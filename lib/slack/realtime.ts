import { createClient } from '@/lib/supabase/client'
import type { RealtimeChannel } from '@supabase/supabase-js'

export interface SlackMessageNotification {
  channel_id: string
  group_id: string
  user_id: string
  timestamp: string
}

class SlackRealtimeManager {
  private supabase = createClient()
  private channels: Map<string, RealtimeChannel> = new Map()
  private listeners: Map<string, Set<(payload: SlackMessageNotification) => void>> = new Map()

  /**
   * S'abonner aux notifications d'un groupe
   */
  subscribe(groupId: string, callback: (payload: SlackMessageNotification) => void) {
    // Ajouter le callback aux listeners
    if (!this.listeners.has(groupId)) {
      this.listeners.set(groupId, new Set())
    }
    this.listeners.get(groupId)!.add(callback)

    // Si le canal n'existe pas déjà, le créer
    if (!this.channels.has(groupId)) {
      const channel = this.supabase
        .channel(`slack-messages:${groupId}`)
        .on('broadcast', { event: 'new_message' }, (payload) => {
          // Notifier tous les listeners de ce groupe
          const callbacks = this.listeners.get(groupId)
          if (callbacks) {
            callbacks.forEach(cb => cb(payload.payload as SlackMessageNotification))
          }
        })
        .subscribe()

      this.channels.set(groupId, channel)
    }

    // Retourner une fonction de cleanup
    return () => {
      const callbacks = this.listeners.get(groupId)
      if (callbacks) {
        callbacks.delete(callback)
        // Si plus aucun listener, se désabonner du canal
        if (callbacks.size === 0) {
          this.unsubscribe(groupId)
        }
      }
    }
  }

  /**
   * Se désabonner d'un groupe
   */
  unsubscribe(groupId: string) {
    const channel = this.channels.get(groupId)
    if (channel) {
      this.supabase.removeChannel(channel)
      this.channels.delete(groupId)
    }
    this.listeners.delete(groupId)
  }

  /**
   * Envoyer une notification de nouveau message
   */
  async notifyNewMessage(groupId: string, channelId: string, userId: string) {
    const channel = this.channels.get(groupId)
    if (channel) {
      await channel.send({
        type: 'broadcast',
        event: 'new_message',
        payload: {
          channel_id: channelId,
          group_id: groupId,
          user_id: userId,
          timestamp: new Date().toISOString()
        } as SlackMessageNotification
      })
    }
  }

  /**
   * Nettoyer toutes les souscriptions
   */
  cleanup() {
    this.channels.forEach((channel) => {
      this.supabase.removeChannel(channel)
    })
    this.channels.clear()
    this.listeners.clear()
  }
}

// Instance singleton
export const slackRealtime = new SlackRealtimeManager()