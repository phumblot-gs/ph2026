'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, ArrowLeft, CreditCard, Building2, CheckCircle, AlertCircle, Shield } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { isStripeConfigured } from '@/lib/stripe/config';
import { Footer } from '@/components/footer';

function CheckoutStep2Content() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessionData, setSessionData] = useState<any>(null);
  const [paymentMethod, setPaymentMethod] = useState<'card' | 'sepa'>('card');
  
  const sessionToken = searchParams.get('session');

  useEffect(() => {
    loadSession();
  }, [sessionToken]);

  async function loadSession() {
    if (!sessionToken) {
      router.push('/faire-un-don');
      return;
    }

    const supabase = createClient();
    
    // Check authentication
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      // Redirect to login if not authenticated
      router.push(`/login?redirect=/faire-un-don/checkout/step2?session=${sessionToken}`);
      return;
    }
    
    // Load checkout session
    const { data: session } = await supabase
      .from('checkout_sessions')
      .select('*')
      .eq('session_token', sessionToken)
      .single();
    
    if (!session || session.status !== 'pending') {
      router.push('/faire-un-don');
      return;
    }
    
    // Check if personal info is complete
    if (!session.member_data?.first_name || !session.member_data?.email) {
      router.push(`/faire-un-don/checkout?session=${sessionToken}&amount=${session.amount}`);
      return;
    }
    
    setSessionData(session);

    // Update member information in database
    const { error: updateError } = await supabase
      .from('members')
      .update({
        first_name: session.member_data.first_name,
        last_name: session.member_data.last_name,
        phone: session.member_data.phone,
        birth_date: session.member_data.birth_date,
        address_line1: session.member_data.address_line1,
        address_line2: session.member_data.address_line2,
        postal_code: session.member_data.postal_code,
        city: session.member_data.city,
        country: session.member_data.country,
        google_place_id: session.member_data.google_place_id,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', user.id);

    if (updateError) {
      console.error('Error updating member:', updateError);
    }
  }

  const handlePayment = async () => {
    setLoading(true);
    setError(null);

    try {
      // Check if Stripe is configured
      if (!isStripeConfigured()) {
        setError('Le système de paiement n\'est pas configuré. Veuillez contacter le support.');
        setLoading(false);
        return;
      }

      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        router.push('/login');
        return;
      }

      // Get member ID
      const { data: member } = await supabase
        .from('members')
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (!member) {
        throw new Error('Member not found');
      }

      // Create Stripe checkout session via API
      const response = await fetch('/api/donations/create-checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount: sessionData.amount,
          member_id: member.id,
          session_token: sessionToken,
          payment_method: paymentMethod,
          member_data: sessionData.member_data,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erreur lors de la création de la session de paiement');
      }

      // Redirect to Stripe Checkout
      if (data.url) {
        window.location.href = data.url;
      } else {
        throw new Error('URL de paiement non disponible');
      }
    } catch (err: any) {
      console.error('Payment error:', err);
      setError(err.message || 'Une erreur est survenue lors du paiement');
      setLoading(false);
    }
  };

  if (!sessionData) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <div className="flex-1 py-8">
        <div className="max-w-3xl mx-auto px-4">
        {/* Progress indicator */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center">
              <div className="flex items-center justify-center w-8 h-8 bg-green-600 text-white rounded-full text-sm">
                <CheckCircle className="h-5 w-5" />
              </div>
              <span className="ml-2 text-gray-600">Informations personnelles</span>
            </div>
            <div className="flex-1 mx-4 h-1 bg-gray-200">
              <div className="h-1 bg-green-600 w-full"></div>
            </div>
            <div className="flex items-center">
              <div className="flex items-center justify-center w-8 h-8 bg-blue-600 text-white rounded-full text-sm font-semibold">
                2
              </div>
              <span className="ml-2 font-medium">Paiement</span>
            </div>
          </div>
        </div>

        {/* Donation summary */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Récapitulatif de votre don</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-600">Montant du don</span>
              <span className="font-semibold text-xl">{sessionData.amount}€</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Donateur</span>
              <span>{sessionData.member_data?.first_name} {sessionData.member_data?.last_name}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Email</span>
              <span>{sessionData.member_data?.email}</span>
            </div>
            <div className="pt-3 border-t">
              <div className="flex items-center text-green-600 text-sm">
                <CheckCircle className="h-4 w-4 mr-2" />
                Déduction fiscale de 66% (soit {Math.round(sessionData.amount * 0.66)}€)
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Payment method selection */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Méthode de paiement</CardTitle>
            <CardDescription>
              Choisissez votre mode de paiement préféré
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <button
                type="button"
                onClick={() => setPaymentMethod('card')}
                className={`p-4 border-2 rounded-lg transition-all ${
                  paymentMethod === 'card' 
                    ? 'border-blue-500 bg-blue-50' 
                    : 'border-gray-200 hover:border-gray-300'
                }`}
                disabled={loading}
              >
                <CreditCard className="h-8 w-8 mb-2 mx-auto text-blue-600" />
                <h3 className="font-semibold">Carte bancaire</h3>
                <p className="text-sm text-gray-600 mt-1">
                  Paiement immédiat et sécurisé
                </p>
              </button>
              
              <button
                type="button"
                onClick={() => setPaymentMethod('sepa')}
                className={`p-4 border-2 rounded-lg transition-all ${
                  paymentMethod === 'sepa' 
                    ? 'border-blue-500 bg-blue-50' 
                    : 'border-gray-200 hover:border-gray-300'
                }`}
                disabled={loading}
              >
                <Building2 className="h-8 w-8 mb-2 mx-auto text-blue-600" />
                <h3 className="font-semibold">Prélèvement SEPA</h3>
                <p className="text-sm text-gray-600 mt-1">
                  Prélèvement bancaire (3-5 jours)
                </p>
              </button>
            </div>
            
            {paymentMethod === 'sepa' && (
              <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <p className="text-sm text-yellow-800">
                  Le prélèvement SEPA sera effectué dans 3 à 5 jours ouvrés. 
                  Vous recevrez un email de confirmation une fois le paiement traité.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Security badges */}
        <Card className="mb-6 bg-green-50 border-green-200">
          <CardContent className="pt-6">
            <div className="flex items-center justify-center space-x-8">
              <div className="flex items-center text-green-700">
                <Shield className="h-5 w-5 mr-2" />
                <span className="text-sm font-medium">Paiement sécurisé</span>
              </div>
              <div className="flex items-center text-green-700">
                <CheckCircle className="h-5 w-5 mr-2" />
                <span className="text-sm font-medium">Données chiffrées</span>
              </div>
              <div className="text-sm text-green-700">
                Powered by <span className="font-semibold">Stripe</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Error message */}
        {error && (
          <div className="mb-6 flex items-center p-4 bg-red-50 text-red-800 rounded-lg">
            <AlertCircle className="h-5 w-5 mr-2 flex-shrink-0" />
            <p className="text-sm">{error}</p>
          </div>
        )}

        {/* Navigation buttons */}
        <div className="flex justify-between">
          <Button
            variant="outline"
            onClick={() => router.push(`/faire-un-don/checkout?session=${sessionToken}&amount=${sessionData.amount}`)}
            disabled={loading}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Retour
          </Button>
          <Button 
            onClick={handlePayment} 
            disabled={loading}
            size="lg"
            className="bg-green-600 hover:bg-green-700"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Redirection vers le paiement...
              </>
            ) : (
              <>
                <CreditCard className="mr-2 h-4 w-4" />
                Procéder au paiement sécurisé
              </>
            )}
          </Button>
        </div>

        {/* Legal notice */}
        <div className="mt-6 p-4 bg-gray-50 rounded-lg">
          <p className="text-xs text-gray-600 text-center">
            En procédant au paiement, vous confirmez que vous êtes une personne physique, 
            que le paiement provient de votre compte personnel et que vous respectez le plafond 
            légal de 7 500€ par an pour les dons politiques.
          </p>
        </div>
        </div>
      </div>
      <Footer />
    </div>
  );
}

export default function CheckoutStep2Page() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
      </div>
    }>
      <CheckoutStep2Content />
    </Suspense>
  );
}