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

  // Vérifier que l'utilisateur est admin
  const { data: member } = await supabase
    .from('members')
    .select('role')
    .eq('user_id', user.id)
    .single();

  if (member?.role !== 'admin') {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 403 }
    );
  }

  try {
    const { invitationId } = await request.json();

    if (!invitationId) {
      return NextResponse.json(
        { error: 'Missing invitationId' },
        { status: 400 }
      );
    }

    // Marquer l'invitation comme complétée
    const { error: updateError } = await supabase
      .from('slack_invitations')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        completed_by: user.id
      })
      .eq('id', invitationId);

    if (updateError) throw updateError;

    return NextResponse.json({
      success: true,
      message: 'Invitation marquée comme complétée'
    });
  } catch (error) {
    console.error('Error completing Slack invitation:', error);
    return NextResponse.json(
      { error: 'Failed to complete invitation' },
      { status: 500 }
    );
  }
}