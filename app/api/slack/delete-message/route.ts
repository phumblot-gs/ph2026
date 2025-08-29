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
      .select('slack_user_id')
      .eq('user_id', user.id)
      .single()
    
    if (!member?.slack_user_id) {
      return NextResponse.json({ error: 'Compte Slack non connecté' }, { status: 400 })
    }
    
    const { channel, timestamp } = await request.json()
    
    if (!channel || !timestamp) {
      return NextResponse.json({ error: 'Canal et timestamp requis' }, { status: 400 })
    }
    
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
    
    // Supprimer le message
    const result = await slack.chat.delete({
      channel,
      ts: timestamp
    })
    
    if (!result.ok) {
      throw new Error('Failed to delete message')
    }
    
    return NextResponse.json({ ok: true })
  } catch (error: any) {
    console.error('Erreur suppression message Slack:', error)
    
    // Gestion spécifique des erreurs Slack
    if (error.code === 'cant_delete_message') {
      return NextResponse.json(
        { error: 'Vous ne pouvez pas supprimer ce message' },
        { status: 403 }
      )
    }
    
    if (error.code === 'message_not_found') {
      return NextResponse.json(
        { error: 'Message introuvable' },
        { status: 404 }
      )
    }
    
    return NextResponse.json(
      { error: error.message || 'Erreur lors de la suppression du message' },
      { status: 500 }
    )
  }
}