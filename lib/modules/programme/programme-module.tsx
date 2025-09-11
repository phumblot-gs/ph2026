'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { FileText, Target, CheckCircle } from 'lucide-react'

interface ProgrammeModuleProps {
  groups: Array<{
    id: string
    name: string
    slack_channel_id: string | null
  }>
  currentUserId: string
}

export default function ProgrammeModule({ groups, currentUserId }: ProgrammeModuleProps) {
  const mockPropositions = [
    {
      id: '1',
      title: 'Transport public gratuit le week-end',
      status: 'en_cours',
      category: 'Transport',
      votes: 45,
      contributors: 8
    },
    {
      id: '2', 
      title: 'Végétalisation des cours d\'école',
      status: 'adopte',
      category: 'Environnement',
      votes: 62,
      contributors: 12
    }
  ]

  return (
    <div className="h-full p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Programme</h1>
          <p className="text-gray-500 mt-1">Construisez collaborativement le programme politique</p>
        </div>
      </div>

      <div className="grid gap-4">
        {mockPropositions.map((prop) => (
          <Card key={prop.id}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {prop.status === 'adopte' ? (
                  <CheckCircle className="h-5 w-5 text-green-600" />
                ) : (
                  <Target className="h-5 w-5 text-orange-600" />
                )}
                {prop.title}
              </CardTitle>
              <CardDescription>
                Catégorie: {prop.category} • {prop.contributors} contributeurs • {prop.votes} votes
              </CardDescription>
            </CardHeader>
          </Card>
        ))}
      </div>

      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-12">
          <FileText className="h-12 w-12 text-gray-400 mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Module en développement</h3>
          <p className="text-gray-500 text-center max-w-md">
            Le module Programme permettra de construire collaborativement le programme politique 
            avec des propositions, votes et débats organisés.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}