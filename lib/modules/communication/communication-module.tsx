'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Megaphone, Users, Share2, BarChart3 } from 'lucide-react'

interface CommunicationModuleProps {
  groups: Array<{
    id: string
    name: string
    slack_channel_id: string | null
  }>
  currentUserId: string
}

export default function CommunicationModule({ groups, currentUserId }: CommunicationModuleProps) {
  const mockCampagnes = [
    {
      id: '1',
      title: 'Campagne "Paris pour tous"',
      status: 'active',
      reach: '15.2K',
      engagement: '8.5%',
      platform: 'Réseaux sociaux'
    },
    {
      id: '2',
      title: 'Tract de proximité - 11e arrondissement', 
      status: 'en_preparation',
      reach: '5K',
      engagement: '12%',
      platform: 'Distribution'
    }
  ]

  const mockOutils = [
    { name: 'Réseaux sociaux', icon: Share2, count: '3 comptes' },
    { name: 'Base contacts', icon: Users, count: '1,247 contacts' },
    { name: 'Analytics', icon: BarChart3, count: '15 campagnes' }
  ]

  return (
    <div className="h-full p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Communication</h1>
          <p className="text-gray-500 mt-1">Gérez la communication externe et les campagnes</p>
        </div>
      </div>

      {/* Outils de communication */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {mockOutils.map((outil) => {
          const Icon = outil.icon
          return (
            <Card key={outil.name}>
              <CardContent className="flex items-center gap-3 p-4">
                <Icon className="h-8 w-8 text-blue-600" />
                <div>
                  <h3 className="font-semibold">{outil.name}</h3>
                  <p className="text-sm text-gray-500">{outil.count}</p>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Campagnes actives */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Campagnes en cours</h2>
        {mockCampagnes.map((campagne) => (
          <Card key={campagne.id}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Megaphone className="h-5 w-5 text-green-600" />
                {campagne.title}
              </CardTitle>
              <CardDescription>
                {campagne.platform} • Portée: {campagne.reach} • Engagement: {campagne.engagement}
              </CardDescription>
            </CardHeader>
          </Card>
        ))}
      </div>

      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Megaphone className="h-12 w-12 text-gray-400 mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Module en développement</h3>
          <p className="text-gray-500 text-center max-w-md">
            Le module Communication permettra de gérer les campagnes, coordonner la communication 
            externe et analyser l'impact des actions.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}