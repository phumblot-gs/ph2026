'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, MessageSquare, ExternalLink, Hash, AlertCircle, RefreshCw } from 'lucide-react';
import Link from 'next/link';

interface SlackMessage {
  user: string;
  text: string;
  timestamp: string;
  ts?: string; // Timestamp Slack original
  channel: string;
  member?: {
    slack_user_id: string;
    first_name: string;
    last_name: string;
    avatar_url: string | null;
  } | null;
  user_profile?: {
    name: string;
    real_name: string;
    image_48: string;
  };
}

interface GroupSlackMessagesProps {
  groups: Array<{
    id: string;
    name: string;
    slack_channel_id: string | null;
  }>;
}

export function GroupSlackMessages({ groups }: GroupSlackMessagesProps) {
  const [messages, setMessages] = useState<Record<string, SlackMessage[]>>({});
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<Record<string, string>>({});

  useEffect(() => {
    // On charge les messages même si l'utilisateur n'est pas connecté à Slack
    // Le bot peut lire les messages pour lui
    groups.forEach(group => {
      if (group.slack_channel_id) {
        loadMessages(group.id, group.slack_channel_id);
      }
    });
  }, [groups]);

  async function loadMessages(groupId: string, channelId: string) {
    setLoading(prev => ({ ...prev, [groupId]: true }));
    setError(prev => ({ ...prev, [groupId]: '' }));

    try {
      const response = await fetch(`/api/slack/messages?channelId=${channelId}&limit=5`);
      
      if (response.ok) {
        const data = await response.json();
        setMessages(prev => ({ ...prev, [groupId]: data.messages || [] }));
      } else {
        const errorData = await response.json();
        setError(prev => ({ ...prev, [groupId]: errorData.error || 'Erreur lors du chargement' }));
      }
    } catch (err) {
      console.error('Error loading messages:', err);
      setError(prev => ({ ...prev, [groupId]: 'Erreur de connexion' }));
    } finally {
      setLoading(prev => ({ ...prev, [groupId]: false }));
    }
  }

  function formatTimestamp(timestamp: string | undefined) {
    if (!timestamp) return '';
    
    // Le timestamp Slack est en format "1234567890.123456"
    const date = new Date(parseFloat(timestamp) * 1000);
    
    // Vérifier si la date est valide
    if (isNaN(date.getTime())) return '';
    
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'À l\'instant';
    if (diffMins < 60) return `Il y a ${diffMins} min`;
    if (diffHours < 24) return `Il y a ${diffHours}h`;
    if (diffDays < 7) return `Il y a ${diffDays}j`;
    
    return date.toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'short'
    });
  }

  function truncateText(text: string, maxLength: number = 100) {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  }

  // On n'exige plus la connexion Slack, le bot peut lire les messages

  if (groups.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Discussions Slack
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-500 text-center py-4">
            Vous n'êtes membre d'aucun groupe
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {groups.map(group => (
        <Card key={group.id}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Hash className="h-4 w-4 text-gray-400" />
                  {group.name}
                </CardTitle>
                {!group.slack_channel_id && (
                  <CardDescription className="mt-1">
                    Pas de canal Slack associé
                  </CardDescription>
                )}
              </div>
              {group.slack_channel_id && (
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => loadMessages(group.id, group.slack_channel_id!)}
                    disabled={loading[group.id]}
                  >
                    {loading[group.id] ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4" />
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    asChild
                  >
                    <a
                      href={`slack://channel?team=${process.env.NEXT_PUBLIC_SLACK_TEAM_ID || ''}&id=${group.slack_channel_id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <ExternalLink className="h-4 w-4 mr-1" />
                      Ouvrir
                    </a>
                  </Button>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {!group.slack_channel_id ? (
              <p className="text-gray-500 text-sm text-center py-4">
                Ce groupe n'a pas encore de canal Slack
              </p>
            ) : loading[group.id] ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
              </div>
            ) : error[group.id] ? (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error[group.id]}</AlertDescription>
              </Alert>
            ) : messages[group.id] && messages[group.id].length > 0 ? (
              <div className="space-y-3">
                {messages[group.id].map((message, index) => {
                  // Utiliser les infos du membre si disponibles, sinon fallback sur user_profile Slack
                  const displayName = message.member 
                    ? `${message.member.first_name} ${message.member.last_name}`
                    : message.user_profile?.real_name || message.user_profile?.name || message.user;
                  
                  const avatarUrl = message.member?.avatar_url || message.user_profile?.image_48;
                  const initials = message.member
                    ? `${message.member.first_name?.[0] || ''}${message.member.last_name?.[0] || ''}`
                    : displayName?.[0] || '?';
                  
                  return (
                    <div key={index} className="flex gap-3 pb-3 border-b last:border-0">
                      <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0 overflow-hidden">
                        {avatarUrl ? (
                          <img src={avatarUrl} alt={displayName} className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-xs font-semibold text-gray-600">
                            {initials.toUpperCase()}
                          </span>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium text-sm">{displayName}</span>
                          <span className="text-xs text-gray-500">
                            {formatTimestamp(message.ts || message.timestamp)}
                          </span>
                        </div>
                        <p className="text-sm text-gray-700 break-words">
                          {truncateText(message.text)}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-gray-500 text-sm text-center py-4">
                Aucun message récent
              </p>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}