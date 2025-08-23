import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

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
    // Récupérer les infos Slack actuelles
    const { data: member } = await supabase
      .from('members')
      .select('slack_user_id')
      .eq('user_id', user.id)
      .single();

    // Mettre à jour le membre pour supprimer les infos Slack
    const { error: updateError } = await supabase
      .from('members')
      .update({
        slack_user_id: null,
        slack_access_token: null,
        slack_connected_at: null,
      })
      .eq('user_id', user.id);

    if (updateError) {
      throw updateError;
    }

    // Logger l'activité
    await supabase
      .from('slack_activity_log')
      .insert({
        user_id: user.id,
        action_type: 'disconnect',
        slack_user_id: member?.slack_user_id,
        details: {
          disconnected_at: new Date().toISOString(),
        },
      });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error disconnecting from Slack:', error);
    return NextResponse.json(
      { error: 'Failed to disconnect from Slack' },
      { status: 500 }
    );
  }
}