import { createClient } from '@/lib/supabase/server'
import { Member, UserRole, UserStatus } from '@/lib/types/database'

/**
 * Récupère les informations complètes d'un membre
 */
export async function getMemberWithGroups(userId: string): Promise<Member | null> {
  const supabase = await createClient()
  
  const { data: member, error } = await supabase
    .from('members')
    .select(`
      *,
      groups:user_groups(
        group:groups(*)
      )
    `)
    .eq('user_id', userId)
    .single()
  
  if (error || !member) return null
  
  return {
    ...member,
    groups: member.groups?.map((ug: any) => ug.group) || []
  }
}

/**
 * Vérifie si un utilisateur est admin
 */
export async function isAdmin(userId: string): Promise<boolean> {
  const supabase = await createClient()
  
  const { data, error } = await supabase
    .from('members')
    .select('role, status')
    .eq('user_id', userId)
    .eq('role', 'admin')
    .eq('status', 'active')
    .single()
  
  return !error && !!data
}

/**
 * Vérifie si un utilisateur est actif
 */
export async function isActiveUser(userId: string): Promise<boolean> {
  const supabase = await createClient()
  
  const { data, error } = await supabase
    .from('members')
    .select('status')
    .eq('user_id', userId)
    .eq('status', 'active')
    .single()
  
  return !error && !!data
}

/**
 * Vérifie si un utilisateur appartient à un groupe
 */
export async function userInGroup(userId: string, groupName: string): Promise<boolean> {
  const supabase = await createClient()
  
  const { data, error } = await supabase
    .from('user_groups')
    .select(`
      id,
      group:groups!inner(name)
    `)
    .eq('user_id', userId)
    .eq('groups.name', groupName)
    .single()
  
  return !error && !!data
}

/**
 * Récupère tous les groupes d'un utilisateur
 */
export async function getUserGroups(userId: string): Promise<string[]> {
  const supabase = await createClient()
  
  const { data, error } = await supabase
    .from('user_groups')
    .select(`
      group:groups(name)
    `)
    .eq('user_id', userId)
  
  if (error || !data) return []
  
  return data.map((ug: any) => ug.group.name).filter(Boolean)
}

/**
 * Vérifie les permissions d'accès
 */
export async function checkAccess(
  userId: string,
  requiredRole?: UserRole,
  requiredGroup?: string
): Promise<boolean> {
  const member = await getMemberWithGroups(userId)
  
  if (!member || member.status !== 'active') {
    return false
  }
  
  // Vérifier le rôle si requis
  if (requiredRole) {
    if (requiredRole === 'admin' && member.role !== 'admin') {
      return false
    }
  }
  
  // Vérifier le groupe si requis
  if (requiredGroup) {
    const groups = member.groups?.map(g => g.name) || []
    if (!groups.includes(requiredGroup)) {
      return false
    }
  }
  
  return true
}

/**
 * Middleware pour protéger les routes admin
 */
export async function requireAdmin(userId: string): Promise<void> {
  const isUserAdmin = await isAdmin(userId)
  
  if (!isUserAdmin) {
    throw new Error('Accès non autorisé : droits administrateur requis')
  }
}

/**
 * Middleware pour protéger les routes membres
 */
export async function requireActiveMember(userId: string): Promise<void> {
  const isActive = await isActiveUser(userId)
  
  if (!isActive) {
    throw new Error('Accès non autorisé : compte non actif')
  }
}