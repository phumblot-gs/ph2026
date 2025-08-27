import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { WebClient } from '@slack/web-api';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');

  // Gérer les erreurs d'autorisation
  if (error) {
    console.error('Slack OAuth error:', error);
    return NextResponse.redirect(new URL('/profile?error=slack_auth_denied', request.url));
  }

  if (!code) {
    return NextResponse.redirect(new URL('/profile?error=slack_auth_failed', request.url));
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  try {
    // Échanger le code contre un token directement avec l'API Slack
    const tokenResponse = await fetch('https://slack.com/api/oauth.v2.access', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: process.env.SLACK_CLIENT_ID!,
        client_secret: process.env.SLACK_CLIENT_SECRET!,
        code: code,
        redirect_uri: process.env.NEXT_PUBLIC_SLACK_REDIRECT_URI!,
      }),
    });

    const tokenData = await tokenResponse.json();

    if (!tokenData.ok) {
      console.error('Slack token exchange failed:', tokenData);
      throw new Error(tokenData.error || 'Token exchange failed');
    }

    // Récupérer les informations de l'utilisateur Slack
    const userClient = new WebClient(tokenData.authed_user?.access_token || tokenData.access_token);
    const identityResult = await userClient.users.identity({
      token: tokenData.authed_user?.access_token || tokenData.access_token
    });

    if (!identityResult.ok || !identityResult.user) {
      throw new Error('Failed to get user identity');
    }

    const slackUserId = identityResult.user.id;
    const slackUserToken = tokenData.authed_user?.access_token || tokenData.access_token;
    const slackBotToken = tokenData.access_token; // Bot token is in access_token

    if (!slackUserId) {
      throw new Error('Slack user ID not found');
    }

    // Mettre à jour le membre dans la base de données
    const { error: updateError } = await supabase
      .from('members')
      .update({
        slack_user_id: slackUserId,
        slack_access_token: slackUserToken,
        slack_connected_at: new Date().toISOString(),
      })
      .eq('user_id', user.id);

    if (updateError) {
      console.error('Error updating member with Slack info:', updateError);
      throw updateError;
    }

    // Sauvegarder le bot token dans app_settings si c'est le premier utilisateur ou si le token n'existe pas
    if (slackBotToken && slackBotToken !== slackUserToken) {
      const { data: existingToken } = await supabase
        .from('app_settings')
        .select('setting_value')
        .eq('setting_key', 'slack_bot_token')
        .single();
      
      if (!existingToken) {
        // Créer le setting si il n'existe pas
        await supabase
          .from('app_settings')
          .insert({
            id: crypto.randomUUID(),
            setting_key: 'slack_bot_token',
            setting_value: slackBotToken,
            description: 'Token du bot Slack pour envoyer des messages',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          });
      } else if (!existingToken.setting_value) {
        // Mettre à jour si la valeur est vide
        await supabase
          .from('app_settings')
          .update({
            setting_value: slackBotToken
          })
          .eq('setting_key', 'slack_bot_token');
      }
    }

    // Logger l'activité
    await supabase
      .from('slack_activity_log')
      .insert({
        user_id: user.id,
        action_type: 'connect',
        slack_user_id: slackUserId,
        details: {
          team_id: identityResult.team?.id,
          team_name: identityResult.team?.name,
          user_name: identityResult.user.name,
          user_email: identityResult.user.email,
        },
      });

    // Ajouter l'utilisateur à tous les canaux de ses groupes
    await addUserToGroupChannels(user.id, slackUserId);

    return NextResponse.redirect(new URL('/profile?success=slack_connected', request.url));
  } catch (error) {
    console.error('Error during Slack OAuth callback:', error);
    return NextResponse.redirect(new URL('/profile?error=slack_auth_failed', request.url));
  }
}

/**
 * Ajouter un utilisateur à tous les canaux de ses groupes
 */
async function addUserToGroupChannels(userId: string, slackUserId: string) {
  const supabase = await createClient();
  
  // Récupérer les groupes de l'utilisateur avec leurs canaux Slack
  const { data: userGroups } = await supabase
    .from('user_groups')
    .select(`
      group_id,
      groups (
        id,
        name,
        slack_channel_id
      )
    `)
    .eq('user_id', userId);

  if (!userGroups) return;

  // Importer les helpers après pour éviter les dépendances circulaires
  const { addUserToChannel } = await import('@/lib/slack/helpers');

  // Ajouter l'utilisateur à chaque canal
  for (const userGroup of userGroups) {
    // Supabase retourne un objet unique pour une relation many-to-one
    const group = userGroup.groups as unknown as { id: string; name: string; slack_channel_id: string | null } | null;
    if (group?.slack_channel_id) {
      try {
        await addUserToChannel(group.slack_channel_id, slackUserId);
        console.log(`Added user ${slackUserId} to channel ${group.slack_channel_id}`);
      } catch (error) {
        console.error(`Failed to add user to channel ${group.slack_channel_id}:`, error);
      }
    }
  }
}