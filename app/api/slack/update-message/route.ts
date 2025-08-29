import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { WebClient } from '@slack/web-api'

// Cache du token bot
let botTokenCache: { token: string | null; expiresAt: number } = {
  token: null,
  expiresAt: 0
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // Vérifier l'authentification
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    
    // Récupérer les infos du membre Slack avec nom et prénom
    const { data: member } = await supabase
      .from('members')
      .select('slack_user_id, first_name, last_name')
      .eq('user_id', user.id)
      .single()
    
    if (!member?.slack_user_id) {
      return NextResponse.json({ error: 'Compte Slack non connecté' }, { status: 400 })
    }
    
    const { channel, timestamp, text } = await request.json()
    
    if (!channel || !timestamp || !text) {
      return NextResponse.json({ error: 'Canal, timestamp et texte requis' }, { status: 400 })
    }
    
    console.log('Tentative de modification du message:', {
      channel,
      timestamp,
      textLength: text.length,
      userId: member.slack_user_id
    })
    
    // Récupérer le token bot depuis le cache ou la base de données
    let botToken: string | null = null
    
    if (botTokenCache.token && botTokenCache.expiresAt > Date.now()) {
      botToken = botTokenCache.token
    } else {
      const { data: botTokenSetting } = await supabase
        .from('app_settings')
        .select('setting_value')
        .eq('setting_key', 'slack_bot_token')
        .single()
      
      if (!botTokenSetting?.setting_value) {
        return NextResponse.json({ error: 'Bot Slack non configuré' }, { status: 500 })
      }
      
      botToken = botTokenSetting.setting_value
      botTokenCache = {
        token: botToken,
        expiresAt: Date.now() + (60 * 60 * 1000) // 1 heure
      }
    }
    
    if (!botToken) {
      return NextResponse.json({ error: 'Configuration Slack manquante' }, { status: 500 })
    }
    
    const slack = new WebClient(botToken)
    
    // D'abord, essayer de récupérer le message original pour vérifier qu'il existe et qu'on peut le modifier
    try {
      const historyResult = await slack.conversations.history({
        channel,
        latest: timestamp,
        inclusive: true,
        limit: 1
      })
      
      if (!historyResult.messages || historyResult.messages.length === 0) {
        console.error('Message non trouvé dans l\'historique:', timestamp)
        return NextResponse.json(
          { error: 'Message introuvable dans l\'historique Slack' },
          { status: 404 }
        )
      }
      
      const originalMessage = historyResult.messages[0]
      console.log('Message original trouvé:', {
        ts: originalMessage.ts,
        bot_id: originalMessage.bot_id,
        user: originalMessage.user,
        text_preview: originalMessage.text?.substring(0, 100)
      })
      
      // Vérifier si le message provient bien de notre bot
      // Le message doit avoir bot_id OU être du type bot_message
      if (!originalMessage.bot_id && originalMessage.subtype !== 'bot_message') {
        console.error('Le message n\'a pas été envoyé par le bot:', {
          bot_id: originalMessage.bot_id,
          subtype: originalMessage.subtype,
          user: originalMessage.user
        })
        return NextResponse.json(
          { error: 'Vous ne pouvez modifier que les messages envoyés via l\'application' },
          { status: 403 }
        )
      }
    } catch (historyError: any) {
      console.error('Erreur lors de la récupération du message:', historyError)
      return NextResponse.json(
        { error: 'Impossible de vérifier le message original' },
        { status: 500 }
      )
    }
    
    // Mettre à jour le message SANS changer la signature
    const result = await slack.chat.update({
      channel,
      ts: timestamp,
      blocks: [
        {
          type: 'context',
          elements: [
            {
              type: 'mrkdwn',
              text: `Envoyé par ${member.first_name} ${member.last_name} • ${member.slack_user_id}`
            }
          ]
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: text
          }
        }
      ],
      // Fallback text pour les notifications et anciens clients
      text: `_Envoyé par ${member.first_name} ${member.last_name} (${member.slack_user_id})_\n${text}`
    })
    
    if (!result.ok) {
      throw new Error('Failed to update message')
    }
    
    return NextResponse.json({ ok: true })
  } catch (error: any) {
    console.error('Erreur modification message Slack:', error)
    console.error('Error details:', {
      code: error.code,
      data: error.data,
      message: error.message
    })
    
    // Gestion spécifique des erreurs Slack
    if (error.code === 'slack_webapi_platform_error') {
      const slackError = error.data?.error
      
      if (slackError === 'message_not_found') {
        return NextResponse.json(
          { error: 'Message introuvable. Il se peut que ce message n\'ait pas été envoyé via l\'application.' },
          { status: 404 }
        )
      }
      
      if (slackError === 'cant_update_message') {
        return NextResponse.json(
          { error: 'Vous ne pouvez pas modifier ce message. Seuls les messages envoyés via l\'application peuvent être modifiés.' },
          { status: 403 }
        )
      }
      
      if (slackError === 'edit_window_closed') {
        return NextResponse.json(
          { error: 'Ce message est trop ancien pour être modifié (plus de 48h)' },
          { status: 400 }
        )
      }
      
      if (slackError === 'msg_too_long') {
        return NextResponse.json(
          { error: 'Le message est trop long' },
          { status: 400 }
        )
      }
      
      return NextResponse.json(
        { error: `Erreur Slack: ${slackError}` },
        { status: 400 }
      )
    }
    
    if (error.code === 'cant_update_message') {
      return NextResponse.json(
        { error: 'Vous ne pouvez pas modifier ce message' },
        { status: 403 }
      )
    }
    
    if (error.code === 'message_not_found') {
      return NextResponse.json(
        { error: 'Message introuvable' },
        { status: 404 }
      )
    }
    
    if (error.code === 'is_inactive') {
      return NextResponse.json(
        { error: 'Message trop ancien pour être modifié' },
        { status: 400 }
      )
    }
    
    return NextResponse.json(
      { error: error.message || 'Erreur lors de la modification du message' },
      { status: 500 }
    )
  }
}