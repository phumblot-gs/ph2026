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
    
    // Récupérer les infos du membre Slack
    const { data: member } = await supabase
      .from('members')
      .select('slack_user_id, slack_access_token')
      .eq('user_id', user.id)
      .single()
    
    if (!member?.slack_user_id) {
      return NextResponse.json({ error: 'Compte Slack non connecté' }, { status: 400 })
    }
    
    const { channel, timestamp, emoji } = await request.json()
    
    if (!channel || !timestamp || !emoji) {
      return NextResponse.json({ error: 'Canal, timestamp et emoji requis' }, { status: 400 })
    }
    
    // Utiliser le token bot pour les réactions
    let token: string | null = null
    
    // Récupérer le token bot depuis le cache ou la base de données
    if (botTokenCache.token && botTokenCache.expiresAt > Date.now()) {
      token = botTokenCache.token
    } else {
      const { data: botTokenSetting } = await supabase
        .from('app_settings')
        .select('setting_value')
        .eq('setting_key', 'slack_bot_token')
        .single()
      
      if (!botTokenSetting?.setting_value) {
        return NextResponse.json({ error: 'Bot Slack non configuré' }, { status: 500 })
      }
      
      token = botTokenSetting.setting_value
      botTokenCache = {
        token: token,
        expiresAt: Date.now() + (60 * 60 * 1000) // 1 heure
      }
    }
    
    if (!token) {
      return NextResponse.json({ error: 'Configuration Slack manquante' }, { status: 500 })
    }
    
    const slack = new WebClient(token)
    
    // Retirer la réaction
    const result = await slack.reactions.remove({
      channel,
      timestamp,
      name: emoji // Le nom de l'emoji sans les :
    })
    
    if (!result.ok) {
      throw new Error('Failed to remove reaction')
    }
    
    return NextResponse.json({ ok: true })
  } catch (error: any) {
    console.error('Erreur suppression réaction Slack:', error)
    
    // Gestion spécifique des erreurs Slack
    if (error.code === 'slack_webapi_platform_error') {
      const slackError = error.data?.error
      
      if (slackError === 'no_reaction') {
        return NextResponse.json(
          { error: 'Vous n\'avez pas ajouté cette réaction' },
          { status: 400 }
        )
      }
      
      if (slackError === 'invalid_name') {
        return NextResponse.json(
          { error: 'Emoji invalide' },
          { status: 400 }
        )
      }
      
      if (slackError === 'message_not_found') {
        return NextResponse.json(
          { error: 'Message introuvable' },
          { status: 404 }
        )
      }
      
      return NextResponse.json(
        { error: `Erreur Slack: ${slackError}` },
        { status: 400 }
      )
    }
    
    return NextResponse.json(
      { error: error.message || 'Erreur lors de la suppression de la réaction' },
      { status: 500 }
    )
  }
}