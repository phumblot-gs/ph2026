import { type NextRequest, NextResponse } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

// Configuration de l'authentification basique
// Dans Edge Runtime, on doit hardcoder ou utiliser une méthode différente
const BASIC_AUTH_USER = 'paul'
const BASIC_AUTH_PASS = 'pierre'
// Activer l'auth basique (à changer manuellement pour désactiver)
const BASIC_AUTH_ENABLED = true

function isAuthenticated(request: NextRequest): boolean {
  const authHeader = request.headers.get('authorization')
  
  if (!authHeader || !authHeader.startsWith('Basic ')) {
    return false
  }
  
  try {
    const base64Credentials = authHeader.split(' ')[1]
    // Décoder base64 de manière compatible avec Edge Runtime
    const credentials = atob(base64Credentials)
    const [username, password] = credentials.split(':')
    
    return username === BASIC_AUTH_USER && password === BASIC_AUTH_PASS
  } catch (error) {
    return false
  }
}

export async function middleware(request: NextRequest) {
  // Exclure les routes API et les assets statiques de l'auth basique
  const isApiRoute = request.nextUrl.pathname.startsWith('/api/')
  const isAuthRoute = request.nextUrl.pathname.startsWith('/auth/')
  
  // Appliquer l'authentification basique si activée
  if (BASIC_AUTH_ENABLED && !isApiRoute && !isAuthRoute) {
    if (!isAuthenticated(request)) {
      return new NextResponse('Authentication required', {
        status: 401,
        headers: {
          'WWW-Authenticate': 'Basic realm="Protected Site"',
        },
      })
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