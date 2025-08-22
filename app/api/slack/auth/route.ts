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
    const authUrl = await slackOAuthProvider.generateInstallUrl({
      scopes: [
        'identity.basic',
        'identity.email',
        'identity.avatar',
        'channels:read',
        'groups:read',
        'channels:history',
        'groups:history',
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