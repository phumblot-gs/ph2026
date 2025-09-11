'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { UserModule, ModulePermission } from '@/lib/types/modules'

export function useModules() {
  const [modules, setModules] = useState<UserModule[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadUserModules()
  }, [])

  const loadUserModules = async () => {
    try {
      const supabase = createClient()
      
      // Utiliser la fonction SQL pour récupérer les modules de l'utilisateur
      const { data, error } = await supabase
        .rpc('get_user_modules')
      
      if (error) {
        throw error
      }

      // Transformer les données pour correspondre au type UserModule
      const userModules: UserModule[] = (data || []).map((item: any) => ({
        id: item.module_id,
        name: item.module_name,
        display_name: item.display_name,
        description: item.description,
        icon: item.icon,
        sort_order: item.sort_order,
        is_active: true, // Les modules inactifs ne sont pas retournés par la fonction
        can_read: item.can_read,
        can_write: item.can_write,
        can_admin: item.can_admin,
        created_at: '',
        updated_at: ''
      }))

      setModules(userModules)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors du chargement des modules')
    } finally {
      setLoading(false)
    }
  }

  const canAccessModule = (moduleName: string, permission: ModulePermission = 'read'): boolean => {
    const module = modules.find(m => m.name === moduleName)
    if (!module) return false

    switch (permission) {
      case 'read':
        return module.can_read
      case 'write':
        return module.can_write
      case 'admin':
        return module.can_admin
      default:
        return false
    }
  }

  const getModule = (moduleName: string): UserModule | undefined => {
    return modules.find(m => m.name === moduleName)
  }

  const getAccessibleModules = (permission: ModulePermission = 'read'): UserModule[] => {
    return modules.filter(module => {
      switch (permission) {
        case 'read':
          return module.can_read
        case 'write':
          return module.can_write
        case 'admin':
          return module.can_admin
        default:
          return false
      }
    })
  }

  return {
    modules,
    loading,
    error,
    canAccessModule,
    getModule,
    getAccessibleModules,
    reload: loadUserModules
  }
}