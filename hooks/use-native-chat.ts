'use client'

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js'
import { useChatCache } from './use-chat-cache'
import { formatSlackMessage } from '@/lib/slack-formatter'
import { sortMessagesWithThreads } from '@/lib/message-sorting'

// Types
export interface ChatMessage {
  id: string
  group_id: string
  user_id: string
  text: string
  formatted_text?: string
  created_at: string
  updated_at: string
  deleted_at?: string | null
  edited_at?: string | null
  thread_ts?: string | null
  reply_count: number
  latest_reply_at?: string | null
  reply_users: string[]
  slack_ts?: string | null
  slack_user_id?: string | null
  slack_channel_id?: string | null
  is_from_slack: boolean
  slack_sync_status: 'pending' | 'synced' | 'failed' | 'none'
  metadata?: any
  // Relations
  user?: {
    id: string
    email: string
  }
  member?: {
    first_name: string
    last_name: string
    photo_url?: string | null
    slack_user_id?: string | null
  }
  files?: ChatFile[]
  reactions?: ChatReaction[]
  mentions?: ChatMention[]
}

export interface ChatFile {
  id: string
  name: string
  original_name: string
  mimetype: string
  size: number
  storage_path: string
  thumbnail_path?: string | null
  width?: number | null
  height?: number | null
  duration?: number | null
}

export interface ChatReaction {
  emoji: string
  emoji_name?: string | null
  users: Array<{
    id: string
    name: string
    photo_url?: string | null
  }>
  count: number
}

export interface ChatMention {
  id: string
  mentioned_user_id?: string | null
  mentioned_slack_user_id?: string | null
  mention_type: 'user' | 'channel' | 'here' | 'everyone'
}

export interface TypingUser {
  user_id: string
  name: string
  photo_url?: string | null
}

export interface ReadStatus {
  group_id: string
  group_name?: string
  unread_count: number
  last_read_at?: string | null
}

