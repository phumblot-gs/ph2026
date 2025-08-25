'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { MessageSquare, Check, Clock, Mail, Loader2, RefreshCw, Search } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

interface SlackInvitation {
  id: string;
  user_id: string;
  email: string;
  first_name: string;
  last_name: string;
  requested_at: string;
  completed_at: string | null;
  completed_by: string | null;
  status: 'pending' | 'completed' | 'cancelled';
  avatar_url?: string;
}

export function SlackInvitationsTab() {
  const [invitations, setInvitations] = useState<SlackInvitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [hideCompleted, setHideCompleted] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    loadInvitations();
  }, []);

  async function loadInvitations() {
    setLoading(true);
    const supabase = createClient();
    
    // Charger les invitations
    const { data: invitationsData, error } = await supabase
      .from('slack_invitations')
      .select('*')
      .order('requested_at', { ascending: false });

    if (error) {
      console.error('Error loading invitations:', error);
    } else if (invitationsData) {
      // Récupérer les avatars des membres
      const userIds = invitationsData.map(inv => inv.user_id);
      const { data: membersData } = await supabase
        .from('members')
        .select('user_id, avatar_url')
        .in('user_id', userIds);
      
      // Créer un map pour les avatars
      const avatarMap = new Map(membersData?.map(m => [m.user_id, m.avatar_url]) || []);
      
      // Transformer les données pour inclure l'avatar
      const formattedData = invitationsData.map(inv => ({
        ...inv,
        avatar_url: avatarMap.get(inv.user_id)
      }));
      setInvitations(formattedData);
    }
    
    setLoading(false);
  }

  async function markAsCompleted(invitationId: string) {
    setProcessingId(invitationId);
    
    try {
      const response = await fetch('/api/slack/complete-invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invitationId })
      });

      if (response.ok) {
        await loadInvitations();
      } else {
        console.error('Failed to mark invitation as completed');
      }
    } catch (error) {
      console.error('Error marking invitation as completed:', error);
    }
    
    setProcessingId(null);
  }

  const pendingInvitations = invitations.filter(inv => inv.status === 'pending');
  
  // Filtrer les invitations selon la recherche et le masquage
  const filteredInvitations = invitations.filter(inv => {
    // Masquer les complétées si nécessaire
    if (hideCompleted && inv.status === 'completed') return false;
    
    // Filtrer par recherche
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      return (
        inv.first_name?.toLowerCase().includes(search) ||
        inv.last_name?.toLowerCase().includes(search) ||
        inv.email?.toLowerCase().includes(search)
      );
    }
    
    return true;
  });

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center">
                <MessageSquare className="h-5 w-5 mr-2" />
                Invitations Slack
              </CardTitle>
              <CardDescription>
                Gérez les demandes d'invitation au workspace Slack
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={loadInvitations}
              disabled={loading}
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
            </Button>
          </div>
          
          {/* Filtres */}
          <div className="flex flex-col sm:flex-row gap-3 mt-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                type="text"
                placeholder="Rechercher par nom ou email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="hide-completed"
                checked={hideCompleted}
                onCheckedChange={(checked) => setHideCompleted(checked as boolean)}
              />
              <label
                htmlFor="hide-completed"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                Masquer les invitations complétées
              </label>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
            </div>
          ) : (
            <>
              {filteredInvitations.length > 0 ? (
                <>
                  {pendingInvitations.length > 0 && (
                    <div className="mb-4">
                      <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
                        <p className="text-sm text-orange-800">
                          <strong>{pendingInvitations.length} demande{pendingInvitations.length > 1 ? 's' : ''} en attente :</strong> Invitez ces membres via Slack (Settings → Manage Members → Invite People) 
                          puis marquez comme terminé.
                        </p>
                      </div>
                    </div>
                  )}
                  
                  {/* Tableau unifié */}
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Membre</TableHead>
                          <TableHead>Email</TableHead>
                          <TableHead>Date</TableHead>
                          <TableHead>Statut</TableHead>
                          <TableHead className="text-right">Action</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredInvitations.map((invitation) => (
                          <TableRow key={invitation.id}>
                            <TableCell>
                              <div className="flex items-center gap-3">
                                <Avatar className="h-8 w-8">
                                  {invitation.avatar_url ? (
                                    <AvatarImage src={invitation.avatar_url} />
                                  ) : (
                                    <AvatarFallback>
                                      {invitation.first_name?.[0]}{invitation.last_name?.[0]}
                                    </AvatarFallback>
                                  )}
                                </Avatar>
                                <div>
                                  <p className="font-medium text-sm">
                                    {invitation.first_name} {invitation.last_name}
                                  </p>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Mail className="h-4 w-4 text-gray-400" />
                                <span className="text-sm">{invitation.email}</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <span className="text-sm text-gray-600">
                                {invitation.status === 'completed' && invitation.completed_at
                                  ? format(new Date(invitation.completed_at), 'dd MMM yyyy', { locale: fr })
                                  : format(new Date(invitation.requested_at), 'dd MMM yyyy à HH:mm', { locale: fr })}
                              </span>
                            </TableCell>
                            <TableCell>
                              {invitation.status === 'completed' ? (
                                <Badge variant="outline" className="text-green-700 border-green-300">
                                  Invitation envoyée
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="text-orange-700 border-orange-300">
                                  En attente
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              {invitation.status === 'pending' ? (
                                <Button
                                  size="sm"
                                  onClick={() => markAsCompleted(invitation.id)}
                                  disabled={processingId === invitation.id}
                                >
                                  {processingId === invitation.id ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <>
                                      <Check className="h-4 w-4 mr-2" />
                                      Marquer terminé
                                    </>
                                  )}
                                </Button>
                              ) : (
                                <span className="text-sm text-gray-400">-</span>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </>
              ) : (
                <>
                  {invitations.length === 0 ? (
                    <div className="text-center py-12">
                      <MessageSquare className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                      <p className="text-gray-600">Aucune demande d'invitation</p>
                    </div>
                  ) : (
                    <div className="text-center py-12">
                      <p className="text-gray-600">Aucune invitation ne correspond à votre recherche</p>
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}