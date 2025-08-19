import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const { email, password, firstName, lastName, phone } = await request.json()
    
    const supabase = await createClient()
    
    // 1. Créer l'utilisateur dans Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          first_name: firstName,
          last_name: lastName,
          phone: phone || '',
        },
        emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback`,
      },
    })
    
    if (authError) {
      console.error('Auth error:', authError)
      return NextResponse.json(
        { error: authError.message },
        { status: 400 }
      )
    }
    
    if (!authData.user) {
      return NextResponse.json(
        { error: 'Erreur lors de la création de l\'utilisateur' },
        { status: 400 }
      )
    }
    
    console.log('User created in auth:', authData.user.id)
    
    // 2. Créer l'entrée dans members (on le fait manuellement car le trigger ne marche pas)
    const { error: memberError } = await supabase
      .from('members')
      .insert({
        user_id: authData.user.id,
        email: email,
        first_name: firstName || '',
        last_name: lastName || '',
        phone: phone || '',
        role: 'member',
        status: 'active'
      })
    
    if (memberError) {
      console.error('Member creation error:', memberError)
      // On continue même si ça échoue, l'utilisateur est créé
    } else {
      console.log('Member created successfully')
    }
    
    // 3. Ajouter l'utilisateur au groupe public
    // Utiliser l'ID connu du groupe public directement pour éviter les problèmes RLS
    const PUBLIC_GROUP_ID = 'dc2ca80a-48b7-492a-aa32-67b9322c951b'
    
    try {
      const { error: groupError } = await supabase
        .from('user_groups')
        .insert({
          user_id: authData.user.id,
          group_id: PUBLIC_GROUP_ID
        })
      
      if (groupError) {
        console.error('Group assignment error:', groupError)
        console.error('Details:', { user_id: authData.user.id, group_id: PUBLIC_GROUP_ID })
        
        // En cas d'erreur, essayer de récupérer le groupe dynamiquement
        const { data: publicGroup } = await supabase
          .from('groups')
          .select('id')
          .eq('name', 'public')
          .maybeSingle()
        
        if (publicGroup) {
          const { error: retryError } = await supabase
            .from('user_groups')
            .insert({
              user_id: authData.user.id,
              group_id: publicGroup.id
            })
          
          if (!retryError) {
            console.log('User added to public group on retry')
          }
        }
      } else {
        console.log('User added to public group successfully')
      }
    } catch (error) {
      console.error('Unexpected error adding user to group:', error)
    }
    
    // 5. Notifier les admins (optionnel)
    try {
      await fetch(`${process.env.NEXT_PUBLIC_SITE_URL}/api/notify-admin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      })
    } catch (notifyError) {
      console.log('Admin notification error:', notifyError)
    }
    
    return NextResponse.json({
      success: true,
      user: authData.user,
      message: 'Inscription réussie'
    })
    
  } catch (error: any) {
    console.error('Signup error:', error)
    return NextResponse.json(
      { error: 'Erreur serveur' },
      { status: 500 }
    )
  }
}