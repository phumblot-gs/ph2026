import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { username, password } = body

    // Vérifier les credentials
    if (username === 'paul' && password === 'pierre') {
      // Créer la réponse avec cookie d'authentification
      const response = NextResponse.json({ success: true })
      
      // Créer un token simple encodé en base64
      const token = btoa(`${username}:${password}`)
      
      // Définir le cookie avec une expiration de 7 jours
      response.cookies.set('basic-auth', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 7, // 7 jours
        path: '/'
      })
      
      return response
    }
    
    return NextResponse.json(
      { error: 'Invalid credentials' },
      { status: 401 }
    )
  } catch (error) {
    return NextResponse.json(
      { error: 'Invalid request' },
      { status: 400 }
    )
  }
}