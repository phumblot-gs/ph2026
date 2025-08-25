'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { MessageSquare, Loader2, CheckCircle, XCircle, Mail, RefreshCw, Clock } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

interface SlackConnectionProps {
  userId: string;
}

export function SlackConnection({ userId }: SlackConnectionProps) {
  const [loading, setLoading] = useState(true);
  const [disconnecting, setDisconnecting] = useState(false);
  const [requestingInvite, setRequestingInvite] = useState(false);
  const [invitationStatus, setInvitationStatus] = useState<{
    id?: string;
    status?: 'pending' | 'completed' | 'cancelled';
    requested_at?: string;
    completed_at?: string;
  } | null>(null);
  const [slackInfo, setSlackInfo] = useState<{
    connected: boolean;
    userId?: string;
    connectedAt?: string;
    groups?: Array<{
      id: string;
      name: string;
      hasChannel: boolean;
    }>;
  }>({
    connected: false,
    groups: []
  });

  useEffect(() => {
    loadSlackInfo();
    checkInvitationStatus();
  }, [userId]);

  async function loadSlackInfo() {
    const supabase = createClient();
    
    // Récupérer les infos Slack du membre
    const { data: member } = await supabase
      .from('members')
      .select('slack_user_id, slack_connected_at')
      .eq('user_id', userId)
      .single();

    // Récupérer les groupes de l'utilisateur avec leurs canaux
    const { data: userGroups } = await supabase
      .from('user_groups')
      .select(`
        group_id,
        groups (
          id,
          name,
          slack_channel_id
        )
      `)
      .eq('user_id', userId);

    setSlackInfo({
      connected: !!member?.slack_user_id,
      userId: member?.slack_user_id || undefined,
      connectedAt: member?.slack_connected_at || undefined,
      groups: userGroups?.map(ug => {
        // Type assertion car Supabase retourne un type générique pour les relations
        const group = ug.groups as unknown as { id: string; name: string; slack_channel_id: string | null } | null;
        return {
          id: group?.id || '',
          name: group?.name || '',
          hasChannel: !!group?.slack_channel_id
        };
      }) || []
    });
    
    setLoading(false);
  }

  async function checkInvitationStatus() {
    try {
      const response = await fetch('/api/slack/request-invite');
      if (response.ok) {
        const data = await response.json();
        if (data.invitation) {
          setInvitationStatus(data.invitation);
        }
      }
    } catch (error) {
      console.error('Error checking invitation status:', error);
    }
  }

  async function handleRequestInvite() {
    setRequestingInvite(true);
    
    try {
      const response = await fetch('/api/slack/request-invite', {
        method: 'POST',
      });
      
      if (response.ok) {
        await checkInvitationStatus();
      } else {
        const data = await response.json();
        console.error('Error requesting invitation:', data.error);
      }
    } catch (error) {
      console.error('Error requesting invitation:', error);
    }
    
    setRequestingInvite(false);
  }

  async function handleConnect() {
    window.location.href = '/api/slack/auth';
  }

  async function handleDisconnect() {
    if (!confirm('Êtes-vous sûr de vouloir vous déconnecter de Slack ?')) {
      return;
    }

    setDisconnecting(true);
    
    try {
      const response = await fetch('/api/slack/disconnect', {
        method: 'POST',
      });

      if (response.ok) {
        await loadSlackInfo();
      } else {
        alert('Erreur lors de la déconnexion');
      }
    } catch (error) {
      console.error('Error disconnecting from Slack:', error);
      alert('Erreur lors de la déconnexion');
    } finally {
      setDisconnecting(false);
    }
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          <MessageSquare className="h-5 w-5 mr-2" />
          Connexion Slack
        </CardTitle>
        <CardDescription>
          Connectez votre compte Slack pour accéder aux discussions de vos groupes
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {slackInfo.connected ? (
          <>
            {/* Statut de connexion */}
            <div className="flex items-center justify-between p-4 bg-green-50 rounded-lg">
              <div className="flex items-center">
                <CheckCircle className="h-5 w-5 text-green-600 mr-3" />
                <div>
                  <p className="font-medium text-green-900">Connecté à Slack</p>
                  {slackInfo.connectedAt && (
                    <p className="text-sm text-green-700">
                      Depuis le {format(new Date(slackInfo.connectedAt), 'dd MMMM yyyy', { locale: fr })}
                    </p>
                  )}
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleDisconnect}
                disabled={disconnecting}
              >
                {disconnecting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Déconnexion...
                  </>
                ) : (
                  'Se déconnecter'
                )}
              </Button>
            </div>

            {/* Liste des canaux accessibles */}
            {slackInfo.groups && slackInfo.groups.length > 0 && (
              <div>
                <h4 className="font-medium mb-3">Canaux accessibles</h4>
                <div className="space-y-2">
                  {slackInfo.groups.map(group => (
                    <div
                      key={group.id}
                      className="flex items-center justify-between p-3 border rounded-lg"
                    >
                      <div className="flex items-center">
                        <MessageSquare className="h-4 w-4 text-gray-400 mr-2" />
                        <span className="text-sm font-medium">{group.name}</span>
                      </div>
                      {group.hasChannel ? (
                        <Badge variant="outline" className="text-xs">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Canal actif
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-xs text-gray-500">
                          <XCircle className="h-3 w-3 mr-1" />
                          Pas de canal
                        </Badge>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        ) : (
          <>
            {/* Non connecté */}
            <div className="text-center py-6">
              <MessageSquare className="h-12 w-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-600 mb-4">
                Pour rejoindre les discussions de vos groupes sur Slack
              </p>
              
              <div className="space-y-4">
                {/* Étape 1: Demande d'invitation */}
                <div className={`p-4 rounded-lg text-left border ${
                  invitationStatus?.status === 'completed' 
                    ? 'bg-green-50 border-green-200' 
                    : invitationStatus?.status === 'pending'
                    ? 'bg-orange-50 border-orange-200'
                    : 'bg-gray-50 border-gray-200'
                }`}>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <p className="text-sm font-medium mb-2">
                        Étape 1: {invitationStatus?.status === 'completed' 
                          ? '✅ Invitation envoyée' 
                          : invitationStatus?.status === 'pending'
                          ? '🕒 Invitation en attente'
                          : 'Demander une invitation'}
                      </p>
                      
                      {invitationStatus?.status === 'completed' ? (
                        <div className="text-xs text-green-700">
                          <p className="mb-2">L'invitation a été envoyée à votre adresse email.</p>
                          <p className="mb-2">Consultez vos emails et acceptez l'invitation Slack.</p>
                          <p className="text-gray-600">En cas de doute, vérifiez vos spams.</p>
                        </div>
                      ) : invitationStatus?.status === 'pending' ? (
                        <div className="text-xs text-orange-700">
                          <p className="mb-1">Votre demande a été transmise aux administrateurs.</p>
                          <p>Vous recevrez un email dès qu'un admin aura traité votre demande.</p>
                          {invitationStatus.requested_at && (
                            <p className="text-gray-600 mt-2">
                              <Clock className="inline h-3 w-3 mr-1" />
                              Demandé {format(new Date(invitationStatus.requested_at), "'le' dd/MM 'à' HH:mm", { locale: fr })}
                            </p>
                          )}
                        </div>
                      ) : (
                        <p className="text-xs text-gray-600">
                          Cliquez pour demander une invitation au workspace Slack
                        </p>
                      )}
                    </div>
                    
                    <div className="ml-3">
                      {invitationStatus?.status === 'completed' ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={handleRequestInvite}
                          disabled={requestingInvite}
                          title="Redemander une invitation"
                        >
                          {requestingInvite ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <RefreshCw className="h-4 w-4" />
                          )}
                        </Button>
                      ) : invitationStatus?.status === 'pending' ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={checkInvitationStatus}
                          title="Actualiser le statut"
                        >
                          <RefreshCw className="h-4 w-4" />
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          onClick={handleRequestInvite}
                          disabled={requestingInvite}
                        >
                          {requestingInvite ? (
                            <>
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              Envoi...
                            </>
                          ) : (
                            <>
                              <Mail className="h-4 w-4 mr-2" />
                              Demander
                            </>
                          )}
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
                
                {/* Étape 2: Connexion */}
                <div className="p-4 bg-gray-50 rounded-lg text-left border border-gray-200">
                  <p className="text-sm font-medium mb-2">
                    Étape 2: Se connecter
                  </p>
                  <p className="text-xs text-gray-600 mb-3">
                    Une fois l'inscription terminée sur Slack, revenez ici pour connecter votre compte
                  </p>
                  <Button 
                    onClick={handleConnect} 
                    className="w-full"
                    disabled={!invitationStatus || invitationStatus.status === 'pending'}
                  >
                    <MessageSquare className="h-4 w-4 mr-2" />
                    Se connecter à Slack
                  </Button>
                </div>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}