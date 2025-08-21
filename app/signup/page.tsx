'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { InputNoAutofill } from '@/components/ui/input-no-autofill'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { PhoneInput } from '@/components/ui/phone-input'
import { config } from '@/lib/config'
import { AlertCircle, CheckCircle, XCircle, Eye, EyeOff } from 'lucide-react'
import { signInWithGoogle, signInWithTwitter } from '@/lib/auth/providers'
import { Footer } from '@/components/footer'

// Fonction pour calculer la force du mot de passe
function getPasswordStrength(password: string): {
  score: number
  message: string
  color: string
} {
  let score = 0
  const messages = []
  
  if (password.length >= 8) score += 20
  if (password.length >= 12) score += 10
  if (/[a-z]/.test(password)) score += 20
  if (/[A-Z]/.test(password)) score += 20
  if (/[0-9]/.test(password)) score += 20
  if (/[^a-zA-Z0-9]/.test(password)) score += 10
  
  if (score < 40) return { score, message: 'Faible', color: 'text-red-500' }
  if (score < 70) return { score, message: 'Moyen', color: 'text-orange-500' }
  if (score < 90) return { score, message: 'Fort', color: 'text-green-500' }
  return { score, message: 'Très fort', color: 'text-green-600' }
}

export default function SignupPage() {
  const [mounted, setMounted] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [phone, setPhone] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    setMounted(true)
  }, [])

  const passwordStrength = getPasswordStrength(password)

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    // Validation
    if (password !== confirmPassword) {
      setError('Les mots de passe ne correspondent pas')
      setIsLoading(false)
      return
    }

    if (password.length < 8) {
      setError('Le mot de passe doit contenir au moins 8 caractères')
      setIsLoading(false)
      return
    }

    if (passwordStrength.score < 40) {
      setError('Le mot de passe est trop faible. Utilisez des majuscules, minuscules, chiffres et caractères spéciaux.')
      setIsLoading(false)
      return
    }

    // Phone is already formatted in E.164 format by PhoneInput component
    const formattedPhone = phone

    try {
      console.log('Tentative inscription avec:', { email, firstName, lastName })
      
      // Appeler notre API qui gère tout le processus d'inscription
      const response = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          password,
          firstName,
          lastName,
          phone: formattedPhone
        })
      })

      const data = await response.json()
      console.log('Réponse API:', data)

      if (!response.ok) {
        throw new Error(data.error || 'Erreur lors de l\'inscription')
      }

      if (data.success) {
        setSuccess(true)
      }
    } catch (error: any) {
      console.error('Signup error:', error)
      if (error.message.includes('already registered')) {
        setError('Cet email est déjà utilisé')
      } else {
        setError(error.message || 'Une erreur est survenue lors de l\'inscription')
      }
    } finally {
      setIsLoading(false)
    }
  }

  const handleGoogleSignup = async () => {
    setIsLoading(true)
    setError(null)

    try {
      await signInWithGoogle()
    } catch (error: any) {
      setError(error.message || 'Une erreur est survenue')
      setIsLoading(false)
    }
  }

  const handleTwitterSignup = async () => {
    setIsLoading(true)
    setError(null)

    try {
      await signInWithTwitter()
    } catch (error: any) {
      setError(error.message || 'Une erreur est survenue avec Twitter')
      setIsLoading(false)
    }
  }

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

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-green-100 flex items-center justify-center">
              <CheckCircle className="h-6 w-6 text-green-600" />
            </div>
            <CardTitle className="text-2xl">Demande d'inscription reçue !</CardTitle>
            <CardDescription className="mt-2">
              Un email de confirmation a été envoyé à <strong>{email}</strong>.
              <br /><br />
              Votre demande sera examinée par notre équipe. Vous recevrez une notification 
              dès que votre compte sera activé.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              className="w-full"
              variant="outline"
              onClick={() => router.push('/')}
            >
              Retour à l'accueil
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col bg-stone-50">
      <div className="flex-1 flex items-center justify-center py-12">
        <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-serif">{config.party.name}</CardTitle>
          <CardDescription>Rejoignez le mouvement</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSignup} className="space-y-4">
            {error && (
              <div className="p-3 rounded-md bg-red-50 text-red-800 text-sm flex items-center gap-2">
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                {error}
              </div>
            )}

            {/* Social Sign Up */}
            <div className="space-y-3">
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={handleGoogleSignup}
                disabled={isLoading}
              >
                <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
                  <path
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    fill="#4285F4"
                  />
                  <path
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    fill="#34A853"
                  />
                  <path
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                    fill="#FBBC05"
                  />
                  <path
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    fill="#EA4335"
                  />
                </svg>
                Continuer avec Google
              </Button>

              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={handleTwitterSignup}
                disabled={isLoading}
              >
                <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                </svg>
                Continuer avec X (Twitter)
              </Button>
            </div>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-white px-2 text-muted-foreground">Ou</span>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label htmlFor="firstName" className="text-sm font-medium">
                  Prénom *
                </label>
                <InputNoAutofill
                  id="firstName"
                  type="text"
                  placeholder="Jean"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  required
                  disabled={isLoading}
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="lastName" className="text-sm font-medium">
                  Nom *
                </label>
                <InputNoAutofill
                  id="lastName"
                  type="text"
                  placeholder="Dupont"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  required
                  disabled={isLoading}
                />
              </div>
            </div>

            <div className="space-y-2">
              <label htmlFor="email" className="text-sm font-medium">
                Email *
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
              <label htmlFor="phone" className="text-sm font-medium">
                Téléphone
              </label>
              <PhoneInput
                value={phone}
                onChange={setPhone}
                disabled={isLoading}
                placeholder="06 12 34 56 78"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="password" className="text-sm font-medium">
                Mot de passe *
              </label>
              <div className="relative">
                <InputNoAutofill
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={isLoading}
                  minLength={8}
                  className="pr-10"
                />
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {password && (
                <div className="flex items-center gap-2 mt-1">
                  <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all ${
                        passwordStrength.score < 40 ? 'bg-red-500' :
                        passwordStrength.score < 70 ? 'bg-orange-500' :
                        passwordStrength.score < 90 ? 'bg-green-500' : 'bg-green-600'
                      }`}
                      style={{ width: `${passwordStrength.score}%` }}
                    />
                  </div>
                  <span className={`text-xs ${passwordStrength.color}`}>
                    {passwordStrength.message}
                  </span>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <label htmlFor="confirmPassword" className="text-sm font-medium">
                Confirmer le mot de passe *
              </label>
              <InputNoAutofill
                id="confirmPassword"
                type="password"
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                disabled={isLoading}
                minLength={8}
              />
              {confirmPassword && password && (
                <div className="flex items-center gap-1 mt-1">
                  {password === confirmPassword ? (
                    <>
                      <CheckCircle className="h-3 w-3 text-green-500" />
                      <span className="text-xs text-green-500">Les mots de passe correspondent</span>
                    </>
                  ) : (
                    <>
                      <XCircle className="h-3 w-3 text-red-500" />
                      <span className="text-xs text-red-500">Les mots de passe ne correspondent pas</span>
                    </>
                  )}
                </div>
              )}
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={isLoading || passwordStrength.score < 40}
            >
              {isLoading ? 'Inscription...' : 'Rejoindre le mouvement'}
            </Button>
          </form>

          <p className="text-center text-sm text-muted-foreground mt-6">
            Déjà membre ?{' '}
            <Link href="/login" className="font-medium hover:text-primary">
              Se connecter
            </Link>
          </p>
        </CardContent>
        </Card>
      </div>
      <Footer />
    </div>
  )
}