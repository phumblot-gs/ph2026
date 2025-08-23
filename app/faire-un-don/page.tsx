import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { Heart, Users, Target, Gift, CreditCard, Shield } from 'lucide-react';
import { config } from '@/lib/config';
import DonationFormIntegrated from './components/donation-form-integrated';
import type { DonationExample, AppSetting } from '@/lib/types/donations';
import { AuthButton } from '@/components/auth-button';

async function getDonationSettings() {
  const supabase = await createClient();
  
  // Check if donations are enabled
  const { data: settings } = await supabase
    .from('app_settings')
    .select('*')
    .in('setting_key', ['donations_enabled', 'support_email']);
  
  const donationsEnabled = settings?.find(s => s.setting_key === 'donations_enabled')?.setting_value === 'true';
  const supportEmail = settings?.find(s => s.setting_key === 'support_email')?.setting_value || 'support@ph2026.fr';
  
  // Get donation examples
  const { data: examples } = await supabase
    .from('app_settings_donation')
    .select('*')
    .eq('is_active', true)
    .order('display_order', { ascending: true });
  
  return {
    enabled: donationsEnabled,
    supportEmail,
    examples: examples || [],
  };
}

export default async function DonationPage() {
  const { enabled, supportEmail, examples } = await getDonationSettings();
  
  // If donations are disabled, show a message
  if (!enabled) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-md mx-auto text-center">
          <Shield className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Collecte de dons temporairement suspendue
          </h1>
          <p className="text-gray-600 mb-4">
            Notre système de collecte de dons est actuellement en maintenance. 
            Nous vous invitons à revenir ultérieurement.
          </p>
          <p className="text-sm text-gray-500">
            Pour toute question, contactez-nous à{' '}
            <a href={`mailto:${supportEmail}`} className="text-blue-600 hover:underline">
              {supportEmail}
            </a>
          </p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-gray-50">
      {/* Auth Button */}
      <div className="fixed top-4 right-4 z-50">
        <AuthButton />
      </div>

      {/* Hero Section */}
      <section className="relative py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto text-center">
          <Heart className="h-16 w-16 text-red-500 mx-auto mb-6 animate-pulse" />
          <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-6">
            Soutenez notre mouvement
          </h1>
          <p className="text-xl text-gray-600 mb-8">
            Faire un don, c'est participer activement à la vie démocratique et soutenir 
            une équipe qui porte des idées pour faire progresser notre société.
          </p>
          <div className="flex flex-wrap justify-center gap-4 text-sm text-gray-500">
            <div className="flex items-center">
              <Shield className="h-4 w-4 mr-2" />
              Paiement sécurisé
            </div>
            <div className="flex items-center">
              <CreditCard className="h-4 w-4 mr-2" />
              Déduction fiscale
            </div>
            <div className="flex items-center">
              <Users className="h-4 w-4 mr-2" />
              Transparence totale
            </div>
          </div>
        </div>
      </section>

      {/* Who Donates Section */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 bg-white">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold text-gray-900 mb-8 text-center">
            Qui fait des dons ?
          </h2>
          <div className="grid md:grid-cols-2 gap-8">
            <div>
              <Users className="h-10 w-10 text-blue-600 mb-4" />
              <h3 className="text-xl font-semibold mb-3">Une diversité de profils</h3>
              <p className="text-gray-600">
                Nos donateurs viennent de tous horizons : artisans, retraités, salariés, 
                chefs d'entreprise, professions libérales. Chacun contribue selon ses moyens 
                à construire un avenir meilleur pour Paris.
              </p>
            </div>
            <div>
              <Target className="h-10 w-10 text-blue-600 mb-4" />
              <h3 className="text-xl font-semibold mb-3">Un engagement citoyen</h3>
              <p className="text-gray-600">
                Toute personne de plus de 18 ans, résidant en France, peut contribuer à notre 
                campagne. C'est un acte citoyen qui permet de faire vivre la démocratie et de 
                porter des idées nouvelles.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Integrated Donation Section with Examples and Form */}
      <section className="py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-bold text-gray-900 mb-4 text-center">
            Quel montant donner ?
          </h2>
          <p className="text-gray-600 text-center mb-12 max-w-2xl mx-auto">
            Chaque contribution compte. Choisissez le montant qui vous convient ou entrez un montant libre.
          </p>
          
          <DonationFormIntegrated examples={examples} />
          
          {/* Legal Information */}
          <div className="mt-12 max-w-2xl mx-auto p-6 bg-gray-50 rounded-lg">
            <h3 className="font-semibold text-gray-900 mb-3">Informations légales</h3>
            <ul className="space-y-2 text-sm text-gray-600">
              <li className="flex items-start">
                <span className="text-gray-400 mr-2">•</span>
                Les dons sont plafonnés à 7 500€ par personne et par an (législation française)
              </li>
              <li className="flex items-start">
                <span className="text-gray-400 mr-2">•</span>
                Seules les personnes physiques majeures résidant en France peuvent faire un don
              </li>
              <li className="flex items-start">
                <span className="text-gray-400 mr-2">•</span>
                66% de votre don est déductible de vos impôts dans la limite de 20% de vos revenus imposables
              </li>
              <li className="flex items-start">
                <span className="text-gray-400 mr-2">•</span>
                Un reçu fiscal vous sera envoyé par email après validation de votre don
              </li>
            </ul>
          </div>
        </div>
      </section>
    </div>
  );
}