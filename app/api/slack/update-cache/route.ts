import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    
    const { channelId, groupId, messages } = await request.json()
    
    if (!channelId || !groupId || !messages) {
      return NextResponse.json({ error: 'Paramètres manquants' }, { status: 400 })
    }
    
    // Verify user has access to this group
    const { data: userGroup } = await supabase
      .from('user_groups')
      .select('id')
      .eq('user_id', user.id)
      .eq('group_id', groupId)
      .single()
    
    if (!userGroup) {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 })
    }
    
    // Use admin client to bypass RLS for cache updates
    const supabaseAdmin = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          persistSession: false
        }
      }
    )
    
    // Limit to last 5 messages for cache
    const messagesToCache = messages.slice(0, 5)
    
    const { error } = await supabaseAdmin
      .from('slack_messages_cache')
      .upsert({
        channel_id: channelId,
        group_id: groupId,
        messages: messagesToCache,
        last_updated: new Date().toISOString()
      }, {
        onConflict: 'channel_id'
      })
    
    if (error) {
      console.error('Error updating message cache:', error)
      return NextResponse.json({ 
        error: 'Erreur lors de la mise à jour du cache' 
      }, { status: 500 })
    }
    
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error updating cache:', error)
    return NextResponse.json({ 
      error: 'Erreur lors de la mise à jour du cache' 
    }, { status: 500 })
  }
}