'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { InputNoAutofill } from '@/components/ui/input-no-autofill'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { config } from '@/lib/config'
import { AlertCircle } from 'lucide-react'

export default function LoginPage() {
  const [mounted, setMounted] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    setMounted(true)
  }, [])

  // Évite les erreurs d'hydratation causées par les extensions navigateur
  if (!mounted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50">
        <div className="w-full max-w-md p-8">
          <div className="animate-pulse">
            <div className="h-8 bg-stone-200 rounded w-3/4 mx-auto mb-4"></div>
            <div className="h-4 bg-stone-200 rounded w-1/2 mx-auto"></div>
          </div>
        </div>
      </div>
    )
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) {
        console.error('Login error:', error)
        throw error
      }

      if (data?.user) {
        // Vérifier le rôle pour rediriger correctement
        const { data: member } = await supabase
          .from('members')
          .select('role')
          .eq('user_id', data.user.id)
          .single()
        
        if (member?.role === 'pending') {
          router.push('/pending')
        } else {
          router.push('/admin')
        }
        router.refresh()
      }
    } catch (error: any) {
      console.error('Auth error:', error)
      if (error.message === 'Invalid login credentials') {
        setError('Email ou mot de passe incorrect')
      } else if (error.message.includes('Email not confirmed')) {
        setError('Veuillez confirmer votre email avant de vous connecter')
      } else {
        setError(error.message || 'Une erreur est survenue')
      }
    } finally {
      setIsLoading(false)
    }
  }

  const handleGoogleLogin = async () => {
    setIsLoading(true)
    setError(null)

    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${config.site.url}/auth/callback`,
        },
      })

      if (error) throw error
    } catch (error: any) {
      setError(error.message || 'Une erreur est survenue')
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-stone-50">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-serif">{config.party.name}</CardTitle>
          <CardDescription>Connexion à l'espace membre</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            {error && (
              <div className="p-3 rounded-md bg-red-50 text-red-800 text-sm flex items-center gap-2">
                <AlertCircle className="h-4 w-4" />
                {error}
              </div>
            )}
            
            <div className="space-y-2">
              <label htmlFor="email" className="text-sm font-medium">
                Email
              </label>
              <InputNoAutofill
                id="email"
                type="email"
                placeholder="vous@exemple.fr"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={isLoading}
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="password" className="text-sm font-medium">
                Mot de passe
              </label>
              <InputNoAutofill
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={isLoading}
              />
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={isLoading}
            >
              {isLoading ? 'Connexion...' : 'Se connecter'}
            </Button>
          </form>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-white px-2 text-muted-foreground">Ou</span>
            </div>
          </div>

          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={handleGoogleLogin}
            disabled={isLoading}
          >
            Continuer avec Google
          </Button>

          <p className="text-center text-sm text-muted-foreground mt-6">
            Pas encore membre ?{' '}
            <a href="/signup" className="font-medium hover:text-primary">
              Créer un compte
            </a>
          </p>
        </CardContent>
      </Card>
    </div>
  )
}