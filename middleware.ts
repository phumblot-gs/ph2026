import { type NextRequest, NextResponse } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

// Configuration de l'authentification basique
// Hardcoded pour Edge Runtime (process.env n'est pas disponible)
const BASIC_AUTH_USER = 'paul'
const BASIC_AUTH_PASS = 'pierre'
const BASIC_AUTH_ENABLED = true

function isAuthenticated(request: NextRequest): boolean {
  // Vérifier le cookie d'authentification
  const authCookie = request.cookies.get('basic-auth')
  if (authCookie) {
    try {
      const credentials = atob(authCookie.value)
      const [username, password] = credentials.split(':')
      return username === BASIC_AUTH_USER && password === BASIC_AUTH_PASS
    } catch (error) {
      console.log('[Auth] Error decoding cookie:', error)
    }
  }
  
  // Fallback sur le header Authorization (pour les outils comme curl)
  const authHeader = request.headers.get('authorization')
  if (!authHeader || !authHeader.startsWith('Basic ')) {
    return false
  }
  
  try {
    const base64Credentials = authHeader.split(' ')[1]
    const credentials = atob(base64Credentials)
    const [username, password] = credentials.split(':')
    return username === BASIC_AUTH_USER && password === BASIC_AUTH_PASS
  } catch (error) {
    return false
  }
}

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname
  
  // Exclure certaines routes de l'auth basique
  const isApiRoute = path.startsWith('/api/')
  const isAuthRoute = path.startsWith('/auth')
  const isBasicAuthLogin = path === '/basic-auth-login' || path === '/auth-login'
  
  // Appliquer l'authentification basique si activée
  if (BASIC_AUTH_ENABLED && !isApiRoute && !isAuthRoute && !isBasicAuthLogin) {
    if (!isAuthenticated(request)) {
      // Rediriger vers la page de login au lieu de retourner 401
      const loginUrl = new URL('/auth-login', request.url)
      return NextResponse.redirect(loginUrl)
    }
  }
  
  // Continuer avec la session Supabase
  return await updateSession(request)
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     * - api routes that don't need authentication
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}