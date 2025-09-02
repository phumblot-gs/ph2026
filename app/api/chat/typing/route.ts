import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// POST /api/chat/typing - Signaler qu'on est en train de taper
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // Vérifier l'authentification
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    
    const body = await request.json()
    const { group_id } = body
    
    if (!group_id) {
      return NextResponse.json({ error: 'group_id requis' }, { status: 400 })
    }
    
    // Vérifier l'appartenance au groupe
    const { data: membership } = await supabase
      .from('user_groups')
      .select('group_id')
      .eq('user_id', user.id)
      .eq('group_id', group_id)
      .single()
    
    if (!membership) {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 })
    }
    
    // Insérer ou mettre à jour l'indicateur de frappe
    const { error } = await supabase
      .from('chat_typing')
      .upsert({
        user_id: user.id,
        group_id,
        started_at: new Date().toISOString()
      }, {
        onConflict: 'user_id,group_id'
      })
    
    if (error) {
      console.error('Erreur typing indicator:', error)
      return NextResponse.json({ error: 'Erreur lors de la mise à jour' }, { status: 500 })
    }
    
    return NextResponse.json({ success: true })
    
  } catch (error) {
    console.error('Erreur API typing:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// DELETE /api/chat/typing - Arrêter l'indicateur de frappe
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // Vérifier l'authentification
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    
    const searchParams = request.nextUrl.searchParams
    const groupId = searchParams.get('group_id')
    
    if (!groupId) {
      return NextResponse.json({ error: 'group_id requis' }, { status: 400 })
    }
    
    // Supprimer l'indicateur de frappe
    const { error } = await supabase
      .from('chat_typing')
      .delete()
      .eq('user_id', user.id)
      .eq('group_id', groupId)
    
    if (error) {
      console.error('Erreur suppression typing:', error)
      return NextResponse.json({ error: 'Erreur lors de la suppression' }, { status: 500 })
    }
    
    return NextResponse.json({ success: true })
    
  } catch (error) {
    console.error('Erreur API delete typing:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// GET /api/chat/typing - Obtenir qui est en train de taper
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // Vérifier l'authentification
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    
    const searchParams = request.nextUrl.searchParams
    const groupId = searchParams.get('group_id')
    
    if (!groupId) {
      return NextResponse.json({ error: 'group_id requis' }, { status: 400 })
    }
    
    // Vérifier l'appartenance au groupe
    const { data: membership } = await supabase
      .from('user_groups')
      .select('group_id')
      .eq('user_id', user.id)
      .eq('group_id', groupId)
      .single()
    
    if (!membership) {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 })
    }
    
    // Récupérer les utilisateurs en train de taper (depuis moins de 10 secondes)
    const tenSecondsAgo = new Date(Date.now() - 10000).toISOString()
    
    const { data: typingUsers, error } = await supabase
      .from('chat_typing')
      .select('user_id, started_at')
      .eq('group_id', groupId)
      .gte('started_at', tenSecondsAgo)
      .neq('user_id', user.id) // Ne pas inclure l'utilisateur actuel
    
    if (error) {
      console.error('Erreur récupération typing:', error)
      console.error('Détails de l\'erreur:', {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint
      })
      return NextResponse.json({ 
        error: 'Erreur lors de la récupération',
        details: error.message 
      }, { status: 500 })
    }
    
    // Récupérer les infos des membres si on a des utilisateurs
    let formattedUsers = []
    if (typingUsers && typingUsers.length > 0) {
      const userIds = typingUsers.map(tu => tu.user_id)
      const { data: members } = await supabase
        .from('members')
        .select('user_id, first_name, last_name, photo_url')
        .in('user_id', userIds)
      
      formattedUsers = typingUsers.map(tu => {
        const member = members?.find(m => m.user_id === tu.user_id)
        return {
          user_id: tu.user_id,
          name: member ? `${member.first_name} ${member.last_name}` : 'Utilisateur',
          photo_url: member?.photo_url
        }
      })
    }
    
    return NextResponse.json({ typing_users: formattedUsers || [] })
    
  } catch (error) {
    console.error('Erreur API get typing:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}