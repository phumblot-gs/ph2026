'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Calendar, MapPin, Users } from 'lucide-react'

interface EventsModuleProps {
  groups: Array<{
    id: string
    name: string
    slack_channel_id: string | null
  }>
  currentUserId: string
}

export default function EventsModule({ groups, currentUserId }: EventsModuleProps) {
  // TODO: Implémenter la logique des événements
  const mockEvents = [
    {
      id: '1',
      title: 'Réunion de quartier - Belleville',
      date: '2025-09-15',
      time: '19:00',
      location: 'Mairie du 20e arrondissement',
      attendees: 25,
      groupName: groups[0]?.name || 'Public'
    },
    {
      id: '2',
      title: 'Assemblée générale',
      date: '2025-09-20',
      time: '18:30',
      location: 'Salle associative - République',
      attendees: 50,
      groupName: groups[0]?.name || 'Public'
    }
  ]

  return (
    <div className="h-full p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Événements</h1>
          <p className="text-gray-500 mt-1">Gérez les événements et rendez-vous de vos groupes</p>
        </div>
      </div>

      <div className="grid gap-4">
        {mockEvents.map((event) => (
          <Card key={event.id}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-blue-600" />
                {event.title}
              </CardTitle>
              <CardDescription>
                Organisé par le groupe {event.groupName}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col sm:flex-row sm:items-center gap-4 text-sm text-gray-600">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  {new Date(event.date).toLocaleDateString('fr-FR', { 
                    weekday: 'long', 
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric' 
                  })} à {event.time}
                </div>
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  {event.location}
                </div>
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  {event.attendees} participants
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Calendar className="h-12 w-12 text-gray-400 mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Module en développement</h3>
          <p className="text-gray-500 text-center max-w-md">
            Le module Événements sera bientôt disponible. Vous pourrez créer, gérer et suivre 
            les événements de vos groupes.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}