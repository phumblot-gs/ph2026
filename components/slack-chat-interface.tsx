'use client'

import { useState, useEffect, useRef } from 'react'
import { Send, Paperclip, Smile, Mic, Hash, ChevronUp, Bold, Italic, Strikethrough, Link2, List, ListOrdered, Type, Square, MicOff, Edit2, Trash2, X, Check, MessageCircle, SmilePlus } from 'lucide-react'
import { Spinner } from '@/components/ui/spinner'
import EmojiPicker from 'emoji-picker-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { formatSlackMessage, formatSlackMessagePreview, extractMessageSignature } from '@/lib/slack-formatter'
import { slackRealtime } from '@/lib/slack/realtime'
import { AudioPlayer } from '@/components/audio-player'
import { FilePreview, FileList } from '@/components/file-preview'

interface SlackMessage {
  user: string
  text: string
  timestamp: string
  ts?: string
  channel: string
  member?: {
    slack_user_id: string
    first_name: string
    last_name: string
    photo_url?: string | null
  } | null
  realAuthor?: {
    slack_user_id: string
    first_name: string
    last_name: string
    photo_url?: string | null
  } | null
  user_profile?: {
    name: string
    real_name: string
    image_48: string
  }
  files?: Array<{
    id: string
    name: string
    mimetype: string
    url_private: string
    url_private_download: string
    permalink: string
    title?: string
    filetype?: string
    size?: number
  }>
  reactions?: Array<{
    name: string
    users: string[]
    count: number
  }>
  thread_ts?: string
  reply_count?: number
  reply_users?: string[]
  latest_reply?: string
  isTemporary?: boolean // Marqueur pour les messages temporaires locaux
}

interface SlackGroup {
  id: string
  name: string
  slack_channel_id: string | null
}

interface SlackChatInterfaceProps {
  groups: SlackGroup[]
  currentUserId: string
  initialMessages?: Record<string, SlackMessage[]>
  cacheInfo?: Record<string, { lastUpdated: string; ageInSeconds: number }>
}

const CACHE_STALE_SECONDS = 30 // Consider cache stale after 30 seconds

