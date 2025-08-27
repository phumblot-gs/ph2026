'use client'

import { useState } from 'react'
import { DashboardNav } from '@/components/dashboard-nav'
import { DashboardSidebar, type DashboardView } from '@/components/dashboard-sidebar'
import { SlackChatInterface } from '@/components/slack-chat-interface'
import { EventsView } from '@/components/events-view'

interface DashboardClientProps {
  member: any
  groups: Array<{
    id: string
    name: string
    slack_channel_id: string | null
  }>
  userId: string
  websiteUrl: string | null
  highlightUrl: string | null
  donationsEnabled: boolean
  initialMessages?: Record<string, any[]>
  cacheInfo?: Record<string, { lastUpdated: string; ageInSeconds: number }>
}

export function DashboardClient({ 
  member, 
  groups, 
  userId, 
  websiteUrl, 
  highlightUrl, 
  donationsEnabled,
  initialMessages,
  cacheInfo 
}: DashboardClientProps) {
  const [currentView, setCurrentView] = useState<DashboardView>('slack')

  return (
    <div className="h-screen bg-gray-50 overflow-hidden">
      {/* Navigation */}
      <DashboardNav 
        memberRole={member?.role} 
        websiteUrl={websiteUrl} 
        highlightUrl={highlightUrl} 
      />
      
      <div className="flex h-full pt-16">
        {/* Sidebar */}
        <DashboardSidebar
          currentView={currentView}
          onViewChange={setCurrentView}
        />
        
        {/* Main Content Area */}
        <div className="flex-1 overflow-hidden">
            {currentView === 'slack' ? (
              <SlackChatInterface
                groups={groups}
                currentUserId={userId}
                initialMessages={initialMessages}
                cacheInfo={cacheInfo}
              />
            ) : (
              <EventsView />
            )}
        </div>
      </div>
    </div>
  )
}