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
        // Vérifier si l'utilisateur existe dans la table members
        const { data: existingMember } = await supabase
          .from('members')
          .select('role, status')
          .eq('user_id', user.id)
          .single()
        
        if (!existingMember) {
          // C'est une première connexion OAuth, créer l'entrée members
          console.log('Creating member entry for OAuth user:', user.id)
          
          // Extraire les informations du profil OAuth
          const userMetadata = user.user_metadata || {}
          const email = user.email || ''
          const fullName = userMetadata.full_name || userMetadata.name || ''
          const [firstName, ...lastNameParts] = fullName.split(' ')
          const lastName = lastNameParts.join(' ')
          
          // Créer l'entrée dans members
          const { error: memberError } = await supabase
            .from('members')
            .insert({
              user_id: user.id,
              email: email,
              first_name: userMetadata.given_name || userMetadata.first_name || firstName || '',
              last_name: userMetadata.family_name || userMetadata.last_name || lastName || '',
              phone: userMetadata.phone || '',
              role: 'member',
              status: 'active'
            })
          
          if (memberError) {
            console.error('Error creating member:', memberError)
          } else {
            console.log('Member created successfully')
            
            // Ajouter au groupe public
            const { data: publicGroup } = await supabase
              .from('groups')
              .select('id')
              .eq('name', 'public')
              .single()
            
            if (publicGroup) {
              const { error: groupError } = await supabase
                .from('user_groups')
                .insert({
                  user_id: user.id,
                  group_id: publicGroup.id
                })
              
              if (groupError) {
                console.error('Error adding to public group:', groupError)
              } else {
                console.log('User added to public group')
              }
            }
          }
          
          // Rediriger vers la page d'accueil ou tableau de bord
          next = '/dashboard'
        } else {
          // L'utilisateur existe déjà, vérifier son statut
          if (existingMember.status === 'suspended') {
            next = '/suspended'
          } else if (existingMember.role === 'admin') {
            next = '/admin'
          } else {
            next = '/dashboard'
          }
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