import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Heart } from 'lucide-react'
import { DashboardNav } from '@/components/dashboard-nav'
import { Footer } from '@/components/footer'

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
  
  // Récupérer les groupes du membre
  const { data: userGroups } = await supabase
    .from('user_groups')
    .select(`
      group_id,
      groups (
        id,
        name,
        description
      )
    `)
    .eq('user_id', user.id)
  
  const groupIds = userGroups?.map(ug => ug.group_id) || []
  
  // Récupérer les derniers membres qui ont rejoint ces groupes
  const { data: recentGroupMembers } = await supabase
    .from('user_groups')
    .select(`
      created_at,
      user_id,
      group_id
    `)
    .in('group_id', groupIds)
    .order('created_at', { ascending: false })
    .limit(10)
  
  // Récupérer les infos des membres et des groupes
  const memberIds = recentGroupMembers?.map(gm => gm.user_id) || []
  const { data: membersInfo } = await supabase
    .from('members')
    .select('user_id, first_name, last_name, email')
    .in('user_id', memberIds)
    
  const { data: groupsInfo } = await supabase
    .from('groups')
    .select('id, name')
    .in('id', groupIds)
  
  // Combiner les données
  const recentMembers = recentGroupMembers?.map(gm => ({
    ...gm,
    member: membersInfo?.find(m => m.user_id === gm.user_id),
    group: groupsInfo?.find(g => g.id === gm.group_id)
  }))
  
  // Formater la date
  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffTime = Math.abs(now.getTime() - date.getTime())
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    
    if (diffDays === 0) return "Aujourd'hui"
    if (diffDays === 1) return "Hier"
    if (diffDays < 7) return `Il y a ${diffDays} jours`
    
    return date.toLocaleDateString('fr-FR', { 
      day: 'numeric', 
      month: 'long', 
      year: 'numeric' 
    })
  }
  
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navigation */}
      <DashboardNav memberRole={member?.role} />
      
      <div className="pt-8 px-4 md:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900">
              Bienvenue, {member?.first_name || 'Membre'} !
            </h1>
            <p className="text-gray-600 mt-2">
              Voici les dernières actualités de vos groupes
            </p>
          </div>
          
          {/* Donation Card */}
          <Card className="mb-6 bg-gradient-to-r from-blue-50 to-purple-50 border-blue-200">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center">
                  <Heart className="h-5 w-5 mr-2 text-red-500" />
                  Soutenez notre mouvement
                </CardTitle>
                <CardDescription className="mt-2">
                  Chaque contribution nous aide à porter nos idées plus loin
                </CardDescription>
              </div>
              <Link href="/faire-un-don">
                <Button>
                  Faire un don
                </Button>
              </Link>
            </div>
          </CardHeader>
          </Card>
          
          {/* Main Content Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Contenus récents - Placeholder */}
            <Card>
            <CardHeader>
              <CardTitle>Contenus récents</CardTitle>
              <CardDescription>
                Les dernières publications de vos groupes
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-center h-32 border-2 border-dashed border-gray-300 rounded-lg">
                  <p className="text-gray-500 text-sm">
                    Les contenus seront affichés ici prochainement
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          {/* Nouveaux membres */}
          <Card>
            <CardHeader>
              <CardTitle>Nouveaux membres</CardTitle>
              <CardDescription>
                Les derniers membres qui ont rejoint vos groupes
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {recentMembers && recentMembers.length > 0 ? (
                  recentMembers.map((item, index) => (
                    <div key={index} className="flex items-start space-x-3 pb-3 border-b last:border-0">
                      <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                        <span className="text-blue-600 font-semibold">
                          {item.member?.first_name?.[0]?.toUpperCase() || '?'}
                        </span>
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-sm">
                          {item.member?.first_name} {item.member?.last_name}
                        </p>
                        <p className="text-xs text-gray-500">
                          A rejoint {item.group?.name} • {formatDate(item.created_at)}
                        </p>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-gray-500 text-sm text-center py-4">
                    Aucun nouveau membre récemment
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
          </div>
          
          {/* Upcoming Events - Placeholder */}
          <Card className="mt-6">
            <CardHeader>
            <CardTitle>Événements à venir</CardTitle>
            <CardDescription>
              Les prochains événements de vos groupes
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-center h-32 border-2 border-dashed border-gray-300 rounded-lg">
              <p className="text-gray-500 text-sm">
                Les événements seront affichés ici prochainement
              </p>
            </div>
          </CardContent>
          </Card>
        </div>
      </div>
      <Footer />
    </div>
  )
}