'use client'

import dynamic from 'next/dynamic'
import { Spinner } from '@/components/ui/spinner'

// Import dynamique pour éviter les problèmes d'hydratation avec les dates
const NativeChatInterface = dynamic(
  () => import('./native-chat-interface'),
  { 
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center h-full">
        <Spinner size="lg" />
      </div>
    )
  }
)

interface NativeChatWrapperProps {
  groupId: string
  groupName?: string
  currentUserId: string
  className?: string
  markChannelAsRead?: (groupId: string) => void
  incrementUnreadCount?: (groupId: string) => void
  unreadCount?: number
}

export function NativeChatWrapper(props: NativeChatWrapperProps) {
  return <NativeChatInterface {...props} />
}