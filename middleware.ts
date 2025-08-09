import { type NextRequest, NextResponse } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

// Configuration de l'authentification basique
// Peut être surchargée par les variables d'environnement
const BASIC_AUTH_USER = process.env.BASIC_AUTH_USER || 'paul'
const BASIC_AUTH_PASS = process.env.BASIC_AUTH_PASSWORD || 'pierre'
const BASIC_AUTH_ENABLED = process.env.BASIC_AUTH_ENABLED === 'true'

function isAuthenticated(request: NextRequest): boolean {
  const authHeader = request.headers.get('authorization')
  
  if (!authHeader || !authHeader.startsWith('Basic ')) {
    return false
  }
  
  const base64Credentials = authHeader.split(' ')[1]
  const credentials = Buffer.from(base64Credentials, 'base64').toString('ascii')
  const [username, password] = credentials.split(':')
  
  return username === BASIC_AUTH_USER && password === BASIC_AUTH_PASS
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
          'WWW-Authenticate': 'Basic realm="Site privé - Accès restreint"',
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