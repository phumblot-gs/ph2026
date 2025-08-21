import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { ArrowRight, Calendar, Users, MapPin, Heart } from "lucide-react"
import { config } from "@/lib/config"
import { AuthButton } from "@/components/auth-button"

export default async function Home() {
  // Gérer le callback d'authentification si code présent dans l'URL
  
  return (
    <main className="min-h-screen">
      {/* Auth Button */}
      <div className="fixed top-4 right-4 z-50">
        <AuthButton />
      </div>

      {/* Hero Section */}
      <section className="relative h-screen flex items-center justify-center bg-gradient-to-b from-stone-50 to-white">
        <div className="container mx-auto px-4 text-center">
          <h1 className="text-5xl md:text-7xl font-serif font-light mb-6">
            {config.party.name}
          </h1>
          <p className="text-xl md:text-2xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            {config.party.slogan}
          </p>
          <p className="text-lg text-muted-foreground mb-12 max-w-3xl mx-auto">
            Rejoignez le mouvement pour les élections municipales de 2026.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a href="/signup">
              <Button size="lg" className="group">
                Nous rejoindre
                <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Button>
            </a>
          </div>
        </div>
      </section>

      {/* Vision Section */}
      <section className="py-20 bg-white">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl md:text-4xl font-serif text-center mb-16">Notre vision pour Paris</h2>
          <div className="grid md:grid-cols-3 gap-8">
            <Card>
              <CardHeader>
                <CardTitle className="font-serif">Ville durable</CardTitle>
                <CardDescription>
                  Un Paris plus vert et respirable
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Transformation écologique de notre ville avec plus d'espaces verts, 
                  une mobilité douce renforcée et une politique ambitieuse de réduction des émissions.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="font-serif">Logement accessible</CardTitle>
                <CardDescription>
                  Habiter Paris, un droit pour tous
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Programme ambitieux de construction de logements sociaux et intermédiaires 
                  pour permettre à chaque Parisien de vivre dignement dans sa ville.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="font-serif">Démocratie locale</CardTitle>
                <CardDescription>
                  Vous au cœur des décisions
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Renforcement de la participation citoyenne avec des conseils de quartier 
                  dotés de vrais pouvoirs et budgets participatifs étendus.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Events Section */}
      <section className="py-20 bg-stone-50">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl md:text-4xl font-serif text-center mb-16">Prochains événements</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-start gap-4">
                  <Calendar className="h-5 w-5 text-muted-foreground mt-1" />
                  <div>
                    <h3 className="font-semibold mb-1">Réunion publique</h3>
                    <p className="text-sm text-muted-foreground mb-2">15 janvier 2025 - 19h</p>
                    <p className="text-sm flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      Mairie du 11e arrondissement
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-start gap-4">
                  <Users className="h-5 w-5 text-muted-foreground mt-1" />
                  <div>
                    <h3 className="font-semibold mb-1">Café citoyen</h3>
                    <p className="text-sm text-muted-foreground mb-2">18 janvier 2025 - 10h</p>
                    <p className="text-sm flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      Place de la République
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-start gap-4">
                  <Calendar className="h-5 w-5 text-muted-foreground mt-1" />
                  <div>
                    <h3 className="font-semibold mb-1">Marche pour le climat</h3>
                    <p className="text-sm text-muted-foreground mb-2">25 janvier 2025 - 14h</p>
                    <p className="text-sm flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      Place de la Nation
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Donation Section */}
      <section className="py-20 bg-gradient-to-r from-blue-50 to-purple-50">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto text-center">
            <Heart className="h-12 w-12 text-red-500 mx-auto mb-6 animate-pulse" />
            <h2 className="text-3xl md:text-4xl font-serif mb-4">Soutenez notre mouvement</h2>
            <p className="text-lg text-muted-foreground mb-8 max-w-2xl mx-auto">
              Votre don nous permet de porter nos idées, d'organiser des événements 
              et de mener une campagne citoyenne indépendante.
            </p>
            <div className="grid md:grid-cols-3 gap-6 mb-8">
              <Card className="bg-white/90">
                <CardContent className="pt-6">
                  <div className="text-2xl font-bold mb-2">5€</div>
                  <p className="text-sm text-muted-foreground">
                    Un coup de pouce bienvenu
                  </p>
                </CardContent>
              </Card>
              <Card className="bg-white/90">
                <CardContent className="pt-6">
                  <div className="text-2xl font-bold mb-2">20€</div>
                  <p className="text-sm text-muted-foreground">
                    3 jours de communication digitale
                  </p>
                </CardContent>
              </Card>
              <Card className="bg-white/90">
                <CardContent className="pt-6">
                  <div className="text-2xl font-bold mb-2">100€</div>
                  <p className="text-sm text-muted-foreground">
                    1 journée d'actions sur le terrain
                  </p>
                </CardContent>
              </Card>
            </div>
            <a href="/faire-un-don">
              <Button size="lg" className="group">
                <Heart className="mr-2 h-5 w-5" />
                Faire un don
                <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Button>
            </a>
            <p className="text-xs text-muted-foreground mt-4">
              Déduction fiscale de 66% • Paiement sécurisé • Transparence totale
            </p>
          </div>
        </div>
      </section>

      {/* Newsletter Section */}
      <section className="py-20 bg-white">
        <div className="container mx-auto px-4">
          <div className="max-w-2xl mx-auto text-center">
            <h2 className="text-3xl md:text-4xl font-serif mb-4">Restez informé</h2>
            <p className="text-muted-foreground mb-8">
              Inscrivez-vous à notre newsletter pour suivre l'actualité de la campagne
            </p>
            <div className="flex flex-col sm:flex-row gap-4 max-w-md mx-auto">
              <Input 
                type="email" 
                placeholder="Votre email" 
                className="flex-1"
              />
              <Button>S'inscrire</Button>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 bg-stone-100 border-t">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="text-center md:text-left">
              <p className="font-serif text-lg mb-2">{config.party.name}</p>
              <p className="text-sm text-muted-foreground">
                {config.party.slogan}
              </p>
            </div>
            <div className="flex gap-6 text-sm text-muted-foreground">
              <a href="#" className="hover:text-foreground transition-colors">Programme</a>
              <a href="#" className="hover:text-foreground transition-colors">Actualités</a>
              <a href="#" className="hover:text-foreground transition-colors">Contact</a>
              <a href="#" className="hover:text-foreground transition-colors">Mentions légales</a>
            </div>
          </div>
        </div>
      </footer>
    </main>
  )
}