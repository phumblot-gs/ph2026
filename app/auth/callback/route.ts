import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  let next = searchParams.get('next') ?? '/admin'

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    
    if (!error) {
      // Vérifier le rôle de l'utilisateur
      const { data: { user } } = await supabase.auth.getUser()
      
      if (user) {
        // Attendre un peu pour que le trigger handle_new_user se termine
        // Nécessaire pour les premières connexions Google OAuth
        let member = null
        let attempts = 0
        const maxAttempts = 5
        
        while (!member && attempts < maxAttempts) {
          const { data } = await supabase
            .from('members')
            .select('role')
            .eq('user_id', user.id)
            .single()
          
          member = data
          
          if (!member && attempts < maxAttempts - 1) {
            // Attendre 200ms avant de réessayer
            await new Promise(resolve => setTimeout(resolve, 200))
          }
          attempts++
        }
        
        // Si l'utilisateur est pending ou n'existe pas encore (sera créé comme pending)
        if (!member || member.role === 'pending') {
          // Si c'est un nouveau membre (pas encore dans la table), notifier les admins
          if (!member && attempts > 0) {
            try {
              // Appeler l'API interne pour notifier les admins
              const notifyUrl = `${origin}/api/notify-admin`
              await fetch(notifyUrl, {
                method: 'POST',
                headers: { 
                  'Content-Type': 'application/json',
                  'Cookie': request.headers.get('cookie') || ''
                }
              })
            } catch (error) {
              console.log('Erreur notification admin:', error)
              // On continue même si la notification échoue
            }
          }
          next = '/pending'
        }
      }
      
      const forwardedHost = request.headers.get('x-forwarded-host')
      const isLocalEnv = process.env.NODE_ENV === 'development'
      if (isLocalEnv) {
        return NextResponse.redirect(`${origin}${next}`)
      } else if (forwardedHost) {
        return NextResponse.redirect(`https://${forwardedHost}${next}`)
      } else {
        return NextResponse.redirect(`${origin}${next}`)
      }
    }
  }

  return NextResponse.redirect(`${origin}/login`)
}