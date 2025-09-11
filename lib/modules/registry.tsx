import { lazy } from 'react'
import { ModuleRegistry } from '@/lib/types/modules'

// Import dynamique des composants de modules
const DiscussionsModule = lazy(() => import('./discussions/discussions-module'))
const EventsModule = lazy(() => import('./events/events-module'))
const ProgrammeModule = lazy(() => import('./programme/programme-module'))
const VeilleModule = lazy(() => import('./veille/veille-module'))
const CommunicationModule = lazy(() => import('./communication/communication-module'))

// Registry des modules disponibles
export const moduleRegistry: ModuleRegistry = {
  discussions: {
    component: DiscussionsModule,
    path: 'discussions'
  },
  events: {
    component: EventsModule,
    path: 'events'
  },
  programme: {
    component: ProgrammeModule,
    path: 'programme'
  },
  veille: {
    component: VeilleModule,
    path: 'veille'
  },
  communication: {
    component: CommunicationModule,
    path: 'communication'
  }
}

// Fonction pour obtenir un module par nom
export function getModuleComponent(moduleName: string) {
  const module = moduleRegistry[moduleName as keyof ModuleRegistry]
  return module?.component || null
}

// Fonction pour obtenir le path d'un module
export function getModulePath(moduleName: string): string {
  const module = moduleRegistry[moduleName as keyof ModuleRegistry]
  return module?.path || ''
}