import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { config } from '@/lib/config'
import { Clock, Heart, Users, ArrowRight } from 'lucide-react'
import Link from 'next/link'

export default async function PendingPage() {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    redirect('/login')
  }

  // Vérifier le statut du membre
  const { data: member } = await supabase
    .from('members')
    .select('role, first_name, last_name')
    .eq('user_id', user.id)
    .single()

  // Si le membre n'est pas pending, rediriger
  if (!member || member.role !== 'pending') {
    if (member?.role === 'member' || member?.role === 'super_admin' || member?.role === 'admin') {
      redirect('/admin')
    } else {
      redirect('/')
    }
  }

  // Récupérer l'email de support depuis les paramètres
  const { data: settings } = await supabase
    .from('settings')
    .select('setting_value')
    .eq('setting_key', 'support_email')
    .single()
  
  const supportEmail = settings?.setting_value || 'contact@nous-parisiens.fr'

  return (
    <div className="min-h-screen bg-gradient-to-b from-stone-50 to-white flex items-center justify-center p-4">
      <div className="max-w-2xl w-full">
        <Card className="border-0 shadow-xl">
          <CardHeader className="text-center pb-8">
            <div className="mx-auto mb-6 h-20 w-20 rounded-full bg-gradient-to-br from-stone-100 to-stone-200 flex items-center justify-center">
              <Heart className="h-10 w-10 text-stone-600" />
            </div>
            <CardTitle className="text-3xl font-serif mb-3">
              Merci {member.first_name} !
            </CardTitle>
            <CardDescription className="text-lg">
              Votre demande d'inscription a bien été reçue
            </CardDescription>
          </CardHeader>
          
          <CardContent className="space-y-6">
            <div className="bg-stone-50 rounded-lg p-6">
              <div className="flex items-start gap-4">
                <div className="p-2 rounded-lg bg-white">
                  <Clock className="h-5 w-5 text-stone-600" />
                </div>
                <div>
                  <h3 className="font-semibold mb-2">Prochaines étapes</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Notre équipe va examiner votre demande dans les plus brefs délais. 
                    Vous recevrez un email de confirmation dès que votre compte sera activé.
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-blue-50 rounded-lg p-6">
              <div className="flex items-start gap-4">
                <div className="p-2 rounded-lg bg-white">
                  <Users className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <h3 className="font-semibold mb-2">Rejoignez la communauté</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed mb-3">
                    En attendant, vous pouvez déjà nous suivre sur les réseaux sociaux 
                    pour rester informé de nos actions et actualités.
                  </p>
                  <div className="flex gap-3">
                    {/* TODO: Ajouter les vrais liens sociaux */}
                    <Button size="sm" variant="outline" className="text-xs">
                      Twitter
                    </Button>
                    <Button size="sm" variant="outline" className="text-xs">
                      Instagram
                    </Button>
                    <Button size="sm" variant="outline" className="text-xs">
                      LinkedIn
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            <div className="text-center pt-4">
              <p className="text-sm text-muted-foreground mb-4">
                Ensemble, construisons l'avenir de Paris
              </p>
              <Link href="/">
                <Button variant="outline" className="group">
                  Retour à l'accueil
                  <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                </Button>
              </Link>
            </div>

            <div className="border-t pt-6">
              <p className="text-xs text-center text-muted-foreground">
                Si vous avez des questions, n'hésitez pas à nous contacter à{' '}
                <a href={`mailto:${supportEmail}`} className="font-medium hover:text-primary">
                  {supportEmail}
                </a>
              </p>
            </div>
          </CardContent>
        </Card>

        <div className="mt-8 text-center">
          <h2 className="text-2xl font-serif mb-4">{config.party.name}</h2>
          <p className="text-sm text-muted-foreground">{config.party.slogan}</p>
        </div>
      </div>
    </div>
  )
}