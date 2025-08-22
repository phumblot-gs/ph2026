import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { 
  createSlackChannel, 
  archiveSlackChannel, 
  formatChannelName,
  sendMessageToChannel 
} from '@/lib/slack/helpers';

// POST - Créer un canal pour un groupe
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
    const { groupId, groupName } = await request.json();

    if (!groupId || !groupName) {
      return NextResponse.json(
        { error: 'Missing groupId or groupName' },
        { status: 400 }
      );
    }

    // Créer le canal Slack
    const channelName = formatChannelName(groupName);
    const channelId = await createSlackChannel(channelName, true);

    if (!channelId) {
      throw new Error('Failed to create Slack channel');
    }

    // Mettre à jour le groupe avec l'ID du canal
    const { error: updateError } = await supabase
      .from('groups')
      .update({ slack_channel_id: channelId })
      .eq('id', groupId);

    if (updateError) {
      throw updateError;
    }

    // Envoyer un message de bienvenue
    await sendMessageToChannel(
      channelId,
      `🎉 Bienvenue dans le canal *${groupName}* !`,
      [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `Ce canal est dédié aux membres du groupe *${groupName}*.\n\nN'hésitez pas à échanger et partager vos idées !`,
          },
        },
      ]
    );

    // Logger l'activité
    await supabase
      .from('slack_activity_log')
      .insert({
        user_id: user.id,
        action_type: 'channel_created',
        group_id: groupId,
        slack_channel_id: channelId,
        details: {
          channel_name: channelName,
          group_name: groupName,
        },
      });

    // Ajouter tous les membres connectés à Slack au canal
    await addGroupMembersToChannel(groupId, channelId);

    return NextResponse.json({ 
      success: true, 
      channelId,
      channelName,
    });
  } catch (error) {
    console.error('Error creating Slack channel:', error);
    return NextResponse.json(
      { error: 'Failed to create Slack channel' },
      { status: 500 }
    );
  }
}

// DELETE - Archiver un canal
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
    const { channelId, groupId } = await request.json();

    if (!channelId) {
      return NextResponse.json(
        { error: 'Missing channelId' },
        { status: 400 }
      );
    }

    // Archiver le canal Slack
    const success = await archiveSlackChannel(channelId);

    if (success && groupId) {
      // Mettre à jour le groupe pour retirer l'ID du canal
      await supabase
        .from('groups')
        .update({ slack_channel_id: null })
        .eq('id', groupId);

      // Logger l'activité
      await supabase
        .from('slack_activity_log')
        .insert({
          user_id: user.id,
          action_type: 'channel_deleted',
          group_id: groupId,
          slack_channel_id: channelId,
          details: {
            archived_at: new Date().toISOString(),
          },
        });
    }

    return NextResponse.json({ success });
  } catch (error) {
    console.error('Error archiving Slack channel:', error);
    return NextResponse.json(
      { error: 'Failed to archive Slack channel' },
      { status: 500 }
    );
  }
}

/**
 * Ajouter tous les membres d'un groupe au canal Slack
 */
async function addGroupMembersToChannel(groupId: string, channelId: string) {
  const supabase = await createClient();
  const { addUserToChannel } = await import('@/lib/slack/helpers');
  
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

  if (!members) return;

  // Ajouter chaque membre au canal
  for (const member of members) {
    if (member.members?.slack_user_id) {
      try {
        await addUserToChannel(channelId, member.members.slack_user_id);
      } catch (error) {
        console.error(`Failed to add user ${member.members.slack_user_id} to channel:`, error);
      }
    }
  }
}