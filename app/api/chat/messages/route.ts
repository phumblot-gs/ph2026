import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { WebClient } from '@slack/web-api'
import { Readable } from 'stream'

// Types
interface ChatMessage {
  id: string
  group_id: string
  user_id: string
  text: string
  formatted_text?: string
  created_at: string
  updated_at: string
  deleted_at?: string
  edited_at?: string
  thread_ts?: string
  reply_count: number
  latest_reply_at?: string
  reply_users: string[]
  slack_ts?: string
  slack_user_id?: string
  slack_channel_id?: string
  is_from_slack: boolean
  slack_sync_status: 'pending' | 'synced' | 'failed' | 'none'
  metadata?: any
}

// Fonction helper pour enrichir un message avec ses données associées
async function enrichMessage(msg: any, supabase: any) {
  try {
    // Récupérer les infos du membre
    const { data: member } = await supabase
      .from('members')
      .select('first_name, last_name, photo_url, slack_user_id')
      .eq('user_id', msg.user_id)
      .single()
    
    // Récupérer les fichiers
    const { data: files } = await supabase
      .from('chat_files')
      .select('*')
      .eq('message_id', msg.id)
    
    // Récupérer les réactions
    const { data: reactions } = await supabase
      .from('chat_reactions')
      .select('*')
      .eq('message_id', msg.id)
    
    // Récupérer les mentions
    const { data: mentions } = await supabase
      .from('chat_mentions')
      .select('*')
      .eq('message_id', msg.id)
    
    // Grouper les réactions par emoji
    const reactionGroups = reactions?.reduce((acc: any, reaction: any) => {
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
        name: 'Utilisateur' // Nom par défaut
      })
      acc[reaction.emoji].count++
      return acc
    }, {})
    
    // Si des réactions existent, récupérer les noms des utilisateurs
    if (reactionGroups) {
      for (const emoji in reactionGroups) {
        const userIds = reactionGroups[emoji].users.map((u: any) => u.id)
        const { data: reactionMembers } = await supabase
          .from('members')
          .select('user_id, first_name, last_name')
          .in('user_id', userIds)
        
        if (reactionMembers) {
          reactionGroups[emoji].users = reactionGroups[emoji].users.map((u: any) => {
            const member = reactionMembers.find((m: any) => m.user_id === u.id)
            return {
              id: u.id,
              name: member ? `${member.first_name} ${member.last_name}` : 'Utilisateur'
            }
          })
        }
      }
    }
    
    return {
      ...msg,
      member,
      files: files || [],
      reactions: Object.values(reactionGroups || {}),
      mentions: mentions || []
    }
  } catch (err) {
    // Retourner le message sans enrichissement en cas d'erreur
    return {
      ...msg,
      member: null,
      files: [],
      reactions: [],
      mentions: []
    }
  }
}

