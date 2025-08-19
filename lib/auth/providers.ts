import { createClient } from '@/lib/supabase/client'

/**
 * Configuration des providers d'authentification
 */
export const AuthProviders = {
  GOOGLE: 'google',
  TWITTER: 'twitter', // Twitter/X
  EMAIL: 'email'
} as const

export type AuthProvider = typeof AuthProviders[keyof typeof AuthProviders]

/**
 * Effectue la connexion avec Google
 */
export async function signInWithGoogle() {
  const supabase = createClient()
  
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${window.location.origin}/auth/callback`,
      queryParams: {
        access_type: 'offline',
        prompt: 'consent',
      },
      scopes: 'email profile'
    }
  })
  
  if (error) throw error
  return data
}

/**
 * Effectue la connexion avec Twitter/X
 */
export async function signInWithTwitter() {
  const supabase = createClient()
  
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'twitter',
    options: {
      redirectTo: `${window.location.origin}/auth/callback`,
      scopes: 'tweet.read users.read'
    }
  })
  
  if (error) throw error
  return data
}

/**
 * Effectue la connexion avec email/password
 */
export async function signInWithEmail(email: string, password: string) {
  const supabase = createClient()
  
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password
  })
  
  if (error) throw error
  return data
}

/**
 * Effectue l'inscription avec email/password
 */
export async function signUpWithEmail(email: string, password: string, metadata?: {
  first_name?: string
  last_name?: string
  phone?: string
}) {
  const supabase = createClient()
  
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: metadata,
      emailRedirectTo: `${window.location.origin}/auth/callback`
    }
  })
  
  if (error) throw error
  return data
}

/**
 * Déconnexion
 */
export async function signOut() {
  const supabase = createClient()
  
  const { error } = await supabase.auth.signOut()
  
  if (error) throw error
}