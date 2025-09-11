'use client'

import { useState, Suspense } from 'react'
import { DashboardNav } from '@/components/dashboard-nav'
import { DashboardSidebar, type DashboardView } from '@/components/dashboard-sidebar'
import { Spinner } from '@/components/ui/spinner'
import { getModuleComponent } from '@/lib/modules/registry'

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
  const [currentView, setCurrentView] = useState<DashboardView>('discussions')

  return (
    <div className="h-screen bg-gray-50 overflow-hidden">
      {/* Navigation */}
      <DashboardNav 
        memberRole={member?.role} 
        websiteUrl={websiteUrl} 
        highlightUrl={highlightUrl} 
      />
      
      <div className="flex h-full">
        {/* Sidebar */}
        <DashboardSidebar
          currentView={currentView}
          onViewChange={setCurrentView}
        />
        
        {/* Main Content Area */}
        <div className="flex-1 overflow-hidden">
          <Suspense fallback={
            <div className="flex items-center justify-center h-full">
              <Spinner size="lg" />
            </div>
          }>
            <ModuleRenderer 
              moduleName={currentView}
              groups={groups}
              currentUserId={userId}
              initialMessages={initialMessages}
              cacheInfo={cacheInfo}
            />
          </Suspense>
        </div>
      </div>
    </div>
  )
}

// Composant pour rendre le module approprié
function ModuleRenderer({ 
  moduleName, 
  groups, 
  currentUserId, 
  initialMessages,
  cacheInfo 
}: {
  moduleName: string
  groups: any[]
  currentUserId: string
  initialMessages?: Record<string, any[]>
  cacheInfo?: Record<string, { lastUpdated: string; ageInSeconds: number }>
}) {
  const ModuleComponent = getModuleComponent(moduleName)
  
  if (!ModuleComponent) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Module non trouvé</h2>
          <p className="text-gray-500">Le module "{moduleName}" n'existe pas.</p>
        </div>
      </div>
    )
  }

  // Props spécifiques pour le module Discussions
  const moduleProps = moduleName === 'discussions' 
    ? { groups, currentUserId, initialMessages, cacheInfo }
    : { groups, currentUserId }

  return <ModuleComponent {...moduleProps} />
}