// GET /api/chat/messages - Récupérer les messages d'un groupe
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // Vérifier l'authentification
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError) {
      return NextResponse.json({ error: 'Erreur authentification' }, { status: 500 })
    }
    if (!user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    
    // Récupérer les paramètres
    const searchParams = request.nextUrl.searchParams
    const groupId = searchParams.get('group_id')
    const limit = parseInt(searchParams.get('limit') || '50')
    const before = searchParams.get('before') // Message ID pour la pagination
    const threadTs = searchParams.get('thread_ts') // Pour récupérer les réponses d'un thread
    const messageId = searchParams.get('message_id') // Pour récupérer un seul message
    const single = searchParams.get('single') === 'true' // Flag pour récupérer un seul message
    
    if (!groupId) {
      return NextResponse.json({ error: 'group_id requis' }, { status: 400 })
    }
    
    // Vérifier que l'utilisateur appartient au groupe
    const { data: membership, error: membershipError } = await supabase
      .from('user_groups')
      .select('group_id')
      .eq('user_id', user.id)
      .eq('group_id', groupId)
      .single()
    
    if (membershipError && membershipError.code !== 'PGRST116') {
      return NextResponse.json({ error: 'Erreur vérification accès' }, { status: 500 })
    }
    
    if (!membership) {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 })
    }
    
    // Si on demande un seul message
    if (single && messageId) {
      const { data: message, error } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('id', messageId)
        .eq('group_id', groupId)
        .single()
      
      if (error || !message) {
        return NextResponse.json({ error: 'Message non trouvé' }, { status: 404 })
      }
      
      // Enrichir le message avec les données associées
      const formattedMessage = await enrichMessage(message, supabase)
      
      return NextResponse.json({ message: formattedMessage })
    }
    
    // Construire la requête pour les messages - simplifiée d'abord
    let query = supabase
      .from('chat_messages')
      .select('*')
      .eq('group_id', groupId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(limit)
    
    // Filtrer par thread si spécifié
    if (threadTs) {
      query = query.eq('thread_ts', threadTs)
    } else {
      // Pour la timeline principale, ne pas inclure les réponses
      query = query.is('thread_ts', null)
    }
    
    // Pagination
    if (before) {
      const { data: beforeMessage } = await supabase
        .from('chat_messages')
        .select('created_at')
        .eq('id', before)
        .single()
      
      if (beforeMessage) {
        query = query.lt('created_at', beforeMessage.created_at)
      }
    }
    
    const { data: messages, error } = await query
    
    if (error) {
      return NextResponse.json({ error: 'Erreur lors de la récupération des messages' }, { status: 500 })
    }
    
    // Enrichir les messages avec les données associées
    const formattedMessages = await Promise.all((messages || []).map(msg => enrichMessage(msg, supabase)))
    
    // Mettre à jour le statut de lecture
    if (messages && messages.length > 0) {
      const latestMessage = messages[0]
      await supabase
        .from('chat_read_status')
        .upsert({
          user_id: user.id,
          group_id: groupId,
          last_read_at: new Date().toISOString(),
          last_read_message_id: latestMessage.id,
          unread_count: 0
        }, {
          onConflict: 'user_id,group_id'
        })
    }
    
    return NextResponse.json({ 
      messages: formattedMessages || [],
      has_more: messages?.length === limit
    })
    
  } catch (error) {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// POST /api/chat/messages - Envoyer un nouveau message
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // Vérifier l'authentification
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    
    const body = await request.json()
    const { group_id, text, thread_ts, files } = body
    
    if (!group_id || !text?.trim()) {
      return NextResponse.json({ error: 'group_id et text requis' }, { status: 400 })
    }
    
    // Vérifier l'appartenance au groupe
    const { data: membership } = await supabase
      .from('user_groups')
      .select('group_id')
      .eq('user_id', user.id)
      .eq('group_id', group_id)
      .single()
    
    if (!membership) {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 })
    }
    
    // Récupérer les infos du groupe pour la sync Slack
    const { data: group } = await supabase
      .from('groups')
      .select('slack_channel_id')
      .eq('id', group_id)
      .single()
    
    // Créer le message dans la base de données
    const { data: message, error: messageError } = await supabase
      .from('chat_messages')
      .insert({
        group_id,
        user_id: user.id,
        text,
        thread_ts,
        slack_sync_status: group?.slack_channel_id ? 'pending' : 'none'
      })
      .select('*')
      .single()
    
    if (messageError) {
      return NextResponse.json({ error: 'Erreur lors de la création du message' }, { status: 500 })
    }
    
    // Récupérer les infos du membre pour enrichir la réponse
    const { data: member } = await supabase
      .from('members')
      .select('first_name, last_name, photo_url, slack_user_id')
      .eq('user_id', user.id)
      .single()
    
    // Gérer les fichiers attachés si présents
    let messageFiles: any[] = []
    if (files && files.length > 0) {
      const fileInserts = files.map((file: any) => ({
        message_id: message.id,
        name: file.name,
        original_name: file.original_name,
        mimetype: file.mimetype,
        size: file.size,
        storage_path: file.storage_path,
        thumbnail_path: file.thumbnail_path,
        width: file.width,
        height: file.height,
        duration: file.duration
      }))
      
      const { data: insertedFiles } = await supabase
        .from('chat_files')
        .insert(fileInserts)
        .select('*')
      
      if (insertedFiles) {
        messageFiles = insertedFiles
      }
    }
    
    // Synchroniser avec Slack si configuré
    if (group?.slack_channel_id) {
      syncMessageToSlack(message, group.slack_channel_id, messageFiles).catch(err => {
        // Marquer comme échoué mais ne pas bloquer
        supabase
          .from('chat_messages')
          .update({ 
            slack_sync_status: 'failed',
            slack_sync_error: err.message 
          })
          .eq('id', message.id)
          .then(() => {})
      })
    }
    
    
    return NextResponse.json({ 
      message: {
        ...message,
        member,
        files: messageFiles,
        reactions: [],
        mentions: []
      }
    })
    
  } catch (error) {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// PUT /api/chat/messages/:id - Modifier un message
export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // Vérifier l'authentification
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    
    const body = await request.json()
    const { id, text } = body
    
    if (!id || !text?.trim()) {
      return NextResponse.json({ error: 'id et text requis' }, { status: 400 })
    }
    
    // Vérifier que l'utilisateur est l'auteur du message
    const { data: existingMessage } = await supabase
      .from('chat_messages')
      .select('user_id, slack_ts, slack_channel_id')
      .eq('id', id)
      .single()
    
    if (!existingMessage || existingMessage.user_id !== user.id) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })
    }
    
    // Mettre à jour le message
    const { data: message, error } = await supabase
      .from('chat_messages')
      .update({
        text,
        edited_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single()
    
    if (error) {
      return NextResponse.json({ error: 'Erreur lors de la modification' }, { status: 500 })
    }
    
    // Synchroniser avec Slack si le message était synchronisé
    if (existingMessage.slack_ts && existingMessage.slack_channel_id) {
      updateMessageInSlack(
        existingMessage.slack_channel_id,
        existingMessage.slack_ts,
        text
      )
    }
    
    return NextResponse.json({ message })
    
  } catch (error) {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// DELETE /api/chat/messages/:id - Supprimer un message (soft delete)
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // Vérifier l'authentification
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    
    const searchParams = request.nextUrl.searchParams
    const id = searchParams.get('id')
    
    
    if (!id) {
      return NextResponse.json({ error: 'id requis' }, { status: 400 })
    }
    
    // Vérifier que l'utilisateur est l'auteur du message et récupérer les fichiers
    const { data: existingMessage, error: fetchError } = await supabase
      .from('chat_messages')
      .select(`
        user_id, 
        slack_ts, 
        slack_channel_id,
        files:chat_files(
          id,
          storage_path,
          thumbnail_path,
          slack_file_id
        )
      `)
      .eq('id', id)
      .single()
    
    if (fetchError) {
      return NextResponse.json({ error: 'Message non trouvé' }, { status: 404 })
    }
    
    
    if (!existingMessage || existingMessage.user_id !== user.id) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })
    }
    
    // Supprimer les fichiers du storage Supabase si présents
    if (existingMessage.files && existingMessage.files.length > 0) {
      for (const file of existingMessage.files) {
        try {
          // Supprimer le fichier principal
          if (file.storage_path) {
            await supabase.storage
              .from('chat')
              .remove([file.storage_path])
          }
          // Supprimer le thumbnail si présent
          if (file.thumbnail_path) {
            await supabase.storage
              .from('chat')
              .remove([file.thumbnail_path])
          }
        } catch (err) {
        }
      }
      
      // Supprimer les entrées de fichiers de la base de données
      await supabase
        .from('chat_files')
        .delete()
        .eq('message_id', id)
    }
    
    // Soft delete du message
    const { error } = await supabase
      .from('chat_messages')
      .update({
        deleted_at: new Date().toISOString(),
        text: '[Message supprimé]'
      })
      .eq('id', id)
    
    if (error) {
      return NextResponse.json({ error: 'Erreur lors de la suppression' }, { status: 500 })
    }
    
    // Supprimer de Slack si synchronisé (message et fichiers)
    if (existingMessage.slack_channel_id) {
      // Supprimer le message Slack (avec les fichiers si présents)
      try {
        await deleteMessageFromSlack(
          existingMessage.slack_channel_id,
          existingMessage.slack_ts || '',
          existingMessage.files
        )
      } catch (err) {
      }
    } else {
    }
    
    return NextResponse.json({ success: true })
    
  } catch (error) {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// Fonctions helper pour la synchronisation Slack
async function syncMessageToSlack(message: any, channelId: string, files: any[] = []) {
  
  // Récupérer le bot token
  const supabase = await createClient()
  const { data: botToken } = await supabase
    .from('app_settings')
    .select('setting_value')
    .eq('setting_key', 'slack_bot_token')
    .single()
  
  if (!botToken?.setting_value) {
    throw new Error('Bot Slack non configuré')
  }
  
  const slack = new WebClient(botToken.setting_value)
  
  // Récupérer les infos de l'utilisateur
  const { data: member } = await supabase
    .from('members')
    .select('first_name, last_name')
    .eq('user_id', message.user_id)
    .single()
  
  // Vérifier si on doit inclure la signature (messages groupés)
  // Récupérer le dernier message du même auteur dans le même groupe
  const { data: previousMessages } = await supabase
    .from('chat_messages')
    .select('user_id, created_at')
    .eq('group_id', message.group_id)
    .eq('user_id', message.user_id)
    .lt('created_at', message.created_at)
    .order('created_at', { ascending: false })
    .limit(1)
  
  const authorName = member ? `${member.first_name} ${member.last_name}` : 'Utilisateur'
  
  // Vérifier si le message précédent est dans les 60 secondes
  const shouldIncludeSignature = !previousMessages || previousMessages.length === 0 || 
    (previousMessages[0] && 
     new Date(message.created_at).getTime() - new Date(previousMessages[0].created_at).getTime() > 60000)
  
  // Créer les blocks pour une meilleure mise en forme
  const blocks = []
  
  if (shouldIncludeSignature) {
    // Ajouter la signature comme bloc context (petite police grisée)
    blocks.push({
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: `— ${authorName}`
        }
      ]
    })
  }
  
  // Ajouter le message principal
  blocks.push({
    type: 'section',
    text: {
      type: 'mrkdwn',
      text: message.text
    }
  })
  
  // Si on a des fichiers, on utilise files.uploadV2 avec initial_comment
  // Cela crée UN SEUL message avec le fichier et le texte
  let slackTs: string | undefined
  
  if (files && files.length > 0) {
    
    // Pour le premier fichier, inclure le message texte
    const firstFile = files[0]
    try {
      const { data: fileData, error: downloadError } = await supabase.storage
        .from('chat')
        .download(firstFile.storage_path)
      
      if (!downloadError && fileData) {
        const buffer = Buffer.from(await fileData.arrayBuffer())
        const stream = Readable.from(buffer)
        
        let slackFilename = firstFile.original_name || firstFile.name
        let fileTitle = firstFile.original_name || firstFile.name
        
        if (firstFile.mimetype === 'audio/mp4' && !slackFilename.endsWith('.m4a')) {
          slackFilename = slackFilename.replace(/\.\w+$/, '.m4a')
          fileTitle = 'Message vocal'
        }
        
        
        // Upload avec le message texte - cela crée UN SEUL message
        const uploadResult = await slack.files.uploadV2({
          channels: channelId,
          file: stream,
          filename: slackFilename,
          title: fileTitle,
          initial_comment: message.text,
          thread_ts: message.thread_ts ? message.thread_ts : undefined
        })
        
        if (uploadResult.ok) {
          
          // Récupérer l'ID du fichier - la structure peut être différente
          let fileId: string | undefined
          
          // Option 1: uploadResult.file (singulier)
          if (uploadResult.file?.id) {
            fileId = uploadResult.file.id
          }
          // Option 2: uploadResult.files (pluriel normal)
          else if (uploadResult.files && uploadResult.files[0]?.id) {
            fileId = uploadResult.files[0].id
          }
          // Option 3: Structure imbriquée bizarre de uploadV2
          else if (uploadResult.files && uploadResult.files[0]?.files && uploadResult.files[0].files[0]?.id) {
            fileId = uploadResult.files[0].files[0].id
          }
          // Option 4: Vérifier d'autres structures possibles
          else {
            for (const key of Object.keys(uploadResult)) {
              const value = uploadResult[key]
              if (typeof value === 'object' && value !== null) {
              } else {
              }
            }
          }
          
          
          // Stocker l'ID du fichier pour la suppression
          if (fileId) {
            // Mettre à jour le fichier dans la base avec l'ID Slack
            if (files.length > 0 && files[0].id) {
              await supabase
                .from('chat_files')
                .update({ slack_file_id: fileId })
                .eq('id', files[0].id)
            }
            
            // Attendre un peu pour que le message soit créé dans Slack
            await new Promise(resolve => setTimeout(resolve, 1000))
            
            // Récupérer le message depuis l'historique
            try {
              const history = await slack.conversations.history({
                channel: channelId,
                limit: 10 // Chercher dans les 10 derniers messages
              })
              
              if (history.messages) {
                // Chercher le message avec notre fichier
                for (const msg of history.messages) {
                  if (msg.files && msg.files.length > 0) {
                    // Vérifier si c'est notre fichier par ID
                    const msgFile = msg.files[0]
                    if (msgFile.id === fileId) {
                      slackTs = msg.ts
                      break
                    }
                  }
                }
              }
              
              // Si on n'a pas trouvé le timestamp, stocker l'ID du fichier
              if (!slackTs) {
                slackTs = `file_${fileId}`
              }
            } catch (err) {
              slackTs = `file_${fileId}`
            }
          }
          
          if (!slackTs) {
            slackTs = 'file_sent'
          }
        }
      }
      
      // Upload des autres fichiers sans initial_comment
      for (let i = 1; i < files.length; i++) {
        const file = files[i]
        try {
          const { data: fileData } = await supabase.storage
            .from('chat')
            .download(file.storage_path)
          
          if (fileData) {
            const buffer = Buffer.from(await fileData.arrayBuffer())
            const stream = Readable.from(buffer)
            
            await slack.files.uploadV2({
              channels: channelId,
              file: stream,
              filename: file.original_name || file.name,
              title: file.original_name || file.name,
              thread_ts: message.thread_ts
            })
          }
        } catch (err) {
        }
      }
    } catch (err) {
    }
  }
  
  // Envoyer un message texte SEULEMENT si on n'a pas de fichier
  if (!slackTs && files.length === 0) {
    const result = await slack.chat.postMessage({
      channel: channelId,
      blocks: blocks,
      text: message.text,
      thread_ts: message.thread_ts ? message.thread_ts : undefined
    })
    
    slackTs = result.ts
  }
  
  // Mettre à jour le message avec le statut de synchronisation
  if (slackTs) {
    await supabase
      .from('chat_messages')
      .update({
        slack_ts: slackTs,
        slack_channel_id: channelId,
        slack_sync_status: 'synced'
      })
      .eq('id', message.id)
  }
}

