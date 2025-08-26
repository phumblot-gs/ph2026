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
    const { groupId, name, groupName } = await request.json();
    
    // Support both 'name' and 'groupName' for backward compatibility
    const finalGroupName = name || groupName;

    if (!groupId || !finalGroupName) {
      return NextResponse.json(
        { error: 'Missing groupId or name' },
        { status: 400 }
      );
    }

    // Créer le canal Slack
    const channelName = formatChannelName(finalGroupName);
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
      `🎉 Bienvenue dans le canal *${finalGroupName}* !`,
      [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `Ce canal est dédié aux membres du groupe *${finalGroupName}*.\n\nN'hésitez pas à échanger et partager vos idées !`,
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
          group_name: finalGroupName,
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
  
  console.log(`Adding members to channel ${channelId} for group ${groupId}`);
  
  // Récupérer d'abord les user_ids du groupe
  const { data: userGroups } = await supabase
    .from('user_groups')
    .select('user_id')
    .eq('group_id', groupId);
  
  if (!userGroups || userGroups.length === 0) {
    console.log('No members found in group');
    return;
  }
  
  console.log(`Found ${userGroups.length} members in group`);
  
  // Récupérer les infos des membres avec leur slack_user_id
  const { data: members } = await supabase
    .from('members')
    .select('user_id, first_name, last_name, slack_user_id')
    .in('user_id', userGroups.map(ug => ug.user_id))
    .not('slack_user_id', 'is', null);
  
  if (!members || members.length === 0) {
    console.log('No members with Slack IDs found');
    return;
  }
  
  console.log(`Found ${members.length} members with Slack IDs`);
  
  // Ajouter chaque membre au canal
  for (const member of members) {
    if (member.slack_user_id) {
      try {
        console.log(`Adding ${member.first_name} ${member.last_name} (${member.slack_user_id}) to channel`);
        await addUserToChannel(channelId, member.slack_user_id);
        console.log(`Successfully added ${member.first_name} ${member.last_name}`);
      } catch (error) {
        console.error(`Failed to add user ${member.slack_user_id} to channel:`, error);
      }
    }
  }
}