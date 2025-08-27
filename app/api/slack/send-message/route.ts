import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { WebClient } from '@slack/web-api'

// Cache du token du bot avec TTL de 1 heure
let botTokenCache: {
  token: string | null
  expiresAt: number
} = {
  token: null,
  expiresAt: 0
}

// Fonction pour invalider le cache (utile si le token est mis à jour)
function invalidateBotTokenCache() {
  botTokenCache = {
    token: null,
    expiresAt: 0
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    
    // Get user's Slack info
    const { data: member } = await supabase
      .from('members')
      .select('slack_user_id, first_name, last_name')
      .eq('user_id', user.id)
      .single()
    
    if (!member?.slack_user_id) {
      return NextResponse.json({ error: 'Compte Slack non connecté' }, { status: 400 })
    }
    
    const { channel, text } = await request.json()
    
    if (!channel || !text) {
      return NextResponse.json({ error: 'Canal et message requis' }, { status: 400 })
    }
    
    // Get bot token from cache or database
    let botToken: string | null = null
    
    // Vérifier si le cache est valide
    if (botTokenCache.token && botTokenCache.expiresAt > Date.now()) {
      botToken = botTokenCache.token
    } else {
      // Récupérer le token depuis la base de données
      const { data: botTokenSetting } = await supabase
        .from('app_settings')
        .select('setting_value')
        .eq('setting_key', 'slack_bot_token')
        .single()
      
      if (!botTokenSetting?.setting_value) {
        return NextResponse.json({ error: 'Bot Slack non configuré' }, { status: 500 })
      }
      
      // Mettre en cache pour 1 heure
      botToken = botTokenSetting.setting_value
      botTokenCache = {
        token: botToken,
        expiresAt: Date.now() + (60 * 60 * 1000) // 1 heure
      }
    }
    
    // Initialize Slack client with bot token
    const slack = new WebClient(botToken || undefined)
    
    // Create message with blocks for better formatting control
    // The signature will appear as muted context text at the beginning
    const result = await slack.chat.postMessage({
      channel,
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
      // Fallback text for notifications and older clients
      text: `_Envoyé par ${member.first_name} ${member.last_name} (${member.slack_user_id})_\n${text}`
    })
    
    if (!result.ok) {
      throw new Error('Failed to send message')
    }
    
    // Trouver le groupe associé à ce canal pour envoyer la notification
    const { data: group } = await supabase
      .from('groups')
      .select('id')
      .eq('slack_channel_id', channel)
      .single()
    
    if (group) {
      // Envoyer une notification broadcast via Supabase Realtime
      const broadcastChannel = supabase.channel(`slack-messages:${group.id}`)
      await broadcastChannel.subscribe()
      
      await broadcastChannel.send({
        type: 'broadcast',
        event: 'new_message',
        payload: {
          channel_id: channel,
          group_id: group.id,
          user_id: user.id,
          timestamp: new Date().toISOString()
        }
      })
      
      // Se désabonner immédiatement après l'envoi
      await supabase.removeChannel(broadcastChannel)
    }
    
    return NextResponse.json({ success: true, ts: result.ts })
  } catch (error: any) {
    console.error('Error sending Slack message:', error)
    console.error('Error code:', error?.code)
    console.error('Error data:', error?.data)
    
    if (error.code === 'slack_webapi_platform_error' && error.data?.error === 'missing_scope') {
      return NextResponse.json({ 
        error: 'Le bot Slack n\'a pas les permissions nécessaires. Vérifiez les scopes: chat:write, chat:write.public' 
      }, { status: 403 })
    }
    
    if (error.code === 'slack_webapi_platform_error' && error.data?.error === 'not_in_channel') {
      return NextResponse.json({ 
        error: 'Le bot doit être invité dans le canal. Tapez /invite @NomDuBot dans le canal Slack.' 
      }, { status: 403 })
    }
    
    if (error.code === 'invalid_auth') {
      // Invalider le cache si le token est invalide
      invalidateBotTokenCache()
      return NextResponse.json({ error: 'Token Slack invalide. Reconnectez votre compte.' }, { status: 401 })
    }
    
    if (error.code === 'channel_not_found') {
      return NextResponse.json({ error: 'Canal Slack introuvable' }, { status: 404 })
    }
    
    return NextResponse.json({ 
      error: error.message || 'Erreur lors de l\'envoi du message',
      details: error.data?.error || error.code
    }, { status: 500 })
  }
}