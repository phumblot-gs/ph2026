'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Member } from '@/lib/types/database'
import { CheckCircle, XCircle, User, Mail, Phone, Calendar, AlertCircle } from 'lucide-react'

interface ModerationListProps {
  initialMembers: Member[]
}

export default function ModerationList({ initialMembers }: ModerationListProps) {
  const [members, setMembers] = useState(initialMembers)
  const [processingId, setProcessingId] = useState<string | null>(null)
  const supabase = createClient()

  const handleApprove = async (memberId: string) => {
    setProcessingId(memberId)
    
    try {
      const { error } = await supabase
        .from('members')
        .update({ role: 'member' })
        .eq('id', memberId)

      if (error) throw error

      // Remove from list
      setMembers(members.filter(m => m.id !== memberId))
      
      // TODO: Send approval email to user
    } catch (error) {
      console.error('Error approving member:', error)
      alert('Erreur lors de l\'approbation')
    } finally {
      setProcessingId(null)
    }
  }

  const handleReject = async (memberId: string, userId?: string) => {
    if (!confirm('Êtes-vous sûr de vouloir refuser cette inscription ? Le compte sera supprimé.')) {
      return
    }

    setProcessingId(memberId)
    
    try {
      // Delete member record
      const { error: memberError } = await supabase
        .from('members')
        .delete()
        .eq('id', memberId)

      if (memberError) throw memberError

      // Delete auth user if exists
      if (userId) {
        // This needs to be done via an Edge Function with service role
        // For now, just remove from list
      }

      // Remove from list
      setMembers(members.filter(m => m.id !== memberId))
      
      // TODO: Send rejection email to user (optional)
    } catch (error) {
      console.error('Error rejecting member:', error)
      alert('Erreur lors du refus')
    } finally {
      setProcessingId(null)
    }
  }

  if (members.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <div className="flex justify-center mb-4">
            <div className="p-3 rounded-full bg-stone-100">
              <CheckCircle className="h-6 w-6 text-stone-600" />
            </div>
          </div>
          <p className="text-muted-foreground">
            Aucune demande d'inscription en attente
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 p-4 bg-amber-50 border border-amber-200 rounded-lg">
        <AlertCircle className="h-5 w-5 text-amber-600" />
        <p className="text-sm text-amber-800">
          {members.length} demande{members.length > 1 ? 's' : ''} d'inscription en attente de validation
        </p>
      </div>

      {members.map((member) => (
        <Card key={member.id}>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-full bg-stone-100">
                  <User className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-lg font-semibold">
                    {member.first_name} {member.last_name}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Inscription le {new Date(member.created_at).toLocaleDateString('fr-FR')}
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={() => handleApprove(member.id)}
                  disabled={processingId === member.id}
                  className="bg-green-600 hover:bg-green-700"
                >
                  <CheckCircle className="h-4 w-4 mr-1" />
                  Approuver
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => handleReject(member.id, member.user_id)}
                  disabled={processingId === member.id}
                >
                  <XCircle className="h-4 w-4 mr-1" />
                  Refuser
                </Button>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-3 gap-4 text-sm">
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <span>{member.email}</span>
              </div>
              {member.phone && (
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <span>{member.phone}</span>
                </div>
              )}
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span>{new Date(member.created_at).toLocaleString('fr-FR')}</span>
              </div>
            </div>
            {member.expertise && (
              <div className="mt-3 p-3 bg-stone-50 rounded-md">
                <p className="text-sm font-medium mb-1">Expertise :</p>
                <p className="text-sm text-muted-foreground">{member.expertise}</p>
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  )
}