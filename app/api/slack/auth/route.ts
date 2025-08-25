import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // Construire l'URL d'autorisation Slack manuellement
  const scopes = [
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
  ];

  const userScopes = [
    'identity.basic',
    'identity.email', 
    'identity.avatar',
  ];

  const state = Buffer.from(JSON.stringify({
    userId: user.id,
    timestamp: Date.now()
  })).toString('base64');

  const params = new URLSearchParams({
    client_id: process.env.SLACK_CLIENT_ID!,
    scope: scopes.join(','),
    user_scope: userScopes.join(','),
    redirect_uri: process.env.NEXT_PUBLIC_SLACK_REDIRECT_URI!,
    state: state,
  });

  // Utiliser le domaine du workspace pour éviter la page de sélection
  const teamDomain = process.env.NEXT_PUBLIC_SLACK_TEAM_DOMAIN || 'nousparisiens';
  const authUrl = `https://${teamDomain}.slack.com/oauth/v2/authorize?${params.toString()}`;

  // Rediriger vers Slack pour l'authentification
  return NextResponse.redirect(authUrl);
}