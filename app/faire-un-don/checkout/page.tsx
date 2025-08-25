'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, ArrowLeft, ArrowRight, AlertCircle, MapPin, User, X } from 'lucide-react';
import { AddressAutocomplete } from '@/components/ui/address-autocomplete';
import { PhoneInput } from '@/components/ui/phone-input';
import { DatePicker } from '@/components/ui/date-picker';
import { createClient } from '@/lib/supabase/client';
import { validateAddress } from '@/lib/google/places-client';
import { isValidPhoneNumber } from 'libphonenumber-js';
import type { CheckoutStep1FormData } from '@/lib/types/donations';
import { Footer } from '@/components/footer';

function CheckoutContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [validating, setValidating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [sessionData, setSessionData] = useState<any>(null);
  const [dataLoaded, setDataLoaded] = useState(false);
  
  const sessionToken = searchParams.get('session');
  const amount = searchParams.get('amount');
  
  const [formData, setFormData] = useState<CheckoutStep1FormData>({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    birth_date: '',
    address_line1: '',
    address_line2: '',
    postal_code: '',
    city: '',
    country: 'France',
    google_place_id: '',
  });

  useEffect(() => {
    checkAuthAndLoadSession();
  }, [sessionToken]);

  async function checkAuthAndLoadSession() {
    if (!sessionToken) {
      router.push('/faire-un-don');
      return;
    }

    const supabase = createClient();
    
    // Check if user is authenticated
    const { data: { user } } = await supabase.auth.getUser();
    setIsAuthenticated(!!user);
    
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
    
    setSessionData(session);
    
    // If authenticated, pre-fill form with member data
    if (user) {
      const { data: member } = await supabase
        .from('members')
        .select('*')
        .eq('user_id', user.id)
        .single();
      
      if (member) {
        setFormData(prev => ({
          ...prev,
          first_name: member.first_name || '',
          last_name: member.last_name || '',
          email: member.email || '',
          phone: member.phone || '',
          birth_date: member.birth_date || '',
          address_line1: member.address_line1 || '',
          address_line2: member.address_line2 || '',
          postal_code: member.postal_code || '',
          city: member.city || '',
          country: member.country || 'France',
          google_place_id: member.google_place_id || '',
        }));
      }
    }
    
    // Mark data as loaded
    setDataLoaded(true);
  }

  const handleAddressSelect = (address: any) => {
    setFormData(prev => ({
      ...prev,
      address_line1: address.address_line1 || '',
      address_line2: address.address_line2 || '',
      postal_code: address.postal_code || '',
      city: address.city || '',
      country: address.country || 'France',
      google_place_id: address.google_place_id || '',
    }));
    setError(null);
  };

  const validateForm = async () => {
    // Check required fields
    if (!formData.first_name || !formData.last_name || !formData.email || 
        !formData.birth_date || !formData.address_line1 || 
        !formData.postal_code || !formData.city) {
      setError('Tous les champs obligatoires doivent être remplis');
      return false;
    }

    // Validate email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      setError('Adresse email invalide');
      return false;
    }

    // Validate phone number if provided
    if (formData.phone && formData.phone.length > 0) {
      try {
        if (!isValidPhoneNumber(formData.phone, 'FR')) {
          setError('Numéro de téléphone invalide. Veuillez saisir un numéro français valide.');
          return false;
        }
      } catch (error) {
        setError('Numéro de téléphone invalide. Veuillez saisir un numéro français valide.');
        return false;
      }
    }

    // Validate age (must be 18+)
    const birthDate = new Date(formData.birth_date);
    const today = new Date();
    const age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    
    if (age < 18 || (age === 18 && monthDiff < 0)) {
      setError('Vous devez avoir au moins 18 ans pour faire un don');
      return false;
    }

    // Validate French address
    const addressValidation = await validateAddress({
      address_line1: formData.address_line1,
      postal_code: formData.postal_code,
      city: formData.city,
      country: formData.country,
    });

    if (!addressValidation.valid) {
      setError(addressValidation.message || 'Adresse invalide');
      return false;
    }

    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setValidating(true);

    if (!await validateForm()) {
      setValidating(false);
      return;
    }

    setValidating(false);
    setLoading(true);

    try {
      const supabase = createClient();
      
      // Update checkout session with personal data
      const { error: updateError } = await supabase
        .from('checkout_sessions')
        .update({
          member_data: {
            ...formData,
            amount: sessionData.amount,
          },
          email: formData.email,
          updated_at: new Date().toISOString(),
        })
        .eq('session_token', sessionToken);

      if (updateError) throw updateError;

      // If not authenticated, redirect to signup/login
      if (!isAuthenticated) {
        // Store form data in session storage for after auth
        sessionStorage.setItem('checkout_data', JSON.stringify({
          session_token: sessionToken,
          personal_info: formData,
          amount: amount,
        }));
        
        router.push(`/signup?redirect=/faire-un-don/checkout/step2?session=${sessionToken}`);
      } else {
        // If authenticated, go directly to step 2
        router.push(`/faire-un-don/checkout/step2?session=${sessionToken}`);
      }
    } catch (err) {
      console.error('Error saving checkout data:', err);
      setError('Une erreur est survenue. Veuillez réessayer.');
      setLoading(false);
    }
  };

  if (!sessionData || !dataLoaded) {
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
              <div className="flex items-center justify-center w-8 h-8 bg-blue-600 text-white rounded-full text-sm font-semibold">
                1
              </div>
              <span className="ml-2 font-medium">Informations personnelles</span>
            </div>
            <div className="flex-1 mx-4 h-1 bg-gray-200">
              <div className="h-1 bg-blue-600 w-1/2"></div>
            </div>
            <div className="flex items-center">
              <div className="flex items-center justify-center w-8 h-8 bg-gray-300 text-white rounded-full text-sm font-semibold">
                2
              </div>
              <span className="ml-2 text-gray-500">Paiement</span>
            </div>
          </div>
        </div>

        {/* Amount reminder */}
        <Card className="mb-6 border-blue-200 bg-blue-50">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Montant de votre don</p>
                <p className="text-2xl font-bold text-gray-900">{amount}€</p>
              </div>
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => router.push('/faire-un-don')}
              >
                Modifier
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Main form */}
        <Card>
          <CardHeader>
            <CardTitle>Vos informations personnelles</CardTitle>
            <CardDescription>
              Ces informations sont requises pour la législation française sur le financement politique
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Name fields */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="first_name">
                    Prénom <span className="text-red-500">*</span>
                  </Label>
                  <div className="relative">
                    <Input
                      id="first_name"
                      type="text"
                      value={formData.first_name}
                      onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                      required
                      disabled={loading}
                      className={formData.first_name ? 'pr-10' : ''}
                    />
                    {formData.first_name && (
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, first_name: '' })}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                        disabled={loading}
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
                <div>
                  <Label htmlFor="last_name">
                    Nom <span className="text-red-500">*</span>
                  </Label>
                  <div className="relative">
                    <Input
                      id="last_name"
                      type="text"
                      value={formData.last_name}
                      onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                      required
                      disabled={loading}
                      className={formData.last_name ? 'pr-10' : ''}
                    />
                    {formData.last_name && (
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, last_name: '' })}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                        disabled={loading}
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Contact fields */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
                <div>
                  <Label htmlFor="email">
                    Email <span className="text-red-500">*</span>
                  </Label>
                  <div className="relative">
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      required
                      disabled={loading || isAuthenticated}
                    />
                    <div className="h-4 mt-1"></div> {/* Spacer to match phone input */}
                  </div>
                </div>
                <div>
                  <Label htmlFor="phone">Téléphone</Label>
                  <PhoneInput
                    value={formData.phone}
                    onChange={(value) => setFormData({ ...formData, phone: value })}
                    disabled={loading}
                    placeholder="06 12 34 56 78"
                  />
                </div>
              </div>

              {/* Birth date */}
              <div>
                <Label htmlFor="birth_date">
                  Date de naissance <span className="text-red-500">*</span>
                </Label>
                <DatePicker
                  value={formData.birth_date}
                  onChange={(value) => setFormData({ ...formData, birth_date: value })}
                  disabled={loading}
                  placeholder="Sélectionner votre date de naissance"
                  maxDate={new Date(new Date().setFullYear(new Date().getFullYear() - 18))}
                  minDate={new Date(new Date().setFullYear(new Date().getFullYear() - 120))}
                />
                <p className="text-xs text-gray-500 mt-1">
                  Vous devez avoir au moins 18 ans pour faire un don
                </p>
              </div>

              {/* Address */}
              <div className="space-y-4">
                <AddressAutocomplete
                  onAddressSelect={handleAddressSelect}
                  initialPlaceId={formData.google_place_id}
                  initialAddress={{
                    address_line1: formData.address_line1,
                    postal_code: formData.postal_code,
                    city: formData.city
                  }}
                  disabled={loading}
                  required
                />
                
                {/* Optional complement field */}
                <div>
                  <Label htmlFor="address_line2">
                    Complément d'adresse (optionnel)
                  </Label>
                  <div className="relative">
                    <Input
                      id="address_line2"
                      type="text"
                      value={formData.address_line2}
                      onChange={(e) => setFormData({ ...formData, address_line2: e.target.value })}
                      disabled={loading}
                      placeholder="Bâtiment, étage, appartement..."
                      className={formData.address_line2 ? 'pr-10' : ''}
                    />
                    {formData.address_line2 && (
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, address_line2: '' })}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                        disabled={loading}
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Error message */}
              {error && (
                <div className="flex items-center p-4 bg-red-50 text-red-800 rounded-lg">
                  <AlertCircle className="h-5 w-5 mr-2 flex-shrink-0" />
                  <p className="text-sm">{error}</p>
                </div>
              )}

              {/* Legal notice */}
              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="text-xs text-gray-600">
                  Conformément à la législation française sur le financement de la vie politique, 
                  seules les personnes physiques majeures résidant en France peuvent effectuer des dons. 
                  Ces informations sont obligatoires et seront vérifiées.
                </p>
              </div>

              {/* Navigation buttons */}
              <div className="flex justify-between pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.push('/faire-un-don')}
                  disabled={loading}
                >
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Retour
                </Button>
                <Button type="submit" disabled={loading || validating}>
                  {loading || validating ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {validating ? 'Validation...' : 'Chargement...'}
                    </>
                  ) : (
                    <>
                      {isAuthenticated ? 'Continuer vers le paiement' : 'Créer un compte et payer'}
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </>
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
        </div>
      </div>
      <Footer />
    </div>
  );
}

export default function CheckoutPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
      </div>
    }>
      <CheckoutContent />
    </Suspense>
  );
}