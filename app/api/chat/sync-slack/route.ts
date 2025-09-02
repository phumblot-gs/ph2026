import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { WebClient } from '@slack/web-api'

const slack = new WebClient(process.env.SLACK_BOT_TOKEN)

// POST /api/chat/sync-slack - Synchroniser les messages Slack vers la base native
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // Vérifier l'authentification
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    
    const { group_id } = await request.json()
    
    if (!group_id) {
      return NextResponse.json({ error: 'group_id requis' }, { status: 400 })
    }
    
    // Vérifier que l'utilisateur appartient au groupe
    const { data: membership } = await supabase
      .from('user_groups')
      .select('group_id')
      .eq('user_id', user.id)
      .eq('group_id', group_id)
      .single()
    
    if (!membership) {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 })
    }
    
    // Récupérer le canal Slack du groupe
    const { data: group } = await supabase
      .from('groups')
      .select('slack_channel_id')
      .eq('id', group_id)
      .single()
    
    if (!group?.slack_channel_id) {
      return NextResponse.json({ 
        synced: 0,
        message: 'Pas de canal Slack configuré' 
      })
    }
    
    // Récupérer le timestamp du dernier message synchronisé
    const { data: lastSyncedMessage } = await supabase
      .from('chat_messages')
      .select('slack_ts')
      .eq('group_id', group_id)
      .eq('is_from_slack', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()
    
    // Récupérer les messages Slack
    console.log(`Récupération messages Slack pour canal ${group.slack_channel_id}, depuis ${lastSyncedMessage?.slack_ts || 'début'}`)
    
    const result = await slack.conversations.history({
      channel: group.slack_channel_id,
      oldest: lastSyncedMessage?.slack_ts || '0',
      limit: 100,
      inclusive: false
    })
    
    console.log(`Slack a retourné ${result.messages?.length || 0} messages`)
    
    if (!result.messages || result.messages.length === 0) {
      return NextResponse.json({ 
        synced: 0,
        message: 'Aucun nouveau message' 
      })
    }
    
    // Récupérer les infos des utilisateurs Slack
    const slackUserIds = [...new Set(result.messages.map(m => m.user).filter(Boolean))]
    const slackUsers = new Map()
    
    for (const slackUserId of slackUserIds) {
      try {
        const userInfo = await slack.users.info({ user: slackUserId })
        if (userInfo.user) {
          slackUsers.set(slackUserId, userInfo.user)
        }
      } catch (err) {
        console.error(`Erreur récupération utilisateur Slack ${slackUserId}:`, err)
      }
    }
    
    // Mapper les utilisateurs Slack aux utilisateurs locaux
    const { data: members } = await supabase
      .from('members')
      .select('user_id, slack_user_id, email')
      .in('slack_user_id', slackUserIds)
    
    const slackToLocalUser = new Map()
    members?.forEach(m => {
      if (m.slack_user_id) {
        slackToLocalUser.set(m.slack_user_id, m.user_id)
      }
    })
    
    console.log('Mapping Slack users:', Array.from(slackToLocalUser.entries()))
    
    // Créer les utilisateurs manquants
    for (const [slackUserId, slackUser] of slackUsers) {
      if (!slackToLocalUser.has(slackUserId) && slackUser.profile?.email) {
        // Vérifier si un utilisateur existe avec cet email
        const { data: existingMember } = await supabase
          .from('members')
          .select('user_id')
          .eq('email', slackUser.profile.email)
          .single()
        
        if (existingMember) {
          // Mettre à jour le slack_user_id
          await supabase
            .from('members')
            .update({ slack_user_id: slackUserId })
            .eq('user_id', existingMember.user_id)
          
          slackToLocalUser.set(slackUserId, existingMember.user_id)
        } else {
          // Créer un profil temporaire pour cet utilisateur Slack
          console.log(`Création profil temporaire pour Slack ${slackUserId} (${slackUser.profile?.email})`)
          
          // Utiliser le service client pour créer un utilisateur
          const serviceClient = createServiceClient()
          
          // Créer un utilisateur avec l'API admin (ou récupérer s'il existe)
          const email = slackUser.profile?.email || `slack_${slackUserId}@temp.local`
          
          // Vérifier d'abord si l'utilisateur auth existe
          const { data: existingUsers } = await serviceClient.auth.admin.listUsers()
          const existingAuthUser = existingUsers?.users?.find(u => u.email === email)
          
          let authUserId = existingAuthUser?.id
          
          if (!authUserId) {
            const { data: authUser, error: authError } = await serviceClient.auth.admin.createUser({
              email,
              email_confirm: true,
              user_metadata: {
                slack_user_id: slackUserId,
                is_slack_only: true
              }
            })
            
            if (authError) {
              console.error('Erreur création auth user:', authError)
            } else {
              authUserId = authUser?.user?.id
            }
          }
          
          if (authUserId) {
            // Vérifier si le profil membre existe déjà
            const { data: existingMemberProfile } = await serviceClient
              .from('members')
              .select('user_id')
              .eq('user_id', authUserId)
              .single()
            
            if (!existingMemberProfile) {
              // Créer le profil membre
              const { error: memberError } = await serviceClient
                .from('members')
                .insert({
                  user_id: authUserId,
                  email,
                  first_name: slackUser.profile?.first_name || slackUser.profile?.real_name?.split(' ')[0] || slackUser.name || 'Slack',
                  last_name: slackUser.profile?.last_name || slackUser.profile?.real_name?.split(' ')[1] || 'User',
                  photo_url: slackUser.profile?.image_192 || slackUser.profile?.image_72,
                  slack_user_id: slackUserId,
                  role: 'member'
                })
              
              if (memberError) {
                console.error('Erreur création membre:', memberError)
              }
            } else {
              // Mettre à jour le slack_user_id si nécessaire
              await serviceClient
                .from('members')
                .update({ slack_user_id: slackUserId })
                .eq('user_id', authUserId)
            }
            
            // Ajouter au groupe si pas déjà membre
            const { data: existingGroupMembership } = await serviceClient
              .from('user_groups')
              .select('user_id')
              .eq('user_id', authUserId)
              .eq('group_id', group_id)
              .single()
            
            if (!existingGroupMembership) {
              await serviceClient
                .from('user_groups')
                .insert({
                  user_id: authUserId,
                  group_id: group_id
                })
            }
            
            slackToLocalUser.set(slackUserId, authUserId)
            console.log(`Utilisateur Slack ${slackUserId} mappé avec ID ${authUserId}`)
          }
        }
      }
    }
    
    // Synchroniser les messages
    let syncedCount = 0
    const messagesToInsert = []
    
    for (const slackMessage of result.messages) {
      if (!slackMessage.user || !slackMessage.text) continue
      
      // Utiliser l'utilisateur mappé ou l'utilisateur actuel comme fallback
      const localUserId = slackToLocalUser.get(slackMessage.user) || user.id
      if (!localUserId) {
        console.error(`Pas d'utilisateur local pour ${slackMessage.user}`)
        continue
      }
      
      // Vérifier si le message existe déjà
      const { data: existingMessage } = await supabase
        .from('chat_messages')
        .select('id')
        .eq('slack_ts', slackMessage.ts)
        .eq('slack_channel_id', group.slack_channel_id)
        .single()
      
      if (!existingMessage) {
        // Formater le texte Slack
        let formattedText = slackMessage.text
        // Conserver les retours à la ligne et formater les listes
        formattedText = formattedText.replace(/^• /gm, '• ')
        
        messagesToInsert.push({
          group_id: group_id,
          user_id: localUserId,
          text: formattedText,
          formatted_text: formattedText,
          slack_ts: slackMessage.ts,
          slack_user_id: slackMessage.user,
          slack_channel_id: group.slack_channel_id,
          is_from_slack: true,
          slack_sync_status: 'synced',
          thread_ts: slackMessage.thread_ts || null,
          created_at: new Date(parseFloat(slackMessage.ts) * 1000).toISOString(),
          metadata: {
            slack_message: slackMessage
          }
        })
      }
    }
    
    if (messagesToInsert.length > 0) {
      console.log(`Insertion de ${messagesToInsert.length} messages dans la base`)
      // Utiliser le client service pour contourner les RLS
      const serviceClient = createServiceClient()
      const { error: insertError } = await serviceClient
        .from('chat_messages')
        .insert(messagesToInsert)
      
      if (insertError) {
        console.error('Erreur insertion messages:', insertError)
        return NextResponse.json({ 
          error: 'Erreur lors de la synchronisation',
          details: insertError.message 
        }, { status: 500 })
      }
      
      syncedCount = messagesToInsert.length
      console.log(`${syncedCount} messages insérés avec succès`)
    } else {
      console.log('Aucun nouveau message à insérer (déjà synchronisés ou filtrés)')
    }
    
    // Synchroniser aussi les réactions
    for (const slackMessage of result.messages) {
      if (slackMessage.reactions && slackMessage.reactions.length > 0) {
        // Récupérer le message local correspondant
        const { data: localMessage } = await supabase
          .from('chat_messages')
          .select('id')
          .eq('slack_ts', slackMessage.ts)
          .eq('slack_channel_id', group.slack_channel_id)
          .single()
        
        if (localMessage) {
          for (const reaction of slackMessage.reactions) {
            for (const slackUserId of reaction.users) {
              const localUserId = slackToLocalUser.get(slackUserId)
              if (localUserId) {
                // Vérifier si la réaction existe déjà
                const { data: existingReaction } = await supabase
                  .from('chat_reactions')
                  .select('id')
                  .eq('message_id', localMessage.id)
                  .eq('user_id', localUserId)
                  .eq('emoji', `:${reaction.name}:`)
                  .single()
                
                if (!existingReaction) {
                  await supabase
                    .from('chat_reactions')
                    .insert({
                      message_id: localMessage.id,
                      user_id: localUserId,
                      emoji: `:${reaction.name}:`,
                      emoji_name: reaction.name
                    })
                }
              }
            }
          }
        }
      }
    }
    
    return NextResponse.json({ 
      synced: syncedCount,
      message: `${syncedCount} message(s) synchronisé(s)` 
    })
    
  } catch (error) {
    console.error('Erreur sync Slack:', error)
    return NextResponse.json({ 
      error: 'Erreur serveur',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}