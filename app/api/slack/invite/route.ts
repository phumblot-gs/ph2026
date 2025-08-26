import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { slackBotClient } from '@/lib/slack/client';

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      { error: 'Not authenticated' },
      { status: 401 }
    );
  }

  try {
    // Récupérer l'email de l'utilisateur
    const { data: member } = await supabase
      .from('members')
      .select('email')
      .eq('user_id', user.id)
      .single();

    if (!member?.email) {
      return NextResponse.json(
        { error: 'Email not found' },
        { status: 400 }
      );
    }

    if (!slackBotClient) {
      return NextResponse.json(
        { error: 'Slack not configured' },
        { status: 500 }
      );
    }

    // Envoyer une invitation par email
    // Note: Cette API nécessite le scope admin.invites:write
    // On doit fournir au moins un canal, on utilise le canal général #tous-nous-parisiens
    const result = await slackBotClient.admin.users.invite({
      channel_ids: ['C09BSD59352'], // Canal #tous-nous-parisiens obligatoire
      email: member.email,
      team_id: process.env.NEXT_PUBLIC_SLACK_TEAM_ID!,
      custom_message: `Bienvenue sur l'espace Slack de ${process.env.NEXT_PUBLIC_PARTY_NAME} ! Cliquez sur le lien ci-dessous pour rejoindre notre équipe.`,
    });

    if (!result.ok) {
      console.error('Slack invite error:', result.error);
      
      // Si l'utilisateur est déjà invité ou membre
      if (result.error === 'already_invited' || result.error === 'already_in_team') {
        return NextResponse.json({
          success: true,
          message: 'Vous avez déjà été invité ou êtes déjà membre du workspace',
          alreadyInvited: true
        });
      }
      
      return NextResponse.json(
        { error: result.error || 'Failed to send invitation' },
        { status: 400 }
      );
    }

    // Logger l'activité
    await supabase
      .from('slack_activity_log')
      .insert({
        user_id: user.id,
        action_type: 'invite_sent',
        details: {
          email: member.email,
        },
      });

    return NextResponse.json({
      success: true,
      message: 'Une invitation a été envoyée à votre adresse email'
    });
  } catch (error: any) {
    console.error('Error sending Slack invitation:', error);
    
    // Gérer les erreurs spécifiques
    if (error.data?.error === 'missing_scope') {
      return NextResponse.json(
        { error: 'Le bot n\'a pas les permissions pour envoyer des invitations' },
        { status: 403 }
      );
    }
    
    return NextResponse.json(
      { error: 'Failed to send invitation' },
      { status: 500 }
    );
  }
}