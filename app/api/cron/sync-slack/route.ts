import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { WebClient } from '@slack/web-api'
import { headers } from 'next/headers'

// Initialiser le client Slack avec le token du bot
const slack = new WebClient(process.env.SLACK_BOT_TOKEN)

// Interface pour les messages Slack
interface SlackMessage {
  type: string
  user?: string
  text?: string
  ts?: string
  thread_ts?: string
  edited?: {
    user: string
    ts: string
  }
}

// GET /api/cron/sync-slack - Endpoint pour le cron job
export async function GET(request: NextRequest) {
  try {
    // Vérifier l'autorisation pour les cron jobs
    // En production, Vercel ajoute un header d'autorisation pour les cron jobs
    const headersList = await headers()
    const authHeader = headersList.get('authorization')
    
    // En développement, on peut bypasser la vérification
    if (process.env.NODE_ENV === 'production') {
      if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        console.error('[Cron] Tentative non autorisée d\'accès au cron job')
        return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
      }
    }

    console.log('[Cron] Début de la synchronisation Slack')
    const startTime = Date.now()
    
    // Utiliser le client service pour avoir les permissions admin
    const supabase = createServiceClient()
    
    // Récupérer tous les groupes avec un canal Slack configuré
    const { data: groups, error: groupsError } = await supabase
      .from('groups')
      .select('id, name, slack_channel_id')
      .not('slack_channel_id', 'is', null)
    
    if (groupsError) {
      console.error('[Cron] Erreur récupération des groupes:', groupsError)
      return NextResponse.json({ 
        error: 'Erreur récupération des groupes',
        details: groupsError 
      }, { status: 500 })
    }
    
    if (!groups || groups.length === 0) {
      console.log('[Cron] Aucun groupe avec Slack configuré')
      return NextResponse.json({ 
        message: 'Aucun groupe avec Slack configuré',
        synced: 0 
      })
    }
    
    console.log(`[Cron] ${groups.length} groupe(s) à synchroniser`)
    
    let totalSynced = 0
    const syncResults = []
    
    // Synchroniser chaque groupe
    for (const group of groups) {
      try {
        console.log(`[Cron] Synchronisation du groupe ${group.name} (${group.id})`)
        
        // Récupérer le timestamp du dernier message synchronisé pour ce groupe
        const { data: lastMessage } = await supabase
          .from('chat_messages')
          .select('slack_ts, created_at')
          .eq('group_id', group.id)
          .eq('is_from_slack', true)
          .order('created_at', { ascending: false })
          .limit(1)
          .single()
        
        const oldest = lastMessage?.slack_ts || '0'
        console.log(`[Cron] Récupération depuis ${oldest || 'début'} pour le canal ${group.slack_channel_id}`)
        
        // Récupérer les messages Slack
        const result = await slack.conversations.history({
          channel: group.slack_channel_id,
          oldest: oldest,
          limit: 100, // Limiter à 100 messages par sync pour éviter les timeouts
          inclusive: false // Ne pas inclure le message au timestamp 'oldest'
        })
        
        if (!result.messages || result.messages.length === 0) {
          console.log(`[Cron] Aucun nouveau message pour ${group.name}`)
          syncResults.push({
            group: group.name,
            synced: 0
          })
          continue
        }
        
        console.log(`[Cron] ${result.messages.length} messages trouvés pour ${group.name}`)
        
        // Récupérer les infos des utilisateurs Slack
        const slackUserIds = [...new Set(result.messages.map(m => m.user).filter(Boolean))]
        const userMapping = new Map<string, string>() // slack_user_id -> user_id
        
        // Mapper les utilisateurs Slack aux utilisateurs locaux
        const { data: members } = await supabase
          .from('members')
          .select('user_id, slack_user_id')
          .in('slack_user_id', slackUserIds)
        
        members?.forEach(member => {
          if (member.slack_user_id) {
            userMapping.set(member.slack_user_id, member.user_id)
          }
        })
        
        // Préparer les messages pour l'insertion
        const messagesToInsert = []
        
        for (const slackMsg of result.messages as SlackMessage[]) {
          // Ignorer les messages sans utilisateur ou sans texte
          if (!slackMsg.user || !slackMsg.text || !slackMsg.ts) continue
          
          // Ignorer les messages de bots (sauf notre bot pour les messages des utilisateurs)
          if (slackMsg.type !== 'message') continue
          
          // Mapper l'utilisateur Slack à un utilisateur local
          const userId = userMapping.get(slackMsg.user)
          
          // Si on ne trouve pas l'utilisateur local, on peut quand même stocker le message
          // avec le slack_user_id pour référence future
          
          const messageData = {
            group_id: group.id,
            user_id: userId || null, // null si pas d'utilisateur local correspondant
            text: slackMsg.text,
            formatted_text: slackMsg.text, // On pourrait formater le texte Slack ici
            created_at: new Date(parseFloat(slackMsg.ts) * 1000).toISOString(),
            updated_at: new Date(parseFloat(slackMsg.ts) * 1000).toISOString(),
            edited_at: slackMsg.edited ? new Date(parseFloat(slackMsg.edited.ts) * 1000).toISOString() : null,
            thread_ts: slackMsg.thread_ts || null,
            slack_ts: slackMsg.ts,
            slack_user_id: slackMsg.user,
            slack_channel_id: group.slack_channel_id,
            is_from_slack: true,
            slack_sync_status: 'synced'
          }
          
          messagesToInsert.push(messageData)
        }
        
        if (messagesToInsert.length > 0) {
          // D'abord, vérifier quels messages existent déjà
          const slackTimestamps = messagesToInsert.map(m => m.slack_ts)
          const { data: existingMessages } = await supabase
            .from('chat_messages')
            .select('slack_ts')
            .in('slack_ts', slackTimestamps)
          
          const existingTs = new Set(existingMessages?.map(m => m.slack_ts) || [])
          const newMessages = messagesToInsert.filter(m => !existingTs.has(m.slack_ts))
          
          if (newMessages.length === 0) {
            console.log(`[Cron] Tous les messages existent déjà pour ${group.name}`)
            syncResults.push({
              group: group.name,
              synced: 0
            })
            continue
          }
          
          // Insérer seulement les nouveaux messages avec insert (pas upsert)
          const { data: inserted, error: insertError } = await supabase
            .from('chat_messages')
            .insert(newMessages)
            .select()
          
          if (insertError) {
            console.error(`[Cron] Erreur insertion messages pour ${group.name}:`, insertError)
            syncResults.push({
              group: group.name,
              synced: 0,
              error: insertError.message
            })
          } else {
            const syncedCount = inserted?.length || 0
            totalSynced += syncedCount
            console.log(`[Cron] ${syncedCount} messages synchronisés pour ${group.name}`)
            syncResults.push({
              group: group.name,
              synced: syncedCount
            })
          }
        } else {
          syncResults.push({
            group: group.name,
            synced: 0
          })
        }
        
      } catch (error) {
        console.error(`[Cron] Erreur sync groupe ${group.name}:`, error)
        syncResults.push({
          group: group.name,
          synced: 0,
          error: error instanceof Error ? error.message : 'Erreur inconnue'
        })
      }
    }
    
    const duration = Date.now() - startTime
    console.log(`[Cron] Synchronisation terminée en ${duration}ms - Total: ${totalSynced} messages`)
    
    return NextResponse.json({
      success: true,
      totalSynced,
      duration,
      results: syncResults,
      timestamp: new Date().toISOString()
    })
    
  } catch (error) {
    console.error('[Cron] Erreur globale:', error)
    return NextResponse.json({ 
      error: 'Erreur lors de la synchronisation',
      details: error instanceof Error ? error.message : 'Erreur inconnue'
    }, { status: 500 })
  }
}

// POST pour tests manuels en développement
export async function POST(request: NextRequest) {
  // Autoriser seulement en développement
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })
  }
  
  return GET(request)
}