async function updateMessageInSlack(channelId: string, ts: string, newText: string) {
  const supabase = await createClient()
  const { data: botToken } = await supabase
    .from('app_settings')
    .select('setting_value')
    .eq('setting_key', 'slack_bot_token')
    .single()
  
  if (!botToken?.setting_value) return
  
  const slack = new WebClient(botToken.setting_value)
  await slack.chat.update({
    channel: channelId,
    ts: ts,
    text: newText
  })
}

async function deleteMessageFromSlack(channelId: string, ts: string, files?: any[]) {
  const supabase = await createClient()
  const { data: botToken } = await supabase
    .from('app_settings')
    .select('setting_value')
    .eq('setting_key', 'slack_bot_token')
    .single()
  
  if (!botToken?.setting_value) {
    return
  }
  
  const slack = new WebClient(botToken.setting_value)
  
  // Si le ts commence par "file_", on doit supprimer via l'ID du fichier
  if (ts.startsWith('file_')) {
    const fileId = ts.replace('file_', '')
    
    try {
      // D'abord essayer de trouver le message associé au fichier
      const history = await slack.conversations.history({
        channel: channelId,
        limit: 100 // Chercher dans les 100 derniers messages
      })
      
      let messageTs: string | undefined
      if (history.messages) {
        for (const msg of history.messages) {
          if (msg.files && msg.files.length > 0) {
            for (const file of msg.files) {
              if (file.id === fileId) {
                messageTs = msg.ts
                break
              }
            }
            if (messageTs) break
          }
        }
      }
      
      // Si on a trouvé le timestamp du message, le supprimer
      if (messageTs) {
        await slack.chat.delete({
          channel: channelId,
          ts: messageTs
        })
      } else {
        // Sinon, essayer de supprimer juste le fichier
        await slack.files.delete({
          file: fileId
        })
      }
    } catch (err) {
    }
  } else if (ts && ts !== 'file_sent') {
    // Suppression normale d'un message texte
    try {
      const deleteResult = await slack.chat.delete({
        channel: channelId,
        ts: ts
      })
      if (deleteResult.ok) {
      } else {
      }
    } catch (err: any) {
    }
  } else if (files && files.length > 0) {
    // Si on n'a pas de timestamp mais on a des fichiers avec slack_file_id
    for (const file of files) {
      if (file.slack_file_id) {
        try {
          // Chercher le message associé
          const history = await slack.conversations.history({
            channel: channelId,
            limit: 100
          })
          
          let messageTs: string | undefined
          if (history.messages) {
            for (const msg of history.messages) {
              if (msg.files && msg.files.some((f: any) => f.id === file.slack_file_id)) {
                messageTs = msg.ts
                break
              }
            }
          }
          
          if (messageTs) {
            await slack.chat.delete({
              channel: channelId,
              ts: messageTs
            })
          } else {
            await slack.files.delete({
              file: file.slack_file_id
            })
          }
        } catch (err) {
        }
      }
    }
  }
}