import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { config } from '@/lib/config'
import { Users, Contact, Calendar, DollarSign, Map, TrendingUp } from 'lucide-react'
import PendingMembersAlert from '@/components/admin/PendingMembersAlert'

export default async function AdminDashboard() {
  const supabase = await createClient()
  
  // Fetch stats (these will return 0 initially as tables are empty)
  const [
    { count: membersCount },
    { count: contactsCount },
    { count: actionsCount },
    { count: donationsCount }
  ] = await Promise.all([
    supabase.from('members').select('*', { count: 'exact', head: true }),
    supabase.from('contacts').select('*', { count: 'exact', head: true }),
    supabase.from('field_actions').select('*', { count: 'exact', head: true }),
    supabase.from('donations').select('*', { count: 'exact', head: true })
  ])

  const stats = [
    {
      title: 'Membres actifs',
      value: membersCount || 0,
      icon: Users,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
    },
    {
      title: 'Contacts CRM',
      value: contactsCount || 0,
      icon: Contact,
      color: 'text-green-600',
      bgColor: 'bg-green-50',
    },
    {
      title: 'Actions terrain',
      value: actionsCount || 0,
      icon: Map,
      color: 'text-purple-600',
      bgColor: 'bg-purple-50',
    },
    {
      title: 'Dons reçus',
      value: `${donationsCount || 0}`,
      icon: DollarSign,
      color: 'text-amber-600',
      bgColor: 'bg-amber-50',
    },
  ]

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-serif font-light">Tableau de bord</h1>
        <p className="text-muted-foreground mt-2">
          Bienvenue dans l'espace d'administration {config.party.name}
        </p>
      </div>

      {/* Pending Members Alert */}
      <PendingMembersAlert />

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {stats.map((stat) => {
          const Icon = stat.icon
          return (
            <Card key={stat.title}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {stat.title}
                </CardTitle>
                <div className={`p-2 rounded-lg ${stat.bgColor}`}>
                  <Icon className={`h-4 w-4 ${stat.color}`} />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stat.value}</div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Quick Actions */}
      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Prochains événements
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground text-sm">
              Aucun événement programmé pour le moment.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Activité récente
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground text-sm">
              Aucune activité récente à afficher.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}