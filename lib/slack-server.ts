import { WebClient } from '@slack/web-api'
import { createClient } from '@/lib/supabase/server'

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

export async function getSlackMessagesForChannels(channelIds: string[]): Promise<Record<string, SlackMessage[]>> {
  const supabase = await createClient()
  
  // Get bot settings
  const { data: settings } = await supabase
    .from('app_settings')
    .select('setting_key, setting_value')
    .eq('setting_key', 'slack_bot_token')
    .single()
  
  const botToken = settings?.setting_value
  if (!botToken) {
    console.error('No Slack bot token configured')
    return {}
  }
  
  const slack = new WebClient(botToken)
  const messagesMap: Record<string, SlackMessage[]> = {}
  
  // Get all members with Slack IDs for mapping
  const { data: members } = await supabase
    .from('members')
    .select('slack_user_id, first_name, last_name, photo_url')
    .not('slack_user_id', 'is', null)
  
  const membersBySlackId = members?.reduce((acc, member) => {
    if (member.slack_user_id) {
      acc[member.slack_user_id] = {
        slack_user_id: member.slack_user_id,
        first_name: member.first_name,
        last_name: member.last_name,
        avatar_url: member.photo_url
      }
    }
    return acc
  }, {} as Record<string, any>) || {}
  
  // Fetch messages for each channel
  await Promise.all(
    channelIds.map(async (channelId) => {
      if (!channelId) return
      
      try {
        const result = await slack.conversations.history({
          channel: channelId,
          limit: 5, // Only get last 5 messages for preview
          include_all_metadata: true
        })
        
        if (result.ok && result.messages) {
          const messages = await Promise.all(
            result.messages.map(async (msg: any) => {
              let userProfile = null
              
              // Try to get user profile if not a bot
              if (msg.user && !msg.bot_id) {
                try {
                  const userInfo = await slack.users.info({ user: msg.user })
                  if (userInfo.ok && userInfo.user) {
                    userProfile = {
                      name: userInfo.user.name || '',
                      real_name: userInfo.user.real_name || userInfo.user.name || '',
                      image_48: userInfo.user.profile?.image_48 || ''
                    }
                  }
                } catch (error) {
                  console.error('Error fetching user info:', error)
                }
              }
              
              return {
                user: msg.user || 'unknown',
                text: msg.text || '',
                timestamp: msg.ts,
                ts: msg.ts,
                channel: channelId,
                member: membersBySlackId[msg.user] || null,
                user_profile: userProfile
              }
            })
          )
          
          messagesMap[channelId] = messages.filter(msg => msg.text) as SlackMessage[]
        }
      } catch (error) {
        console.error(`Error fetching messages for channel ${channelId}:`, error)
        messagesMap[channelId] = []
      }
    })
  )
  
  return messagesMap
}