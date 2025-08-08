import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import ModerationList from '@/components/admin/ModerationList'

export default async function ModerationPage() {
  const supabase = await createClient()
  
  // Check auth and admin role
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    redirect('/login')
  }

  // Check if user is super_admin
  const { data: member } = await supabase
    .from('members')
    .select('role')
    .eq('user_id', user.id)
    .single()

  if (!member || member.role !== 'super_admin') {
    redirect('/admin')
  }

  // Get pending members
  const { data: pendingMembers } = await supabase
    .from('members')
    .select('*')
    .eq('role', 'pending')
    .order('created_at', { ascending: false })

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-serif font-light">Modération des inscriptions</h1>
        <p className="text-muted-foreground mt-2">
          Validez ou refusez les demandes d'inscription
        </p>
      </div>

      <ModerationList initialMembers={pendingMembers || []} />
    </div>
  )
}