// Hook principal
export function useNativeChat(groupId: string | null, shouldIncrementUnread?: () => boolean, incrementUnreadCount?: (groupId: string) => void) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [loading, setLoading] = useState(false)
  const [loadingInBackground, setLoadingInBackground] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [typingUsers, setTypingUsers] = useState<TypingUser[]>([])
  const [hasMore, setHasMore] = useState(true)
  const [sendingMessage, setSendingMessage] = useState(false)
  const [wsConnected, setWsConnected] = useState(false)
  
  const supabase = useMemo(() => createClient(), [])
  const channelRef = useRef<RealtimeChannel | null>(null)
  const localMessagesRef = useRef<Map<string, ChatMessage>>(new Map())
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const currentUserIdRef = useRef<string | null>(null)
  const syncIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const fallbackPollingRef = useRef<NodeJS.Timeout | null>(null)
  const lastMessageTimeRef = useRef<number>(Date.now())
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const loadMessagesRef = useRef<() => void>(() => {})
  const processedMessagesRef = useRef<Set<string>>(new Set()) // Pour éviter les doublons d'incrémentation
  const localReactionChangesRef = useRef<Set<string>>(new Set()) // Pour tracker les changements locaux de réactions
  const pendingLocalChangesRef = useRef<Map<string, any>>(new Map()) // Pour stocker les changements locaux en attente
  const messagesRef = useRef(messages) // Pour accéder aux messages mis à jour sans setMessages
  
  // Mettre à jour la référence quand les messages changent
  useEffect(() => {
    messagesRef.current = messages
  }, [messages])
  const lastLoadTimeRef = useRef<number>(0) // Pour tracker le dernier rechargement
  
  // Utiliser le cache
  const chatCache = useChatCache()
  const { getFromCache, updateCache, addMessageToCache, updateMessageInCache, removeMessageFromCache, invalidateCache } = chatCache
  
  // Créer des refs pour les fonctions du cache pour éviter les problèmes de dépendances
  const updateMessageInCacheRef = useRef(updateMessageInCache)
  useEffect(() => {
    updateMessageInCacheRef.current = updateMessageInCache
  }, [updateMessageInCache])
  
  // Récupérer l'utilisateur actuel
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      currentUserIdRef.current = data.user?.id || null
    })
  }, [])
  
  // Fonction pour charger depuis l'API (déclarée en premier pour éviter les dépendances circulaires)
  const loadMessagesFromAPI = useCallback(async (groupId: string, before?: string, background = false) => {
    if (!background) {
      setLoading(true)
      setError(null)
    }
    
    try {
      const params = new URLSearchParams({
        group_id: groupId,
        limit: '50'
      })
      
      if (before) {
        params.append('before', before)
      }
      
      const response = await fetch(`/api/chat/messages?${params}`, {
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include'
      })
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
        throw new Error(errorData.error || `Erreur lors du chargement des messages (${response.status})`)
      }
      
      const data = await response.json()
      
      if (before) {
        // Ajouter les anciens messages au début et retrier
        setMessages(prev => {
          // Créer un Map pour dédupliquer par ID
          const messageMap = new Map<string, ChatMessage>()
          
          // Ajouter d'abord les anciens messages existants
          prev.forEach(msg => messageMap.set(msg.id, msg))
          
          // Ajouter les nouveaux messages (écrasera les doublons)
          data.messages.forEach((msg: ChatMessage) => messageMap.set(msg.id, msg))
          
          // Convertir en array et trier en respectant les threads
          const allMessages = Array.from(messageMap.values())
          const sorted = sortMessagesWithThreads(allMessages)
          
          // Mettre à jour le cache avec les messages combinés
          updateCache(groupId, sorted, data.has_more || false)
          return sorted
        })
      } else {
        // Remplacer tous les messages (déjà triés par l'API)
        const messages = data.messages || []
        
        // Appliquer les changements locaux en attente si le rechargement est récent
        const now = Date.now()
        const timeSinceLastLoad = now - lastLoadTimeRef.current
        lastLoadTimeRef.current = now
        
        // Si on recharge dans les 2 secondes après un changement local, réappliquer les changements
        if (timeSinceLastLoad < 2000 && pendingLocalChangesRef.current.size > 0) {
          const updatedMessages = messages.map((msg: ChatMessage) => {
            const pendingChange = pendingLocalChangesRef.current.get(msg.id)
            if (pendingChange) {
              return { ...msg, reactions: pendingChange.reactions }
            }
            return msg
          })
          setMessages(updatedMessages)
          updateCache(groupId, updatedMessages, data.has_more || false)
        } else {
          setMessages(messages)
          updateCache(groupId, messages, data.has_more || false)
        }
        
        // Nettoyer les changements en attente après 3 secondes
        setTimeout(() => {
          pendingLocalChangesRef.current.clear()
        }, 3000)
      }
      
      setHasMore(data.has_more || false)
      
    } catch (err) {
      if (!background) {
        setError(err instanceof Error ? err.message : 'Erreur inconnue')
      }
    } finally {
      if (!background) {
        setLoading(false)
      }
    }
  }, []) // Remove updateCache dependency to avoid re-renders
  
  // Charger les messages
  const loadMessages = useCallback(async (before?: string, forceRefresh = false) => {
    if (!groupId) return
    
    // Si pas de before et pas de forceRefresh, essayer d'utiliser le cache
    if (!before && !forceRefresh) {
      const cached = getFromCache(groupId)
      if (cached) {
        // On a un cache, afficher immédiatement sans spinner principal
        setMessages(cached.messages)
        setHasMore(cached.hasMore)
        setLoading(false)
        setError(null)
        
        // Calculer l'âge du cache (timestamp inclus dans CacheEntry)
        const cacheAge = Date.now() - cached.timestamp
        const CACHE_REFRESH_THRESHOLD = 30000 // 30 secondes
        
        // Seulement rafraîchir en arrière-plan si le cache est ancien
        if (cacheAge > CACHE_REFRESH_THRESHOLD) {
          // Indiquer qu'on charge en arrière-plan
          setLoadingInBackground(true)
          
          // Charger les nouveaux messages en arrière-plan
          loadMessagesFromAPI(groupId, undefined, true).finally(() => {
            setLoadingInBackground(false)
          })
        }
        return
      }
      // Pas de cache, on va charger depuis l'API avec un spinner
      setLoading(true)
      setMessages([]) // Vider les anciens messages pour montrer qu'on charge
    }
    
    await loadMessagesFromAPI(groupId, before, false)
  }, [groupId]) // Remove unstable dependencies to avoid re-renders
  
  // Stocker la référence à loadMessages
  useEffect(() => {
    loadMessagesRef.current = loadMessages
  }, [loadMessages])
  
  // Envoyer un message
  const sendMessage = useCallback(async (
    text: string,
    threadTs?: string,
    files?: File[]
  ): Promise<boolean> => {
    // Si on a des fichiers mais pas de texte, ajouter un texte par défaut
    let messageText = text
    if (files && files.length > 0 && !text.trim()) {
      // Afficher le type MIME et la taille du fichier
      const file = files[0]
      const fileSize = file.size
      let sizeStr = ''
      if (fileSize < 1024) {
        sizeStr = `${fileSize} B`
      } else if (fileSize < 1024 * 1024) {
        sizeStr = `${(fileSize / 1024).toFixed(1)} KB`
      } else {
        sizeStr = `${(fileSize / (1024 * 1024)).toFixed(1)} MB`
      }
      
      // Format: 📎 type/mime • taille
      messageText = `📎 ${file.type || 'application/octet-stream'} • ${sizeStr}`
    }
    
    if (!groupId || (!messageText.trim() && (!files || files.length === 0))) return false
    
    // S'assurer que l'ID utilisateur est défini
    if (!currentUserIdRef.current) {
      const { data } = await supabase.auth.getUser()
      currentUserIdRef.current = data.user?.id || null
    }
    
    setSendingMessage(true)
    setError(null)
    
    // Générer un ID temporaire pour le pré-stockage
    const tempMessageId = `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    let tempMessageStored = false
    
    try {
      // Upload des fichiers si présents
      let uploadedFiles: ChatFile[] = []
      if (files && files.length > 0) {
        for (const file of files) {
          const formData = new FormData()
          formData.append('file', file)
          formData.append('group_id', groupId)
          
          const uploadResponse = await fetch('/api/chat/upload', {
            method: 'POST',
            body: formData,
            credentials: 'include'
          })
          
          if (uploadResponse.ok) {
            const { file: uploadedFile } = await uploadResponse.json()
            uploadedFiles.push(uploadedFile)
          } else {
            const errorData = await uploadResponse.json().catch(() => ({ error: 'Upload failed' }))
            throw new Error(errorData.error || `Erreur lors de l'upload du fichier (${uploadResponse.status})`)
          }
        }
        
        // PRÉ-STOCKER dans le cache AVANT l'envoi API si on a des fichiers
        if (uploadedFiles.length > 0) {
          const tempMessage = {
            id: tempMessageId,
            text: messageText,  // Utiliser messageText au lieu de text
            thread_ts: threadTs,
            files: uploadedFiles,
            created_at: new Date().toISOString()
          }
          localMessagesRef.current.set(tempMessageId, tempMessage as any)
          tempMessageStored = true
        }
      }
      
      // Envoyer le message
      const response = await fetch('/api/chat/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          group_id: groupId,
          text: messageText,  // Utiliser messageText au lieu de text
          thread_ts: threadTs,
          files: uploadedFiles
        }),
        credentials: 'include'
      })
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
        throw new Error(errorData.error || `Erreur lors de l'envoi du message (${response.status})`)
      }
      
      const { message } = await response.json()
      
      // Remplacer le message temporaire par le message réel
      if (tempMessageStored) {
        localMessagesRef.current.delete(tempMessageId)
      }
      
      // Stocker le message avec son ID réel pour préserver les fichiers
      // quand l'événement Realtime arrivera
      if (message.files && message.files.length > 0) {
        localMessagesRef.current.set(message.id, message)
        
        // Nettoyer après 5 minutes (300 secondes) au lieu de 60 secondes
        // Cela laisse largement le temps aux événements Realtime d'arriver
        setTimeout(() => {
          localMessagesRef.current.delete(message.id)
        }, 300000) // 5 minutes
      }
      
      // Ajouter le message avec les infos complètes
      // Realtime le mettra à jour si nécessaire
      setMessages(prev => {
        // Vérifier qu'il n'existe pas déjà (au cas où Realtime l'aurait déjà ajouté)
        const existingIndex = prev.findIndex(m => m.id === message.id)
        if (existingIndex >= 0) {
          // Mettre à jour le message existant au lieu d'ajouter un doublon
          const updated = [...prev]
          // IMPORTANT: Préserver les fichiers du message API s'ils existent
          const existingMessage = prev[existingIndex]
          if (message.files && message.files.length > 0) {
            // Le message de l'API a des fichiers, les conserver
            updated[existingIndex] = message
          } else if (existingMessage.files && existingMessage.files.length > 0) {
            // Le message existant a des fichiers mais pas le nouveau, conserver les anciens
            updated[existingIndex] = { ...message, files: existingMessage.files }
          } else {
            // Pas de fichiers dans aucun des deux
            updated[existingIndex] = message
          }
          return updated
        }
        
        const updated = [message, ...prev]
        // Mettre à jour le cache
        if (groupId) {
          addMessageToCache(groupId, message)
        }
        return updated
      })
      
      // Les réponses aux threads sont maintenant gérées par le real-time, 
      // pas besoin de forcer un rechargement qui cause un scroll indésirable
      
      return true
      
    } catch (err) {
      // Nettoyer le message temporaire en cas d'erreur
      if (tempMessageStored) {
        localMessagesRef.current.delete(tempMessageId)
      }
      setError(err instanceof Error ? err.message : 'Erreur inconnue')
      return false
    } finally {
      setSendingMessage(false)
    }
  }, [groupId]) // Remove unstable dependencies
  
  // Modifier un message
  const updateMessage = useCallback(async (
    messageId: string,
    newText: string
  ): Promise<boolean> => {
    if (!newText.trim()) return false
    
    try {
      const response = await fetch('/api/chat/messages', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          id: messageId,
          text: newText
        }),
        credentials: 'include'
      })
      
      if (!response.ok) {
        throw new Error('Erreur lors de la modification')
      }
      
      // Mettre à jour localement
      setMessages(prev => {
        const updated = prev.map(msg => 
          msg.id === messageId 
            ? { ...msg, text: newText, edited_at: new Date().toISOString() }
            : msg
        )
        // Mettre à jour le cache
        if (groupId) {
          updateMessageInCacheRef.current(groupId, messageId, msg => ({ 
            ...msg, 
            text: newText, 
            edited_at: new Date().toISOString() 
          }))
        }
        return updated
      })
      
      return true
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue')
      return false
    }
  }, [groupId]) // Remove unstable dependencies
  
  // Supprimer un message
  const deleteMessage = useCallback(async (messageId: string): Promise<boolean> => {
    try {
      const response = await fetch(`/api/chat/messages?id=${messageId}`, {
        method: 'DELETE',
        credentials: 'include'
      })
      
      if (!response.ok) {
        throw new Error('Erreur lors de la suppression')
      }
      
      // Nettoyer le cache local des messages temporaires
      localMessagesRef.current.delete(messageId)
      
      // Chercher aussi les messages temporaires qui pourraient correspondre
      for (const [key, cached] of localMessagesRef.current.entries()) {
        if (key.startsWith('temp_')) {
          // Si c'est un message temporaire, on peut le supprimer aussi par précaution
          const message = messages.find(m => m.id === messageId)
          if (message && cached.text === message.text) {
            localMessagesRef.current.delete(key)
          }
        }
      }
      
      // Marquer comme supprimé localement (soft delete pour garder la structure)
      setMessages(prev => {
        const updated = prev.map(msg => 
          msg.id === messageId 
            ? { 
                ...msg, 
                deleted_at: new Date().toISOString(), 
                text: '[Message supprimé]',
                files: [], // Supprimer les fichiers pour ne plus afficher le player
                reactions: [] // Supprimer les réactions aussi
              }
            : msg
        )
        // Mettre à jour le cache
        if (groupId) {
          updateMessageInCacheRef.current(groupId, messageId, msg => ({ 
            ...msg, 
            deleted_at: new Date().toISOString(),
            text: '[Message supprimé]',
            files: [], // Supprimer les fichiers du cache aussi
            reactions: []
          }))
        }
        return updated
      })
      
      return true
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue')
      return false
    }
  }, [groupId]) // Remove unstable dependencies
  
  // Retirer une réaction (défini avant addReaction car utilisé dans ses dépendances)
  const removeReaction = useCallback(async (
    messageId: string,
    emoji: string
  ): Promise<boolean> => {
    try {
      const response = await fetch(
        `/api/chat/reactions?message_id=${messageId}&emoji=${encodeURIComponent(emoji)}`,
        {
          method: 'DELETE',
          credentials: 'include'
        }
      )
      
      if (!response.ok) {
        throw new Error('Erreur lors du retrait de la réaction')
      }
      
      // Mettre à jour l'état local immédiatement
      const currentUserId = currentUserIdRef.current
      if (!currentUserId) return false
      
      // Marquer ce changement comme local pour éviter le reload depuis realtime
      const changeKey = `${messageId}-${emoji}-${currentUserId}-remove`
      localReactionChangesRef.current.add(changeKey)
      
      // Nettoyer après 3 secondes
      setTimeout(() => {
        localReactionChangesRef.current.delete(changeKey)
      }, 3000)
      
      setMessages(prev => {
        // IMPORTANT: Créer de nouveaux objets à TOUS les niveaux pour que React détecte les changements  
        const updated = prev.map(msg => {
          if (msg.id !== messageId) {
            return msg // Ne pas toucher aux autres messages
          }
          
          const updatedReactions = msg.reactions?.map(reaction => {
            if (reaction.emoji === emoji) {
              // Retirer l'utilisateur actuel de la liste
              const updatedUsers = reaction.users.filter(u => u.id !== currentUserId)
              // Si plus personne n'a cette réaction, on la supprime complètement
              if (updatedUsers.length === 0) {
                return null
              }
              // Créer un NOUVEL objet réaction
              return {
                emoji: reaction.emoji,
                emoji_name: reaction.emoji_name,
                users: updatedUsers,
                count: updatedUsers.length
              }
            }
            return reaction // Pas de copie si pas modifiée
          }).filter(Boolean) as ChatReaction[] // Enlever les réactions null
          
          // Créer un NOUVEAU message avec les réactions mises à jour
          const updatedMsg = {
            ...msg,
            reactions: updatedReactions
          }
          return updatedMsg
        })
        
        return updated
      })
      
      // Mettre à jour le cache si on a un groupId
      // Ne PAS utiliser setMessages ici car cela cause un double appel
      if (groupId) {
        // Attendre un peu pour que l'état soit mis à jour
        setTimeout(() => {
          const updatedMessage = messagesRef.current.find(m => m.id === messageId)
          if (updatedMessage) {
            updateMessageInCacheRef.current(groupId, messageId, () => updatedMessage)
            // Stocker le changement local en cas de rechargement imminent
            pendingLocalChangesRef.current.set(messageId, {
              reactions: updatedMessage.reactions
            })
            // Nettoyer après 3 secondes
            setTimeout(() => {
              pendingLocalChangesRef.current.delete(messageId)
            }, 3000)
          }
        }, 50)
      }
      
      // Ne pas utiliser setMessages pour logger après
      
      return true
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue')
      return false
    }
  }, [groupId]) // Keep minimal dependencies

  // Ajouter une réaction
  const addReaction = useCallback(async (
    messageId: string,
    emoji: string,
    emojiName?: string
  ): Promise<boolean> => {
    
    // D'ABORD faire l'appel API
    try {
      const response = await fetch('/api/chat/reactions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          message_id: messageId,
          emoji,
          emoji_name: emojiName
        }),
        credentials: 'include'
      })
      
      if (!response.ok) {
        const error = await response.json()
        // Si déjà réagi, retirer la réaction
        if (error.error === 'Réaction déjà ajoutée') {
          return removeReaction(messageId, emoji)
        }
        throw new Error(error.error || 'Erreur lors de l\'ajout de la réaction')
      }
      
      // Récupérer le nom de l'utilisateur actuel
      const currentUserId = currentUserIdRef.current
      if (!currentUserId) {
        return false
      }
      
      // Marquer ce changement comme local pour éviter le reload depuis realtime
      const changeKey = `${messageId}-${emoji}-${currentUserId}-add`
      localReactionChangesRef.current.add(changeKey)
      
      // Nettoyer après 3 secondes
      setTimeout(() => {
        localReactionChangesRef.current.delete(changeKey)
      }, 3000)
      
      // Obtenir le nom de l'utilisateur depuis messagesRef
      const currentMessages = messagesRef.current
      const userMessage = currentMessages.find(m => m.user_id === currentUserId)
      const currentUserName = userMessage?.member 
        ? `${userMessage.member.first_name} ${userMessage.member.last_name}`
        : 'Vous'
      
      // Mettre à jour l'état local immédiatement
      
      setMessages(prev => {
        
        // IMPORTANT: Créer de nouveaux objets à TOUS les niveaux pour que React détecte les changements
        const updated = prev.map(msg => {
          if (msg.id !== messageId) {
            return msg // Ne pas toucher aux autres messages
          }
          
          // IMPORTANT: Toujours vérifier l'état actuel pour éviter les doublons
          const existingReaction = msg.reactions?.find(r => r.emoji === emoji)
          
          if (existingReaction) {
            // Vérifier si l'utilisateur n'a pas déjà réagi (protection contre le double appel)
            const alreadyReacted = existingReaction.users.some(u => u.id === currentUserId)
            if (alreadyReacted) {
              return msg
            }
            // Créer un NOUVEAU tableau de réactions avec de NOUVEAUX objets
            const updatedReactions = msg.reactions?.map(reaction => {
              if (reaction.emoji === emoji) {
                const newUsers = [...reaction.users, { 
                  id: currentUserId, 
                  name: currentUserName,
                  photo_url: null // Ajouter pour cohérence
                }]
                // Créer un NOUVEL objet réaction
                const updatedReaction = {
                  emoji: reaction.emoji,
                  emoji_name: reaction.emoji_name,
                  users: newUsers,
                  count: newUsers.length
                }
                return updatedReaction
              }
              // Retourner la réaction telle quelle (pas de copie si pas modifiée)
              return reaction
            })
            
            // Créer un NOUVEAU message avec les nouvelles réactions
            const updatedMsg = {
              ...msg,
              reactions: updatedReactions || msg.reactions
            }
            return updatedMsg
          } else {
            // Nouvelle réaction
            const newReaction = {
              emoji,
              emoji_name: emojiName || emoji,
              users: [{ 
                id: currentUserId, 
                name: currentUserName,
                photo_url: null
              }],
              count: 1
            }
            // Créer un NOUVEAU message avec la nouvelle réaction
            const updatedMsg = {
              ...msg,
              reactions: [...(msg.reactions || []), newReaction]
            }
            return updatedMsg
          }
        })
        
        // NE PAS mettre à jour le cache ici, le faire après que l'état soit mis à jour
        return updated
      })
      
      // Mettre à jour le cache après que l'état soit mis à jour
      if (groupId) {
        setTimeout(() => {
          const updatedMessage = messagesRef.current.find(m => m.id === messageId)
          if (updatedMessage) {
            updateMessageInCacheRef.current(groupId, messageId, () => updatedMessage)
            // Stocker le changement local en cas de rechargement imminent
            pendingLocalChangesRef.current.set(messageId, {
              reactions: updatedMessage.reactions
            })
            // Nettoyer après 3 secondes
            setTimeout(() => {
              pendingLocalChangesRef.current.delete(messageId)
            }, 3000)
          }
        }, 50)
      }
      
      return true
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue')
      return false
    }
  }, [groupId]) // Keep minimal dependencies
  
  // Signaler qu'on est en train de taper
  const setTyping = useCallback(async (isTyping: boolean) => {
    if (!groupId) return
    
    try {
      if (isTyping) {
        // Envoyer l'indicateur de frappe
        await fetch('/api/chat/typing', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            group_id: groupId
          }),
          credentials: 'include'
        })
        
        // Renouveler toutes les 5 secondes
        if (typingTimeoutRef.current) {
          clearTimeout(typingTimeoutRef.current)
        }
        typingTimeoutRef.current = setTimeout(() => {
          setTyping(true)
        }, 5000)
        
      } else {
        // Arrêter l'indicateur
        if (typingTimeoutRef.current) {
          clearTimeout(typingTimeoutRef.current)
          typingTimeoutRef.current = null
        }
        
        await fetch(`/api/chat/typing?group_id=${groupId}`, {
          method: 'DELETE',
          credentials: 'include'
        })
      }
    } catch (err) {
    }
  }, [groupId])
  
  // Marquer les messages comme lus
  const markAsRead = useCallback(async (lastMessageId?: string) => {
    if (!groupId) {
      return
    }
    
    // Ne pas marquer comme lu si on n'a pas d'ID de message et qu'on demande un ID spécifique
    if (lastMessageId === undefined || lastMessageId === null) {
      return
    }
    
    try {
      
      const response = await fetch('/api/chat/read-status', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          group_id: groupId,
          last_read_message_id: lastMessageId
        }),
        credentials: 'include'
      })
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
        throw new Error(errorData.error || `Erreur ${response.status}`)
      }
      
      // Réinitialiser le Set des messages traités quand on marque comme lu
      processedMessagesRef.current.clear()
    } catch (err) {
      // Ne pas propager l'erreur pour éviter de casser l'interface
    }
  }, [groupId])
  
  // Synchroniser avec Slack
  const syncWithSlack = useCallback(async () => {
    if (!groupId) return
    
    try {
      const response = await fetch('/api/chat/sync-slack', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          group_id: groupId
        }),
        credentials: 'include'
      })
      
      if (response.ok) {
        const data = await response.json()
        // Si des messages ont été synchronisés, forcer un rechargement après un délai
        if (data.synced > 0 && loadMessagesRef.current) {
          setTimeout(() => {
            loadMessagesRef.current?.()
          }, 1000)
        }
      } else {
        const error = await response.json()
      }
    } catch (err) {
    }
  }, [groupId])
  
  // Fonction de reconnexion WebSocket
  const reconnectWebSocket = useCallback(() => {
    if (!groupId || !channelRef.current) return
    
    // Nettoyer l'ancienne connexion
    supabase.removeChannel(channelRef.current)
    
    // Recréer le canal (la logique sera dupliquée depuis le useEffect principal)
    const channel = supabase
      .channel(`chat:${groupId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `group_id=eq.${groupId}` }, () => {
        setWsConnected(true)
        lastMessageTimeRef.current = Date.now()
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          setWsConnected(true)
          lastMessageTimeRef.current = Date.now()
        } else {
          setWsConnected(false)
        }
      })
    
    channelRef.current = channel
  }, [groupId, supabase])
  
  // Système de fallback intelligent
  useEffect(() => {
    if (!groupId) return
    
    const startFallbackPolling = () => {
      if (fallbackPollingRef.current) {
        clearInterval(fallbackPollingRef.current)
      }
      
      // Seulement faire du polling si WebSocket est déconnecté
      if (!wsConnected) {
        fallbackPollingRef.current = setInterval(() => {
          // Vérifier s'il y a de nouveaux messages en background SEULEMENT si WebSocket down
          if (!wsConnected) {
            loadMessagesFromAPI(groupId, undefined, true) // background refresh
          }
          
          // Retry WebSocket si down depuis plus de 30s
          if (!wsConnected && Date.now() - lastMessageTimeRef.current > 30000) {
            if (reconnectTimeoutRef.current) {
              clearTimeout(reconnectTimeoutRef.current)
            }
            
            reconnectTimeoutRef.current = setTimeout(() => {
              reconnectWebSocket()
            }, 1000)
          }
        }, 15000) // 15s si WebSocket KO
      }
    }
    
    startFallbackPolling()
    
    return () => {
      if (fallbackPollingRef.current) {
        clearInterval(fallbackPollingRef.current)
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current)
      }
    }
  }, [groupId, wsConnected, reconnectWebSocket, loadMessagesFromAPI])
  
  // Configuration Realtime
  useEffect(() => {
    if (!groupId) {
      return
    }
    
    // Nettoyer l'ancienne connexion
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current)
    }
    
    // Réinitialiser le Set des messages traités quand on change de groupe
    processedMessagesRef.current.clear()
    
    // Réinitialiser l'état des messages pour éviter d'afficher les anciens messages
    setMessages([])
    setLoading(true)
    setError(null)
    
    // Créer le canal Realtime
    const channel = supabase
      .channel(`chat:${groupId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
          filter: `group_id=eq.${groupId}`
        },
        async (payload: RealtimePostgresChangesPayload<any>) => {
          const newMessage = payload.new as ChatMessage
          
          // Marquer WebSocket comme actif
          setWsConnected(true)
          lastMessageTimeRef.current = Date.now()
          
          // Si c'est notre propre message, attendre un peu pour que les fichiers soient insérés
          
          // Pour nos propres messages, attendre un peu et réessayer pour obtenir les fichiers
          const isOurMessage = newMessage.user_id && currentUserIdRef.current && newMessage.user_id === currentUserIdRef.current
          let retryCount = 0
          const maxRetries = isOurMessage ? 3 : 1
          
          if (isOurMessage) {
            await new Promise(resolve => setTimeout(resolve, 500))
          }
          
          let enrichedMessage = null
          let messageError = null
          
          // Si c'est notre message vocal, on s'attend à avoir des fichiers
          const expectingFiles = isOurMessage && newMessage.text?.includes('🎤 Message vocal')
          
          while (retryCount < maxRetries) {
            // Récupérer les infos complètes du message avec les fichiers
            const result = await supabase
              .from('chat_messages')
              .select(`
                *,
                files:chat_files(*)
              `)
              .eq('id', newMessage.id)
              .single()
            
            enrichedMessage = result.data
            messageError = result.error
            
            if (messageError) break
            
            // Si on attend des fichiers et qu'on n'en a pas encore, réessayer
            if (expectingFiles && (!enrichedMessage?.files || enrichedMessage.files.length === 0) && retryCount < maxRetries - 1) {
              await new Promise(resolve => setTimeout(resolve, 1000))
              retryCount++
            } else {
              break
            }
          }
          
          if (messageError) {
            return
          }
          
          if (enrichedMessage) {
            
            // Récupérer les infos du membre - gérer le cas où user_id est null
            let member = null
            
            if (enrichedMessage.user_id) {
              const { data } = await supabase
                .from('members')
                .select('first_name, last_name, photo_url, slack_user_id')
                .eq('user_id', enrichedMessage.user_id)
                .maybeSingle() // Utiliser maybeSingle() au lieu de single() pour éviter les erreurs
              member = data
            } else if (enrichedMessage.slack_user_id) {
              // Si pas d'user_id mais un slack_user_id, essayer de trouver le membre
              const { data } = await supabase
                .from('members')
                .select('first_name, last_name, photo_url, slack_user_id')
                .eq('slack_user_id', enrichedMessage.slack_user_id)
                .maybeSingle()
              member = data
            }
            
            const fullMessage = {
              ...enrichedMessage,
              member,
              files: enrichedMessage.files || [],
              reactions: [],
              mentions: []
            }
            
            setMessages(prev => {
              // Vérifier si le message existe déjà (pour éviter les doublons)
              const existingIndex = prev.findIndex(m => m.id === fullMessage.id)
              if (existingIndex >= 0) {
                const updated = [...prev]
                // IMPORTANT: Toujours conserver les fichiers existants car l'API les envoie avant Realtime
                const existingMessage = prev[existingIndex]
                
                // Fusionner les fichiers - prioriser ceux qui existent déjà
                if (existingMessage.files && existingMessage.files.length > 0) {
                  // Si le message existant a des fichiers, les conserver absolument
                  fullMessage.files = existingMessage.files
                } else if (fullMessage.files && fullMessage.files.length > 0) {
                  // Si le nouveau message a des fichiers, les utiliser
                }
                
                // Vérifier aussi le cache local pour les fichiers
                
                // Chercher d'abord par ID exact
                let localMessage = localMessagesRef.current.get(fullMessage.id)
                
                // Si pas trouvé, chercher un message temporaire avec le même contenu et timestamp proche
                if (!localMessage && fullMessage.text) {
                  for (const [key, cached] of localMessagesRef.current.entries()) {
                    if (key.startsWith('temp_') && cached.text === fullMessage.text) {
                      const timeDiff = Math.abs(new Date(fullMessage.created_at).getTime() - new Date(cached.created_at).getTime())
                      if (timeDiff < 5000) { // 5 secondes de tolérance
                        localMessage = cached
                        // Transférer vers le nouvel ID et supprimer l'ancien
                        localMessagesRef.current.set(fullMessage.id, cached)
                        localMessagesRef.current.delete(key)
                        break
                      }
                    }
                  }
                }
                
                let finalFiles = fullMessage.files || existingMessage.files || []
                
                if (!finalFiles.length && localMessage?.files && localMessage.files.length > 0) {
                  finalFiles = localMessage.files
                }
                
                // Conserver aussi les autres propriétés importantes
                const updatedMessage = {
                  ...fullMessage,
                  // Conserver les fichiers et reactions s'ils existaient
                  files: finalFiles,
                  reactions: fullMessage.reactions || existingMessage.reactions || []
                }
                updated[existingIndex] = updatedMessage
                
                // Mettre à jour le cache avec le message mis à jour (pas l'original)
                if (groupId) {
                  updateMessageInCacheRef.current(groupId, updatedMessage.id, () => updatedMessage)
                }
                return updated
              }
              
              // Double vérification pour éviter les doublons lors d'ajouts rapides
              if (prev.some(m => m.id === fullMessage.id)) {
                return prev
              }
              
              // Vérifier si on a une version locale du message avec des fichiers
              // Cela arrive quand l'API répond avant l'événement Realtime
              
              // Chercher d'abord par ID exact
              let localMessage = localMessagesRef.current.get(fullMessage.id)
              
              // Si pas trouvé, chercher un message temporaire avec le même contenu et timestamp proche
              if (!localMessage && fullMessage.text) {
                for (const [key, cached] of localMessagesRef.current.entries()) {
                  if (key.startsWith('temp_') && cached.text === fullMessage.text) {
                    const timeDiff = Math.abs(new Date(fullMessage.created_at).getTime() - new Date(cached.created_at).getTime())
                    if (timeDiff < 5000) { // 5 secondes de tolérance
                      localMessage = cached
                      // Transférer vers le nouvel ID et supprimer l'ancien
                      localMessagesRef.current.set(fullMessage.id, cached)
                      localMessagesRef.current.delete(key)
                      break
                    }
                  }
                }
              }
              
              if (localMessage?.files && localMessage.files.length > 0) {
                fullMessage.files = localMessage.files
              }
              
              // Ajouter et retrier en respectant les threads
              const updated = sortMessagesWithThreads([fullMessage, ...prev])
              
              // Incrémenter le compteur si l'utilisateur a scrollé vers le haut
              // Le hook useUnreadCounts ne gère PAS le groupe actif pour éviter les conflits
              if (fullMessage.user_id !== currentUserIdRef.current && groupId && incrementUnreadCount) {
                const shouldIncrement = shouldIncrementUnread ? shouldIncrementUnread() : true
                if (shouldIncrement) {
                  // Vérifier qu'on n'a pas déjà traité ce message pour éviter les doublons
                  if (!processedMessagesRef.current.has(fullMessage.id)) {
                    processedMessagesRef.current.add(fullMessage.id)
                    // Déférer l'incrémentation pour éviter l'erreur "Cannot update component while rendering"
                    setTimeout(() => {
                      incrementUnreadCount(groupId)
                    }, 0)
                  }
                } else {
                }
              }
              
              // Mettre à jour le cache
              if (groupId) {
                addMessageToCache(groupId, fullMessage)
              }
              
              return updated
            })
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'chat_messages',
          filter: `group_id=eq.${groupId}`
        },
        async (payload: RealtimePostgresChangesPayload<any>) => {
          const updatedMessage = payload.new as ChatMessage
          
          // Si le message est supprimé, nettoyer les fichiers et réactions
          if (updatedMessage.deleted_at) {
            setMessages(prev => {
              const updated = prev.map(msg => 
                msg.id === updatedMessage.id 
                  ? {
                      ...updatedMessage,
                      files: [], // Supprimer les fichiers pour enlever le player
                      reactions: [], // Supprimer les réactions
                      member: msg.member // Conserver les infos du membre
                    }
                  : msg
              )
              // Mettre à jour le cache
              if (groupId) {
                updateMessageInCacheRef.current(groupId, updatedMessage.id, () => ({
                  ...updatedMessage,
                  files: [],
                  reactions: [],
                  member: prev.find(m => m.id === updatedMessage.id)?.member
                }))
              }
              return updated
            })
            
            // Nettoyer aussi le cache local
            localMessagesRef.current.delete(updatedMessage.id)
            
          } else {
            // Message modifié mais pas supprimé
            // Récupérer les infos du membre - gérer le cas où user_id est null
            let member = null
            
            if (updatedMessage.user_id) {
              const { data } = await supabase
                .from('members')
                .select('first_name, last_name, photo_url, slack_user_id')
                .eq('user_id', updatedMessage.user_id)
                .maybeSingle()
              member = data
            } else if (updatedMessage.slack_user_id) {
              const { data } = await supabase
                .from('members')
                .select('first_name, last_name, photo_url, slack_user_id')
                .eq('slack_user_id', updatedMessage.slack_user_id)
                .maybeSingle()
              member = data
            }
            
            // Récupérer les fichiers si nécessaire
            const { data: files } = await supabase
              .from('chat_files')
              .select('*')
              .eq('message_id', updatedMessage.id)
            
            const fullMessage = {
              ...updatedMessage,
              member,
              files: files || [],
              reactions: [],
              mentions: []
            }
            
            setMessages(prev => {
              const updated = prev.map(msg => 
                msg.id === fullMessage.id ? fullMessage as ChatMessage : msg
              )
              // Mettre à jour le cache
              if (groupId) {
                updateMessageInCacheRef.current(groupId, fullMessage.id, () => fullMessage as ChatMessage)
              }
              return updated
            })
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'chat_messages',
          filter: `group_id=eq.${groupId}`
        },
        (payload: RealtimePostgresChangesPayload<any>) => {
          const deletedId = (payload.old as any).id
          setMessages(prev => {
            const updated = prev.filter(msg => msg.id !== deletedId)
            // Mettre à jour le cache
            if (groupId) {
              removeMessageFromCache(groupId, deletedId)
            }
            return updated
          })
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'chat_reactions'
        },
        async (payload: RealtimePostgresChangesPayload<any>) => {
          // Pour DELETE, Supabase ne renvoie pas les données par défaut
          // On doit utiliser une approche différente
          
          let messageId: string | undefined
          let emoji: string | undefined
          let changeUserId: string | undefined
          
          if (payload.eventType === 'DELETE') {
            // Pour DELETE, essayer de récupérer depuis old, mais si vide, on utilisera une autre approche
            messageId = (payload.old as any)?.message_id
            emoji = (payload.old as any)?.emoji
            changeUserId = (payload.old as any)?.user_id
            
            // Si on n'a pas les données dans old (cas par défaut Supabase), 
            // on va devoir recharger toutes les réactions pour tous les messages
            if (!messageId) {
              // On va parcourir tous les messages et recharger leurs réactions
              const currentMessages = messagesRef.current
              for (const msg of currentMessages) {
                if (msg.reactions && msg.reactions.length > 0) {
                  // Recharger les réactions pour ce message
                  const { data: reactions } = await supabase
                    .from('chat_reactions')
                    .select('*')
                    .eq('message_id', msg.id)
                  
                  if (reactions !== null) {
                    // Grouper les réactions par emoji
                    const reactionGroups: Record<string, any> = {}
                    reactions.forEach(r => {
                      if (!reactionGroups[r.emoji]) {
                        reactionGroups[r.emoji] = {
                          emoji: r.emoji,
                          emoji_name: r.emoji_name,
                          users: [],
                          count: 0
                        }
                      }
                      reactionGroups[r.emoji].users.push({ id: r.user_id, name: 'User' })
                      reactionGroups[r.emoji].count++
                    })
                    
                    // Mettre à jour le message
                    setMessages(prev => prev.map(m => 
                      m.id === msg.id 
                        ? { ...m, reactions: Object.values(reactionGroups) }
                        : m
                    ))
                  }
                }
              }
              return
            }
          } else {
            // Pour INSERT/UPDATE, les données sont dans new
            const data = payload.new
            messageId = (data as any)?.message_id
            emoji = (data as any)?.emoji
            changeUserId = (data as any)?.user_id
          }
          
          const eventType = payload.eventType === 'INSERT' ? 'add' : payload.eventType === 'DELETE' ? 'remove' : 'update'
          
          // Si on n'a pas les données nécessaires, on ignore
          if (!messageId || !emoji) {
            return
          }
          
          // Vérifier si c'est un changement local qu'on a déjà traité
          const changeKey = `${messageId}-${emoji}-${changeUserId}-${eventType}`
          
          if (localReactionChangesRef.current.has(changeKey)) {
            return
          }
          
          // Charger seulement les réactions de ce message spécifique
          if (messageId) {
            // Vérifier d'abord que ce message appartient bien à ce groupe
            const messageExists = messagesRef.current.some(m => m.id === messageId)
            if (!messageExists) {
              return
            }
            
            // Petit délai pour laisser les autres événements arriver
            setTimeout(async () => {
              // Vérifier une dernière fois si ce n'est pas un changement local
              if (!localReactionChangesRef.current.has(changeKey)) {
                // Récupérer seulement les réactions du message concerné
                const { data: reactions } = await supabase
                  .from('chat_reactions')
                  .select('*')
                  .eq('message_id', messageId)
                
                if (reactions) {
                  // Grouper les réactions par emoji
                  const reactionGroups: Record<string, any> = {}
                  reactions.forEach(r => {
                    if (!reactionGroups[r.emoji]) {
                      reactionGroups[r.emoji] = {
                        emoji: r.emoji,
                        emoji_name: r.emoji_name,
                        users: [],
                        count: 0
                      }
                    }
                    reactionGroups[r.emoji].users.push({ id: r.user_id, name: 'User' })
                    reactionGroups[r.emoji].count++
                  })
                  
                  // Mettre à jour seulement ce message
                  setMessages(prev => prev.map(msg => 
                    msg.id === messageId 
                      ? { ...msg, reactions: Object.values(reactionGroups) }
                      : msg
                  ))
                  
                  // Mettre à jour le cache
                  if (groupId) {
                    updateMessageInCacheRef.current(groupId, messageId, msg => ({
                      ...msg,
                      reactions: Object.values(reactionGroups)
                    }))
                  }
                }
              }
            }, 100)
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'chat_typing',
          filter: `group_id=eq.${groupId}`
        },
        async () => {
          // Récupérer les utilisateurs en train de taper
          // Désactivé temporairement si la table n'existe pas
          try {
            const response = await fetch(`/api/chat/typing?group_id=${groupId}`, {
              credentials: 'include'
            })
            if (response.ok) {
              const { typing_users } = await response.json()
              setTypingUsers(typing_users || [])
            } else {
              // Si erreur 500 (table n'existe pas), on ignore silencieusement
              if (response.status === 500) {
                setTypingUsers([])
              }
            }
          } catch (err) {
            // On ignore les erreurs de réseau pour ne pas bloquer le chat
            setTypingUsers([])
          }
        }
      )
    
    channel.subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          setWsConnected(true)
          lastMessageTimeRef.current = Date.now()
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          setWsConnected(false)
        }
      })
    
    channelRef.current = channel
    
    // Charger les messages initiaux avec un petit délai pour s'assurer que loadMessagesRef est défini
    setTimeout(() => {
      if (loadMessagesRef.current) {
        loadMessagesRef.current() // loadMessages utilise déjà groupId via la closure
      }
    }, 0)
    
    // IMPORTANT: Désactivation de la synchronisation Slack côté client
    // Cette synchronisation crée des doublons car :
    // 1. Les messages arrivent déjà via Supabase Realtime
    // 2. La sync Slack devrait être faite côté serveur (cron job)
    // 
    // TODO: Implémenter un cron job côté serveur pour synchroniser Slack → Supabase
    // Les clients doivent uniquement écouter Supabase Realtime
    
    // syncWithSlack() // DÉSACTIVÉ - cause des doublons
    
    // syncIntervalRef.current = setInterval(() => {
    //   syncWithSlack()
    // }, 10000) // DÉSACTIVÉ - cause des doublons
    
    // Cleanup
    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current)
      }
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current)
      }
      if (syncIntervalRef.current) {
        clearInterval(syncIntervalRef.current)
      }
    }
  }, [groupId]) // Simplified dependencies to avoid infinite re-renders
  
  return {
    // État
    messages,
    loading,
    loadingInBackground,
    error,
    typingUsers,
    hasMore,
    sendingMessage,
    wsConnected,
    
    // Actions
    loadMessages,
    sendMessage,
    updateMessage,
    deleteMessage,
    addReaction,
    removeReaction,
    setTyping,
    markAsRead,
    
    // Helpers
    loadMoreMessages: () => {
      if (messages.length > 0 && hasMore && !loading) {
        const oldestMessage = messages[messages.length - 1]
        loadMessages(oldestMessage.id)
      }
    }
  }
}