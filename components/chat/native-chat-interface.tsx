'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useNativeChat } from '@/hooks/use-native-chat'
import { formatDistanceToNow } from 'date-fns'
import { fr } from 'date-fns/locale'
import EmojiPicker, { EmojiClickData } from 'emoji-picker-react'
import { formatSlackMessage } from '@/lib/slack-formatter'
import { Send, Paperclip, Edit2, Trash2, Reply, X, ChevronDown, ArrowDown, StopCircle } from 'lucide-react'
import { LexicalEditor } from './lexical-editor'
import { AudioPlayer } from './audio-player'
import { MessageItem } from './message-item'
import { FilePreviewNative } from './file-preview-native'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Spinner } from '@/components/ui/spinner'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

interface NativeChatInterfaceProps {
  groupId: string
  groupName?: string
  currentUserId: string
  className?: string
  markChannelAsRead?: (groupId: string) => void
  incrementUnreadCount?: (groupId: string) => void
}

// Emojis courants pour les réactions rapides
const QUICK_REACTIONS = ['👍', '❤️', '😄', '👏', '🔥', '🎉', '👀', '🤔']

// Composant AudioPlayer mémorisé pour éviter les re-rendus
const MemoizedAudioPlayer = React.memo(AudioPlayer)

function NativeChatInterface({
  groupId,
  groupName,
  currentUserId,
  className,
  markChannelAsRead,
  incrementUnreadCount
}: NativeChatInterfaceProps) {
  const [mounted, setMounted] = useState(false)
  
  useEffect(() => {
    setMounted(true)
  }, [])

  // Auto-focus sur le champ de texte quand on tape
  useEffect(() => {
    const handleGlobalKeyPress = (e: KeyboardEvent) => {
      // Ignorer si on est déjà dans un champ de saisie
      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.contentEditable === 'true') {
        return
      }
      
      // Ignorer les touches de contrôle et les raccourcis
      if (e.ctrlKey || e.metaKey || e.altKey) {
        return
      }
      
      // Ignorer certaines touches spéciales
      const ignoredKeys = ['Tab', 'Escape', 'Enter', 'Shift', 'Control', 'Alt', 'Meta', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'PageUp', 'PageDown', 'Home', 'End', 'F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8', 'F9', 'F10', 'F11', 'F12']
      if (ignoredKeys.includes(e.key)) {
        return
      }
      
      // Donner le focus à l'éditeur et insérer le caractère tapé
      if (editorRef.current?.focus) {
        editorRef.current.focus()
        
        // Si c'est une lettre, un chiffre ou un caractère imprimable, l'ajouter au texte
        if (e.key.length === 1) {
          // Ajouter le caractère tapé au texte existant
          setMessageText(prev => prev + e.key)
          // Empêcher le comportement par défaut
          e.preventDefault()
        }
      }
    }

    window.addEventListener('keydown', handleGlobalKeyPress)
    return () => {
      window.removeEventListener('keydown', handleGlobalKeyPress)
    }
  }, [])

  // Refs pour le scroll - définis avant car utilisés dans les callbacks
  const scrollAreaRef = useRef<HTMLDivElement>(null)
  
  // Fonction pour vérifier si on est près du bas - définie avant car utilisée dans le callback
  const isNearBottomEarly = useCallback(() => {
    if (!scrollAreaRef.current) return true
    const { scrollTop, scrollHeight, clientHeight } = scrollAreaRef.current
    const distanceFromBottom = scrollHeight - scrollTop - clientHeight
    return distanceFromBottom < 100 // Considéré près du bas si moins de 100px
  }, [])

  // Callback pour déterminer si on doit incrémenter les messages non lus
  const shouldIncrementUnread = useCallback(() => {
    // Ne pas incrémenter si on est près du bas du scroll
    return !isNearBottomEarly()
  }, [isNearBottomEarly])

  const {
    messages,
    loading,
    loadingInBackground,
    error,
    typingUsers,
    hasMore,
    sendingMessage,
    loadMessages,
    sendMessage,
    updateMessage,
    deleteMessage,
    addReaction,
    removeReaction,
    setTyping,
    markAsRead,
    loadMoreMessages
  } = useNativeChat(groupId, shouldIncrementUnread, incrementUnreadCount)
  

  const [messageText, setMessageText] = useState('')
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null)
  const [editingText, setEditingText] = useState('')
  const [replyingTo, setReplyingTo] = useState<string | null>(null)
  const [showEmojiReactionPicker, setShowEmojiReactionPicker] = useState<string | null>(null)
  const [attachedFiles, setAttachedFiles] = useState<File[]>([])
  const [isTyping, setIsTyping] = useState(false)
  const [showScrollButton, setShowScrollButton] = useState(false)
  const [newMessagesWhileScrolled, setNewMessagesWhileScrolled] = useState(0)
  const [isLoadingHistory, setIsLoadingHistory] = useState(false)
  const [expectedMessagesAfterLoad, setExpectedMessagesAfterLoad] = useState<number | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const editorRef = useRef<any>(null)
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const [recordingTime, setRecordingTime] = useState(0)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const isUserScrollingRef = useRef(false)
  const lastScrollTopRef = useRef(0)
  const previousScrollHeightRef = useRef(0)
  const isLoadingMoreRef = useRef(false)
  const hasInitiallyLoadedRef = useRef(false)
  const previousMessageCountRef = useRef(0)
  const hasUserInteractedRef = useRef(false) // Pour éviter le marquage automatique au chargement

  // Utiliser la fonction isNearBottomEarly définie en haut
  const isNearBottom = isNearBottomEarly

  // Fonction pour scroller vers le bas
  const scrollToBottom = useCallback((smooth = false) => {
    if (!scrollAreaRef.current) return
    const scrollElement = scrollAreaRef.current
    scrollElement.scrollTop = scrollElement.scrollHeight
  }, [])

  // Gérer le scroll manuel de l'utilisateur
  const handleScroll = useCallback(() => {
    if (!scrollAreaRef.current) return
    
    const currentScrollTop = scrollAreaRef.current.scrollTop
    const nearBottom = isNearBottom()
    
    // Marquer que l'utilisateur a interagi
    hasUserInteractedRef.current = true
    
    // Déterminer si l'utilisateur a scrollé manuellement
    // On considère qu'il y a eu scroll manuel si le déplacement est significatif
    // et qu'on n'est pas près du bas
    if (Math.abs(currentScrollTop - lastScrollTopRef.current) > 10) {
      isUserScrollingRef.current = !nearBottom
    }
    
    // Si on est revenu près du bas après avoir scrollé ET que l'utilisateur a interagi
    if (nearBottom && !showScrollButton && messages.length > 0 && hasUserInteractedRef.current) {
      // Marquer comme lu
      if (markChannelAsRead) {
        markChannelAsRead(groupId)
      }
      // Réinitialiser le compteur de nouveaux messages
      setNewMessagesWhileScrolled(0)
    }
    
    // Afficher/masquer le bouton de retour en bas
    setShowScrollButton(!nearBottom)
    
    lastScrollTopRef.current = currentScrollTop
  }, [isNearBottom, showScrollButton, messages.length, groupId, markChannelAsRead, scrollToBottom])

  // Scroll initial au chargement des messages
  useEffect(() => {
    if (messages.length > 0 && !loading && !isLoadingMoreRef.current && !hasInitiallyLoadedRef.current) {
      hasInitiallyLoadedRef.current = true
      // Initialiser le compteur de messages au premier chargement
      previousMessageCountRef.current = messages.length
      // Forcer le scroll au bas lors du premier chargement uniquement
      const timer = setTimeout(() => {
        scrollToBottom(false)
      }, 150)
      return () => clearTimeout(timer)
    }
  }, [loading, messages.length]) // Ajouter messages.length pour initialiser le compteur

  // Auto-scroll sur nouveaux messages (seulement si on est déjà en bas)
  useEffect(() => {
    if (scrollAreaRef.current && messages.length > 0) {
      // Si on est en train de charger l'historique, ne rien faire
      if (isLoadingHistory || isLoadingMoreRef.current) {
        // Mettre à jour le compteur sans déclencher d'actions et sans incrémenter le badge
        previousMessageCountRef.current = messages.length
        return
      }
      
      // Si c'est le premier chargement, ne pas compter comme nouveaux messages
      if (!hasInitiallyLoadedRef.current) {
        previousMessageCountRef.current = messages.length
        return
      }
      
      // Si on a déjà des messages enregistrés
      if (previousMessageCountRef.current > 0) {
        // Détecter si de nouveaux messages sont arrivés
        const hasNewMessages = messages.length > previousMessageCountRef.current
        
        // Si de nouveaux messages arrivent (pas l'historique)
        if (hasNewMessages) {
          if (isNearBottom()) {
            // Si on est près du bas, scroller et réinitialiser le compteur
            setTimeout(() => scrollToBottom(true), 100) // Petit délai pour laisser le DOM se mettre à jour
            isUserScrollingRef.current = false
            setNewMessagesWhileScrolled(0)
          } else {
            // Si on n'est pas près du bas, incrémenter le compteur de nouveaux messages
            const newCount = messages.length - previousMessageCountRef.current
            setNewMessagesWhileScrolled(prev => {
              return prev + newCount
            })
          }
        }
      }
      
      // Mettre à jour le compteur de messages
      previousMessageCountRef.current = messages.length
    }
  }, [messages.length, isNearBottom, scrollToBottom, isLoadingHistory])

  // Réinitialiser isLoadingHistory quand les messages attendus sont arrivés
  useEffect(() => {
    if (expectedMessagesAfterLoad !== null && messages.length >= expectedMessagesAfterLoad) {
      setIsLoadingHistory(false)
      setExpectedMessagesAfterLoad(null)
    }
  }, [messages.length, expectedMessagesAfterLoad])

  // Marquer le canal comme lu seulement si on est en bas ET que l'utilisateur a interagi
  useEffect(() => {
    // Ne pas marquer comme lu si on est en train de charger l'historique
    if (isLoadingMoreRef.current) {
      return
    }
    
    if (messages.length > 0 && !loading && groupId && isNearBottom() && markChannelAsRead && hasUserInteractedRef.current) {
      // Marquer le canal comme lu après un court délai, seulement si on est près du bas et après interaction
      const timer = setTimeout(() => {
        markChannelAsRead(groupId)
      }, 500)
      return () => clearTimeout(timer)
    }
  }, [messages.length, loading, groupId, markChannelAsRead, isNearBottom])


  // Réinitialiser les flags quand on change de groupe
  useEffect(() => {
    isUserScrollingRef.current = false
    hasInitiallyLoadedRef.current = false // Réinitialiser pour le nouveau groupe
    previousMessageCountRef.current = 0 // Réinitialiser le compteur de messages
    hasUserInteractedRef.current = false // Réinitialiser le flag d'interaction
    // Forcer le scroll immédiatement au changement de groupe
    const timer = setTimeout(() => {
      scrollToBottom(false)
    }, 100)
    return () => clearTimeout(timer)
  }, [groupId, scrollToBottom])

  // Marquer comme lu quand on voit les messages
  useEffect(() => {
    // Ne marquer comme lu que si l'utilisateur a interagi et qu'on est en bas
    if (messages.length > 0 && hasUserInteractedRef.current && isNearBottom()) {
      const latestMessage = messages[0]
      // Vérifier qu'on a bien un ID valide avant d'appeler markAsRead
      if (latestMessage && latestMessage.id) {
        markAsRead(latestMessage.id)
      }
    }
  }, [messages, markAsRead, isNearBottom])

  // Gérer l'affichage du toast pour le chargement en arrière-plan
  useEffect(() => {
    let toastId: string | number | undefined
    
    if (loadingInBackground) {
      toastId = toast.loading('Recherche de nouveaux messages...', {
        duration: Infinity,
      })
    }
    
    return () => {
      if (toastId) {
        toast.dismiss(toastId)
      }
    }
  }, [loadingInBackground])

  // Gestion du typing
  const handleTyping = useCallback(() => {
    if (!isTyping) {
      setIsTyping(true)
      setTyping(true)
    }

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current)
    }

    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false)
      setTyping(false)
    }, 3000)
  }, [isTyping, setTyping])

  // Envoyer le message
  const handleSendMessage = async () => {
    if (!messageText.trim() && attachedFiles.length === 0) return

    const success = await sendMessage(
      messageText,
      replyingTo || undefined,
      attachedFiles.length > 0 ? attachedFiles : undefined
    )

    if (success) {
      setMessageText('')
      setReplyingTo(null)
      setAttachedFiles([])
      setIsTyping(false)
      setTyping(false)
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current)
      }
      // Toujours scroller vers le bas après l'envoi d'un message
      isUserScrollingRef.current = false
      setTimeout(() => scrollToBottom(true), 100)
    }
  }

  // Modifier un message
  const handleUpdateMessage = async () => {
    if (!editingMessageId || !editingText.trim()) return

    const success = await updateMessage(editingMessageId, editingText)
    if (success) {
      setEditingMessageId(null)
      setEditingText('')
    }
  }

  // Supprimer un message
  const handleDeleteMessage = async (messageId: string) => {
    if (confirm('Êtes-vous sûr de vouloir supprimer ce message ?')) {
      await deleteMessage(messageId)
    }
  }

  // Ajouter/retirer une réaction
  const handleToggleReaction = async (messageId: string, emoji: string) => {
    const message = messages.find(m => m.id === messageId)
    const existingReaction = message?.reactions?.find(r => r.emoji === emoji)
    const hasReacted = existingReaction?.users.some(u => u.id === currentUserId)

    if (hasReacted) {
      await removeReaction(messageId, emoji)
    } else {
      await addReaction(messageId, emoji)
    }
    setShowEmojiReactionPicker(null)
  }

  // Gérer la sélection de fichiers
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    setAttachedFiles(prev => [...prev, ...files])
  }

  // Fonctions pour l'enregistrement vocal
  const startRecording = async () => {
    try {
      // Configuration audio optimisée
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100,
          autoGainControl: true
        }
      })
      
      // Déterminer le meilleur format audio disponible
      let mimeType = 'audio/webm'
      if (MediaRecorder.isTypeSupported('audio/mp4')) {
        mimeType = 'audio/mp4'
      } else if (MediaRecorder.isTypeSupported('audio/ogg')) {
        mimeType = 'audio/ogg'
      }
      
      const mediaRecorder = new MediaRecorder(stream, { 
        mimeType,
        audioBitsPerSecond: 256000 // 256 kbps pour une excellente qualité
      })
      
      audioChunksRef.current = []
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data)
        }
      }
      
      mediaRecorder.onstop = async () => {
        // Vérifier qu'on a des données
        if (audioChunksRef.current.length === 0) {
          toast.error('Erreur lors de l\'enregistrement audio')
          return
        }
        
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType })
        
        // Vérifier la taille du blob
        if (audioBlob.size === 0) {
          toast.error('Erreur lors de l\'enregistrement audio')
          return
        }
        
        // Arrêter le stream
        stream.getTracks().forEach(track => track.stop())
        
        // Déterminer l'extension du fichier
        const extension = mimeType.includes('mp4') ? 'mp4' : 
                         mimeType.includes('ogg') ? 'ogg' : 'webm'
        
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
        const fileName = `audio-${timestamp}.${extension}`
        const file = new File([audioBlob], fileName, { type: mimeType })
        
        
        // Envoyer automatiquement le message vocal
        await sendMessage('🎤 Message vocal', undefined, [file])
      }
      
      // Utiliser un timeslice de 1000ms pour s'assurer que les données sont collectées
      mediaRecorder.start(1000)
      mediaRecorderRef.current = mediaRecorder
      setIsRecording(true)
      setRecordingTime(0)
      
      // Démarrer le timer
      recordingIntervalRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1)
      }, 1000)
    } catch (error) {
      toast.error('Impossible d\'accéder au microphone. Vérifiez les permissions.')
    }
  }
  
  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop()
      setIsRecording(false)
      
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current)
        recordingIntervalRef.current = null
      }
    }
  }
  
  const cancelRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop()
      mediaRecorderRef.current.onstop = () => {
        const stream = mediaRecorderRef.current?.stream
        if (stream) {
          stream.getTracks().forEach(track => track.stop())
        }
      }
    }
    
    setIsRecording(false)
    setRecordingTime(0)
    audioChunksRef.current = []
    
    if (recordingIntervalRef.current) {
      clearInterval(recordingIntervalRef.current)
      recordingIntervalRef.current = null
    }
  }
  
  const formatRecordingTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }


  // Obtenir le message parent pour une réponse
  const getParentMessage = useCallback((threadTs: string) => {
    return messages.find(m => m.id === threadTs)
  }, [messages])

  // Charger plus de messages
  const handleLoadMoreMessages = async () => {
    // Marquer qu'on charge l'historique et définir le nombre attendu de messages
    setIsLoadingHistory(true)
    // On s'attend à avoir plus de messages après le chargement (on ne sait pas combien exactement)
    // mais on sait qu'on aura au moins les messages actuels
    setExpectedMessagesAfterLoad(messages.length + 1) // Au moins 1 de plus
    
    if (scrollAreaRef.current) {
      // Sauvegarder la hauteur et la position avant le chargement
      const scrollElement = scrollAreaRef.current
      const previousScrollHeight = scrollElement.scrollHeight
      const previousScrollTop = scrollElement.scrollTop
      
      // Marquer immédiatement qu'on charge plus de messages (synchrone)
      isLoadingMoreRef.current = true
      
      await loadMoreMessages()
      
      // Restaurer la position après le chargement avec un délai plus long pour laisser le DOM se mettre à jour
      setTimeout(() => {
        if (scrollAreaRef.current) {
          const newScrollHeight = scrollAreaRef.current.scrollHeight
          const scrollDiff = newScrollHeight - previousScrollHeight
          // Ajuster la position pour maintenir la vue au même endroit
          scrollAreaRef.current.scrollTop = previousScrollTop + scrollDiff
        }
        // Réinitialiser le flag isLoadingMoreRef mais PAS isLoadingHistory
        // isLoadingHistory sera réinitialisé quand les messages auront été traités
        isLoadingMoreRef.current = false
      }, 100)
    } else {
      isLoadingMoreRef.current = true
      await loadMoreMessages()
      setTimeout(() => {
        isLoadingMoreRef.current = false
      }, 200)
    }
  }

  // Rendu d'un message - mémorisé pour éviter les re-rendus
  const renderMessage = useCallback((message: typeof messages[0], isReply = false, showHeader = true) => {
    const isCurrentUser = message.user_id === currentUserId
    const parentMessage = message.thread_ts ? getParentMessage(message.thread_ts) : null

    return (
      <div
        className={cn(
          'group flex gap-3 hover:bg-[#f0f1f2] relative',
          showHeader ? 'pt-3' : 'pt-1',
          'px-3 pb-1',
          isReply && 'ml-12 border-l-2 border-gray-200',
          message.deleted_at && 'opacity-50'
        )}
      >
        {!isReply && showHeader ? (
          <Avatar className="h-8 w-8 flex-shrink-0">
            <AvatarImage src={message.member?.photo_url || undefined} />
            <AvatarFallback>
              {message.member?.first_name?.[0]}{message.member?.last_name?.[0]}
            </AvatarFallback>
          </Avatar>
        ) : !isReply ? (
          <div className="w-8 flex-shrink-0" />
        ) : null}

        <div className="flex-1 min-w-0">
          {!isReply && showHeader && (
            <div className="flex items-baseline gap-2 mb-1">
              <span className="font-semibold text-sm">
                {isCurrentUser ? 'Vous' : `${message.member?.first_name} ${message.member?.last_name}`}
              </span>
              {mounted && (
                <span className="text-xs text-gray-500">
                  {formatDistanceToNow(new Date(message.created_at), {
                    addSuffix: true,
                    locale: fr
                  })}
                </span>
              )}
              {message.edited_at && (
                <span className="text-xs text-gray-400">(modifié)</span>
              )}
              {message.is_from_slack && (
                <span className="text-xs text-blue-500">via Slack</span>
              )}
            </div>
          )}

          {parentMessage && !isReply && (
            <div className="text-xs text-gray-500 mb-1 p-2 bg-gray-100 rounded">
              Réponse à {parentMessage.user_id === currentUserId ? 'vous' : parentMessage.member?.first_name}: {parentMessage.text.substring(0, 50)}...
            </div>
          )}

          {editingMessageId === message.id ? (
            <div className="flex gap-2">
              <Input
                value={editingText}
                onChange={(e) => setEditingText(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleUpdateMessage()}
                className="flex-1"
                autoFocus
              />
              <Button size="sm" onClick={handleUpdateMessage}>
                Modifier
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setEditingMessageId(null)
                  setEditingText('')
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <div 
              className={cn(
                "break-words slack-message",
                // Si le message commence par 📎 ou 🎤, le rendre petit et estompé
                (message.text.startsWith('📎') || message.text.startsWith('🎤')) ? "text-xs text-gray-500" : "text-sm"
              )}
              dangerouslySetInnerHTML={{ __html: formatSlackMessage(message.formatted_text || message.text) }}
            />
          )}

          {/* Fichiers attachés */}
          {message.files && message.files.length > 0 && (
            <div className="mt-2 space-y-2">
              {message.files.map(file => {
                // Si c'est un fichier audio, afficher le lecteur audio
                if (file.mimetype && file.mimetype.startsWith('audio/')) {
                  return (
                    <MemoizedAudioPlayer
                      key={file.id}
                      src={`/api/chat/upload?path=${file.storage_path}&direct=true`}
                      className="max-w-md"
                    />
                  )
                }
                
                // Pour tous les autres fichiers, utiliser le nouveau composant FilePreviewNative
                return (
                  <FilePreviewNative
                    key={file.id}
                    file={file}
                  />
                )
                
                if (file.mimetype.includes('sheet') || file.mimetype.includes('excel')) {
                  fileIcon = <svg className="w-5 h-5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z"/>
                    <path fillRule="evenodd" d="M4 5a2 2 0 012-2 1 1 0 000 2H6a2 2 0 00-2 2v6a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-1a1 1 0 100-2h1a4 4 0 014 4v6a4 4 0 01-4 4H6a4 4 0 01-4-4V7a4 4 0 014-4z" clipRule="evenodd"/>
                  </svg>
                  fileType = 'Tableur'
                } else if (file.mimetype.includes('word') || file.mimetype.includes('document')) {
                  fileIcon = <svg className="w-5 h-5 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M4 4a2 2 0 012-2h8l4 4v10a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 0v12h8V8h-4V4H6z" clipRule="evenodd"/>
                  </svg>
                  fileType = 'Document'
                } else if (file.mimetype.includes('presentation') || file.mimetype.includes('powerpoint')) {
                  fileIcon = <svg className="w-5 h-5 text-orange-600" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M10 12a2 2 0 100-4 2 2 0 000 4z"/>
                    <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd"/>
                  </svg>
                  fileType = 'Pr\u00e9sentation'
                } else if (file.mimetype.includes('zip') || file.mimetype.includes('compressed')) {
                  fileIcon = <svg className="w-5 h-5 text-yellow-600" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M6 2a2 2 0 00-2 2v12a2 2 0 002 2h8a2 2 0 002-2V7.414A2 2 0 0015.414 6L12 2.586A2 2 0 0010.586 2H6zm5 6a1 1 0 10-2 0v3.586l-1.293-1.293a1 1 0 10-1.414 1.414l3 3a1 1 0 001.414 0l3-3a1 1 0 00-1.414-1.414L11 11.586V8z" clipRule="evenodd"/>
                  </svg>
                  fileType = 'Archive'
                }
                
                return (
                  <div key={file.id} className="mt-2 inline-block">
                    <div className="flex items-start gap-3 p-3 bg-[#f9f9f9] rounded-lg border border-gray-300 hover:border-gray-400 transition-colors max-w-md">
                      <div className="flex-shrink-0 w-10 h-10 bg-gray-100 rounded border border-gray-200 flex items-center justify-center text-gray-500">
                        {fileIcon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <a
                          href={`/api/chat/upload?path=${file.storage_path}`}
                          download={file.original_name}
                          className="text-sm font-medium text-[#1d1c1d] hover:text-blue-600 hover:underline block truncate"
                        >
                          {file.original_name || file.name}
                        </a>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[11px] text-gray-500">{fileType}</span>
                          <span className="text-[11px] text-gray-400">•</span>
                          <span className="text-[11px] text-gray-400">
                            {Math.round(file.size / 1024)}KB
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* Réactions */}
          {message.reactions && message.reactions.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {message.reactions.map(reaction => (
                <Popover key={reaction.emoji}>
                  <PopoverTrigger asChild>
                    <button
                      onClick={() => handleToggleReaction(message.id, reaction.emoji)}
                      className={cn(
                        'inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs',
                        'bg-gray-100 hover:bg-gray-200 transition-colors',
                        reaction.users.some(u => u.id === currentUserId) && 'bg-blue-100 hover:bg-blue-200'
                      )}
                    >
                      <span>{reaction.emoji}</span>
                      <span>{reaction.count}</span>
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-2">
                    <div className="text-xs">
                      {reaction.users.map(u => u.name).join(', ')}
                    </div>
                  </PopoverContent>
                </Popover>
              ))}
            </div>
          )}

          {/* Actions du message */}
          {!message.deleted_at && (
            <div className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 transition-opacity">
              <div className="flex items-center gap-1 bg-white shadow-lg rounded p-1">
                {/* Réactions rapides */}
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 w-7 p-0"
                    >
                      😊
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-1">
                    <div className="flex gap-1">
                      {QUICK_REACTIONS.map(emoji => (
                        <button
                          key={emoji}
                          onClick={() => handleToggleReaction(message.id, emoji)}
                          className="p-1 hover:bg-gray-100 rounded"
                        >
                          {emoji}
                        </button>
                      ))}
                      <button
                        onClick={() => setShowEmojiReactionPicker(message.id)}
                        className="p-1 hover:bg-gray-100 rounded text-gray-500"
                        title="Plus d'emojis"
                      >
                        +
                      </button>
                    </div>
                  </PopoverContent>
                </Popover>

                {/* Répondre */}
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 w-7 p-0"
                  onClick={() => {
                    setReplyingTo(message.id)
                    inputRef.current?.focus()
                  }}
                >
                  <Reply className="h-4 w-4" />
                </Button>

                {/* Modifier (si c'est notre message et que ce n'est pas un message vocal) */}
                {isCurrentUser && !message.text?.includes('🎤 Message vocal') && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 w-7 p-0"
                    onClick={() => {
                      setEditingMessageId(message.id)
                      setEditingText(message.text)
                    }}
                  >
                    <Edit2 className="h-4 w-4" />
                  </Button>
                )}

                {/* Supprimer (si c'est notre message) */}
                {isCurrentUser && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 w-7 p-0"
                    onClick={() => handleDeleteMessage(message.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Emoji picker flottant */}
        {showEmojiReactionPicker === message.id && (
          <div className="absolute right-0 top-10 z-50">
            <div className="relative">
              <Button
                size="sm"
                variant="ghost"
                className="absolute -top-8 right-0"
                onClick={() => setShowEmojiReactionPicker(null)}
              >
                <X className="h-4 w-4" />
              </Button>
              <EmojiPicker
                onEmojiClick={(emojiData) => {
                  handleToggleReaction(message.id, emojiData.emoji)
                }}
                searchDisabled
                skinTonesDisabled
                width={300}
                height={400}
              />
            </div>
          </div>
        )}
      </div>
    )
  }, [currentUserId, messages, editingMessageId, editingText, showEmojiReactionPicker, mounted, updateMessage, deleteMessage, addReaction, removeReaction, setReplyingTo, setEditingMessageId, getParentMessage])

  // Fonction pour vérifier si deux messages doivent être groupés
  const shouldGroupMessages = (msg1: typeof messages[0], msg2: typeof messages[0]) => {
    if (!msg1 || !msg2) return false
    if (msg1.user_id !== msg2.user_id) return false
    
    // Grouper si les messages sont envoyés dans les 60 secondes
    const time1 = new Date(msg1.created_at).getTime()
    const time2 = new Date(msg2.created_at).getTime()
    const timeDiff = Math.abs(time1 - time2)
    return timeDiff < 60 * 1000 // 60 secondes
  }

  // Dédupliquer les messages par ID au cas où
  const uniqueMessages = Array.from(
    new Map(messages.map(msg => [msg.id, msg])).values()
  )
  
  // Grouper les messages par thread et par utilisateur
  const messageGroups = uniqueMessages.reduce((acc, message, index) => {
    if (!message.thread_ts) {
      // Message principal
      // Vérifier si on peut grouper avec le dernier groupe existant
      const lastGroup = acc.length > 0 ? acc[acc.length - 1] : null
      const lastMessageInGroup = lastGroup && !lastGroup.isThread && lastGroup.messages.length > 0 
        ? lastGroup.messages[0] // Le plus récent du groupe (car on unshift)
        : null
      
      if (lastGroup && lastMessageInGroup && shouldGroupMessages(message, lastMessageInGroup)) {
        // Ajouter au début du groupe existant
        lastGroup.messages.unshift(message)
      } else {
        // Créer un nouveau groupe
        acc.push({ 
          messages: [message], 
          replies: [],
          isThread: false
        })
      }
    } else {
      // Réponse dans un thread
      const parentGroup = acc.find(g => 
        g.messages.some(m => m.id === message.thread_ts)
      )
      if (parentGroup) {
        parentGroup.replies.unshift(message)
      }
    }
    return acc
  }, [] as Array<{ messages: typeof messages, replies: typeof messages, isThread: boolean }>)

  return (
    <div className={cn('flex flex-col h-full', className)}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b flex-shrink-0">
        <h2 className="text-lg font-semibold">{groupName || 'Chat'}</h2>
        {error && (
          <span className="text-sm text-red-500">{error}</span>
        )}
      </div>

      {/* Bouton flottant pour revenir en bas - positionné en absolute dans le container */}
      {showScrollButton && (
        <Button
          onClick={() => {
            scrollToBottom(true)
            isUserScrollingRef.current = false
            setNewMessagesWhileScrolled(0)
            // Marquer les messages comme lus quand on clique sur le bouton
            if (markChannelAsRead) {
              setTimeout(() => {
                markChannelAsRead(groupId)
              }, 200)
            }
          }}
          className="absolute bottom-20 right-4 rounded-full shadow-lg z-50"
          size="icon"
          variant="secondary"
        >
          <ArrowDown className="h-4 w-4" />
          {newMessagesWhileScrolled > 0 && (
            <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full min-w-[20px] h-5 flex items-center justify-center px-1">
              {newMessagesWhileScrolled}
            </span>
          )}
        </Button>
      )}

      {/* Messages */}
      <div 
        className="flex-1 overflow-y-auto relative scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent min-h-0" 
        ref={scrollAreaRef}
        onScroll={handleScroll}
      >
        
        {/* Bouton charger plus - masqué lors du chargement initial */}
        {hasMore && messages.length > 0 && (
          <div className="text-center p-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLoadMoreMessages}
              disabled={loading}
            >
              {loading ? (
                <Spinner size="sm" />
              ) : (
                <>
                  <ChevronDown className="h-4 w-4 mr-1 rotate-180" />
                  Charger plus
                </>
              )}
            </Button>
          </div>
        )}

        {/* Liste des messages */}
        <div className="flex flex-col-reverse">
          {messageGroups.map((group, groupIndex) => (
            <div key={`group-${groupIndex}`}>
              {/* Afficher les messages du groupe */}
              {group.messages.map((message, messageIndex) => (
                <MessageItem
                  key={message.id}
                  message={message}
                  renderMessage={renderMessage}
                  isReply={false}
                  showHeader={messageIndex === 0}
                />
              ))}
              {/* Afficher les réponses */}
              {group.replies.map((reply) => (
                <MessageItem
                  key={reply.id}
                  message={reply}
                  renderMessage={renderMessage}
                  isReply={true}
                  showHeader={true}
                />
              ))}
            </div>
          ))}
        </div>

        {/* Messages en cours de chargement */}
        {loading && messages.length === 0 && (
          <div className="flex items-center justify-center p-8">
            <Spinner size="lg" />
          </div>
        )}

        {/* Aucun message */}
        {!loading && messages.length === 0 && (
          <div className="text-center p-8 text-gray-500">
            Aucun message pour le moment
          </div>
        )}

        {/* Indicateur de frappe - toujours visible avec hauteur fixe */}
        <div className="h-8 flex items-center px-4 flex-shrink-0">
          {typingUsers.length > 0 && (
            <div className="text-xs text-gray-400 italic">
              {typingUsers.map(u => u.name).join(', ')} 
              {typingUsers.length === 1 ? ' est' : ' sont'} en train d'écrire...
            </div>
          )}
        </div>

      </div>

      {/* Zone de saisie */}
      <div className="border-t bg-white flex-shrink-0 p-4">
        {/* Réponse en cours */}
        {replyingTo && (
          <div className="flex items-center justify-between mb-2 p-2 bg-gray-100 rounded">
            <div className="text-sm">
              <span className="text-gray-500">Réponse à </span>
              <span className="font-semibold">
                {(() => {
                  const replyMessage = messages.find(m => m.id === replyingTo)
                  return replyMessage?.user_id === currentUserId ? 'vous' : replyMessage?.member?.first_name
                })()}
              </span>
            </div>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setReplyingTo(null)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        )}

        {/* Fichiers attachés */}
        {attachedFiles.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-2">
            {attachedFiles.map((file, index) => (
              <div
                key={index}
                className="flex items-center gap-2 px-2 py-1 bg-gray-100 rounded"
              >
                <Paperclip className="h-3 w-3" />
                <span className="text-sm">{file.name}</span>
                <button
                  onClick={() => setAttachedFiles(prev => prev.filter((_, i) => i !== index))}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}


        {/* Indicateur d'enregistrement */}
        {isRecording && (
          <div className="flex items-center justify-between mb-2 p-2 bg-red-50 rounded-lg">
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 bg-red-500 rounded-full animate-pulse" />
              <span className="text-sm font-medium">Enregistrement en cours...</span>
              <span className="text-sm text-gray-600">{formatRecordingTime(recordingTime)}</span>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={cancelRecording}
              >
                Annuler
              </Button>
              <Button
                size="sm"
                onClick={stopRecording}
              >
                <StopCircle className="h-4 w-4 mr-1" />
                Arrêter et envoyer
              </Button>
            </div>
          </div>
        )}

        {/* Input et boutons */}
        <div className="flex gap-2 items-center">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileSelect}
            multiple
            className="hidden"
          />
          
          <Button
            size="icon"
            variant="ghost"
            onClick={() => fileInputRef.current?.click()}
            disabled={isRecording}
            className="h-9 w-9"
          >
            <Paperclip className="h-4 w-4" />
          </Button>

          <div className="flex-1">
            <LexicalEditor
              ref={editorRef}
              value={messageText}
              onChange={(markdown) => {
                setMessageText(markdown)
                handleTyping()
              }}
              onSubmit={handleSendMessage}
              placeholder="Tapez votre message..."
              disabled={sendingMessage || isRecording}
              showEmojiPicker={showEmojiPicker}
              setShowEmojiPicker={setShowEmojiPicker}
              isRecording={isRecording}
              onStartRecording={startRecording}
              onStopRecording={stopRecording}
              className="bg-white"
            />
          </div>

          <Button
            onClick={handleSendMessage}
            disabled={sendingMessage || (!messageText.trim() && attachedFiles.length === 0) || isRecording}
            size="default"
            className="h-9"
          >
            {sendingMessage ? (
              <Spinner size="sm" className="h-4 w-4 text-primary-foreground" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}

export default NativeChatInterface
export { NativeChatInterface }