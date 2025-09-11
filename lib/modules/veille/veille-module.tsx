'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Eye, ExternalLink, Calendar } from 'lucide-react'

interface VeilleModuleProps {
  groups: Array<{
    id: string
    name: string
    slack_channel_id: string | null
  }>
  currentUserId: string
}

export default function VeilleModule({ groups, currentUserId }: VeilleModuleProps) {
  const mockActualites = [
    {
      id: '1',
      title: 'Nouveau plan vélo pour Paris 2025-2030',
      source: 'Ville de Paris',
      date: '2025-09-10',
      category: 'Transport',
      excerpt: 'La mairie dévoile son nouveau plan vélo avec 180km de pistes supplémentaires...'
    },
    {
      id: '2',
      title: 'Budget participatif : 100M€ pour les quartiers',
      source: 'Le Parisien',
      date: '2025-09-09', 
      category: 'Démocratie',
      excerpt: 'Lancement de la consultation citoyenne pour le budget participatif 2026...'
    }
  ]

  return (
    <div className="h-full p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Veille Politique</h1>
          <p className="text-gray-500 mt-1">Suivez l'actualité politique locale et les enjeux de Paris</p>
        </div>
      </div>

      <div className="grid gap-4">
        {mockActualites.map((actu) => (
          <Card key={actu.id}>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Eye className="h-5 w-5 text-blue-600" />
                  {actu.title}
                </span>
                <ExternalLink className="h-4 w-4 text-gray-400" />
              </CardTitle>
              <CardDescription className="flex items-center gap-4">
                <span>{actu.source}</span>
                <span className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {new Date(actu.date).toLocaleDateString('fr-FR')}
                </span>
                <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs">
                  {actu.category}
                </span>
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600 text-sm">{actu.excerpt}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Eye className="h-12 w-12 text-gray-400 mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Module en développement</h3>
          <p className="text-gray-500 text-center max-w-md">
            Le module Veille Politique permettra de suivre l'actualité, analyser les enjeux 
            et organiser la réflexion politique collective.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}