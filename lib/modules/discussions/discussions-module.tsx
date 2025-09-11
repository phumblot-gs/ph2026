'use client'

import { Suspense } from 'react'
import { ChatWrapper } from '@/components/chat/chat-wrapper'
import { Spinner } from '@/components/ui/spinner'

interface DiscussionsModuleProps {
  groups: Array<{
    id: string
    name: string
    slack_channel_id: string | null
  }>
  currentUserId: string
  initialMessages?: Record<string, any[]>
  cacheInfo?: Record<string, { lastUpdated: string; ageInSeconds: number }>
}

export default function DiscussionsModule({ 
  groups, 
  currentUserId, 
  initialMessages,
  cacheInfo
}: DiscussionsModuleProps) {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center h-full">
        <Spinner size="lg" />
      </div>
    }>
      <ChatWrapper
        groups={groups}
        currentUserId={currentUserId}
        initialMessages={initialMessages}
        cacheInfo={cacheInfo}
      />
    </Suspense>
  )
}