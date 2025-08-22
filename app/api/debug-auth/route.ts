import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  
  try {
    // 1. Récupérer l'utilisateur actuel
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    
    if (userError || !user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    
    // 2. Vérifier si l'utilisateur existe dans members
    const { data: member, error: memberError } = await supabase
      .from('members')
      .select('*')
      .eq('user_id', user.id)
      .single()
    
    // 3. Vérifier les groupes de l'utilisateur
    const { data: userGroups, error: groupsError } = await supabase
      .from('user_groups')
      .select(`
        *,
        groups (*)
      `)
      .eq('user_id', user.id)
    
    // 4. Vérifier si le groupe public existe
    const { data: publicGroup, error: publicGroupError } = await supabase
      .from('groups')
      .select('*')
      .eq('name', 'public')
      .single()
    
    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        metadata: user.user_metadata,
        created_at: user.created_at
      },
      member: member || null,
      memberError: memberError?.message || null,
      userGroups: userGroups || [],
      groupsError: groupsError?.message || null,
      publicGroup: publicGroup || null,
      publicGroupError: publicGroupError?.message || null,
      debug: {
        hasUser: !!user,
        hasMember: !!member,
        hasGroups: userGroups && userGroups.length > 0,
        hasPublicGroup: !!publicGroup
      }
    })
    
  } catch (error: any) {
    return NextResponse.json({ 
      error: 'Erreur serveur',
      details: error.message 
    }, { status: 500 })
  }
}