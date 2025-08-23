import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getChannelMessages } from '@/lib/slack/helpers';

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      { error: 'Non authentifié' },
      { status: 401 }
    );
  }

  const searchParams = request.nextUrl.searchParams;
  const channelId = searchParams.get('channelId');
  const limit = parseInt(searchParams.get('limit') || '10');

  if (!channelId) {
    return NextResponse.json(
      { error: 'channelId requis' },
      { status: 400 }
    );
  }

  // Vérifier que l'utilisateur est membre du groupe associé à ce canal
  const { data: group } = await supabase
    .from('groups')
    .select('id')
    .eq('slack_channel_id', channelId)
    .single();

  if (!group) {
    return NextResponse.json(
      { error: 'Canal non trouvé' },
      { status: 404 }
    );
  }

  const { data: userGroup } = await supabase
    .from('user_groups')
    .select('group_id')
    .eq('user_id', user.id)
    .eq('group_id', group.id)
    .single();

  if (!userGroup) {
    return NextResponse.json(
      { error: 'Accès non autorisé à ce canal' },
      { status: 403 }
    );
  }

  // Vérifier que l'utilisateur est connecté à Slack
  const { data: member } = await supabase
    .from('members')
    .select('slack_user_id, slack_access_token')
    .eq('user_id', user.id)
    .single();

  if (!member?.slack_user_id) {
    return NextResponse.json(
      { error: 'Non connecté à Slack' },
      { status: 400 }
    );
  }

  try {
    // Récupérer les messages du canal
    const messages = await getChannelMessages(channelId, limit);

    if (!messages) {
      return NextResponse.json(
        { error: 'Impossible de récupérer les messages' },
        { status: 500 }
      );
    }

    return NextResponse.json({ messages });
  } catch (error) {
    console.error('Error fetching Slack messages:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la récupération des messages' },
      { status: 500 }
    );
  }
}