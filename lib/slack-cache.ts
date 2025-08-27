import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

interface SlackMessage {
  user: string
  text: string
  timestamp: string
  ts?: string
  channel: string
  member?: {
    slack_user_id: string
    first_name: string
    last_name: string
    avatar_url: string | null
  } | null
  user_profile?: {
    name: string
    real_name: string
    image_48: string
  }
}

interface CachedMessagesResult {
  messages: Record<string, SlackMessage[]>
  cacheInfo: Record<string, { lastUpdated: string; ageInSeconds: number }>
}

/**
 * Get cached messages for groups with cache metadata
 */
export async function getCachedMessagesWithInfo(groupIds: string[]): Promise<CachedMessagesResult> {
  const supabase = await createClient()
  
  const { data: cacheEntries, error } = await supabase
    .from('slack_messages_cache')
    .select('group_id, messages, last_updated')
    .in('group_id', groupIds)
  
  if (error) {
    console.error('Error fetching cached messages:', error)
    return { messages: {}, cacheInfo: {} }
  }
  
  const messagesByGroup: Record<string, SlackMessage[]> = {}
  const cacheInfo: Record<string, { lastUpdated: string; ageInSeconds: number }> = {}
  
  cacheEntries?.forEach(entry => {
    if (entry.group_id) {
      // Parse messages from JSONB
      messagesByGroup[entry.group_id] = entry.messages as SlackMessage[]
      
      // Calculate cache age in seconds
      const now = new Date()
      const updated = new Date(entry.last_updated)
      const ageInSeconds = Math.floor((now.getTime() - updated.getTime()) / 1000)
      
      cacheInfo[entry.group_id] = {
        lastUpdated: entry.last_updated,
        ageInSeconds
      }
    }
  })
  
  return { messages: messagesByGroup, cacheInfo }
}

/**
 * Get cached messages for groups (backward compatibility)
 */
export async function getCachedMessages(groupIds: string[]): Promise<Record<string, SlackMessage[]>> {
  const result = await getCachedMessagesWithInfo(groupIds)
  return result.messages
}

/**
 * Update cache for a specific channel
 */
export async function updateMessageCache(
  channelId: string,
  groupId: string,
  messages: SlackMessage[]
): Promise<void> {
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
  }
}

/**
 * Get cache age in minutes
 */
export function getCacheAge(lastUpdated: string): number {
  const now = new Date()
  const updated = new Date(lastUpdated)
  return Math.floor((now.getTime() - updated.getTime()) / (1000 * 60))
}

/**
 * Check if cache is stale (older than 5 minutes)
 */
export function isCacheStale(lastUpdated: string): boolean {
  return getCacheAge(lastUpdated) > 5
}