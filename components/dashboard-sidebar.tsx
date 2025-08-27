'use client'

import { useState } from 'react'
import { MessageSquare, Calendar } from 'lucide-react'
import { cn } from '@/lib/utils'

export type DashboardView = 'slack' | 'events'

interface DashboardSidebarProps {
  currentView: DashboardView
  onViewChange: (view: DashboardView) => void
}

export function DashboardSidebar({ currentView, onViewChange }: DashboardSidebarProps) {
  const menuItems = [
    {
      id: 'slack' as DashboardView,
      label: 'Slack',
      icon: MessageSquare
    },
    {
      id: 'events' as DashboardView,
      label: 'Événements',
      icon: Calendar
    }
  ]

  return (
    <div className="w-16 md:w-56 bg-white border-r border-gray-200 h-full flex flex-col flex-shrink-0">
      <div className="p-4">
        <h2 className="text-lg font-semibold text-gray-900 hidden md:block">Navigation</h2>
      </div>
      <nav className="flex-1 p-2 space-y-1 overflow-y-auto">
        {menuItems.map((item) => {
          const Icon = item.icon
          return (
            <button
              key={item.id}
              onClick={() => onViewChange(item.id)}
              className={cn(
                "w-full flex items-center justify-center md:justify-start gap-3 px-3 py-2.5 rounded-lg transition-colors",
                "hover:bg-gray-100",
                currentView === item.id ? "bg-blue-50 text-blue-600" : "text-gray-700"
              )}
            >
              <Icon className="h-5 w-5 flex-shrink-0" />
              <span className="hidden md:inline">{item.label}</span>
            </button>
          )
        })}
      </nav>
    </div>
  )
}