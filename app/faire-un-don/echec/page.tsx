'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { XCircle, RefreshCw, HelpCircle, Mail, Phone, ArrowLeft, Loader2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { Footer } from '@/components/footer';

function ErrorContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [supportEmail, setSupportEmail] = useState('support@ph2026.fr');
  
  const donationId = searchParams.get('donation_id');
  const errorCode = searchParams.get('error');

  useEffect(() => {
    loadSettings();
    if (donationId) {
      updateDonationStatus();
    }
  }, [donationId]);

  async function loadSettings() {
    const supabase = createClient();
    const { data } = await supabase
      .from('app_settings')
      .select('setting_value')
      .eq('setting_key', 'support_email')
      .single();
    
    if (data?.setting_value) {
      setSupportEmail(data.setting_value);
    }
  }

  async function updateDonationStatus() {
    const supabase = createClient();
    await supabase
      .from('donations')
      .update({
        status: 'failed',
        updated_at: new Date().toISOString(),
      })
      .eq('id', donationId);
  }

  const getErrorMessage = () => {
    switch (errorCode) {
      case 'card_declined':
        return {
          title: "Carte refusée",
          message: "Votre carte bancaire a été refusée. Veuillez vérifier vos informations de paiement ou essayer avec une autre carte."
        };
      case 'insufficient_funds':
        return {
          title: "Fonds insuffisants",
          message: "Le paiement n'a pas pu être effectué en raison de fonds insuffisants sur votre compte."
        };
      case 'processing_error':
        return {
          title: "Erreur de traitement",
          message: "Une erreur technique s'est produite lors du traitement de votre paiement. Veuillez réessayer."
        };
      default:
        return {
          title: "Paiement annulé",
          message: "Votre paiement a été annulé ou n'a pas pu être complété. Aucun montant n'a été débité."
        };
    }
  };

  const error = getErrorMessage();

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <div className="flex-1 py-12">
        <div className="max-w-3xl mx-auto px-4">
        {/* Error icon and message */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-red-100 rounded-full mb-4">
            <XCircle className="h-12 w-12 text-red-600" />
          </div>
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            {error.title}
          </h1>
          <p className="text-xl text-gray-600 max-w-xl mx-auto">
            {error.message}
          </p>
        </div>

        {/* What happened card */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center">
              <HelpCircle className="h-5 w-5 mr-2" />
              Que s'est-il passé ?
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-sm text-yellow-800">
                <strong>Rassurez-vous :</strong> Aucun montant n'a été prélevé sur votre compte. 
                Les transactions annulées ou échouées ne donnent lieu à aucun débit.
              </p>
            </div>
            <div className="space-y-2 text-sm text-gray-600">
              <p>Les raisons possibles de cet échec peuvent être :</p>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li>Informations de carte incorrectes</li>
                <li>Plafond de paiement atteint</li>
                <li>Autorisation refusée par votre banque</li>
                <li>Problème de connexion temporaire</li>
              </ul>
            </div>
          </CardContent>
        </Card>

        {/* Solutions */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Solutions proposées</CardTitle>
            <CardDescription>
              Voici ce que vous pouvez faire pour finaliser votre don
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-start">
              <RefreshCw className="h-5 w-5 text-blue-600 mt-0.5 mr-3 flex-shrink-0" />
              <div>
                <h3 className="font-semibold">Réessayer le paiement</h3>
                <p className="text-sm text-gray-600 mt-1">
                  Vérifiez vos informations de paiement et réessayez. La plupart des problèmes 
                  sont temporaires et se résolvent au deuxième essai.
                </p>
              </div>
            </div>
            <div className="flex items-start">
              <Mail className="h-5 w-5 text-blue-600 mt-0.5 mr-3 flex-shrink-0" />
              <div>
                <h3 className="font-semibold">Contacter le support</h3>
                <p className="text-sm text-gray-600 mt-1">
                  Si le problème persiste, contactez notre équipe support à{' '}
                  <a href={`mailto:${supportEmail}`} className="text-blue-600 hover:underline">
                    {supportEmail}
                  </a>
                </p>
              </div>
            </div>
            <div className="flex items-start">
              <Phone className="h-5 w-5 text-blue-600 mt-0.5 mr-3 flex-shrink-0" />
              <div>
                <h3 className="font-semibold">Contacter votre banque</h3>
                <p className="text-sm text-gray-600 mt-1">
                  Si votre carte est systématiquement refusée, contactez votre banque pour 
                  vérifier qu'il n'y a pas de restriction sur les paiements en ligne.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Action buttons */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link href="/faire-un-don">
            <Button size="lg" className="w-full sm:w-auto">
              <RefreshCw className="mr-2 h-4 w-4" />
              Réessayer le don
            </Button>
          </Link>
          <Link href="/">
            <Button variant="outline" size="lg" className="w-full sm:w-auto">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Retour à l'accueil
            </Button>
          </Link>
        </div>

        {/* Support contact */}
        <div className="mt-12 text-center p-6 bg-gray-100 rounded-lg">
          <h3 className="font-semibold text-gray-900 mb-2">
            Besoin d'aide ?
          </h3>
          <p className="text-sm text-gray-600 mb-4">
            Notre équipe est là pour vous aider à finaliser votre don
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a 
              href={`mailto:${supportEmail}?subject=Problème avec mon don`}
              className="inline-flex items-center text-blue-600 hover:underline"
            >
              <Mail className="h-4 w-4 mr-2" />
              {supportEmail}
            </a>
          </div>
        </div>
        </div>
      </div>
      <Footer />
    </div>
  );
}

export default function ErrorPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
      </div>
    }>
      <ErrorContent />
    </Suspense>
  );
}