export function SlackChatInterface({ groups, currentUserId, initialMessages, cacheInfo }: SlackChatInterfaceProps) {
  const [selectedChannel, setSelectedChannel] = useState<SlackGroup | null>(null)
  const [messages, setMessages] = useState<Record<string, SlackMessage[]>>(initialMessages || {})
  const [loading, setLoading] = useState<Record<string, boolean>>({})
  const [silentLoading, setSilentLoading] = useState<Record<string, boolean>>({}) // For background refresh
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({})
  const [lastReadTimestamps, setLastReadTimestamps] = useState<Record<string, string>>({})
  const [inputMessage, setInputMessage] = useState('')
  const [sendingMessage, setSendingMessage] = useState(false)
  const [sendError, setSendError] = useState<string | null>(null)
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isSlackConnected, setIsSlackConnected] = useState(false)
  const [currentUserSlackId, setCurrentUserSlackId] = useState<string | null>(null)
  const [hasLoadedFullMessages, setHasLoadedFullMessages] = useState<Record<string, boolean>>({})
  const [showMobileChannelList, setShowMobileChannelList] = useState(false)
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const [refreshingAfterSend, setRefreshingAfterSend] = useState(false)
  const [replyingTo, setReplyingTo] = useState<SlackMessage | null>(null)
  const [showReactionPicker, setShowReactionPicker] = useState<string | null>(null)
  const [addingReaction, setAddingReaction] = useState(false)
  const [removingReaction, setRemovingReaction] = useState(false)
  const [membersMap, setMembersMap] = useState<Record<string, any>>({})
  const [showThreads, setShowThreads] = useState<Record<string, boolean>>({})
  const [hasMoreMessages, setHasMoreMessages] = useState<Record<string, boolean>>({})
  const [loadingMoreMessages, setLoadingMoreMessages] = useState(false)
  const [hoveredMessage, setHoveredMessage] = useState<string | null>(null)
  const [editingMessage, setEditingMessage] = useState<{ ts: string; text: string } | null>(null)
  const [editingText, setEditingText] = useState('')
  const [deletingMessage, setDeletingMessage] = useState<SlackMessage | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isUpdating, setIsUpdating] = useState(false)
  const [showEditFormatting, setShowEditFormatting] = useState(false)
  const [showEditEmoji, setShowEditEmoji] = useState(false)
  const editTextareaRef = useRef<HTMLTextAreaElement>(null)
  const [isLoadingHistory, setIsLoadingHistory] = useState(false)
  const [hasLoadedHistoryRecently, setHasLoadedHistoryRecently] = useState(false)
  const [oldestTimestamp, setOldestTimestamp] = useState<Record<string, string>>({})
  const [userHasScrolled, setUserHasScrolled] = useState(false)
  const [newMessageNotification, setNewMessageNotification] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const scrollAreaRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const [showFormatting, setShowFormatting] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const [recordingTime, setRecordingTime] = useState(0)
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null)
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const backgroundPollingRef = useRef<NodeJS.Timeout | null>(null)
  const supabase = createClient()
  
  // Fonction pour convertir les noms d'emoji Slack en emoji réels
  const getEmojiFromName = (name: string): string => {
    // Nettoyer le nom (enlever les : si présents)
    const cleanName = name.replace(/^:/, '').replace(/:$/, '')
    
    // Map des emojis les plus courants
    const emojiMap: Record<string, string> = {
      // Réactions courantes
      'thumbsup': '👍',
      '+1': '👍',
      'thumbsdown': '👎',
      '-1': '👎',
      'heart': '❤️',
      'hearts': '💕',
      'smile': '😊',
      'smiley': '😃',
      'grinning': '😀',
      'laughing': '😂',
      'joy': '😂',
      'rofl': '🤣',
      'fire': '🔥',
      'clap': '👏',
      'tada': '🎉',
      'confetti_ball': '🎊',
      'rocket': '🚀',
      'eyes': '👀',
      'thinking_face': '🤔',
      'thinking': '🤔',
      'white_check_mark': '✅',
      'heavy_check_mark': '✔️',
      'x': '❌',
      'pray': '🙏',
      'raised_hands': '🙌',
      'muscle': '💪',
      'ok_hand': '👌',
      'ok': '👌',
      'wave': '👋',
      'star': '⭐',
      'star2': '🌟',
      'sparkles': '✨',
      'boom': '💥',
      'zap': '⚡',
      'bulb': '💡',
      'bell': '🔔',
      'pushpin': '📌',
      'memo': '📝',
      'warning': '⚠️',
      'question': '❓',
      'exclamation': '❗',
      '100': '💯',
      
      // Emojis de visage
      'grin': '😁',
      'wink': '😉',
      'blush': '😊',
      'slightly_smiling_face': '🙂',
      'upside_down_face': '🙃',
      'relaxed': '☺️',
      'yum': '😋',
      'relieved': '😌',
      'heart_eyes': '😍',
      'kissing_heart': '😘',
      'stuck_out_tongue': '😛',
      'stuck_out_tongue_winking_eye': '😜',
      'stuck_out_tongue_closed_eyes': '😝',
      'neutral_face': '😐',
      'expressionless': '😑',
      'no_mouth': '😶',
      'smirk': '😏',
      'persevere': '😣',
      'disappointed_relieved': '😥',
      'open_mouth': '😮',
      'zipper_mouth_face': '🤐',
      'hushed': '😯',
      'sleepy': '😪',
      'tired_face': '😫',
      'sleeping': '😴',
      'nerd_face': '🤓',
      'sunglasses': '😎',
      'confused': '😕',
      'worried': '😟',
      'slightly_frowning_face': '🙁',
      'frowning_face': '☹️',
      'cry': '😢',
      'sob': '😭',
      'scream': '😱',
      'astonished': '😲',
      'flushed': '😳',
      'crazy_face': '🤪',
      'dizzy_face': '😵',
      'rage': '😡',
      'angry': '😠',
      'sweat_smile': '😅',
      'sweat': '😓',
      'weary': '😩',
      'face_with_rolling_eyes': '🙄',
      'rolling_on_the_floor_laughing': '🤣',
      
      // Mains et gestes
      'point_up': '☝️',
      'point_down': '👇',
      'point_left': '👈',
      'point_right': '👉',
      'facepunch': '👊',
      'fist': '✊',
      'v': '✌️',
      'crossed_fingers': '🤞',
      'hand': '✋',
      'raised_hand': '✋',
      
      // Objets
      'gift': '🎁',
      'trophy': '🏆',
      'medal_sports': '🏅',
      'medal_military': '🎖️',
      'crown': '👑',
      'money_bag': '💰',
      'gem': '💎',
      
      // Symboles
      'red_circle': '🔴',
      'blue_circle': '🔵',
      'white_circle': '⚪',
      'black_circle': '⚫',
      'green_circle': '🟢',
      'yellow_circle': '🟡',
      'purple_circle': '🟣',
      'orange_circle': '🟠',
      'brown_circle': '🟤'
    }
    
    // Si on trouve l'emoji dans le map, le retourner
    if (emojiMap[cleanName]) {
      return emojiMap[cleanName]
    }
    
    // Sinon, essayer de voir si c'est déjà un emoji
    // Si c'est un seul caractère emoji, le retourner tel quel
    if (cleanName.length <= 2 && /\p{Emoji}/u.test(cleanName)) {
      return cleanName
    }
    
    // Sinon retourner le nom avec les :
    return `:${cleanName}:`
  }

  // Cleanup recording on unmount
  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stop()
      }
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current)
      }
    }
  }, [])

  useEffect(() => {
    checkSlackConnection()
    loadLastReadTimestamps()
    restoreLastSelectedChannel()
    // Calculate initial unread counts
    if (initialMessages) {
      calculateUnreadCounts(initialMessages)
    }
    
    // S'abonner aux notifications en temps réel pour tous les groupes
    const unsubscribers: (() => void)[] = []
    
    groups.forEach(group => {
      if (group.slack_channel_id) {
        const unsubscribe = slackRealtime.subscribe(group.id, async (notification) => {
          // Ne pas recharger si c'est notre propre message (on l'a déjà ajouté temporairement)
          if (notification.user_id !== currentUserId) {
            // Recharger les messages pour ce groupe
            if (group.slack_channel_id) {
              // Si c'est le canal actuel, faire un rechargement complet
              if (selectedChannel?.id === group.id) {
                await loadChannelMessages(group.id, group.slack_channel_id, true)
                // Afficher une notification
                setNewMessageNotification(`Nouveau message dans #${group.name}`)
                setTimeout(() => setNewMessageNotification(null), 3000)
              } else {
                // Sinon, juste recharger silencieusement les derniers messages
                await loadChannelMessagesSilently(group.id, group.slack_channel_id)
                // Incrémenter le compteur de messages non lus
                setUnreadCounts(prev => ({
                  ...prev,
                  [group.id]: (prev[group.id] || 0) + 1
                }))
              }
            }
          }
        })
        unsubscribers.push(unsubscribe)
      }
    })
    
    // Cleanup
    return () => {
      unsubscribers.forEach(unsub => unsub())
    }
  }, [groups, currentUserId])

  useEffect(() => {
    // Smart refresh: only refresh stale channels
    const refreshStaleChannels = async () => {
      // Small delay to allow cached content to display first
      await new Promise(resolve => setTimeout(resolve, 500))
      
      for (const group of groups) {
        if (group.slack_channel_id) {
          // Check if cache is stale for this group
          const cache = cacheInfo?.[group.id]
          const shouldRefresh = !cache || cache.ageInSeconds > CACHE_STALE_SECONDS
          
          if (shouldRefresh) {
            // Load messages silently (without showing loading indicator)
            await loadChannelMessagesSilently(group.id, group.slack_channel_id)
          }
        }
      }
    }
    refreshStaleChannels()
  }, [groups, cacheInfo])

  useEffect(() => {
    if (selectedChannel && messages[selectedChannel.id]) {
      markChannelAsRead(selectedChannel.id)
      // Save the selected channel to localStorage
      localStorage.setItem('lastSelectedChannel', selectedChannel.id)
      // Load full messages for selected channel if not already loaded
      // BUT NOT if we're loading history (to avoid overwriting)
      if (!hasLoadedFullMessages[selectedChannel.id] && selectedChannel.slack_channel_id && !isLoadingHistory) {
        loadChannelMessages(selectedChannel.id, selectedChannel.slack_channel_id, true)
      }
    }
  }, [selectedChannel, isLoadingHistory])
  
  // Separate effect for channel change only (not isLoadingHistory change)
  useEffect(() => {
    if (selectedChannel && messages[selectedChannel.id]) {
      // Reset scroll flags ONLY when actually changing channels
      setUserHasScrolled(false)
      setHasLoadedHistoryRecently(false) // Réinitialiser pour le nouveau canal
      scrollToBottom()
    }
  }, [selectedChannel]) // Seulement selectedChannel, pas isLoadingHistory!
  
  // Separate effect for scrolling when messages change
  useEffect(() => {
    // Only auto-scroll if user hasn't manually scrolled AND not loading history
    // AND hasn't loaded history recently (protection permanente)
    if (selectedChannel && messages[selectedChannel.id] && !userHasScrolled && !hasLoadedHistoryRecently) {
      scrollToBottom()
    }
  }, [messages, selectedChannel, hasLoadedHistoryRecently])

  // Polling pour le canal sélectionné (toutes les 5 secondes)
  useEffect(() => {
    // Nettoyer l'ancien intervalle
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current)
    }

    // Fonction de polling pour le canal sélectionné
    const pollSelectedChannel = async () => {
      // Ne pas faire de polling si on est en train d'envoyer un message ou de charger l'historique
      if (refreshingAfterSend || isLoadingHistory) return
      
      // Rafraîchir uniquement le canal actuellement sélectionné
      if (selectedChannel && selectedChannel.slack_channel_id && !loading[selectedChannel.id]) {
        // Utiliser le chargement silencieux pour ne pas afficher de spinner
        await loadChannelMessagesSilently(selectedChannel.id, selectedChannel.slack_channel_id, true)
      }
    }

    // Démarrer le polling toutes les 5 secondes pour le canal sélectionné
    pollingIntervalRef.current = setInterval(pollSelectedChannel, 5000)

    // Cleanup
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current)
      }
    }
  }, [selectedChannel, refreshingAfterSend, loading])

  // Polling pour les canaux non sélectionnés (toutes les minutes)
  useEffect(() => {
    // Nettoyer l'ancien intervalle
    if (backgroundPollingRef.current) {
      clearInterval(backgroundPollingRef.current)
    }

    // Fonction de polling pour les canaux en arrière-plan
    const pollBackgroundChannels = async () => {
      // Ne pas faire de polling si on est en train d'envoyer un message
      if (refreshingAfterSend) return
      
      // Rafraîchir tous les canaux SAUF le canal sélectionné
      for (const group of groups) {
        if (group.slack_channel_id && group.id !== selectedChannel?.id && !loading[group.id]) {
          // Charger silencieusement les derniers messages
          await loadChannelMessagesSilently(group.id, group.slack_channel_id, false)
        }
      }
    }

    // Démarrer le polling toutes les 60 secondes pour les canaux non sélectionnés
    backgroundPollingRef.current = setInterval(pollBackgroundChannels, 60000)

    // Cleanup
    return () => {
      if (backgroundPollingRef.current) {
        clearInterval(backgroundPollingRef.current)
      }
    }
  }, [groups, selectedChannel, refreshingAfterSend, loading])

  const calculateUnreadCounts = (messagesMap: Record<string, SlackMessage[]>) => {
    const counts: Record<string, number> = {}
    Object.entries(messagesMap).forEach(([groupId, groupMessages]) => {
      const lastRead = lastReadTimestamps[groupId]
      if (lastRead && groupMessages) {
        const unreadCount = groupMessages.filter((msg: SlackMessage) => {
          const msgTime = new Date(parseFloat(msg.ts || msg.timestamp) * 1000)
          return msgTime > new Date(lastRead)
        }).length
        counts[groupId] = unreadCount
      }
    })
    setUnreadCounts(counts)
  }

  const checkSlackConnection = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { data: member } = await supabase
        .from('members')
        .select('slack_user_id')
        .eq('user_id', user.id)
        .single()
      
      setIsSlackConnected(!!member?.slack_user_id)
      setCurrentUserSlackId(member?.slack_user_id || null)
    }
  }

  const loadLastReadTimestamps = async () => {
    const storedTimestamps = localStorage.getItem('slackLastRead')
    if (storedTimestamps) {
      setLastReadTimestamps(JSON.parse(storedTimestamps))
    }
  }

  const restoreLastSelectedChannel = () => {
    const lastChannelId = localStorage.getItem('lastSelectedChannel')
    if (lastChannelId && groups.length > 0) {
      const channel = groups.find(g => g.id === lastChannelId)
      if (channel) {
        setSelectedChannel(channel)
      } else {
        // If the last channel doesn't exist anymore, select the first one
        setSelectedChannel(groups[0])
      }
    } else if (groups.length > 0) {
      // If no last channel saved, select the first one
      setSelectedChannel(groups[0])
    }
  }

  const markChannelAsRead = (channelId: string) => {
    // Use a timestamp slightly in the future to account for any timing issues
    const now = new Date()
    now.setSeconds(now.getSeconds() + 2) // Add 2 seconds buffer
    const timestamp = now.toISOString()
    
    const newTimestamps = { ...lastReadTimestamps, [channelId]: timestamp }
    setLastReadTimestamps(newTimestamps)
    localStorage.setItem('slackLastRead', JSON.stringify(newTimestamps))
    setUnreadCounts(prev => ({ ...prev, [channelId]: 0 }))
  }

  const applyFormatting = (type: string) => {
    if (!inputRef.current) return
    
    const textarea = inputRef.current
    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const selectedText = inputMessage.substring(start, end)
    
    let formattedText = ''
    let cursorOffset = 0
    
    switch (type) {
      case 'bold':
        if (selectedText) {
          formattedText = `*${selectedText}*`
          cursorOffset = formattedText.length
        } else {
          formattedText = '**'
          cursorOffset = 1
        }
        break
      case 'italic':
        if (selectedText) {
          formattedText = `_${selectedText}_`
          cursorOffset = formattedText.length
        } else {
          formattedText = '__'
          cursorOffset = 1
        }
        break
      case 'strikethrough':
        if (selectedText) {
          formattedText = `~${selectedText}~`
          cursorOffset = formattedText.length
        } else {
          formattedText = '~~'
          cursorOffset = 1
        }
        break
      case 'link':
        if (selectedText) {
          const url = prompt('URL du lien:')
          if (url) {
            formattedText = `<${url}|${selectedText}>`
            cursorOffset = formattedText.length
          } else {
            return
          }
        } else {
          formattedText = '<https://example.com|texte du lien>'
          cursorOffset = 21 // Position after https://
        }
        break
      case 'bullet':
        // Add bullet point at the beginning of the current line
        const beforeText = inputMessage.substring(0, start)
        const afterText = inputMessage.substring(end)
        const lastNewline = beforeText.lastIndexOf('\n')
        const lineStart = lastNewline === -1 ? 0 : lastNewline + 1
        const newMessage = inputMessage.substring(0, lineStart) + '• ' + inputMessage.substring(lineStart)
        setInputMessage(newMessage)
        setTimeout(() => {
          textarea.selectionStart = textarea.selectionEnd = start + 2
        }, 0)
        return
      case 'numbered':
        // Add number at the beginning of the current line
        const beforeText2 = inputMessage.substring(0, start)
        const afterText2 = inputMessage.substring(end)
        const lastNewline2 = beforeText2.lastIndexOf('\n')
        const lineStart2 = lastNewline2 === -1 ? 0 : lastNewline2 + 1
        const newMessage2 = inputMessage.substring(0, lineStart2) + '1. ' + inputMessage.substring(lineStart2)
        setInputMessage(newMessage2)
        setTimeout(() => {
          textarea.selectionStart = textarea.selectionEnd = start + 3
        }, 0)
        return
      default:
        return
    }
    
    const newMessage = inputMessage.substring(0, start) + formattedText + inputMessage.substring(end)
    setInputMessage(newMessage)
    
    // Restore cursor position
    setTimeout(() => {
      textarea.selectionStart = textarea.selectionEnd = start + cursorOffset
      textarea.focus()
    }, 0)
  }


  const loadChannelMessages = async (groupId: string, channelId: string, fullLoad: boolean = false, before?: string) => {
    // Don't reload if we already have full messages (unless loading more)
    if (fullLoad && hasLoadedFullMessages[groupId] && !before) return
    
    if (!before) {
      setLoading(prev => ({ ...prev, [groupId]: true }))
    }

    try {
      const limit = fullLoad ? 50 : 5
      let url = `/api/slack/messages?channelId=${channelId}&limit=${limit}`
      if (before) {
        url += `&before=${before}`
      }
      
      const response = await fetch(url)
      if (response.ok) {
        const data = await response.json()
        const channelMessages = data.messages || []
        
        // Stocker la map des membres
        if (data.membersMap) {
          setMembersMap(data.membersMap)
        }
        
        if (before) {
          // Prepend older messages et garder l'ordre correct
          setMessages(prev => {
            const existingMessages = prev[groupId] || []
            // Ajouter les anciens messages au début
            const mergedMessages = [...channelMessages, ...existingMessages]
            return { ...prev, [groupId]: mergedMessages }
          })
          
          // Mettre à jour le timestamp le plus ancien
          if (channelMessages.length > 0) {
            const oldest = channelMessages[0] // Premier message est le plus ancien
            setOldestTimestamp(prev => ({
              ...prev,
              [groupId]: oldest.ts || oldest.timestamp
            }))
          } else {
          }
          
          // Vérifier s'il reste des messages plus anciens
          setHasMoreMessages(prev => ({ 
            ...prev, 
            [groupId]: channelMessages.length === limit 
          }))
        } else {
          // Replace messages - ensure we don't lose any messages
          setMessages(prev => {
            // Check if we have temporary messages that might not be in the new load
            const existingMessages = prev[groupId] || []
            
            // Filter out ALL temporary messages completely
            // Messages are temporary if they have:
            // - isTemporary flag
            // - temp- file IDs
            const nonTemporaryMessages = existingMessages.filter((m: any) => {
              // Remove messages explicitly marked as temporary
              if (m.isTemporary) {
                return false
              }
              // Remove any message with temporary file IDs
              if (m.files && m.files.some((f: any) => f.id?.startsWith('temp-'))) {
                return false
              }
              return true
            })
            
            // Don't keep any recent messages that might be duplicates
            // Just use the fresh data from Slack
            return { ...prev, [groupId]: channelMessages }
          })
        }
        
        // Check if there are more messages
        setHasMoreMessages(prev => ({ 
          ...prev, 
          [groupId]: channelMessages.length === limit 
        }))
        
        // Store oldest timestamp ONLY if NOT loading history (before parameter)
        if (channelMessages.length > 0 && !before) {
          // Les messages viennent de Slack triés du plus récent au plus ancien
          // Donc le dernier est le plus ancien
          const oldest = channelMessages[channelMessages.length - 1]
          const oldestTs = oldest.ts || oldest.timestamp
          setOldestTimestamp(prev => ({
            ...prev,
            [groupId]: oldestTs
          }))
        }
        
        if (fullLoad) {
          setHasLoadedFullMessages(prev => ({ ...prev, [groupId]: true }))
        }
        
        // Update cache with new messages (async, don't wait)
        if (channelMessages.length > 0) {
          fetch('/api/slack/update-cache', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              channelId,
              groupId,
              messages: channelMessages.slice(0, 5) // Only cache last 5 messages
            })
          }).catch(err => console.error('Failed to update cache:', err))
        }
        
        // Calculate unread count based on context
        const lastRead = lastReadTimestamps[groupId]
        
        if (lastRead) {
          const unreadCount = channelMessages.filter((msg: SlackMessage) => {
            const msgTime = new Date(parseFloat(msg.ts || msg.timestamp) * 1000)
            return msgTime > new Date(lastRead)
          }).length
          
          // For the selected channel:
          // - Show badge only if scrolled up (not viewing latest messages)
          // - Hide badge if scrolled to bottom (viewing latest messages)
          if (selectedChannel?.id === groupId) {
            if (!userHasScrolled) {
              // User is at bottom, viewing latest messages - no badge
              setUnreadCounts(prev => ({ ...prev, [groupId]: 0 }))
            } else if (unreadCount > 0) {
              // User is scrolled up AND there are new messages - show badge
              setUnreadCounts(prev => ({ ...prev, [groupId]: unreadCount }))
            }
          }
          // For non-selected channels, always show accurate unread count
          else {
            setUnreadCounts(prev => ({ ...prev, [groupId]: unreadCount }))
          }
        }
      }
    } catch (error) {
      console.error('Error loading messages:', error)
    } finally {
      setLoading(prev => ({ ...prev, [groupId]: false }))
    }
  }

  const loadChannelMessagesSilently = async (groupId: string, channelId: string, fullLoad: boolean = false) => {
    // Use silentLoading instead of loading to avoid showing the loading indicator
    setSilentLoading(prev => ({ ...prev, [groupId]: true }))

    try {
      const limit = fullLoad ? 50 : 5
      const response = await fetch(`/api/slack/messages?channelId=${channelId}&limit=${limit}`)
      
      if (response.ok) {
        const data = await response.json()
        const channelMessages = data.messages || []
        
        // Stocker la map des membres
        if (data.membersMap) {
          setMembersMap(data.membersMap)
        }
        
        // Only update messages if we got new data
        if (channelMessages.length > 0) {
          // Utiliser setMessages pour accéder à l'état actuel et retourner le nouvel état
          setMessages(prev => {
            const existingMessages = prev[groupId] || []
            
            const existingLatestTs = existingMessages.length > 0 
              ? Math.max(...existingMessages.map((m: any) => parseFloat(m.ts || m.timestamp)))
              : 0
            
            const newLatestTs = channelMessages.length > 0
              ? Math.max(...channelMessages.map((m: any) => parseFloat(m.ts || m.timestamp)))
              : 0
            
            // S'il y a un nouveau message
            if (newLatestTs > existingLatestTs && existingMessages.length > 0) {
              // Trouver le dernier nouveau message
              const latestNewMessage = channelMessages
                .filter((m: any) => parseFloat(m.ts || m.timestamp) > existingLatestTs)
                .sort((a: any, b: any) => parseFloat(b.ts || b.timestamp) - parseFloat(a.ts || a.timestamp))[0]
              
              if (latestNewMessage) {
                // Vérifier que ce n'est pas notre propre message
                const { authorSlackId } = extractMessageSignature(latestNewMessage.text)
                const isOurMessage = authorSlackId 
                  ? authorSlackId === currentUserSlackId
                  : (latestNewMessage.user === currentUserSlackId || latestNewMessage.member?.slack_user_id === currentUserSlackId)
                
                if (!isOurMessage) {
                  // Afficher une notification
                  const group = groups.find(g => g.id === groupId)
                  if (group) {
                    setNewMessageNotification(`Nouveau message dans #${group.name}`)
                    setTimeout(() => setNewMessageNotification(null), 3000)
                  }
                }
              }
            }
            
            // Si on a déjà plus de messages que ce qu'on récupère (à cause du load more),
            // on ne remplace pas tout mais on merge intelligemment
            if (existingMessages.length > limit) {
              // On a probablement chargé des messages historiques, donc on garde tout
              // et on met juste à jour/ajoute les messages récents
              const newMessageIds = new Set(channelMessages.map((m: any) => m.ts || m.timestamp))
              
              // Garder tous les anciens messages qui ne sont pas dans les nouveaux
              // MAIS exclure les messages temporaires
              const oldMessages = existingMessages.filter(m => {
                // Remove messages explicitly marked as temporary
                if (m.isTemporary) {
                  return false
                }
                // Remove any message with temporary file IDs
                if (m.files && m.files.some((f: any) => f.id?.startsWith('temp-'))) {
                  return false
                }
                const timestamp = m.ts || m.timestamp
                // Garder si ce n'est pas dans les nouveaux messages récupérés
                return !newMessageIds.has(timestamp)
              })
              
              // Combiner les anciens messages avec les nouveaux
              const mergedMessages = [...oldMessages, ...channelMessages]
              
              // Trier par timestamp
              mergedMessages.sort((a, b) => {
                const timeA = parseFloat(a.ts || a.timestamp)
                const timeB = parseFloat(b.ts || b.timestamp)
                return timeA - timeB
              })
              
              return { ...prev, [groupId]: mergedMessages }
            }
            
            // Sinon, remplacer complètement par les nouveaux messages
            // Ne PAS garder les messages récents pour éviter la duplication
            // Slack est notre source de vérité
            return { ...prev, [groupId]: channelMessages }
          })
        }
        
        if (fullLoad) {
          setHasLoadedFullMessages(prev => ({ ...prev, [groupId]: true }))
        }
        
        // Update cache with new messages (async, don't wait)
        if (channelMessages.length > 0) {
          fetch('/api/slack/update-cache', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              channelId,
              groupId,
              messages: channelMessages.slice(0, 5) // Only cache last 5 messages
            })
          }).catch(err => console.error('Failed to update cache:', err))
        }
        
        // Calculate unread count based on context
        const lastRead = lastReadTimestamps[groupId]
        
        if (lastRead) {
          const unreadCount = channelMessages.filter((msg: SlackMessage) => {
            const msgTime = new Date(parseFloat(msg.ts || msg.timestamp) * 1000)
            return msgTime > new Date(lastRead)
          }).length
          
          // For the selected channel:
          // - Show badge only if scrolled up (not viewing latest messages)
          // - Hide badge if scrolled to bottom (viewing latest messages)
          if (selectedChannel?.id === groupId) {
            if (!userHasScrolled) {
              // User is at bottom, viewing latest messages - no badge
              setUnreadCounts(prev => ({ ...prev, [groupId]: 0 }))
            } else if (unreadCount > 0) {
              // User is scrolled up AND there are new messages - show badge
              setUnreadCounts(prev => ({ ...prev, [groupId]: unreadCount }))
            }
          }
          // For non-selected channels, always show accurate unread count
          else {
            setUnreadCounts(prev => ({ ...prev, [groupId]: unreadCount }))
          }
        }
      }
    } catch (error) {
      console.error('Error loading messages silently:', error)
    } finally {
      setSilentLoading(prev => ({ ...prev, [groupId]: false }))
    }
  }

  const scrollToBottom = () => {
    // Ne jamais scroller si on charge l'historique ou si on a récemment chargé l'historique
    if (scrollRef.current && !userHasScrolled && !isLoadingHistory && !hasLoadedHistoryRecently) {
      scrollRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }

  const formatTimestamp = (timestamp: string | undefined) => {
    if (!timestamp) return ''
    
    // Parse the timestamp - Slack uses seconds since epoch
    const date = new Date(parseFloat(timestamp) * 1000)
    
    // Check if date is valid
    if (isNaN(date.getTime())) {
      console.warn('Invalid timestamp for time formatting:', timestamp)
      return ''
    }
    
    const now = new Date()
    const isToday = date.toDateString() === now.toDateString()
    const yesterday = new Date(now)
    yesterday.setDate(yesterday.getDate() - 1)
    const isYesterday = date.toDateString() === yesterday.toDateString()
    
    // For today's messages, show only time
    if (isToday) {
      return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
    }
    
    // For yesterday's messages, show "Hier" + time
    if (isYesterday) {
      return 'Hier ' + date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
    }
    
    // For older messages, show date + time
    return date.toLocaleDateString('fr-FR', { 
      day: 'numeric', 
      month: 'short' 
    }) + ' ' + date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
  }

  const formatRelativeTime = (timestamp: string | undefined) => {
    if (!timestamp) return ''
    
    // Parse the timestamp - Slack uses seconds since epoch
    const date = new Date(parseFloat(timestamp) * 1000)
    
    // Check if date is valid
    if (isNaN(date.getTime())) {
      console.warn('Invalid timestamp:', timestamp)
      return ''
    }
    
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMins / 60)
    const diffDays = Math.floor(diffHours / 24)

    if (diffMins < 1) return "À l'instant"
    if (diffMins < 60) return `Il y a ${diffMins} min`
    if (diffHours < 24) return `Il y a ${diffHours}h`
    if (diffDays < 7) return `Il y a ${diffDays}j`
    
    // For older messages, show the date
    return date.toLocaleDateString('fr-FR', { 
      day: 'numeric', 
      month: 'short' 
    })
  }

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      
      // Déterminer le meilleur format audio disponible
      let mimeType = 'audio/webm'
      if (MediaRecorder.isTypeSupported('audio/mp4')) {
        mimeType = 'audio/mp4'
      } else if (MediaRecorder.isTypeSupported('audio/ogg')) {
        mimeType = 'audio/ogg'
      }
      
      const mediaRecorder = new MediaRecorder(stream, { mimeType })
      
      audioChunksRef.current = []
      
      mediaRecorder.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data)
      }
      
      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType })
        setAudioBlob(audioBlob)
        
        // Arrêter le stream
        stream.getTracks().forEach(track => track.stop())
        
        // Envoyer automatiquement le fichier audio
        if (selectedChannel?.slack_channel_id) {
          await sendAudioMessage(audioBlob)
        }
      }
      
      mediaRecorder.start()
      mediaRecorderRef.current = mediaRecorder
      setIsRecording(true)
      setRecordingTime(0)
      
      // Démarrer le timer
      recordingTimerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1)
      }, 1000)
    } catch (error) {
      console.error('Erreur lors du démarrage de l\'enregistrement:', error)
      alert('Impossible d\'accéder au microphone. Vérifiez les permissions.')
    }
  }
  
  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop()
      setIsRecording(false)
      
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current)
        recordingTimerRef.current = null
      }
    }
  }
  
  const cancelRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop()
      // Ne pas envoyer le message
      mediaRecorderRef.current.onstop = () => {
        const stream = mediaRecorderRef.current?.stream
        if (stream) {
          stream.getTracks().forEach(track => track.stop())
        }
      }
    }
    
    setIsRecording(false)
    setRecordingTime(0)
    setAudioBlob(null)
    audioChunksRef.current = []
    
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current)
      recordingTimerRef.current = null
    }
  }
  
  const sendAudioMessage = async (blob: Blob) => {
    if (!selectedChannel?.slack_channel_id) return
    
    setSendingMessage(true)
    setSendError(null)
    
    try {
      // Déterminer l'extension du fichier basée sur le type MIME
      const extension = blob.type.includes('mp4') ? 'mp4' : 
                       blob.type.includes('ogg') ? 'ogg' : 'webm'
      
      // Créer un FormData pour envoyer le fichier
      const formData = new FormData()
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
      const fileName = `audio-${timestamp}.${extension}`
      formData.append('file', blob, fileName)
      formData.append('channel', selectedChannel.slack_channel_id)
      formData.append('title', 'Message vocal')
      formData.append('initial_comment', '🎤 Message vocal')
      
      const response = await fetch('/api/slack/upload-file', {
        method: 'POST',
        body: formData
      })
      
      if (response.ok) {
        // Recharger les messages
        setRefreshingAfterSend(true)
        setTimeout(async () => {
          await loadChannelMessages(selectedChannel.id, selectedChannel.slack_channel_id || '', true)
          setRefreshingAfterSend(false)
        }, 2000)
      } else {
        const error = await response.json()
        setSendError(error.error || 'Erreur lors de l\'envoi du message vocal')
      }
    } catch (error) {
      console.error('Erreur lors de l\'envoi du message vocal:', error)
      setSendError('Impossible d\'envoyer le message vocal')
    } finally {
      setSendingMessage(false)
      setAudioBlob(null)
      setRecordingTime(0)
    }
  }
  
  const formatRecordingTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const sendMessage = async () => {
    if ((!inputMessage.trim() && selectedFiles.length === 0) || !selectedChannel?.slack_channel_id || sendingMessage) return
    
    // Si on répond à un message, utiliser la fonction de réponse
    if (replyingTo) {
      return handleReplyToMessage()
    }

    setSendingMessage(true)
    setSendError(null)
    
    // Capturer les valeurs avant de les réinitialiser
    const messageToSend = inputMessage
    const filesToSend = [...selectedFiles]
    
    // Réinitialiser immédiatement l'interface
    setInputMessage('')
    setSelectedFiles([])
    if (inputRef.current) {
      inputRef.current.style.height = '38px'
    }
    
    // Ajouter immédiatement le message/fichier temporaire à l'interface
    if (messageToSend || filesToSend.length > 0) {
      const tempMessage: SlackMessage = {
        user: currentUserSlackId || '',
        text: filesToSend.length > 0 
          ? (messageToSend || `📎 ${filesToSend.map(f => f.name).join(', ')}`)
          : messageToSend,
        timestamp: String(Date.now() / 1000),
        ts: String(Date.now() / 1000),
        channel: selectedChannel.slack_channel_id,
        member: null,
        user_profile: undefined,
        isTemporary: true, // Marqueur explicite pour les messages temporaires
        files: filesToSend.length > 0 ? filesToSend.map(file => ({
          id: `temp-${Date.now()}-${Math.random()}`,
          name: file.name,
          mimetype: file.type,
          url_private: '',
          url_private_download: '',
          permalink: '',
          title: file.name,
          filetype: file.name.split('.').pop() || '',
          size: file.size
        })) : undefined
      }
      
      // Ajouter temporairement le message
      const currentMessages = messages[selectedChannel.id] || []
      setMessages(prev => ({
        ...prev,
        [selectedChannel.id]: [...currentMessages, tempMessage]
      }))
      
      // Scroll immédiatement vers le bas
      setUserHasScrolled(false)
      setTimeout(() => scrollToBottom(), 50)
    }
    
    // Mark channel as read
    markChannelAsRead(selectedChannel.id)
    
    // Indiquer que le message est en cours d'envoi
    setRefreshingAfterSend(true)
    
    try {
      // Envoyer en arrière-plan
      if (filesToSend.length > 0) {
        for (const file of filesToSend) {
          const formData = new FormData()
          formData.append('file', file)
          formData.append('channel', selectedChannel.slack_channel_id)
          formData.append('title', file.name)
          formData.append('initial_comment', messageToSend || '')
          
          const uploadResponse = await fetch('/api/slack/upload-file', {
            method: 'POST',
            body: formData
          })
          
          if (!uploadResponse.ok) {
            const error = await uploadResponse.json()
            throw new Error(error.error || 'Erreur lors de l\'upload du fichier')
          }
        }
      } else if (messageToSend) {
        const response = await fetch('/api/slack/send-message', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            channel: selectedChannel.slack_channel_id,
            text: messageToSend
          })
        })

        const data = await response.json()
        
        if (!response.ok) {
          throw new Error(data.error || 'Erreur lors de l\'envoi du message')
        }
      }
      
      // Attendre un peu puis rafraîchir pour obtenir le vrai message de Slack
      setTimeout(async () => {
        await loadChannelMessages(selectedChannel.id, selectedChannel.slack_channel_id || '', true)
        setRefreshingAfterSend(false)
        setUserHasScrolled(false)
        setTimeout(() => scrollToBottom(), 100)
      }, 1500)
    } catch (error) {
      console.error('Error sending message:', error)
      setSendError('Erreur de connexion au serveur')
    } finally {
      setSendingMessage(false)
    }
  }

  const handleEmojiClick = (emojiObject: any) => {
    setInputMessage(prev => prev + emojiObject.emoji)
    setShowEmojiPicker(false)
    // Focus back to input
    if (inputRef.current) {
      inputRef.current.focus()
    }
  }

  const handleAddReaction = async (messageTs: string, emoji: string) => {
    if (!selectedChannel || addingReaction) return
    
    setAddingReaction(true)
    try {
      const response = await fetch('/api/slack/add-reaction', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channel: selectedChannel.slack_channel_id,
          timestamp: messageTs,
          emoji: emoji.replace(/:/g, '') // Enlever les : autour de l'emoji
        })
      })
      
      if (!response.ok) {
        const error = await response.json()
        
        // Si l'erreur est "already_reacted", on essaye de retirer la réaction
        if (error.error === 'Vous avez déjà ajouté cette réaction') {
          // Retirer la réaction à la place
          await handleRemoveReaction(messageTs, emoji.replace(/:/g, ''))
          return
        }
        
        throw new Error(error.error || 'Erreur lors de l\'ajout de la réaction')
      }
      
      // Rafraîchir les messages pour voir la nouvelle réaction
      await loadChannelMessages(selectedChannel.id, selectedChannel.slack_channel_id || '', true)
    } catch (error: any) {
      console.error('Erreur ajout réaction:', error)
      setSendError(error.message || 'Erreur lors de l\'ajout de la réaction')
    } finally {
      setAddingReaction(false)
      setShowReactionPicker(null)
    }
  }

  const handleRemoveReaction = async (messageTs: string, emoji: string) => {
    if (!selectedChannel || removingReaction) return
    
    setRemovingReaction(true)
    try {
      const response = await fetch('/api/slack/remove-reaction', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channel: selectedChannel.slack_channel_id,
          timestamp: messageTs,
          emoji: emoji
        })
      })
      
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Erreur lors de la suppression de la réaction')
      }
      
      // Rafraîchir les messages pour voir la réaction supprimée
      await loadChannelMessages(selectedChannel.id, selectedChannel.slack_channel_id || '', true)
    } catch (error: any) {
      console.error('Erreur suppression réaction:', error)
      setSendError(error.message || 'Erreur lors de la suppression de la réaction')
    } finally {
      setRemovingReaction(false)
    }
  }

  const handleReplyToMessage = async () => {
    if (!replyingTo || !selectedChannel || !inputMessage.trim()) return
    
    const messageToSend = inputMessage.trim()
    setInputMessage('')
    setSendError(null)
    setSendingMessage(true)
    
    try {
      const response = await fetch('/api/slack/reply-message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channel: selectedChannel.slack_channel_id,
          text: messageToSend,
          thread_ts: replyingTo.thread_ts || replyingTo.ts || replyingTo.timestamp
        })
      })
      
      const data = await response.json()
      
      if (!response.ok) {
        throw new Error(data.error || 'Erreur lors de l\'envoi de la réponse')
      }
      
      setReplyingTo(null)
      
      // Rafraîchir les messages après un court délai
      setTimeout(async () => {
        await loadChannelMessages(selectedChannel.id, selectedChannel.slack_channel_id || '', true)
      }, 1500)
    } catch (error: any) {
      console.error('Erreur envoi réponse:', error)
      setSendError(error.message || 'Erreur lors de l\'envoi de la réponse')
    } finally {
      setSendingMessage(false)
    }
  }

  const handleDeleteMessage = async () => {
    if (!deletingMessage || !selectedChannel || isDeleting) return
    
    setIsDeleting(true)
    try {
      const response = await fetch('/api/slack/delete-message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channel: selectedChannel.slack_channel_id,
          timestamp: deletingMessage.ts || deletingMessage.timestamp
        })
      })
      
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Erreur lors de la suppression')
      }
      
      // Supprimer le message de la liste locale
      setMessages(prev => ({
        ...prev,
        [selectedChannel.id]: (prev[selectedChannel.id] || []).filter(
          msg => (msg.ts || msg.timestamp) !== (deletingMessage.ts || deletingMessage.timestamp)
        )
      }))
      
      setDeletingMessage(null)
    } catch (error: any) {
      console.error('Erreur suppression message:', error)
      setSendError(error.message || 'Erreur lors de la suppression du message')
    } finally {
      setIsDeleting(false)
    }
  }

  const handleUpdateMessage = async () => {
    if (!editingMessage || !selectedChannel || !editingText.trim() || isUpdating) return
    
    setIsUpdating(true)
    try {
      const response = await fetch('/api/slack/update-message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channel: selectedChannel.slack_channel_id,
          timestamp: editingMessage.ts,
          text: editingText
        })
      })
      
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Erreur lors de la modification')
      }
      
      // Mettre à jour le message dans la liste locale avec la nouvelle signature
      // Récupérer les infos de l'utilisateur pour reconstruire la signature
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: member } = await supabase
          .from('members')
          .select('slack_user_id, first_name, last_name')
          .eq('user_id', user.id)
          .single()
        
        if (member) {
          // Reconstruire le texte avec la signature SANS mention modifié
          const updatedText = `_Envoyé par ${member.first_name} ${member.last_name} • ${member.slack_user_id}_\n${editingText}`
          
          setMessages(prev => ({
            ...prev,
            [selectedChannel.id]: (prev[selectedChannel.id] || []).map(msg => {
              if ((msg.ts || msg.timestamp) === editingMessage.ts) {
                return { ...msg, text: updatedText }
              }
              return msg
            })
          }))
        }
      }
      
      setEditingMessage(null)
      setEditingText('')
    } catch (error: any) {
      console.error('Erreur modification message:', error)
      setSendError(error.message || 'Erreur lors de la modification du message')
    } finally {
      setIsUpdating(false)
    }
  }

  const startEditMessage = (msg: SlackMessage) => {
    // Extraire le texte sans la signature
    const { cleanText } = extractMessageSignature(msg.text || '')
    setEditingMessage({ ts: msg.ts || msg.timestamp, text: msg.text })
    setEditingText(cleanText)
    
    // Ajuster la hauteur du textarea après le rendu pour correspondre au contenu
    setTimeout(() => {
      if (editTextareaRef.current) {
        editTextareaRef.current.style.height = 'auto'
        const scrollHeight = editTextareaRef.current.scrollHeight
        // Limiter à 500px maximum
        editTextareaRef.current.style.height = Math.min(scrollHeight, 500) + 'px'
      }
    }, 0)
  }

  const cancelEdit = () => {
    setEditingMessage(null)
    setEditingText('')
  }

  const loadMoreMessages = async () => {
    if (!selectedChannel || !selectedChannel.slack_channel_id || loadingMoreMessages) return
    
    setLoadingMoreMessages(true)
    setIsLoadingHistory(true) // Empêcher le rechargement par le useEffect
    setHasLoadedHistoryRecently(true) // Flag permanent pour bloquer le scroll
    // Keep scroll position when loading more messages (don't auto-scroll)
    setUserHasScrolled(true)
    
    // Capturer le premier message visible AVANT le chargement
    const scrollContainer = document.querySelector('.overflow-y-auto') as HTMLElement
    let firstVisibleElement: Element | null = null
    let firstVisibleOffsetTop = 0
    
    if (scrollContainer) {
      // Trouver le premier message visible dans le viewport
      const messages = scrollContainer.querySelectorAll('[data-message-group]')
      const containerRect = scrollContainer.getBoundingClientRect()
      
      for (const msg of messages) {
        const rect = msg.getBoundingClientRect()
        if (rect.bottom > containerRect.top) {
          firstVisibleElement = msg
          firstVisibleOffsetTop = rect.top - containerRect.top
          break
        }
      }
    }
    
    const oldest = oldestTimestamp[selectedChannel.id]
    
    if (oldest) {
      await loadChannelMessages(selectedChannel.id, selectedChannel.slack_channel_id, true, oldest)
      
      // Après le chargement, maintenir le premier message visible à la même position
      requestAnimationFrame(() => {
        setTimeout(() => {
          if (scrollContainer && firstVisibleElement) {
            // Retrouver l'élément et calculer où le scroller pour qu'il soit à la même position
            const rect = firstVisibleElement.getBoundingClientRect()
            const containerRect = scrollContainer.getBoundingClientRect()
            const currentOffsetTop = rect.top - containerRect.top
            const scrollAdjustment = currentOffsetTop - firstVisibleOffsetTop
            
            // Ajuster le scroll pour remettre l'élément à sa position d'origine
            scrollContainer.scrollTop += scrollAdjustment
          } else if (scrollContainer) {
            // Fallback : si on était tout en haut, scroller pour voir quelques anciens messages
            const scrollHeightAfter = scrollContainer.scrollHeight
            const scrollHeightBefore = scrollContainer.clientHeight // approximation
            const heightDiff = scrollHeightAfter - scrollHeightBefore
            
            if (heightDiff > 0) {
              // Scroller pour garder les anciens messages visibles
              scrollContainer.scrollTop = Math.max(100, heightDiff - 200)
            }
          }
        }, 150)
      })
    }
    
    setLoadingMoreMessages(false)
    // Réinitialiser le flag après un délai plus long pour s'assurer que tout est stabilisé
    setTimeout(() => setIsLoadingHistory(false), 2000)
  }

  // Group consecutive messages by same user within same minute
  const groupMessages = (messages: SlackMessage[]) => {
    const grouped: Array<{
      user: string
      messages: SlackMessage[]
      timestamp: string
      displayName: string
      avatarUrl?: string
      initials: string
      isCurrentUser: boolean
      realAuthorSlackId?: string | null
    }> = []

    // Sort messages by timestamp (oldest first)
    const sortedMessages = [...messages].sort((a, b) => {
      const timeA = parseFloat(a.ts || a.timestamp)
      const timeB = parseFloat(b.ts || b.timestamp)
      return timeA - timeB
    })

    sortedMessages.forEach((msg) => {
      const msgTime = new Date(parseFloat(msg.ts || msg.timestamp) * 1000)
      
      // Use realAuthor if available (for messages sent via bot)
      const actualAuthor = msg.realAuthor || msg.member
      const actualUserProfile = msg.realAuthor ? null : msg.user_profile
      
      
      // Determine the real author ID
      const realAuthorId = actualAuthor?.slack_user_id || msg.user
      
      // Determine if this is the current user's message
      const isCurrentUser = realAuthorId === currentUserSlackId
      
      // Get display name from the actual author
      const displayName = actualAuthor
        ? `${actualAuthor.first_name} ${actualAuthor.last_name}`
        : actualUserProfile?.real_name || actualUserProfile?.name || msg.user
      
      const avatarUrl = actualAuthor?.photo_url || actualUserProfile?.image_48
      const initials = actualAuthor
        ? `${actualAuthor.first_name?.[0] || ''}${actualAuthor.last_name?.[0] || ''}`
        : displayName.split(' ')
            .map(word => word[0])
            .slice(0, 2)
            .join('')
            .toUpperCase() || '?'

      const lastGroup = grouped[grouped.length - 1]
      // Group by real author instead of msg.user
      if (
        lastGroup &&
        lastGroup.realAuthorSlackId === realAuthorId &&
        Math.abs(msgTime.getTime() - new Date(parseFloat(lastGroup.timestamp) * 1000).getTime()) < 60000
      ) {
        lastGroup.messages.push(msg)
      } else {
        grouped.push({
          user: msg.user,
          messages: [msg],
          timestamp: msg.ts || msg.timestamp,
          displayName,
          avatarUrl,
          initials,
          isCurrentUser,
          realAuthorSlackId: realAuthorId
        })
      }
    })

    return grouped
  }

  // On mobile, show channel list only if explicitly requested or no channel selected
  if (showMobileChannelList || (!selectedChannel && typeof window !== 'undefined' && window.innerWidth < 768)) {
    return (
      <div className="flex h-full">
        <ChannelList
          groups={groups}
          selectedChannel={selectedChannel}
          onSelectChannel={(channel) => {
            setSelectedChannel(channel)
            setShowMobileChannelList(false)
          }}
          loading={loading}
          messages={messages}
          unreadCounts={unreadCounts}
          isMobileView={true}
          markChannelAsRead={markChannelAsRead}
        />
      </div>
    )
  }

  return (
    <div className="flex h-full bg-white rounded-lg border border-gray-200">
      {/* Channel List */}
      <div className="hidden md:block">
        <ChannelList
          groups={groups}
          selectedChannel={selectedChannel}
          onSelectChannel={setSelectedChannel}
          loading={loading}
          messages={messages}
          unreadCounts={unreadCounts}
          isMobileView={false}
          markChannelAsRead={markChannelAsRead}
        />
      </div>

      {/* Chat Area */}
      <div 
        className="flex-1 flex flex-col overflow-hidden relative"
        onDragOver={(e) => {
          e.preventDefault()
          e.stopPropagation()
          setIsDragging(true)
        }}
        onDragEnter={(e) => {
          e.preventDefault()
          e.stopPropagation()
          setIsDragging(true)
        }}
        onDragLeave={(e) => {
          e.preventDefault()
          e.stopPropagation()
          // Only set isDragging to false if we're leaving the container
          if (e.currentTarget === e.target) {
            setIsDragging(false)
          }
        }}
        onDrop={(e) => {
          e.preventDefault()
          e.stopPropagation()
          setIsDragging(false)
          
          const files = Array.from(e.dataTransfer.files)
          if (files.length > 0) {
            setSelectedFiles(prev => [...prev, ...files])
          }
        }}
      >
        {/* Drag overlay */}
        {isDragging && (
          <div className="absolute inset-0 z-50 bg-blue-50/90 flex items-center justify-center pointer-events-none">
            <div className="text-center">
              <div className="mb-4">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full">
                  <Paperclip className="h-8 w-8 text-blue-600" />
                </div>
              </div>
              <p className="text-xl font-semibold text-blue-900">
                Charger dans {selectedChannel?.name || 'le canal'}
              </p>
              <p className="text-sm text-blue-700 mt-2">
                Relâchez pour ajouter les fichiers
              </p>
            </div>
          </div>
        )}
        
        {/* Channel Header */}
        <div className="px-4 py-3 border-b border-gray-200 bg-white flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button
                className="md:hidden"
                onClick={() => setShowMobileChannelList(true)}
              >
                ← Retour
              </button>
              <Hash className="h-5 w-5 text-gray-500" />
              <h2 className="font-semibold text-gray-900">{selectedChannel?.name || ''}</h2>
            </div>
          </div>
        </div>

        {/* Notification de nouveau message */}
        {newMessageNotification && (
          <div className="absolute top-20 left-1/2 transform -translate-x-1/2 z-50">
            <div className="bg-blue-600 text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-2">
              <Spinner size="sm" className="h-4 w-4" />
              <span className="text-sm">{newMessageNotification}</span>
            </div>
          </div>
        )}

        {/* Messages Area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {selectedChannel && loading[selectedChannel.id] ? (
            <div className="flex-1 flex items-center justify-center">
              <Spinner size="md" className="text-gray-400" />
            </div>
          ) : selectedChannel && messages[selectedChannel.id] && messages[selectedChannel.id].length > 0 ? (
            <div 
              className="flex-1 overflow-y-auto relative" 
              onScroll={(e) => {
                // Ne pas modifier userHasScrolled si on charge l'historique
                if (isLoadingHistory) return
                
                const element = e.currentTarget
                // Check if user is at the top or near the bottom
                const isAtTop = element.scrollTop < 100
                const isNearBottom = !isAtTop && 
                                   element.scrollHeight - element.scrollTop - element.clientHeight < 100
                
                // If user scrolled up (not near bottom), set flag
                if (!isNearBottom) {
                  setUserHasScrolled(true)
                } else {
                  // If user scrolled back to bottom, reset flag and mark as read
                  setUserHasScrolled(false)
                  if (selectedChannel) {
                    markChannelAsRead(selectedChannel.id)
                  }
                }
              }}>
              <div className="flex flex-col p-4">
                <div className="space-y-4 flex-1">
                  {/* Button to load more messages */}
                  {hasMoreMessages[selectedChannel.id] && (
                    <div className="flex justify-center pb-4">
                      <button
                        onClick={loadMoreMessages}
                        disabled={loadingMoreMessages}
                        className="px-4 py-2 text-sm text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition-colors flex items-center gap-2"
                      >
                        {loadingMoreMessages ? (
                          <>
                            <Spinner size="sm" className="h-4 w-4" />
                            Chargement...
                          </>
                        ) : (
                          <>
                            <ChevronUp className="h-4 w-4" />
                            Voir les messages précédents
                          </>
                        )}
                      </button>
                    </div>
                  )}
                  
                  {groupMessages(messages[selectedChannel.id]).map((group, groupIndex) => (
                <div 
                  key={groupIndex}
                  data-message-group={`group-${groupIndex}-${group.timestamp}`}
                  className={cn(
                    "flex gap-3",
                    group.isCurrentUser && "flex-row-reverse"
                  )}
                >
                  {!group.isCurrentUser && (
                    <Avatar className="h-8 w-8 flex-shrink-0">
                      <AvatarImage src={group.avatarUrl} />
                      <AvatarFallback>{group.initials}</AvatarFallback>
                    </Avatar>
                  )}
                  <div className="flex-1">
                    <div className={cn(
                      "flex items-baseline gap-2 mb-1",
                      group.isCurrentUser ? "justify-end" : "justify-start"
                    )}>
                      <span className="font-semibold text-sm">
                        {group.isCurrentUser ? "Vous" : group.displayName}
                      </span>
                      <span className="text-xs text-gray-500">
                        {formatTimestamp(group.timestamp)}
                      </span>
                    </div>
                    <div className="flex flex-col gap-1">
                      {group.messages.map((msg, msgIndex) => {
                        
                        // Vérifier si le message contient un fichier audio (Slack les marque souvent comme video/mp4)
                        const audioFile = msg.files?.find(file => 
                          file.mimetype?.startsWith('audio/') || 
                          file.mimetype === 'video/mp4' ||
                          file.mimetype === 'video/webm' ||
                          file.name?.match(/\.(mp3|mp4|m4a|wav|ogg|webm)$/i)
                        )
                        
                        // Si c'est un message vocal (avec fichier audio)
                        if (audioFile && (msg.text?.includes('Message vocal') || msg.text?.includes('🎤'))) {
                          return (
                            <div
                              key={msgIndex}
                              className={cn(
                                "min-w-[280px]",
                                group.isCurrentUser && "ml-auto"
                              )}
                            >
                              <AudioPlayer
                                url={`/api/slack/proxy-file?url=${encodeURIComponent(audioFile.url_private_download || audioFile.url_private)}`}
                                className={cn(
                                  group.isCurrentUser 
                                    ? "bg-blue-50 border-blue-200" 
                                    : "bg-gray-50 border-gray-200"
                                )}
                              />
                            </div>
                          )
                        }
                        
                        // Message texte normal avec fichiers éventuels
                        // Extraire le texte sans signature pour vérifier s'il y a du contenu
                        const { cleanText } = extractMessageSignature(msg.text || '')
                        const hasTextContent = cleanText && cleanText.trim().length > 0
                        const messageKey = msg.ts || msg.timestamp
                        const isEditing = editingMessage?.ts === messageKey
                        const isHovered = hoveredMessage === messageKey
                        
                        // Vérifier si le message a été envoyé via notre bot (a une signature/realAuthor)
                        // Seuls les messages avec realAuthor peuvent être modifiés/supprimés
                        const canEditOrDelete = group.isCurrentUser && msg.realAuthor
                        
                        return (
                          <div 
                            key={msgIndex} 
                            className={cn(
                              "flex gap-2 items-start",
                              group.isCurrentUser ? "justify-end" : "justify-start"
                            )}
                            onMouseEnter={() => setHoveredMessage(messageKey)}
                            onMouseLeave={() => setHoveredMessage(null)}
                          >
                            {/* Boutons à gauche pour les messages de l'utilisateur */}
                            {canEditOrDelete && isHovered && !isEditing && group.isCurrentUser && (
                              <div className="flex items-center gap-1 p-1">
                                {hasTextContent && !msg.files?.length && (
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-7 w-7"
                                    onClick={() => startEditMessage(msg)}
                                    title="Modifier"
                                  >
                                    <Edit2 className="h-4 w-4" />
                                  </Button>
                                )}
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-7 w-7 text-red-500 hover:text-red-600"
                                  onClick={() => setDeletingMessage(msg)}
                                  title="Supprimer"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            )}
                            
                            {/* Contenu du message avec max 70% de largeur */}
                            <div className="flex flex-col max-w-[70%]">
                              {/* Mode édition ou affichage normal */}
                              {isEditing ? (
                              <div className="flex flex-col gap-2">
                                <div className="flex gap-2 items-end">
                                  <div className="w-[500px] relative">
                                    <Textarea
                                      ref={editTextareaRef}
                                      value={editingText}
                                      onChange={(e) => {
                                        setEditingText(e.target.value)
                                        // Auto-resize avec limite à 500px
                                        e.target.style.height = 'auto'
                                        const scrollHeight = e.target.scrollHeight
                                        e.target.style.height = Math.min(scrollHeight, 500) + 'px'
                                      }}
                                      className="w-full resize-none pr-20"
                                      style={{ minHeight: '40px', maxHeight: '500px' }}
                                      placeholder="Modifier le message..."
                                      onKeyDown={(e) => {
                                        // Raccourcis clavier pour la mise en forme
                                        if ((e.metaKey || e.ctrlKey) && !e.shiftKey) {
                                          const textarea = e.currentTarget
                                          const start = textarea.selectionStart
                                          const end = textarea.selectionEnd
                                          const selectedText = editingText.substring(start, end)
                                          let formattedText = ''
                                          let cursorOffset = 1
                                          
                                          switch(e.key) {
                                            case 'b': // Gras
                                              e.preventDefault()
                                              formattedText = selectedText ? `*${selectedText}*` : '**'
                                              break
                                            case 'i': // Italique
                                              e.preventDefault()
                                              formattedText = selectedText ? `_${selectedText}_` : '__'
                                              break
                                            case 'k': // Lien
                                              e.preventDefault()
                                              if (selectedText.startsWith('http')) {
                                                formattedText = `<${selectedText}|texte du lien>`
                                                cursorOffset = formattedText.length - 1
                                              } else {
                                                formattedText = selectedText ? `<url|${selectedText}>` : '<url|texte>'
                                                cursorOffset = 1
                                              }
                                              break
                                            case 'e': // Code inline
                                              e.preventDefault()
                                              formattedText = selectedText ? `\`${selectedText}\`` : '``'
                                              break
                                          }
                                          
                                          if (formattedText) {
                                            const newText = editingText.substring(0, start) + formattedText + editingText.substring(end)
                                            setEditingText(newText)
                                            setTimeout(() => {
                                              textarea.selectionStart = textarea.selectionEnd = selectedText ? start + formattedText.length : start + cursorOffset
                                              textarea.focus()
                                            }, 0)
                                          }
                                        }
                                        
                                        // Raccourci pour valider
                                        if (e.key === 'Enter' && !e.shiftKey) {
                                          e.preventDefault()
                                          handleUpdateMessage()
                                        }
                                        
                                        // Raccourci pour annuler
                                        if (e.key === 'Escape') {
                                          cancelEdit()
                                          setShowEditFormatting(false)
                                          setShowEditEmoji(false)
                                        }
                                      }}
                                      autoFocus
                                    />
                                    <div className="absolute bottom-2 right-2 flex gap-1">
                                      <Popover open={showEditFormatting} onOpenChange={setShowEditFormatting}>
                                        <PopoverTrigger asChild>
                                          <Button
                                            size="icon"
                                            variant="ghost"
                                            className="h-7 w-7"
                                            type="button"
                                          >
                                            <Type className="h-4 w-4" />
                                          </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-auto p-2" align="end">
                                          <div className="flex gap-1">
                                            <Button
                                              size="icon"
                                              variant="ghost"
                                              className="h-7 w-7"
                                              onClick={() => {
                                                const textarea = editTextareaRef.current
                                                if (!textarea) return
                                                const start = textarea.selectionStart
                                                const end = textarea.selectionEnd
                                                const selectedText = editingText.substring(start, end)
                                                const formattedText = selectedText ? `*${selectedText}*` : '**'
                                                const newText = editingText.substring(0, start) + formattedText + editingText.substring(end)
                                                setEditingText(newText)
                                                setTimeout(() => {
                                                  textarea.selectionStart = textarea.selectionEnd = selectedText ? start + formattedText.length : start + 1
                                                  textarea.focus()
                                                }, 0)
                                              }}
                                            >
                                              <Bold className="h-4 w-4" />
                                            </Button>
                                            <Button
                                              size="icon"
                                              variant="ghost"
                                              className="h-7 w-7"
                                              onClick={() => {
                                                const textarea = editTextareaRef.current
                                                if (!textarea) return
                                                const start = textarea.selectionStart
                                                const end = textarea.selectionEnd
                                                const selectedText = editingText.substring(start, end)
                                                const formattedText = selectedText ? `_${selectedText}_` : '__'
                                                const newText = editingText.substring(0, start) + formattedText + editingText.substring(end)
                                                setEditingText(newText)
                                                setTimeout(() => {
                                                  textarea.selectionStart = textarea.selectionEnd = selectedText ? start + formattedText.length : start + 1
                                                  textarea.focus()
                                                }, 0)
                                              }}
                                            >
                                              <Italic className="h-4 w-4" />
                                            </Button>
                                            <Button
                                              size="icon"
                                              variant="ghost"
                                              className="h-7 w-7"
                                              onClick={() => {
                                                const textarea = editTextareaRef.current
                                                if (!textarea) return
                                                const start = textarea.selectionStart
                                                const end = textarea.selectionEnd
                                                const selectedText = editingText.substring(start, end)
                                                const formattedText = selectedText ? `~${selectedText}~` : '~~'
                                                const newText = editingText.substring(0, start) + formattedText + editingText.substring(end)
                                                setEditingText(newText)
                                                setTimeout(() => {
                                                  textarea.selectionStart = textarea.selectionEnd = selectedText ? start + formattedText.length : start + 1
                                                  textarea.focus()
                                                }, 0)
                                              }}
                                            >
                                              <Strikethrough className="h-4 w-4" />
                                            </Button>
                                          </div>
                                        </PopoverContent>
                                      </Popover>
                                      
                                      <Popover open={showEditEmoji} onOpenChange={setShowEditEmoji}>
                                        <PopoverTrigger asChild>
                                          <Button
                                            size="icon"
                                            variant="ghost"
                                            className="h-7 w-7"
                                            type="button"
                                          >
                                            <Smile className="h-4 w-4" />
                                          </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-auto p-0" align="end">
                                          <EmojiPicker
                                            onEmojiClick={(emojiData) => {
                                              setEditingText(prev => prev + emojiData.emoji)
                                              setShowEditEmoji(false)
                                              if (editTextareaRef.current) {
                                                editTextareaRef.current.focus()
                                              }
                                            }}
                                          />
                                        </PopoverContent>
                                      </Popover>
                                    </div>
                                  </div>
                                  <div className="flex gap-1">
                                    <Button
                                      size="icon"
                                      variant="default"
                                      className="h-9 w-9"
                                      onClick={handleUpdateMessage}
                                      disabled={!editingText.trim() || isUpdating}
                                    >
                                      {isUpdating ? (
                                        <Spinner size="sm" className="h-4 w-4" />
                                      ) : (
                                        <Check className="h-4 w-4" />
                                      )}
                                    </Button>
                                    <Button
                                      size="icon"
                                      variant="outline"
                                      className="h-9 w-9"
                                      onClick={() => {
                                        cancelEdit()
                                        setShowEditFormatting(false)
                                        setShowEditEmoji(false)
                                      }}
                                      disabled={isUpdating}
                                    >
                                      <X className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </div>
                              </div>
                            ) : (
                              <>
                                {hasTextContent && (
                                  <div
                                    className={cn(
                                      "px-3 py-2 rounded-lg text-sm break-words slack-message w-fit",
                                      group.isCurrentUser 
                                        ? "bg-blue-100 text-gray-900" 
                                        : "bg-gray-100 text-gray-800"
                                    )}
                                    dangerouslySetInnerHTML={{ __html: formatSlackMessage(msg.text) }}
                                  />
                                )}
                              </>
                            )}
                            {msg.files && msg.files.length > 0 && (
                              <FileList
                                files={msg.files.map(file => ({
                                  id: file.id,
                                  name: file.name,
                                  mimetype: file.mimetype,
                                  url_private: file.url_private,
                                  url_private_download: file.url_private_download,
                                  permalink: file.permalink,
                                  title: file.title,
                                  filetype: file.filetype,
                                  size: file.size
                                }))}
                                isLocal={false}
                                className={cn(
                                  group.isCurrentUser && "ml-auto"
                                )}
                              />
                            )}
                            
                              {/* Réactions sous le message */}
                              {msg.reactions && msg.reactions.length > 0 && (
                                <div className="flex flex-wrap gap-1 mt-1">
                                  {msg.reactions.map((reaction) => {
                                    const userHasReacted = reaction.users.includes(currentUserSlackId || '')
                                    const reactionUsers = reaction.users.map(userId => {
                                      // Chercher dans le membersMap
                                      if (membersMap && membersMap[userId]) {
                                        const member = membersMap[userId]
                                        return `${member.first_name} ${member.last_name}`
                                      }
                                      // Si pas trouvé, retourner juste l'ID (ou "Bot" si c'est le bot)
                                      return userId.startsWith('B') ? 'Bot' : userId
                                    })
                                    
                                    return (
                                      <Popover key={reaction.name}>
                                        <PopoverTrigger asChild>
                                          <Button
                                            variant={userHasReacted ? "default" : "outline"}
                                            size="sm"
                                            className={cn(
                                              "h-6 px-2 text-xs cursor-pointer",
                                              userHasReacted && "bg-blue-100 hover:bg-blue-200 text-blue-800 border-blue-300"
                                            )}
                                          >
                                            <span className="mr-1">{getEmojiFromName(reaction.name)}</span>
                                            <span>{reaction.count}</span>
                                          </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-auto p-2" side="top">
                                          <div className="text-xs">
                                            {reactionUsers.join(', ')}
                                          </div>
                                        </PopoverContent>
                                      </Popover>
                                    )
                                  })}
                                </div>
                              )}
                              
                              {/* Nombre de réponses */}
                              {msg.reply_count && msg.reply_count > 0 && (
                                <div className="text-xs text-gray-500 mt-1">
                                  {msg.reply_count} réponse{msg.reply_count > 1 ? 's' : ''}
                                </div>
                              )}
                            </div>
                            
                            {/* Boutons à droite pour les messages des autres */}
                            {!group.isCurrentUser && isHovered && !isEditing && (
                              <div className="flex items-center gap-1 p-1">
                                <Popover open={showReactionPicker === (msg.ts || msg.timestamp)} onOpenChange={(open) => setShowReactionPicker(open ? (msg.ts || msg.timestamp) : null)}>
                                  <PopoverTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-7 w-7"
                                      title="Ajouter une réaction"
                                    >
                                      <SmilePlus className="h-4 w-4" />
                                    </Button>
                                  </PopoverTrigger>
                                  <PopoverContent className="w-auto p-0" align="start" side="top">
                                    <div className="p-3 grid grid-cols-8 gap-1 max-h-[400px] overflow-y-auto">
                                      {/* Liste d'emojis Slack valides */}
                                      {[
                                        { emoji: '👍', name: 'thumbsup' },
                                        { emoji: '👎', name: 'thumbsdown' },
                                        { emoji: '❤️', name: 'heart' },
                                        { emoji: '😂', name: 'joy' },
                                        { emoji: '🔥', name: 'fire' },
                                        { emoji: '👏', name: 'clap' },
                                        { emoji: '🎉', name: 'tada' },
                                        { emoji: '🚀', name: 'rocket' },
                                        { emoji: '👀', name: 'eyes' },
                                        { emoji: '🤔', name: 'thinking_face' },
                                        { emoji: '✅', name: 'white_check_mark' },
                                        { emoji: '❌', name: 'x' },
                                        { emoji: '🙏', name: 'pray' },
                                        { emoji: '💪', name: 'muscle' },
                                        { emoji: '👌', name: 'ok_hand' },
                                        { emoji: '😊', name: 'blush' },
                                        { emoji: '😃', name: 'smiley' },
                                        { emoji: '😁', name: 'grin' },
                                        { emoji: '😄', name: 'smile' },
                                        { emoji: '😍', name: 'heart_eyes' },
                                        { emoji: '😘', name: 'kissing_heart' },
                                        { emoji: '😉', name: 'wink' },
                                        { emoji: '😎', name: 'sunglasses' },
                                        { emoji: '😢', name: 'cry' },
                                        { emoji: '😭', name: 'sob' },
                                        { emoji: '😱', name: 'scream' },
                                        { emoji: '😴', name: 'sleeping' },
                                        { emoji: '🤓', name: 'nerd_face' },
                                        { emoji: '😡', name: 'rage' },
                                        { emoji: '🙌', name: 'raised_hands' },
                                        { emoji: '✋', name: 'raised_hand' },
                                        { emoji: '👋', name: 'wave' },
                                        { emoji: '✊', name: 'fist' },
                                        { emoji: '✌️', name: 'v' },
                                        { emoji: '🤞', name: 'crossed_fingers' },
                                        { emoji: '☝️', name: 'point_up' },
                                        { emoji: '👇', name: 'point_down' },
                                        { emoji: '👈', name: 'point_left' },
                                        { emoji: '👉', name: 'point_right' },
                                        { emoji: '⭐', name: 'star' },
                                        { emoji: '✨', name: 'sparkles' },
                                        { emoji: '💥', name: 'boom' },
                                        { emoji: '💯', name: '100' },
                                        { emoji: '🎁', name: 'gift' },
                                        { emoji: '🏆', name: 'trophy' },
                                        { emoji: '🥇', name: 'first_place_medal' },
                                        { emoji: '🥈', name: 'second_place_medal' },
                                        { emoji: '🥉', name: 'third_place_medal' },
                                        { emoji: '⚡', name: 'zap' },
                                        { emoji: '💡', name: 'bulb' },
                                        { emoji: '🔔', name: 'bell' },
                                        { emoji: '📌', name: 'pushpin' },
                                        { emoji: '📝', name: 'memo' },
                                        { emoji: '⚠️', name: 'warning' },
                                        { emoji: '❓', name: 'question' },
                                        { emoji: '❗', name: 'exclamation' },
                                        { emoji: '➕', name: 'heavy_plus_sign' },
                                        { emoji: '➖', name: 'heavy_minus_sign' },
                                        { emoji: '✔️', name: 'heavy_check_mark' },
                                        { emoji: '🔴', name: 'red_circle' },
                                        { emoji: '🔵', name: 'large_blue_circle' },
                                        { emoji: '⚪', name: 'white_circle' },
                                        { emoji: '⚫', name: 'black_circle' },
                                        { emoji: '🟢', name: 'green_circle' },
                                        { emoji: '🟡', name: 'yellow_circle' },
                                        { emoji: '🟣', name: 'purple_circle' },
                                        { emoji: '🟠', name: 'orange_circle' }
                                      ].map(({ emoji, name }) => (
                                        <Button
                                          key={name}
                                          variant="ghost"
                                          size="sm"
                                          className="h-8 w-8 p-0 hover:bg-gray-100"
                                          onClick={() => {
                                            handleAddReaction(msg.ts || msg.timestamp, name)
                                            setShowReactionPicker(null)
                                          }}
                                          title={`:${name}:`}
                                        >
                                          <span className="text-lg">{emoji}</span>
                                        </Button>
                                      ))}
                                    </div>
                                  </PopoverContent>
                                </Popover>
                                
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7"
                                  onClick={() => setReplyingTo(msg)}
                                  title="Répondre"
                                >
                                  <MessageCircle className="h-4 w-4" />
                                </Button>
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </div>
              ))}
                  <div ref={scrollRef} />
                  {refreshingAfterSend && (
                    <div className="flex items-center justify-center gap-1.5 text-xs text-gray-400 mt-2 opacity-60">
                      <Spinner size="sm" className="h-3 w-3" />
                      <span>Synchronisation...</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-500">
              Aucun message dans ce canal
            </div>
          )}
        </div>

        {/* Message Input */}
        {isSlackConnected ? (
          <div className="p-4 border-t border-gray-200 bg-gray-50 flex-shrink-0">
            {sendError && (
              <Alert className="mb-2 border-red-200 bg-red-50">
                <AlertDescription className="text-red-800">
                  {sendError}
                </AlertDescription>
              </Alert>
            )}
            
            {/* Indicateur de réponse */}
            {replyingTo && (
              <div className="mb-2 p-2 bg-blue-50 border border-blue-200 rounded-lg flex items-start justify-between">
                <div className="flex-1">
                  <div className="text-xs text-blue-700 mb-1 flex items-center">
                    <MessageCircle className="h-3 w-3 mr-1" />
                    Répondre à {replyingTo.realAuthor?.first_name || replyingTo.member?.first_name || 'un message'}
                  </div>
                  <div className="text-sm text-gray-600 line-clamp-2">
                    {(() => {
                      const { cleanText } = extractMessageSignature(replyingTo.text || '')
                      return cleanText || '(message sans texte)'
                    })()}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 ml-2"
                  onClick={() => setReplyingTo(null)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            )}
            {selectedFiles.length > 0 && (
              <div className="mb-2">
                <FileList
                  files={selectedFiles.map(file => ({
                    name: file.name,
                    mimetype: file.type,
                    size: file.size,
                    file: file
                  }))}
                  onRemove={(index) => {
                    setSelectedFiles(prev => prev.filter((_, i) => i !== index))
                  }}
                  isLocal={true}
                  className="mb-2"
                />
              </div>
            )}
            {showFormatting && (
              <div className="flex items-center gap-1 mb-2 p-2 bg-white border border-gray-200 rounded-lg">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0"
                  onClick={() => applyFormatting('bold')}
                  title="Gras (Ctrl+B)"
                >
                  <Bold className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0"
                  onClick={() => applyFormatting('italic')}
                  title="Italique (Ctrl+I)"
                >
                  <Italic className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0"
                  onClick={() => applyFormatting('strikethrough')}
                  title="Barré"
                >
                  <Strikethrough className="h-4 w-4" />
                </Button>
                <div className="w-px h-5 bg-gray-300 mx-1" />
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0"
                  onClick={() => applyFormatting('link')}
                  title="Lien hypertexte"
                >
                  <Link2 className="h-4 w-4" />
                </Button>
                <div className="w-px h-5 bg-gray-300 mx-1" />
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0"
                  onClick={() => applyFormatting('bullet')}
                  title="Liste à puces"
                >
                  <List className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0"
                  onClick={() => applyFormatting('numbered')}
                  title="Liste numérotée"
                >
                  <ListOrdered className="h-4 w-4" />
                </Button>
              </div>
            )}
            <div className="flex gap-2 items-end">
              <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={(e) => {
                  const files = Array.from(e.target.files || [])
                  setSelectedFiles(prev => [...prev, ...files])
                  if (fileInputRef.current) {
                    fileInputRef.current.value = ''
                  }
                }}
              />
              <Button
                variant="ghost"
                size="icon"
                className="text-gray-500 hover:text-gray-700"
                onClick={() => fileInputRef.current?.click()}
              >
                <Paperclip className="h-5 w-5" />
              </Button>
              <div className="flex-1 relative">
                <Textarea
                  ref={inputRef}
                  placeholder="Écrire un message..."
                  value={inputMessage}
                  onChange={(e) => {
                    setInputMessage(e.target.value)
                    // Auto-resize uniquement si nécessaire
                    const textarea = e.target
                    // Reset height to get the correct scrollHeight
                    textarea.style.height = '38px'
                    // Only resize if content needs more space
                    if (textarea.scrollHeight > 38) {
                      textarea.style.height = Math.min(textarea.scrollHeight, 240) + 'px' // 240px ≈ 15 lignes
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      if (e.shiftKey) {
                        // MAJ+ENTREE: vérifier si on est dans une liste pour continuer
                        const textarea = e.currentTarget
                        const start = textarea.selectionStart
                        const beforeCursor = inputMessage.substring(0, start)
                        const lines = beforeCursor.split('\n')
                        const currentLine = lines[lines.length - 1]
                        
                        // Vérifier si on est dans une liste à puces
                        if (currentLine.trim().startsWith('•')) {
                          e.preventDefault()
                          const newText = inputMessage.substring(0, start) + '\n• ' + inputMessage.substring(start)
                          setInputMessage(newText)
                          setTimeout(() => {
                            textarea.selectionStart = textarea.selectionEnd = start + 3
                            // Trigger resize
                            textarea.style.height = '38px'
                            if (textarea.scrollHeight > 38) {
                              textarea.style.height = Math.min(textarea.scrollHeight, 240) + 'px'
                            }
                          }, 0)
                          return
                        }
                        
                        // Vérifier si on est dans une liste numérotée
                        const numberedMatch = currentLine.match(/^(\d+)\./)
                        if (numberedMatch) {
                          e.preventDefault()
                          const nextNumber = parseInt(numberedMatch[1]) + 1
                          const newText = inputMessage.substring(0, start) + '\n' + nextNumber + '. ' + inputMessage.substring(start)
                          setInputMessage(newText)
                          setTimeout(() => {
                            textarea.selectionStart = textarea.selectionEnd = start + 3 + nextNumber.toString().length
                            // Trigger resize
                            textarea.style.height = '38px'
                            if (textarea.scrollHeight > 38) {
                              textarea.style.height = Math.min(textarea.scrollHeight, 240) + 'px'
                            }
                          }, 0)
                          return
                        }
                      } else {
                        // ENTREE seul: envoyer le message
                        e.preventDefault()
                        sendMessage()
                      }
                    }
                    
                    // Gestion de la touche Backspace pour supprimer les puces/numéros vides
                    if (e.key === 'Backspace') {
                      const textarea = e.currentTarget
                      const start = textarea.selectionStart
                      const beforeCursor = inputMessage.substring(0, start)
                      
                      // Si on est juste après une puce ou un numéro
                      if (beforeCursor.endsWith('• ') || beforeCursor.match(/\d+\. $/)) {
                        e.preventDefault()
                        const lines = beforeCursor.split('\n')
                        lines[lines.length - 1] = ''
                        const newText = lines.join('\n') + inputMessage.substring(start)
                        setInputMessage(newText)
                        setTimeout(() => {
                          textarea.selectionStart = textarea.selectionEnd = beforeCursor.lastIndexOf('\n') + 1
                        }, 0)
                        return
                      }
                    }
                    
                    // Shortcuts de formatage
                    if (e.ctrlKey || e.metaKey) {
                      if (e.key === 'b') {
                        e.preventDefault()
                        applyFormatting('bold')
                      } else if (e.key === 'i') {
                        e.preventDefault()
                        applyFormatting('italic')
                      }
                    }
                  }}
                  className="resize-none min-h-[38px] max-h-[240px] py-2"
                  disabled={sendingMessage}
                  style={{ height: '38px' }}
                />
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="text-gray-500 hover:text-gray-700"
                onClick={() => setShowFormatting(!showFormatting)}
                title="Formatage du texte"
              >
                <Type className="h-5 w-5" />
              </Button>
              <Popover open={showEmojiPicker} onOpenChange={setShowEmojiPicker}>
                <PopoverTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-gray-500 hover:text-gray-700"
                  >
                    <Smile className="h-5 w-5" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="end">
                  <EmojiPicker
                    onEmojiClick={(emojiData) => {
                      handleEmojiClick(emojiData)
                    }}
                  />
                </PopoverContent>
              </Popover>
              {isRecording ? (
                <>
                  <div className="flex items-center gap-2 px-2 text-red-500">
                    <div className="animate-pulse">●</div>
                    <span className="text-sm font-mono">{formatRecordingTime(recordingTime)}</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-red-500 hover:text-red-600"
                    onClick={cancelRecording}
                    title="Annuler l'enregistrement"
                  >
                    <MicOff className="h-5 w-5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-green-600 hover:text-green-700"
                    onClick={stopRecording}
                    title="Envoyer le message vocal"
                  >
                    <Square className="h-5 w-5" />
                  </Button>
                </>
              ) : (
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-gray-500 hover:text-gray-700"
                  onClick={startRecording}
                  title="Enregistrer un message vocal"
                >
                  <Mic className="h-5 w-5" />
                </Button>
              )}
              <Button
                onClick={sendMessage}
                disabled={(!inputMessage.trim() && selectedFiles.length === 0) || sendingMessage}
              >
                {sendingMessage ? (
                  <Spinner size="sm" className="h-4 w-4" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
        ) : (
          <div className="p-4 border-t border-gray-200 bg-gray-50 flex-shrink-0">
            <Alert>
              <AlertDescription>
                Connectez votre compte Slack dans{' '}
                <a href="/profile" className="text-blue-600 hover:text-blue-800 underline">
                  votre profil
                </a>
                {' '}pour pouvoir envoyer des messages
              </AlertDescription>
            </Alert>
          </div>
        )}
      </div>
      
      {/* Dialogue de confirmation de suppression */}
      <AlertDialog open={!!deletingMessage} onOpenChange={() => setDeletingMessage(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer le message</AlertDialogTitle>
            <AlertDialogDescription>
              Voulez-vous vraiment supprimer ce message ? Cette opération est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          
          {deletingMessage && (
            <div className="my-4 p-3 bg-gray-50 rounded-lg">
              {/* Afficher le texte du message s'il existe */}
              {(() => {
                const { cleanText } = extractMessageSignature(deletingMessage.text || '')
                return cleanText && cleanText.trim() ? (
                  <div 
                    className="text-sm text-gray-700 break-words slack-message"
                    dangerouslySetInnerHTML={{ __html: formatSlackMessage(deletingMessage.text) }}
                  />
                ) : null
              })()}
              
              {/* Afficher les fichiers s'il y en a */}
              {deletingMessage.files && deletingMessage.files.length > 0 && (
                <div className="mt-2">
                  <FileList
                    files={deletingMessage.files.map(file => ({
                      id: file.id,
                      name: file.name,
                      mimetype: file.mimetype,
                      url_private: file.url_private,
                      url_private_download: file.url_private_download,
                      permalink: file.permalink,
                      title: file.title,
                      filetype: file.filetype,
                      size: file.size
                    }))}
                    isLocal={false}
                  />
                </div>
              )}
            </div>
          )}
          
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteMessage}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {isDeleting ? (
                <>
                  <Spinner size="sm" className="h-4 w-4 mr-2 text-primary-foreground" />
                  Suppression...
                </>
              ) : (
                'Supprimer'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

// Channel List Component
function ChannelList({ 
  groups, 
  selectedChannel, 
  onSelectChannel, 
  loading, 
  messages, 
  unreadCounts,
  isMobileView,
  markChannelAsRead
}: {
  groups: SlackGroup[]
  selectedChannel: SlackGroup | null
  onSelectChannel: (channel: SlackGroup) => void
  loading: Record<string, boolean>
  messages: Record<string, SlackMessage[]>
  unreadCounts: Record<string, number>
  isMobileView: boolean
  markChannelAsRead: (channelId: string) => void
}) {
  const formatRelativeTime = (timestamp: string | undefined) => {
    if (!timestamp) return ''
    
    // Parse the timestamp - Slack uses seconds since epoch
    const date = new Date(parseFloat(timestamp) * 1000)
    
    // Check if date is valid
    if (isNaN(date.getTime())) {
      console.warn('Invalid timestamp in channel list:', timestamp)
      return ''
    }
    
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMins / 60)
    const diffDays = Math.floor(diffHours / 24)

    if (diffMins < 1) return "À l'instant"
    if (diffMins < 60) return `${diffMins} min`
    if (diffHours < 24) return `${diffHours}h`
    if (diffDays < 7) return `${diffDays}j`
    
    // For older messages, show the date
    return date.toLocaleDateString('fr-FR', { 
      day: 'numeric', 
      month: 'short' 
    })
  }

  return (
    <div className={cn(
      "border-r border-gray-200 bg-gray-50 h-full flex flex-col",
      isMobileView ? "w-full" : "w-80"
    )}>
      <div className="p-4 border-b border-gray-200 flex-shrink-0">
        <h3 className="font-semibold text-gray-900">Canaux</h3>
      </div>
      <div className="flex-1 overflow-y-auto">
        <div className="p-2 space-y-1">
          {groups.map((group) => {
            if (!group.slack_channel_id) return null
            
            const groupMessages = messages[group.id] || []
            const lastMessage = groupMessages[groupMessages.length - 1] // Prendre le dernier message
            const unreadCount = unreadCounts[group.id] || 0
            const isSelected = selectedChannel?.id === group.id
            
            return (
              <button
                key={group.id}
                onClick={() => {
                  onSelectChannel(group)
                  // Only mark as read if user is at bottom of scroll (not userHasScrolled)
                  // This will be handled by the scroll event and channel selection logic
                }}
                className={cn(
                  "w-full p-3 rounded-lg text-left transition-colors",
                  "hover:bg-white",
                  isSelected ? "bg-white shadow-sm" : "bg-transparent"
                )}
              >
                <div className="flex items-start justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <Hash className="h-4 w-4 text-gray-400 mt-0.5" />
                    <span className="font-medium text-sm">{group.name}</span>
                  </div>
                  {unreadCount > 0 && (
                    <Badge className="bg-blue-600 text-white text-xs px-1.5 py-0 h-5">
                      {unreadCount}
                    </Badge>
                  )}
                </div>
                {loading[group.id] ? (
                  <div className="text-xs text-gray-500">Chargement...</div>
                ) : lastMessage ? (
                  <div className="ml-6">
                    <div className="flex items-baseline gap-2">
                      <span className="text-xs font-medium text-gray-600">
                        {(() => {
                          // Use realAuthor if available (for messages sent via bot)
                          const actualAuthor = lastMessage.realAuthor || lastMessage.member
                          if (actualAuthor) {
                            return actualAuthor.first_name
                          }
                          // Fall back to user profile
                          return lastMessage.user_profile?.name || lastMessage.user
                        })()}
                      </span>
                      <span className="text-xs text-gray-400">
                        {formatRelativeTime(lastMessage.ts || lastMessage.timestamp)}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 truncate mt-0.5">
                      {formatSlackMessagePreview(lastMessage.text, 80)}
                    </p>
                  </div>
                ) : (
                  <div className="text-xs text-gray-400 ml-6">Aucun message</div>
                )}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}