import { type NextRequest, NextResponse } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

// Configuration de l'authentification basique
// Hardcoded pour Edge Runtime (process.env n'est pas disponible)
const BASIC_AUTH_USER = 'paul'
const BASIC_AUTH_PASS = 'pierre'
const BASIC_AUTH_ENABLED = true

function isAuthenticated(request: NextRequest): boolean {
  const authHeader = request.headers.get('authorization')
  
  if (!authHeader || !authHeader.startsWith('Basic ')) {
    return false
  }
  
  try {
    const base64Credentials = authHeader.split(' ')[1]
    // Utiliser atob() au lieu de Buffer pour Edge Runtime
    const credentials = atob(base64Credentials)
    const [username, password] = credentials.split(':')
    
    return username === BASIC_AUTH_USER && password === BASIC_AUTH_PASS
  } catch (error) {
    return false
  }
}

export async function middleware(request: NextRequest) {
  // Debug logs
  console.log('[Middleware] Path:', request.nextUrl.pathname)
  console.log('[Middleware] BASIC_AUTH_ENABLED:', BASIC_AUTH_ENABLED)
  
  // Exclure les routes API et les assets statiques de l'auth basique
  const isApiRoute = request.nextUrl.pathname.startsWith('/api/')
  const isAuthRoute = request.nextUrl.pathname.startsWith('/auth/')
  
  console.log('[Middleware] isApiRoute:', isApiRoute, 'isAuthRoute:', isAuthRoute)
  
  // Appliquer l'authentification basique si activée
  if (BASIC_AUTH_ENABLED && !isApiRoute && !isAuthRoute) {
    console.log('[Middleware] Basic auth check required')
    if (!isAuthenticated(request)) {
      console.log('[Middleware] Basic auth failed - returning 401')
      return new NextResponse('Authentication required', {
        status: 401,
        headers: {
          'WWW-Authenticate': 'Basic realm="Site prive - Acces restreint"',
        },
      })
    }
    console.log('[Middleware] Basic auth passed')
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