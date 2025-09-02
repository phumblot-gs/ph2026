'use client'

import { useState, useEffect, useCallback } from 'react'
import { NativeChatWrapper } from '@/components/chat/native-chat-wrapper'
import { SlackChatInterface } from '@/components/slack-chat-interface'
import { createClient } from '@/lib/supabase/client'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { MessageSquare, Hash } from 'lucide-react'
import { Spinner } from '@/components/ui/spinner'
import { useChatCache } from '@/hooks/use-chat-cache'
import { useUnreadCounts } from '@/hooks/use-unread-counts'

interface ChatWrapperProps {
  groups: Array<{
    id: string
    name: string
    slack_channel_id: string | null
  }>
  currentUserId: string
  initialMessages?: Record<string, any[]>
  cacheInfo?: Record<string, { lastUpdated: string; ageInSeconds: number }>
}

export function ChatWrapper({
  groups,
  currentUserId,
  initialMessages,
  cacheInfo
}: ChatWrapperProps) {
  // État temporaire pour éviter le flash
  const [isInitialized, setIsInitialized] = useState(false)
  
  // Initialiser avec des valeurs par défaut
  const [selectedGroupId, setSelectedGroupId] = useState<string>('')
  const [useNativeChat, setUseNativeChat] = useState(true)
  
  // Utiliser le hook de cache pour pouvoir le vider
  const { clearCache } = useChatCache()
  
  // Utiliser le hook pour les messages non lus
  // Passer le groupe sélectionné pour éviter l'incrémentation automatique sur ce groupe
  const { getUnreadCount, markAsRead, incrementUnreadCount } = useUnreadCounts(selectedGroupId)
  
  // Gestionnaire de raccourcis clavier
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // Option+Shift+R (Mac) ou Alt+Shift+R (Windows/Linux)
    if ((e.altKey || e.metaKey) && e.shiftKey && e.key === 'R') {
      e.preventDefault()
      clearCache()
      // Vider aussi le localStorage et sessionStorage pour un nettoyage complet
      localStorage.removeItem('visitedGroups')
      localStorage.removeItem('selectedGroupId')
      localStorage.removeItem('useNativeChat')
      sessionStorage.removeItem('chat-messages-cache')
      // Rafraîchir la page
      window.location.reload()
    }
  }, [clearCache])
  
  // Écouter les raccourcis clavier
  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])
  
  // Charger les préférences depuis localStorage après le montage
  useEffect(() => {
    const savedGroupId = localStorage.getItem('selectedGroupId')
    const savedUseNative = localStorage.getItem('useNativeChat')
    
    // Utiliser le groupe sauvegardé s'il existe et est valide, sinon le premier groupe
    if (savedGroupId && groups.some(g => g.id === savedGroupId)) {
      setSelectedGroupId(savedGroupId)
    } else {
      setSelectedGroupId(groups[0]?.id || '')
    }
    
    if (savedUseNative !== null) {
      setUseNativeChat(savedUseNative !== 'false')
    }
    
    setIsInitialized(true)
  }, [groups])
  
  const supabase = createClient()

  // Vérifier si le groupe a une intégration Slack active
  const selectedGroup = groups.find(g => g.id === selectedGroupId)
  const hasSlackIntegration = !!selectedGroup?.slack_channel_id
  
  // Sauvegarder le groupe sélectionné quand il change
  useEffect(() => {
    if (selectedGroupId && typeof window !== 'undefined') {
      localStorage.setItem('selectedGroupId', selectedGroupId)
    }
  }, [selectedGroupId])
  
  // Sauvegarder la préférence de chat quand elle change
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('useNativeChat', String(useNativeChat))
    }
  }, [useNativeChat])
  
  // Gérer les groupes visités
  const [visitedGroups, setVisitedGroups] = useState<Set<string>>(new Set())
  const [visitedGroupsLoaded, setVisitedGroupsLoaded] = useState(false)
  
  // Charger les groupes visités depuis localStorage après le montage
  useEffect(() => {
    const saved = localStorage.getItem('visitedGroups')
    if (saved) {
      try {
        setVisitedGroups(new Set(JSON.parse(saved)))
      } catch {
        setVisitedGroups(new Set())
      }
    }
    setVisitedGroupsLoaded(true)
  }, [])
  
  // Marquer un groupe comme visité
  useEffect(() => {
    if (selectedGroupId && visitedGroupsLoaded && !visitedGroups.has(selectedGroupId)) {
      const newVisited = new Set(visitedGroups)
      newVisited.add(selectedGroupId)
      setVisitedGroups(newVisited)
      localStorage.setItem('visitedGroups', JSON.stringify(Array.from(newVisited)))
    }
  }, [selectedGroupId, visitedGroups, visitedGroupsLoaded])

  // Ne pas afficher l'interface tant que l'initialisation n'est pas terminée
  if (!isInitialized) {
    return (
      <div className="flex h-full items-center justify-center">
        <Spinner size="lg" />
      </div>
    )
  }
  
  return (
    <div className="flex h-full">
      {/* Liste des groupes */}
      <div className="w-64 border-r bg-white">
        <div className="p-4 border-b">
          <h2 className="font-semibold text-lg">Groupes</h2>
        </div>
        <div className="overflow-y-auto">
          {groups.map(group => (
            <button
              key={group.id}
              onClick={() => {
                setSelectedGroupId(group.id)
                // Ne pas marquer comme lu ici, le composant NativeChatInterface s'en charge
              }}
              className={`w-full text-left px-4 py-3 hover:bg-gray-50 transition-all flex items-center gap-3 ${
                selectedGroupId === group.id 
                  ? 'bg-blue-50 border-l-4 border-blue-500' 
                  : 'border-l-4 border-transparent'
              }`}
            >
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{group.name}</span>
                  {visitedGroupsLoaded && !visitedGroups.has(group.id) && (
                    <span className="text-xs bg-green-500 text-white px-1.5 py-0.5 rounded">
                      Nouveau
                    </span>
                  )}
                  {(() => {
                    const unreadCount = getUnreadCount(group.id)
                    if (unreadCount > 0) {
                      return (
                        <span className="inline-flex items-center justify-center text-xs bg-red-500 text-white rounded-full min-w-[20px] h-5 px-1">
                          {unreadCount > 99 ? '99+' : unreadCount}
                        </span>
                      )
                    }
                    return null
                  })()}
                </div>
                {group.slack_channel_id && (
                  <div className="text-xs text-gray-500 flex items-center gap-1 mt-1">
                    <Hash className="h-3 w-3" />
                    Slack connecté
                  </div>
                )}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Zone de chat */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {selectedGroupId ? (
          <>
            {/* Sélecteur de type de chat si Slack est disponible */}
            {hasSlackIntegration && (
              <div className="border-b bg-white px-4 py-2">
                <Tabs value={useNativeChat ? 'native' : 'slack'} onValueChange={(v) => setUseNativeChat(v === 'native')}>
                  <TabsList className="h-8">
                    <TabsTrigger value="native" className="text-xs">
                      <MessageSquare className="h-3 w-3 mr-1" />
                      Chat Natif
                    </TabsTrigger>
                    <TabsTrigger value="slack" className="text-xs">
                      <Hash className="h-3 w-3 mr-1" />
                      Slack
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>
            )}

            {/* Interface de chat */}
            <div className="flex-1 overflow-hidden">
              {useNativeChat ? (
                <NativeChatWrapper
                  groupId={selectedGroupId}
                  groupName={selectedGroup?.name}
                  currentUserId={currentUserId}
                  className="h-full"
                  markChannelAsRead={markAsRead}
                  incrementUnreadCount={incrementUnreadCount}
                />
              ) : (
                <SlackChatInterface
                  groups={groups}
                  currentUserId={currentUserId}
                  initialMessages={initialMessages}
                  cacheInfo={cacheInfo}
                />
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-500">
            Sélectionnez un groupe pour commencer
          </div>
        )}
      </div>
    </div>
  )
}