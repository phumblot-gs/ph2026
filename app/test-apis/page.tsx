'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CheckCircle, XCircle, Loader2, CreditCard, MapPin } from 'lucide-react';
import { getStripe } from '@/lib/stripe/client';
import { getStripePublicKey } from '@/lib/stripe/config';
import { getGooglePlacesApiKey } from '@/lib/google/places';
import { AddressAutocomplete } from '@/components/ui/address-autocomplete';

export default function TestAPIsPage() {
  const [stripeStatus, setStripeStatus] = useState<'checking' | 'configured' | 'not-configured' | null>(null);
  const [googleStatus, setGoogleStatus] = useState<'checking' | 'configured' | 'not-configured' | null>(null);
  const [stripeTestResult, setStripeTestResult] = useState<string | null>(null);
  const [addressResult, setAddressResult] = useState<any>(null);
  const [testAmount, setTestAmount] = useState('10');
  const [loading, setLoading] = useState(false);

  // Check Stripe configuration
  const checkStripeConfig = async () => {
    setStripeStatus('checking');
    try {
      const key = getStripePublicKey();
      if (key) {
        const stripe = await getStripe();
        if (stripe) {
          setStripeStatus('configured');
          setStripeTestResult(`✅ Stripe configuré avec la clé: ${key.substring(0, 20)}...`);
        } else {
          setStripeStatus('not-configured');
          setStripeTestResult('❌ Stripe non configuré - clé invalide');
        }
      } else {
        setStripeStatus('not-configured');
        setStripeTestResult('❌ Stripe non configuré - aucune clé trouvée');
      }
    } catch (error) {
      setStripeStatus('not-configured');
      setStripeTestResult(`❌ Erreur: ${error}`);
    }
  };

  // Check Google Places API configuration
  const checkGoogleConfig = () => {
    setGoogleStatus('checking');
    const key = getGooglePlacesApiKey();
    if (key) {
      setGoogleStatus('configured');
    } else {
      setGoogleStatus('not-configured');
    }
  };

  // Test Stripe payment
  const testStripePayment = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/test-stripe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: parseFloat(testAmount) }),
      });
      
      const data = await response.json();
      if (data.success) {
        setStripeTestResult(`✅ Session de test créée: ${data.sessionId}`);
      } else {
        setStripeTestResult(`❌ Erreur: ${data.error}`);
      }
    } catch (error) {
      setStripeTestResult(`❌ Erreur: ${error}`);
    }
    setLoading(false);
  };

  const handleAddressSelect = (address: any) => {
    setAddressResult(address);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6 lg:p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Test des APIs</h1>
        
        {/* Stripe Test */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center">
              <CreditCard className="h-5 w-5 mr-2" />
              Configuration Stripe
            </CardTitle>
            <CardDescription>
              Test de la configuration Stripe en mode test
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center space-x-4">
              <Button onClick={checkStripeConfig} disabled={stripeStatus === 'checking'}>
                {stripeStatus === 'checking' ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : null}
                Vérifier la configuration
              </Button>
              
              {stripeStatus === 'configured' && (
                <CheckCircle className="h-5 w-5 text-green-500" />
              )}
              {stripeStatus === 'not-configured' && (
                <XCircle className="h-5 w-5 text-red-500" />
              )}
            </div>
            
            {stripeTestResult && (
              <div className="p-3 bg-gray-100 rounded-md text-sm font-mono">
                {stripeTestResult}
              </div>
            )}
            
            {stripeStatus === 'configured' && (
              <div className="space-y-3 border-t pt-4">
                <Label>Tester un paiement (montant en euros)</Label>
                <div className="flex space-x-2">
                  <Input
                    type="number"
                    value={testAmount}
                    onChange={(e) => setTestAmount(e.target.value)}
                    placeholder="10"
                    className="w-32"
                  />
                  <Button onClick={testStripePayment} disabled={loading}>
                    {loading ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : null}
                    Créer une session test
                  </Button>
                </div>
              </div>
            )}
            
            {stripeStatus === 'not-configured' && (
              <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-md">
                <h3 className="font-semibold text-yellow-900 mb-2">Configuration requise</h3>
                <ol className="list-decimal list-inside text-sm text-yellow-800 space-y-1">
                  <li>Créer un compte sur stripe.com</li>
                  <li>Récupérer les clés API en mode test</li>
                  <li>Ajouter les clés dans .env.local :</li>
                </ol>
                <pre className="mt-2 p-2 bg-yellow-100 rounded text-xs">
{`STRIPE_SECRET_KEY=sk_test_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...`}
                </pre>
              </div>
            )}
          </CardContent>
        </Card>
        
        {/* Google Places API Test */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <MapPin className="h-5 w-5 mr-2" />
              Configuration Google Places API
            </CardTitle>
            <CardDescription>
              Test de l'autocomplétion d'adresse
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center space-x-4">
              <Button onClick={checkGoogleConfig} disabled={googleStatus === 'checking'}>
                {googleStatus === 'checking' ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : null}
                Vérifier la configuration
              </Button>
              
              {googleStatus === 'configured' && (
                <CheckCircle className="h-5 w-5 text-green-500" />
              )}
              {googleStatus === 'not-configured' && (
                <XCircle className="h-5 w-5 text-red-500" />
              )}
            </div>
            
            {googleStatus === 'configured' && (
              <div className="space-y-3 border-t pt-4">
                <Label>Tester l'autocomplétion d'adresse</Label>
                <AddressAutocomplete onAddressSelect={handleAddressSelect} />
                
                {addressResult && (
                  <div className="p-3 bg-gray-100 rounded-md text-sm">
                    <p className="font-semibold mb-2">Adresse sélectionnée :</p>
                    <pre className="text-xs">{JSON.stringify(addressResult, null, 2)}</pre>
                  </div>
                )}
              </div>
            )}
            
            {googleStatus === 'not-configured' && (
              <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-md">
                <h3 className="font-semibold text-yellow-900 mb-2">Configuration requise</h3>
                <ol className="list-decimal list-inside text-sm text-yellow-800 space-y-1">
                  <li>Aller sur console.cloud.google.com</li>
                  <li>Créer un projet et activer Places API</li>
                  <li>Créer une clé API et la restreindre</li>
                  <li>Ajouter la clé dans .env.local :</li>
                </ol>
                <pre className="mt-2 p-2 bg-yellow-100 rounded text-xs">
{`NEXT_PUBLIC_GOOGLE_PLACES_API_KEY=AIza...`}
                </pre>
              </div>
            )}
          </CardContent>
        </Card>
        
        {/* Test Cards Examples */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Cartes de test Stripe</CardTitle>
            <CardDescription>
              Numéros de carte à utiliser pour tester les paiements
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <div className="font-mono">4242 4242 4242 4242</div>
                <div className="text-green-600">✓ Paiement réussi</div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="font-mono">4000 0000 0000 0002</div>
                <div className="text-red-600">✗ Carte refusée</div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="font-mono">4000 0000 0000 9995</div>
                <div className="text-red-600">✗ Fonds insuffisants</div>
              </div>
              <p className="text-xs text-gray-500 mt-3">
                Date d'expiration : n'importe quelle date future • 
                CVV : n'importe quel nombre à 3 chiffres • 
                Code postal : n'importe quel code valide
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}