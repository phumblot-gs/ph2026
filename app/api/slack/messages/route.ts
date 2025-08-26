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

  // Récupérer les infos du membre (optionnel, juste pour enrichir les données)
  const { data: member } = await supabase
    .from('members')
    .select('slack_user_id, slack_access_token')
    .eq('user_id', user.id)
    .single();

  // On n'exige plus que l'utilisateur soit connecté à Slack
  // Le bot peut lire les messages pour lui

  try {
    // Toujours utiliser le bot token pour lire les messages
    const messages = await getChannelMessages(channelId, limit);

    if (!messages) {
      return NextResponse.json(
        { error: 'Impossible de récupérer les messages' },
        { status: 500 }
      );
    }

    // Récupérer les IDs Slack uniques des messages ET des mentions dans le texte
    const slackUserIds = [...new Set(messages.map(m => m.user).filter(Boolean))];
    
    // Extraire aussi les IDs des mentions <@U...> dans les textes
    const mentionRegex = /<@(U[A-Z0-9]+)>/g;
    messages.forEach(msg => {
      const matches = msg.text?.matchAll(mentionRegex);
      if (matches) {
        for (const match of matches) {
          slackUserIds.push(match[1]);
        }
      }
    });
    
    // Dédupliquer les IDs
    const uniqueSlackUserIds = [...new Set(slackUserIds)];
    
    // Récupérer les membres correspondants dans notre base
    const { data: members } = await supabase
      .from('members')
      .select('slack_user_id, first_name, last_name, avatar_url')
      .in('slack_user_id', uniqueSlackUserIds);
    
    // Créer un map pour associer rapidement les IDs Slack aux membres
    const memberMap = new Map(members?.map(m => [m.slack_user_id, m]) || []);
    
    // Créer un map avec les infos Slack des utilisateurs des messages
    const slackUserInfoMap = new Map();
    for (const msg of messages) {
      if (msg.user_profile) {
        slackUserInfoMap.set(msg.user, msg.user_profile);
      }
    }
    
    // Fonction pour remplacer les mentions dans le texte
    const replaceMentions = (text: string): string => {
      return text.replace(mentionRegex, (match, userId) => {
        // D'abord chercher dans notre base
        const member = memberMap.get(userId);
        if (member) {
          return `${member.first_name} ${member.last_name}`;
        }
        
        // Sinon chercher dans les infos Slack des messages
        const slackInfo = slackUserInfoMap.get(userId);
        if (slackInfo) {
          return slackInfo.real_name || slackInfo.name || match;
        }
        
        // Si toujours pas trouvé, essayer de chercher dans les messages pour cet ID
        const messageFromUser = messages.find(m => m.user === userId);
        if (messageFromUser?.user_profile) {
          return messageFromUser.user_profile.real_name || messageFromUser.user_profile.name || match;
        }
        
        // En dernier recours, garder juste le prénom si possible ou l'ID
        return match;
      });
    };
    
    // Enrichir les messages avec les infos membres
    const enrichedMessages = messages.map(msg => ({
      ...msg,
      member: memberMap.get(msg.user) || null,
      text: replaceMentions(msg.text || ''), // Remplacer les mentions dans le texte
      // Formater correctement le timestamp
      timestamp: msg.ts, // Garder le timestamp Slack original
    }));

    return NextResponse.json({ messages: enrichedMessages });
  } catch (error) {
    console.error('Error fetching Slack messages:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la récupération des messages' },
      { status: 500 }
    );
  }
}