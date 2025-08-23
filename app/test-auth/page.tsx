'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default function TestAuthPage() {
  const [debugData, setDebugData] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  const fetchDebugData = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/debug-auth')
      const data = await response.json()
      setDebugData(data)
    } catch (error) {
      console.error('Erreur:', error)
      setDebugData({ error: 'Erreur lors de la récupération des données' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen p-8 bg-stone-50">
      <div className="max-w-4xl mx-auto space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Test du système d'authentification</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Cette page permet de vérifier l'état de l'authentification et de déboguer les problèmes.
              </p>
              
              <Button onClick={fetchDebugData} disabled={loading}>
                {loading ? 'Chargement...' : 'Vérifier mon statut'}
              </Button>

              {debugData && (
                <div className="mt-6 space-y-4">
                  <div className="p-4 bg-gray-100 rounded-lg">
                    <h3 className="font-semibold mb-2">Résumé:</h3>
                    <ul className="text-sm space-y-1">
                      <li>✓ Utilisateur Auth: {debugData.debug?.hasUser ? '✅ Oui' : '❌ Non'}</li>
                      <li>✓ Entrée Members: {debugData.debug?.hasMember ? '✅ Oui' : '❌ Non'}</li>
                      <li>✓ Dans un groupe: {debugData.debug?.hasGroups ? '✅ Oui' : '❌ Non'}</li>
                      <li>✓ Groupe public existe: {debugData.debug?.hasPublicGroup ? '✅ Oui' : '❌ Non'}</li>
                    </ul>
                  </div>

                  <div className="p-4 bg-white border rounded-lg">
                    <h3 className="font-semibold mb-2">Données complètes (JSON):</h3>
                    <pre className="text-xs overflow-auto bg-gray-50 p-2 rounded">
                      {JSON.stringify(debugData, null, 2)}
                    </pre>
                  </div>

                  {debugData.memberError && (
                    <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                      <h3 className="font-semibold text-red-800 mb-2">Erreur Members:</h3>
                      <p className="text-sm text-red-600">{debugData.memberError}</p>
                    </div>
                  )}

                  {debugData.groupsError && (
                    <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                      <h3 className="font-semibold text-red-800 mb-2">Erreur Groupes:</h3>
                      <p className="text-sm text-red-600">{debugData.groupsError}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}