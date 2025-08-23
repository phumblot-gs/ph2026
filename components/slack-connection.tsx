'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { MessageSquare, Loader2, CheckCircle, XCircle } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

interface SlackConnectionProps {
  userId: string;
}

export function SlackConnection({ userId }: SlackConnectionProps) {
  const [loading, setLoading] = useState(true);
  const [disconnecting, setDisconnecting] = useState(false);
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
              <p className="text-gray-600 mb-6">
                Connectez-vous à Slack pour rejoindre les discussions de vos groupes
              </p>
              <Button onClick={handleConnect}>
                <MessageSquare className="h-4 w-4 mr-2" />
                Se connecter à Slack
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}