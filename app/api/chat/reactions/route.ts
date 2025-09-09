import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { WebClient } from '@slack/web-api'

// POST /api/chat/reactions - Ajouter une réaction
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // Vérifier l'authentification
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    
    const body = await request.json()
    const { message_id, emoji, emoji_name } = body
    
    if (!message_id || !emoji) {
      return NextResponse.json({ error: 'message_id et emoji requis' }, { status: 400 })
    }
    
    // Vérifier que le message existe
    const { data: message } = await supabase
      .from('chat_messages')
      .select('id, group_id, slack_ts, slack_channel_id')
      .eq('id', message_id)
      .single()
    
    if (!message) {
      return NextResponse.json({ error: 'Message non trouvé' }, { status: 404 })
    }
    
    // Vérifier que l'utilisateur a accès au groupe
    const { data: userGroup } = await supabase
      .from('user_groups')
      .select('id')
      .eq('user_id', user.id)
      .eq('group_id', message.group_id)
      .single()
    
    if (!userGroup) {
      return NextResponse.json({ error: 'Accès refusé au groupe' }, { status: 403 })
    }
    
    // Ajouter la réaction
    const { data: reaction, error } = await supabase
      .from('chat_reactions')
      .insert({
        message_id,
        user_id: user.id,
        emoji,
        emoji_name: emoji_name || null,
        is_from_slack: false
      })
      .select()
      .single()
    
    if (error) {
      // Si l'erreur est une contrainte unique, la réaction existe déjà
      if (error.code === '23505') {
        return NextResponse.json({ error: 'Réaction déjà ajoutée' }, { status: 400 })
      }
      console.error('Erreur ajout réaction:', error)
      return NextResponse.json({ error: 'Erreur lors de l\'ajout de la réaction' }, { status: 500 })
    }
    
    // Synchroniser avec Slack si le message est synchronisé
    if (message.slack_ts && message.slack_channel_id) {
      syncReactionToSlack(
        message.slack_channel_id,
        message.slack_ts,
        emoji_name || emoji,
        'add'
      ).catch(err => console.error('Erreur sync réaction Slack:', err))
    }
    
    return NextResponse.json({ reaction })
    
  } catch (error) {
    console.error('Erreur API add reaction:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// DELETE /api/chat/reactions - Retirer une réaction
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // Vérifier l'authentification
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    
    const searchParams = request.nextUrl.searchParams
    const messageId = searchParams.get('message_id')
    const emoji = searchParams.get('emoji')
    
    if (!messageId || !emoji) {
      return NextResponse.json({ error: 'message_id et emoji requis' }, { status: 400 })
    }
    
    // Récupérer la réaction et vérifier les infos Slack
    const { data: reaction } = await supabase
      .from('chat_reactions')
      .select(`
        id,
        emoji_name,
        message:chat_messages!message_id (
          slack_ts,
          slack_channel_id
        )
      `)
      .eq('message_id', messageId)
      .eq('user_id', user.id)
      .eq('emoji', emoji)
      .single()
    
    if (!reaction) {
      return NextResponse.json({ error: 'Réaction non trouvée' }, { status: 404 })
    }
    
    // Supprimer la réaction
    const { error } = await supabase
      .from('chat_reactions')
      .delete()
      .eq('id', reaction.id)
    
    if (error) {
      console.error('Erreur suppression réaction:', error)
      return NextResponse.json({ error: 'Erreur lors de la suppression' }, { status: 500 })
    }
    
    // Synchroniser avec Slack si le message est synchronisé
    const message = reaction.message as any
    if (message?.slack_ts && message?.slack_channel_id) {
      syncReactionToSlack(
        message.slack_channel_id,
        message.slack_ts,
        reaction.emoji_name || emoji,
        'remove'
      ).catch(err => console.error('Erreur sync suppression réaction Slack:', err))
    }
    
    return NextResponse.json({ success: true })
    
  } catch (error) {
    console.error('Erreur API remove reaction:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// GET /api/chat/reactions - Récupérer les réactions d'un message
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // Vérifier l'authentification
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    
    const searchParams = request.nextUrl.searchParams
    const messageId = searchParams.get('message_id')
    
    if (!messageId) {
      return NextResponse.json({ error: 'message_id requis' }, { status: 400 })
    }
    
    // Vérifier l'accès au message
    const { data: message } = await supabase
      .from('chat_messages')
      .select(`
        id,
        groups!inner (
          user_groups!inner (
            user_id
          )
        )
      `)
      .eq('id', messageId)
      .eq('groups.user_groups.user_id', user.id)
      .single()
    
    if (!message) {
      return NextResponse.json({ error: 'Message non trouvé ou accès refusé' }, { status: 404 })
    }
    
    // Récupérer les réactions avec les infos utilisateurs
    const { data: reactions, error } = await supabase
      .from('chat_reactions')
      .select(`
        id,
        emoji,
        emoji_name,
        created_at,
        user_id,
        member:members!user_id (
          first_name,
          last_name,
          photo_url
        )
      `)
      .eq('message_id', messageId)
      .order('created_at', { ascending: true })
    
    if (error) {
      console.error('Erreur récupération réactions:', error)
      return NextResponse.json({ error: 'Erreur lors de la récupération' }, { status: 500 })
    }
    
    // Grouper par emoji
    const groupedReactions = reactions?.reduce((acc: any, reaction: any) => {
      if (!acc[reaction.emoji]) {
        acc[reaction.emoji] = {
          emoji: reaction.emoji,
          emoji_name: reaction.emoji_name,
          users: [],
          count: 0
        }
      }
      acc[reaction.emoji].users.push({
        id: reaction.user_id,
        name: reaction.member ? `${reaction.member.first_name} ${reaction.member.last_name}` : 'Utilisateur',
        photo_url: reaction.member?.photo_url
      })
      acc[reaction.emoji].count++
      return acc
    }, {})
    
    return NextResponse.json({ 
      reactions: groupedReactions ? Object.values(groupedReactions) : []
    })
    
  } catch (error) {
    console.error('Erreur API get reactions:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// Fonction helper pour synchroniser avec Slack
async function syncReactionToSlack(
  channelId: string, 
  timestamp: string, 
  emoji: string, 
  action: 'add' | 'remove'
) {
  try {
    const supabase = await createClient()
    
    // Récupérer le bot token
    const { data: botToken } = await supabase
      .from('app_settings')
      .select('setting_value')
      .eq('setting_key', 'slack_bot_token')
      .single()
    
    if (!botToken?.setting_value) {
      console.log('Bot Slack non configuré, skip sync')
      return
    }
    
    const slack = new WebClient(botToken.setting_value)
    
    // Nettoyer le nom de l'emoji (enlever les : si présents)
    let cleanEmoji = emoji.replace(/^:/, '').replace(/:$/, '')
    
    // Mapping des emojis Unicode vers les noms Slack
    const emojiMap: { [key: string]: string } = {
      '❤️': 'heart',
      '❤': 'heart',
      '👍': 'thumbsup',
      '👎': 'thumbsdown',
      '😂': 'joy',
      '😢': 'sob',
      '😍': 'heart_eyes',
      '😡': 'rage',
      '🎉': 'tada',
      '🔥': 'fire',
      '💯': '100',
      '✅': 'white_check_mark',
      '❌': 'x',
      '⭐': 'star',
      '💪': 'muscle'
    }
    
    // Si c'est un emoji Unicode, le convertir en nom Slack
    if (emojiMap[cleanEmoji]) {
      cleanEmoji = emojiMap[cleanEmoji]
    }
    
    // Valider que le nom ne contient que des caractères autorisés (lettres, chiffres, underscore)
    if (!/^[a-zA-Z0-9_+-]+$/.test(cleanEmoji)) {
      console.log(`Emoji non valide pour Slack: "${cleanEmoji}", skip sync`)
      return
    }
    
    if (action === 'add') {
      await slack.reactions.add({
        channel: channelId,
        timestamp: timestamp,
        name: cleanEmoji
      })
    } else {
      await slack.reactions.remove({
        channel: channelId,
        timestamp: timestamp,
        name: cleanEmoji
      })
    }
  } catch (error: any) {
    // Si l'erreur est "already_reacted" ou "no_reaction", c'est OK
    if (error?.data?.error === 'already_reacted' || error?.data?.error === 'no_reaction') {
      return
    }
    throw error
  }
}