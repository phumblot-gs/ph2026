import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { DashboardClient } from '@/components/dashboard-client'
import { getSlackMessagesForChannels } from '@/lib/slack-server'
import { getCachedMessagesWithInfo } from '@/lib/slack-cache'

export default async function DashboardPage() {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    redirect('/login')
  }
  
  // Récupérer les informations du membre
  const { data: member } = await supabase
    .from('members')
    .select('*')
    .eq('user_id', user.id)
    .single()
  
  // Récupérer les groupes du membre avec leurs canaux Slack
  const { data: userGroups } = await supabase
    .from('user_groups')
    .select(`
      group_id,
      groups (
        id,
        name,
        description,
        slack_channel_id
      )
    `)
    .eq('user_id', user.id)
  
  // Get website URL, highlight URL and donations setting for navigation
  const { data: navigationSettings } = await supabase
    .from('app_settings')
    .select('setting_key, setting_value')
    .in('setting_key', ['website_url', 'highlight_url', 'donations_enabled'])
  
  const websiteUrl = navigationSettings?.find(s => s.setting_key === 'website_url')?.setting_value?.replace(/^https?:\/\//, '') || null
  const highlightUrl = navigationSettings?.find(s => s.setting_key === 'highlight_url')?.setting_value || null
  const donationsEnabled = navigationSettings?.find(s => s.setting_key === 'donations_enabled')?.setting_value === 'true'
  
  // Transform groups data
  const groups = userGroups?.map(ug => {
    const group = ug.groups as unknown as { id: string; name: string; slack_channel_id: string | null } | null
    return {
      id: group?.id || '',
      name: group?.name || '',
      slack_channel_id: group?.slack_channel_id || null
    }
  }).filter(g => g.id) || []
  
  // Get initial Slack messages from cache first
  let initialMessagesByGroup: Record<string, any> = {}
  let cacheInfo: Record<string, { lastUpdated: string; ageInSeconds: number }> = {}
  
  // Get group IDs for cache lookup
  const groupIds = groups.map(g => g.id)
  
  if (groupIds.length > 0) {
    // First, try to get messages from cache (instant)
    try {
      const cachedResult = await getCachedMessagesWithInfo(groupIds)
      initialMessagesByGroup = cachedResult.messages
      cacheInfo = cachedResult.cacheInfo
    } catch (error) {
      console.error('Error loading cached messages:', error)
    }
    
    // If no cache or cache is incomplete, try to get from Slack API
    // This will happen in the background on the client side to avoid blocking initial render
  }
  
  return (
    <DashboardClient
      member={member}
      groups={groups}
      userId={user.id}
      websiteUrl={websiteUrl}
      highlightUrl={highlightUrl}
      donationsEnabled={donationsEnabled}
      initialMessages={initialMessagesByGroup}
      cacheInfo={cacheInfo}
    />
  )
}