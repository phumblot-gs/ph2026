'use client'

import { useState, useEffect, useCallback } from 'react'
import { NativeChatWrapper } from '@/components/chat/native-chat-wrapper'
import { createClient } from '@/lib/supabase/client'
import { Hash } from 'lucide-react'
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
      localStorage.removeItem('selectedGroupId')
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
    
    // Utiliser le groupe sauvegardé s'il existe et est valide, sinon le premier groupe
    if (savedGroupId && groups.some(g => g.id === savedGroupId)) {
      setSelectedGroupId(savedGroupId)
    } else {
      setSelectedGroupId(groups[0]?.id || '')
    }
    
    setIsInitialized(true)
  }, [groups])
  
  const supabase = createClient()
  const selectedGroup = groups.find(g => g.id === selectedGroupId)
  
  // Sauvegarder le groupe sélectionné quand il change
  useEffect(() => {
    if (selectedGroupId && typeof window !== 'undefined') {
      localStorage.setItem('selectedGroupId', selectedGroupId)
    }
  }, [selectedGroupId])
  
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
            {/* Interface de chat */}
            <div className="flex-1 overflow-hidden">
              <NativeChatWrapper
                groupId={selectedGroupId}
                groupName={selectedGroup?.name}
                currentUserId={currentUserId}
                className="h-full"
                markChannelAsRead={markAsRead}
                incrementUnreadCount={incrementUnreadCount}
                unreadCount={getUnreadCount(selectedGroupId)}
              />
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