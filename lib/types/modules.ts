export interface Module {
  id: string
  name: string
  display_name: string
  description?: string
  icon: string
  sort_order: number
  is_active: boolean
  config?: Record<string, any>
  created_at: string
  updated_at: string
}

export interface UserModule extends Module {
  can_read: boolean
  can_write: boolean
  can_admin: boolean
}

export interface GroupModule {
  id: string
  group_id: string
  module_id: string
  can_read: boolean
  can_write: boolean
  can_admin: boolean
  config?: Record<string, any>
  created_at: string
  updated_at: string
}

export interface ModuleDataPermission {
  id: string
  module_id: string
  source_group_id: string
  target_group_id: string
  permission_type: 'read' | 'write'
  created_at: string
}

export type ModulePermission = 'read' | 'write' | 'admin'

export interface ModuleComponent {
  name: string
  component: React.ComponentType<any>
  path: string
  icon: string
}

// Types pour les modules spécifiques
export interface ModuleRegistry {
  discussions: {
    component: React.ComponentType<{ groups: any[], currentUserId: string }>
    path: string
  }
  events: {
    component: React.ComponentType<{ groups: any[], currentUserId: string }>
    path: string
  }
  programme: {
    component: React.ComponentType<{ groups: any[], currentUserId: string }>
    path: string
  }
  veille: {
    component: React.ComponentType<{ groups: any[], currentUserId: string }>
    path: string
  }
  communication: {
    component: React.ComponentType<{ groups: any[], currentUserId: string }>
    path: string
  }
}

export type ModuleName = keyof ModuleRegistry