'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { RealtimeChannel } from '@supabase/supabase-js'

export interface UnreadCount {
  user_id: string
  group_id: string
  group_name: string
  slack_channel_id: string | null
  last_read_at: string
  last_read_message_id: string | null
  unread_count: number
  latest_message_at: string | null
  user_latest_message_at: string | null
  total_messages: number
}

export function useUnreadCounts(activeGroupId?: string | null) {
  const [unreadCounts, setUnreadCounts] = useState<Map<string, UnreadCount>>(new Map())
  const [totalUnread, setTotalUnread] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const supabase = createClient()
  
  // Identifiant unique pour cette instance du hook (pour debug)
  const instanceId = useRef(Math.random().toString(36).substr(2, 9))
  console.log(`[UnreadCounts] Instance créée: ${instanceId.current}, activeGroupId: ${activeGroupId}`)

  // Récupérer les compteurs depuis la vue
  const fetchUnreadCounts = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setUnreadCounts(new Map())
        setTotalUnread(0)
        setLoading(false)
        return
      }

      const { data, error } = await supabase
        .from('chat_unread_counts')
        .select('*')
        .eq('user_id', user.id)

      if (error) {
        console.error('Erreur lors de la récupération des compteurs:', error)
        setError(error)
        return
      }

      console.log('[UnreadCounts] Données récupérées depuis la vue:', data)

      // Créer une Map pour un accès rapide par group_id
      const countsMap = new Map<string, UnreadCount>()
      let total = 0

      data?.forEach(count => {
        countsMap.set(count.group_id, count)
        total += count.unread_count
        if (count.unread_count > 0) {
          console.log(`[UnreadCounts] Groupe ${count.group_name}: ${count.unread_count} non lus`)
        }
      })

      setUnreadCounts(countsMap)
      setTotalUnread(total)
      console.log(`[UnreadCounts] Total messages non lus: ${total}`)
      setError(null)
    } catch (err) {
      console.error('Erreur:', err)
      setError(err as Error)
    } finally {
      setLoading(false)
    }
  }, [supabase])

  // Marquer un canal comme lu
  const markAsRead = useCallback(async (groupId: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      console.log(`[UnreadCounts] Marquage du canal ${groupId} comme lu`)

      // Récupérer le dernier message du canal
      const { data: latestMessage } = await supabase
        .from('chat_messages')
        .select('id, created_at')
        .eq('group_id', groupId)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      const now = new Date().toISOString()
      
      // Mettre à jour ou créer le statut de lecture
      const { error } = await supabase
        .from('chat_read_status')
        .upsert({
          user_id: user.id,
          group_id: groupId,
          last_read_at: latestMessage?.created_at || now,
          last_read_message_id: latestMessage?.id || null,
          unread_count: 0
        }, {
          onConflict: 'user_id,group_id'
        })

      if (error) {
        console.error('Erreur lors du marquage comme lu:', error)
        return
      }

      console.log(`[UnreadCounts] Canal ${groupId} marqué comme lu avec succès`)

      // Mettre à jour l'état local immédiatement
      setUnreadCounts(prev => {
        const newMap = new Map(prev)
        const current = newMap.get(groupId)
        if (current) {
          const updatedCount = { ...current, unread_count: 0, last_read_at: latestMessage?.created_at || now }
          newMap.set(groupId, updatedCount)
          
          // Recalculer le total
          let newTotal = 0
          newMap.forEach(count => {
            newTotal += count.unread_count
          })
          setTotalUnread(newTotal)
        }
        return newMap
      })

      // Ne pas rafraîchir immédiatement pour éviter de réafficher les badges
      // Le realtime se chargera de mettre à jour si nécessaire
    } catch (err) {
      console.error('Erreur lors du marquage comme lu:', err)
      setError(err as Error)
    }
  }, [supabase])

  // Obtenir le compteur pour un groupe spécifique
  const getUnreadCount = useCallback((groupId: string): number => {
    return unreadCounts.get(groupId)?.unread_count || 0
  }, [unreadCounts])

  // Incrémenter le compteur de messages non lus pour un groupe
  const incrementUnreadCount = useCallback((groupId: string) => {
    console.log(`[UnreadCounts] Incrémentation manuelle du compteur pour le groupe ${groupId}`)
    
    // Utiliser une mise à jour fonctionnelle pour éviter les problèmes de concurrence
    setUnreadCounts(prev => {
      const newMap = new Map(prev)
      const current = newMap.get(groupId)
      
      if (current) {
        // Vérifier que le compteur est dans un état cohérent
        const currentCount = current.unread_count || 0
        const updatedCount = { 
          ...current, 
          unread_count: currentCount + 1
        }
        newMap.set(groupId, updatedCount)
        console.log(`[UnreadCounts] Compteur incrémenté: ${currentCount} -> ${updatedCount.unread_count}`)
        
        // Recalculer le total
        let newTotal = 0
        newMap.forEach(count => {
          newTotal += count.unread_count
        })
        setTotalUnread(newTotal)
      } else {
        console.log('[UnreadCounts] Pas de données pour ce groupe, création avec compteur à 1')
        // Créer une entrée avec un compteur à 1
        const newCount: UnreadCount = {
          user_id: '',
          group_id: groupId,
          group_name: '',
          slack_channel_id: null,
          last_read_at: new Date().toISOString(),
          last_read_message_id: null,
          unread_count: 1,
          latest_message_at: new Date().toISOString(),
          user_latest_message_at: null,
          total_messages: 0
        }
        newMap.set(groupId, newCount)
        
        // Recalculer le total
        let newTotal = 0
        newMap.forEach(count => {
          newTotal += count.unread_count
        })
        setTotalUnread(newTotal)
      }
      
      return newMap
    })
  }, [])

  // Configuration du realtime
  useEffect(() => {
    fetchUnreadCounts()

    let messageChannel: RealtimeChannel
    let readStatusChannel: RealtimeChannel

    const setupRealtime = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // Écouter les nouveaux messages
      messageChannel = supabase
        .channel('chat_messages_unread')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'chat_messages'
          },
          async (payload) => {
            console.log(`[UnreadCounts-${instanceId.current}] Nouveau message reçu:`, payload.new)
            
            // Vérifier si le message n'est pas de l'utilisateur actuel
            if (payload.new.user_id !== user.id) {
              const messageGroupId = payload.new.group_id
              console.log(`[UnreadCounts-${instanceId.current}] Message d'un autre utilisateur dans le groupe ${messageGroupId}`)
              
              // Ne pas incrémenter si c'est le groupe actif
              // L'incrémentation pour le groupe actif sera gérée par le composant de chat lui-même
              console.log(`[UnreadCounts-${instanceId.current}] Comparaison: messageGroupId=${messageGroupId}, activeGroupId=${activeGroupId}, égaux=${messageGroupId === activeGroupId}`)
              if (messageGroupId === activeGroupId) {
                console.log(`[UnreadCounts-${instanceId.current}] Groupe actif (${messageGroupId}), incrémentation gérée par le composant de chat - SKIP`)
                return
              }
              
              // Incrémenter le compteur local pour ce groupe
              setUnreadCounts(prev => {
                const newMap = new Map(prev)
                const current = newMap.get(messageGroupId)
                console.log(`[UnreadCounts-${instanceId.current}] État actuel pour ce groupe:`, current)
                
                if (current) {
                  // Incrémenter seulement si le message est plus récent que last_read_at
                  const messageTime = new Date(payload.new.created_at).getTime()
                  const lastReadTime = new Date(current.last_read_at).getTime()
                  
                  console.log(`[UnreadCounts-${instanceId.current}] Comparaison temps:`, {
                    messageTime: new Date(messageTime).toISOString(),
                    lastReadTime: new Date(lastReadTime).toISOString(),
                    isNewer: messageTime > lastReadTime
                  })
                  
                  if (messageTime > lastReadTime) {
                    const updatedCount = { 
                      ...current, 
                      unread_count: current.unread_count + 1,
                      latest_message_at: payload.new.created_at
                    }
                    newMap.set(messageGroupId, updatedCount)
                    console.log(`[UnreadCounts-${instanceId.current}] Incrémentation du compteur: ${current.unread_count} -> ${updatedCount.unread_count}`)
                    
                    // Recalculer le total
                    let newTotal = 0
                    newMap.forEach(count => {
                      newTotal += count.unread_count
                    })
                    setTotalUnread(newTotal)
                  }
                } else {
                  console.log('[UnreadCounts] Pas de données pour ce groupe, rechargement nécessaire')
                  // Si on n'a pas de données pour ce groupe, les récupérer
                  fetchUnreadCounts()
                }
                return newMap
              })
            }
          }
        )
        .subscribe()

      // Écouter les changements de statut de lecture
      readStatusChannel = supabase
        .channel('chat_read_status_changes')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'chat_read_status',
            filter: `user_id=eq.${user.id}`
          },
          async () => {
            // Rafraîchir les compteurs quand le statut de lecture change
            await fetchUnreadCounts()
          }
        )
        .subscribe()
    }

    setupRealtime()

    // Cleanup
    return () => {
      if (messageChannel) {
        supabase.removeChannel(messageChannel)
      }
      if (readStatusChannel) {
        supabase.removeChannel(readStatusChannel)
      }
    }
  }, [supabase, fetchUnreadCounts, activeGroupId])

  return {
    unreadCounts,
    totalUnread,
    loading,
    error,
    markAsRead,
    getUnreadCount,
    incrementUnreadCount,
    refreshCounts: fetchUnreadCounts
  }
}