import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { addUserToChannel, removeUserFromChannel } from '@/lib/slack/helpers';

// POST - Ajouter un membre à un canal
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
    const { channelId, userId, groupId } = await request.json();

    if (!channelId || !userId) {
      return NextResponse.json(
        { error: 'Missing channelId or userId' },
        { status: 400 }
      );
    }

    // Récupérer le slack_user_id du membre
    const { data: targetMember } = await supabase
      .from('members')
      .select('slack_user_id')
      .eq('user_id', userId)
      .single();

    if (!targetMember?.slack_user_id) {
      return NextResponse.json(
        { error: 'User not connected to Slack' },
        { status: 400 }
      );
    }

    // Ajouter l'utilisateur au canal
    const success = await addUserToChannel(channelId, targetMember.slack_user_id);

    if (success) {
      // Logger l'activité
      await supabase
        .from('slack_activity_log')
        .insert({
          user_id: user.id,
          action_type: 'user_added',
          group_id: groupId,
          slack_channel_id: channelId,
          slack_user_id: targetMember.slack_user_id,
          details: {
            added_user_id: userId,
            added_at: new Date().toISOString(),
          },
        });
    }

    return NextResponse.json({ success });
  } catch (error) {
    console.error('Error adding user to channel:', error);
    return NextResponse.json(
      { error: 'Failed to add user to channel' },
      { status: 500 }
    );
  }
}

// DELETE - Retirer un membre d'un canal
export async function DELETE(request: NextRequest) {
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
    const { channelId, userId, groupId } = await request.json();

    if (!channelId || !userId) {
      return NextResponse.json(
        { error: 'Missing channelId or userId' },
        { status: 400 }
      );
    }

    // Récupérer le slack_user_id du membre
    const { data: targetMember } = await supabase
      .from('members')
      .select('slack_user_id')
      .eq('user_id', userId)
      .single();

    if (!targetMember?.slack_user_id) {
      return NextResponse.json(
        { error: 'User not connected to Slack' },
        { status: 400 }
      );
    }

    // Retirer l'utilisateur du canal
    const success = await removeUserFromChannel(channelId, targetMember.slack_user_id);

    if (success) {
      // Logger l'activité
      await supabase
        .from('slack_activity_log')
        .insert({
          user_id: user.id,
          action_type: 'user_removed',
          group_id: groupId,
          slack_channel_id: channelId,
          slack_user_id: targetMember.slack_user_id,
          details: {
            removed_user_id: userId,
            removed_at: new Date().toISOString(),
          },
        });
    }

    return NextResponse.json({ success });
  } catch (error) {
    console.error('Error removing user from channel:', error);
    return NextResponse.json(
      { error: 'Failed to remove user from channel' },
      { status: 500 }
    );
  }
}

// PUT - Synchroniser tous les membres d'un groupe avec un canal
export async function PUT(request: NextRequest) {
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
    const { channelId, groupId } = await request.json();

    if (!channelId || !groupId) {
      return NextResponse.json(
        { error: 'Missing channelId or groupId' },
        { status: 400 }
      );
    }

    // Récupérer tous les membres du groupe connectés à Slack
    const { data: members } = await supabase
      .from('user_groups')
      .select(`
        user_id,
        members!inner (
          slack_user_id
        )
      `)
      .eq('group_id', groupId)
      .not('members.slack_user_id', 'is', null);

    if (!members) {
      return NextResponse.json({ 
        success: true, 
        added: 0,
        errors: 0,
      });
    }

    let added = 0;
    let errors = 0;

    // Ajouter chaque membre au canal
    for (const groupMember of members) {
      if (groupMember.members?.slack_user_id) {
        try {
          const success = await addUserToChannel(channelId, groupMember.members.slack_user_id);
          if (success) added++;
        } catch (error) {
          console.error(`Failed to add user ${groupMember.members.slack_user_id}:`, error);
          errors++;
        }
      }
    }

    // Logger l'activité
    await supabase
      .from('slack_activity_log')
      .insert({
        user_id: user.id,
        action_type: 'channel_sync',
        group_id: groupId,
        slack_channel_id: channelId,
        details: {
          members_added: added,
          errors,
          synced_at: new Date().toISOString(),
        },
      });

    return NextResponse.json({ 
      success: true,
      added,
      errors,
    });
  } catch (error) {
    console.error('Error syncing channel members:', error);
    return NextResponse.json(
      { error: 'Failed to sync channel members' },
      { status: 500 }
    );
  }
}