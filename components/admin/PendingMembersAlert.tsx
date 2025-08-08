'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { AlertCircle, ArrowRight } from 'lucide-react'
import { useRouter } from 'next/navigation'

export default function PendingMembersAlert() {
  const [pendingCount, setPendingCount] = useState(0)
  const [isAdmin, setIsAdmin] = useState(false)
  const supabase = createClient()
  const router = useRouter()

  useEffect(() => {
    checkPendingMembers()
  }, [])

  const checkPendingMembers = async () => {
    try {
      // Check if current user is admin
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: member } = await supabase
        .from('members')
        .select('role')
        .eq('user_id', user.id)
        .single()

      if (member?.role === 'super_admin') {
        setIsAdmin(true)

        // Count pending members
        const { count } = await supabase
          .from('members')
          .select('*', { count: 'exact', head: true })
          .eq('role', 'pending')

        setPendingCount(count || 0)
      }
    } catch (error) {
      console.error('Error checking pending members:', error)
    }
  }

  if (!isAdmin || pendingCount === 0) return null

  return (
    <Card className="border-amber-200 bg-amber-50">
      <CardContent className="py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-amber-100">
              <AlertCircle className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <p className="font-medium text-amber-900">
                {pendingCount} inscription{pendingCount > 1 ? 's' : ''} en attente
              </p>
              <p className="text-sm text-amber-700">
                De nouvelles personnes souhaitent rejoindre le mouvement
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push('/admin/moderation')}
            className="border-amber-300 hover:bg-amber-100"
          >
            Modérer
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}