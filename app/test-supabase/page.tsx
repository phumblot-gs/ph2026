'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { CheckCircle, XCircle, AlertCircle } from 'lucide-react'

export default function TestSupabasePage() {
  const [status, setStatus] = useState<'checking' | 'connected' | 'error'>('checking')
  const [error, setError] = useState<string | null>(null)
  const [user, setUser] = useState<any>(null)
  const supabase = createClient()

  useEffect(() => {
    checkConnection()
  }, [])

  const checkConnection = async () => {
    try {
      // Test 1: Vérifier la connexion de base
      const { data: { session }, error: sessionError } = await supabase.auth.getSession()
      
      if (sessionError) {
        throw new Error(`Session error: ${sessionError.message}`)
      }

      // Test 2: Essayer une requête simple
      const { error: testError } = await supabase
        .from('members')
        .select('count')
        .limit(1)
        .single()

      if (testError && !testError.message.includes('No rows')) {
        console.error('Query error:', testError)
        // C'est OK si la table est vide
      }

      setUser(session?.user || null)
      setStatus('connected')
    } catch (err: any) {
      console.error('Connection error:', err)
      setError(err.message)
      setStatus('error')
    }
  }

  const testSignUp = async () => {
    const testEmail = `test-${Date.now()}@example.com`
    const { data, error } = await supabase.auth.signUp({
      email: testEmail,
      password: 'testpassword123',
    })
    
    if (error) {
      alert(`Erreur signup: ${error.message}`)
    } else {
      alert(`Test signup réussi! Check email: ${testEmail}`)
    }
  }

  return (
    <div className="min-h-screen bg-stone-50 p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <h1 className="text-3xl font-serif">Test de connexion Supabase</h1>
        
        {/* Status Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {status === 'checking' && (
                <>
                  <AlertCircle className="h-5 w-5 text-yellow-500" />
                  Vérification en cours...
                </>
              )}
              {status === 'connected' && (
                <>
                  <CheckCircle className="h-5 w-5 text-green-500" />
                  Connexion réussie
                </>
              )}
              {status === 'error' && (
                <>
                  <XCircle className="h-5 w-5 text-red-500" />
                  Erreur de connexion
                </>
              )}
            </CardTitle>
            <CardDescription>
              {status === 'connected' && 'Supabase est correctement configuré'}
              {status === 'error' && error}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              <p><strong>URL:</strong> {process.env.NEXT_PUBLIC_SUPABASE_URL || 'Non configuré'}</p>
              <p><strong>Anon Key:</strong> {process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? '✅ Configuré' : '❌ Non configuré'}</p>
              <p><strong>Utilisateur connecté:</strong> {user ? user.email : 'Aucun'}</p>
            </div>
          </CardContent>
        </Card>

        {/* Configuration Info */}
        <Card>
          <CardHeader>
            <CardTitle>Configuration actuelle</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="bg-stone-100 p-4 rounded text-xs overflow-auto">
{`NEXT_PUBLIC_SUPABASE_URL=${process.env.NEXT_PUBLIC_SUPABASE_URL || '❌ Non défini'}
NEXT_PUBLIC_SUPABASE_ANON_KEY=${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? '✅ Défini' : '❌ Non défini'}`}
            </pre>
          </CardContent>
        </Card>

        {/* Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Actions de test</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button onClick={checkConnection} variant="outline">
              Retester la connexion
            </Button>
            <Button onClick={testSignUp} variant="outline">
              Test signup (créera un utilisateur test)
            </Button>
            <Button onClick={() => window.location.href = '/login'} variant="outline">
              Aller à la page de login
            </Button>
            <Button onClick={() => window.location.href = '/signup'} variant="outline">
              Aller à la page d'inscription
            </Button>
          </CardContent>
        </Card>

        {/* Instructions */}
        <Card>
          <CardHeader>
            <CardTitle>Instructions de dépannage</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div>
              <h3 className="font-semibold mb-2">1. Vérifiez vos variables d'environnement</h3>
              <p>Assurez-vous que le fichier <code>.env.local</code> contient les bonnes clés Supabase.</p>
            </div>
            
            <div>
              <h3 className="font-semibold mb-2">2. Redémarrez le serveur</h3>
              <p>Après avoir modifié <code>.env.local</code>, arrêtez le serveur (Ctrl+C) et relancez <code>npm run dev</code></p>
            </div>
            
            <div>
              <h3 className="font-semibold mb-2">3. Vérifiez dans Supabase</h3>
              <p>Dans votre dashboard Supabase, vérifiez que :</p>
              <ul className="list-disc list-inside ml-4 mt-1">
                <li>Le projet est actif</li>
                <li>Les tables ont été créées (via le script SQL)</li>
                <li>L'authentification par email est activée</li>
              </ul>
            </div>

            <div>
              <h3 className="font-semibold mb-2">4. Exécutez les scripts SQL</h3>
              <p>Dans l'éditeur SQL de Supabase, exécutez :</p>
              <ol className="list-decimal list-inside ml-4 mt-1">
                <li><code>supabase/schema.sql</code> - Pour créer les tables</li>
                <li><code>supabase/triggers.sql</code> - Pour les triggers automatiques</li>
              </ol>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}