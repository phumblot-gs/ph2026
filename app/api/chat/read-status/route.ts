import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET /api/chat/read-status - Obtenir le statut de lecture pour tous les groupes
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // Vérifier l'authentification
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    
    // Récupérer les groupes de l'utilisateur avec le statut de lecture
    const { data: groups, error } = await supabase
      .from('user_groups')
      .select(`
        group_id,
        group:groups (
          id,
          name,
          slack_channel_id
        )
      `)
      .eq('user_id', user.id)
    
    if (error) {
      console.error('Erreur récupération groupes:', error)
      return NextResponse.json({ error: 'Erreur lors de la récupération' }, { status: 500 })
    }
    
    // Pour chaque groupe, calculer le nombre de messages non lus
    const readStatuses = await Promise.all(
      (groups || []).map(async (ug) => {
        // Récupérer le statut de lecture
        const { data: readStatus } = await supabase
          .from('chat_read_status')
          .select('last_read_at, last_read_message_id')
          .eq('user_id', user.id)
          .eq('group_id', ug.group_id)
          .single()
        
        // Compter les messages non lus
        let unreadCount = 0
        if (readStatus?.last_read_at) {
          const { count } = await supabase
            .from('chat_messages')
            .select('*', { count: 'exact', head: true })
            .eq('group_id', ug.group_id)
            .gt('created_at', readStatus.last_read_at)
            .is('deleted_at', null)
            .is('thread_ts', null) // Ne compter que les messages principaux
            .neq('user_id', user.id) // Ne pas compter ses propres messages
          
          unreadCount = count || 0
        } else {
          // Si jamais lu, compter tous les messages
          const { count } = await supabase
            .from('chat_messages')
            .select('*', { count: 'exact', head: true })
            .eq('group_id', ug.group_id)
            .is('deleted_at', null)
            .is('thread_ts', null)
            .neq('user_id', user.id)
          
          unreadCount = count || 0
        }
        
        return {
          group_id: ug.group_id,
          group_name: ug.group?.name,
          unread_count: unreadCount,
          last_read_at: readStatus?.last_read_at || null
        }
      })
    )
    
    return NextResponse.json({ read_statuses: readStatuses })
    
  } catch (error) {
    console.error('Erreur API read status:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// POST /api/chat/read-status - Marquer des messages comme lus
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // Vérifier l'authentification
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    
    const body = await request.json()
    const { group_id, last_read_message_id } = body
    
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
    
    // Si un message spécifique est fourni, récupérer sa date
    let lastReadAt = new Date().toISOString()
    if (last_read_message_id) {
      const { data: message } = await supabase
        .from('chat_messages')
        .select('created_at')
        .eq('id', last_read_message_id)
        .single()
      
      if (message) {
        lastReadAt = message.created_at
      }
    }
    
    // Mettre à jour ou créer le statut de lecture
    const { error } = await supabase
      .from('chat_read_status')
      .upsert({
        user_id: user.id,
        group_id,
        last_read_at: lastReadAt,
        last_read_message_id,
        unread_count: 0
      }, {
        onConflict: 'user_id,group_id'
      })
    
    if (error) {
      console.error('Erreur mise à jour read status:', error)
      return NextResponse.json({ error: 'Erreur lors de la mise à jour' }, { status: 500 })
    }
    
    return NextResponse.json({ success: true })
    
  } catch (error) {
    console.error('Erreur API update read status:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// DELETE /api/chat/read-status - Réinitialiser le statut de lecture d'un groupe
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
    
    // Supprimer le statut de lecture
    const { error } = await supabase
      .from('chat_read_status')
      .delete()
      .eq('user_id', user.id)
      .eq('group_id', groupId)
    
    if (error) {
      console.error('Erreur suppression read status:', error)
      return NextResponse.json({ error: 'Erreur lors de la suppression' }, { status: 500 })
    }
    
    return NextResponse.json({ success: true })
    
  } catch (error) {
    console.error('Erreur API delete read status:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}