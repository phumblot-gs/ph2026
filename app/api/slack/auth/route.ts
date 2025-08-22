import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { slackOAuthProvider } from '@/lib/slack/client';

export async function GET(request: NextRequest) {
  if (!slackOAuthProvider) {
    return NextResponse.json(
      { error: 'Slack not configured' },
      { status: 500 }
    );
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  try {
    // Générer l'URL d'autorisation Slack
    // Note: Les scopes admin ne sont pas inclus car ils nécessitent un workspace payant
    const authUrl = await slackOAuthProvider.generateInstallUrl({
      scopes: [
        'channels:manage',      // Créer et gérer les canaux
        'channels:read',        // Lire les infos des canaux  
        'channels:history',     // Lire l'historique
        'groups:read',          // Lire les canaux privés
        'groups:write',         // Gérer les canaux privés
        'groups:history',       // Historique canaux privés
        'users:read',           // Lire les infos utilisateurs
        'users:read.email',     // Lire les emails
        'chat:write',           // Envoyer des messages
        'im:write',            // Messages directs
      ],
      redirectUri: process.env.NEXT_PUBLIC_SLACK_REDIRECT_URI,
      userScopes: [
        'identity.basic',
        'identity.email', 
        'identity.avatar',
      ],
      metadata: JSON.stringify({ userId: user.id }),
    });

    // Rediriger vers Slack pour l'authentification
    return NextResponse.redirect(authUrl);
  } catch (error) {
    console.error('Error generating Slack auth URL:', error);
    return NextResponse.json(
      { error: 'Failed to initiate Slack authentication' },
      { status: 500 }
    );
  }
}