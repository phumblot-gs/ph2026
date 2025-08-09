import { type NextRequest, NextResponse } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

// Configuration de l'authentification basique
const BASIC_AUTH_USER = 'paul'
const BASIC_AUTH_PASS = 'pierre'

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
  // Ne pas appliquer l'auth basique en production
  const isProduction = process.env.NEXT_PUBLIC_ENV === 'production' || 
                      process.env.NODE_ENV === 'production' && !process.env.NEXT_PUBLIC_ENV
  
  // Exclure les routes API et les assets statiques de l'auth basique
  const isApiRoute = request.nextUrl.pathname.startsWith('/api/')
  const isAuthRoute = request.nextUrl.pathname.startsWith('/auth/')
  
  // Appliquer l'authentification basique sauf en production et pour certaines routes
  if (!isProduction && !isApiRoute && !isAuthRoute) {
    if (!isAuthenticated(request)) {
      return new NextResponse('Authentication required', {
        status: 401,
        headers: {
          'WWW-Authenticate': 'Basic realm="Site en développement"',
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