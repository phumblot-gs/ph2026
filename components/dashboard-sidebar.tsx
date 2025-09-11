'use client'

import { useState, useEffect } from 'react'
import { MessageSquare, Calendar, FileText, Eye, Megaphone, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useModules } from '@/hooks/use-modules'
import { UserModule } from '@/lib/types/modules'

export type DashboardView = 'discussions' | 'events' | 'programme' | 'veille' | 'communication'

interface DashboardSidebarProps {
  currentView: DashboardView
  onViewChange: (view: DashboardView) => void
}

export function DashboardSidebar({ currentView, onViewChange }: DashboardSidebarProps) {
  const { modules, loading, canAccessModule } = useModules()

  // Mapping des icônes par module
  const moduleIcons = {
    discussions: MessageSquare,
    events: Calendar,
    programme: FileText,
    veille: Eye,
    communication: Megaphone
  }

  // Filtrer et trier les modules accessibles
  const accessibleModules = modules
    .filter(module => module.can_read)
    .sort((a, b) => a.sort_order - b.sort_order)
    .map(module => ({
      id: module.name as DashboardView,
      label: module.display_name,
      icon: moduleIcons[module.name as keyof typeof moduleIcons] || MessageSquare,
      isActive: module.is_active
    }))

  if (loading) {
    return (
      <div className="w-16 md:w-56 bg-white border-r border-gray-200 h-full flex flex-col flex-shrink-0">
        <div className="p-4">
          <h2 className="text-lg font-semibold text-gray-900 hidden md:block">Navigation</h2>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
        </div>
      </div>
    )
  }

  return (
    <div className="w-16 md:w-56 bg-white border-r border-gray-200 h-full flex flex-col flex-shrink-0">
      <div className="p-4">
        <h2 className="text-lg font-semibold text-gray-900 hidden md:block">Navigation</h2>
      </div>
      <nav className="flex-1 p-2 space-y-1 overflow-y-auto">
        {accessibleModules.map((item) => {
          const Icon = item.icon
          return (
            <button
              key={item.id}
              onClick={() => onViewChange(item.id)}
              disabled={!item.isActive}
              className={cn(
                "w-full flex items-center justify-center md:justify-start gap-3 px-3 py-2.5 rounded-lg transition-colors",
                "hover:bg-gray-100",
                currentView === item.id ? "bg-blue-50 text-blue-600" : "text-gray-700",
                !item.isActive && "opacity-50 cursor-not-allowed"
              )}
            >
              <Icon className="h-5 w-5 flex-shrink-0" />
              <span className="hidden md:inline">{item.label}</span>
              {!item.isActive && (
                <span className="hidden md:inline text-xs bg-orange-100 text-orange-600 px-1.5 py-0.5 rounded ml-auto">
                  Bientôt
                </span>
              )}
            </button>
          )
        })}
      </nav>
    </div>
  )
}