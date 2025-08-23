'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Heart, AlertCircle, Sparkles, Trophy, Loader2 } from 'lucide-react';
import DonationExamples from './donation-examples';
import { createClient } from '@/lib/supabase/client';
import { MIN_DONATION_AMOUNT, MAX_DONATION_AMOUNT } from '@/lib/stripe/config';
import type { DonationExample, DonationFormData } from '@/lib/types/donations';

interface DonationFormProps {
  examples: DonationExample[];
}

export default function DonationForm({ examples }: DonationFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState<DonationFormData>({
    amount: 0,
    custom_amount: false,
    certification_accepted: false,
    selected_example_id: undefined,
  });
  const [customAmount, setCustomAmount] = useState('');
  const [currentYearlyTotal, setCurrentYearlyTotal] = useState<number | null>(null);

  // Load current user's yearly donation total if authenticated
  useEffect(() => {
    async function loadYearlyTotal() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      
      if (user) {
        const { data: member } = await supabase
          .from('members')
          .select('id')
          .eq('user_id', user.id)
          .single();
        
        if (member) {
          // Call the database function to get yearly total
          const { data, error } = await supabase
            .rpc('get_member_yearly_donations', { p_member_id: member.id });
          
          if (!error && data !== null) {
            setCurrentYearlyTotal(Number(data));
          }
        }
      }
    }
    
    loadYearlyTotal();
  }, []);

  const handleAmountSelect = (amount: number, exampleId?: string) => {
    if (exampleId === 'custom' || amount === 0) {
      setFormData({
        ...formData,
        amount: 0,
        custom_amount: true,
        selected_example_id: undefined,
      });
      setCustomAmount('');
    } else {
      setFormData({
        ...formData,
        amount,
        custom_amount: false,
        selected_example_id: exampleId,
      });
      setCustomAmount('');
    }
    setError(null);
  };

  const handleCustomAmountChange = (value: string) => {
    // Only allow numbers and decimal point
    const sanitized = value.replace(/[^0-9.]/g, '');
    setCustomAmount(sanitized);
    
    const numValue = parseFloat(sanitized);
    if (!isNaN(numValue)) {
      setFormData({
        ...formData,
        amount: numValue,
        custom_amount: true,
      });
    }
  };

  const getFeedbackMessage = () => {
    const amount = formData.custom_amount ? parseFloat(customAmount) : formData.amount;
    if (!amount) return null;
    
    if (amount <= 100) {
      return { icon: <Heart className="h-5 w-5" />, text: 'Merci !', color: 'text-blue-600' };
    } else if (amount <= 1000) {
      return { icon: <Sparkles className="h-5 w-5" />, text: "C'est génial !", color: 'text-purple-600' };
    } else {
      return { icon: <Trophy className="h-5 w-5" />, text: 'Incroyable !', color: 'text-yellow-600' };
    }
  };

  const validateAmount = () => {
    const amount = formData.custom_amount ? parseFloat(customAmount) : formData.amount;
    
    if (!amount || amount < MIN_DONATION_AMOUNT) {
      setError(`Le montant minimum est de ${MIN_DONATION_AMOUNT}€`);
      return false;
    }
    
    if (amount > MAX_DONATION_AMOUNT) {
      setError(`Le montant maximum autorisé par la loi est de ${MAX_DONATION_AMOUNT}€ par an`);
      return false;
    }
    
    if (currentYearlyTotal !== null && amount + currentYearlyTotal > MAX_DONATION_AMOUNT) {
      const remaining = MAX_DONATION_AMOUNT - currentYearlyTotal;
      setError(`Vous avez déjà donné ${currentYearlyTotal}€ cette année. Le montant maximum que vous pouvez encore donner est de ${remaining}€`);
      return false;
    }
    
    if (!formData.certification_accepted) {
      setError('Vous devez certifier sur l\'honneur pour continuer');
      return false;
    }
    
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateAmount()) {
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      const amount = formData.custom_amount ? parseFloat(customAmount) : formData.amount;
      
      // Create a checkout session in the database
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      
      // Generate a unique session token
      const sessionToken = crypto.randomUUID();
      
      // Store the donation intent in a checkout session
      const { error: sessionError } = await supabase
        .from('checkout_sessions')
        .insert({
          session_token: sessionToken,
          email: user?.email || '',
          amount,
          member_data: {
            amount,
            selected_example_id: formData.selected_example_id,
          },
          status: 'pending',
          expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(), // 30 minutes
        });
      
      if (sessionError) {
        throw sessionError;
      }
      
      // Redirect to checkout step 1
      router.push(`/faire-un-don/checkout?session=${sessionToken}&amount=${amount}`);
    } catch (err) {
      console.error('Error initiating donation:', err);
      setError('Une erreur est survenue. Veuillez réessayer.');
      setLoading(false);
    }
  };

  const feedback = getFeedbackMessage();

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {/* Amount Selection */}
      <div>
        <Label className="text-lg font-semibold mb-4 block">
          Choisissez votre montant
        </Label>
        <DonationExamples 
          examples={examples} 
          onSelectAmount={handleAmountSelect}
        />
      </div>

      {/* Custom Amount Input */}
      {formData.custom_amount && (
        <div>
          <Label htmlFor="custom-amount">Montant libre (en euros)</Label>
          <div className="relative mt-2">
            <Input
              id="custom-amount"
              type="text"
              inputMode="decimal"
              placeholder="Entrez votre montant"
              value={customAmount}
              onChange={(e) => handleCustomAmountChange(e.target.value)}
              className="pr-12 text-lg"
            />
            <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500">
              €
            </span>
          </div>
          {currentYearlyTotal !== null && currentYearlyTotal > 0 && (
            <p className="text-sm text-gray-500 mt-2">
              Vous avez déjà donné {currentYearlyTotal}€ cette année. 
              Maximum restant : {MAX_DONATION_AMOUNT - currentYearlyTotal}€
            </p>
          )}
        </div>
      )}

      {/* Feedback Message */}
      {feedback && (
        <div className={`flex items-center justify-center p-4 bg-gray-50 rounded-lg ${feedback.color}`}>
          {feedback.icon}
          <span className="ml-2 font-semibold text-lg">{feedback.text}</span>
        </div>
      )}

      {/* Certification */}
      <Card className="border-blue-200 bg-blue-50">
        <CardContent className="p-6">
          <div className="flex items-start space-x-3">
            <Switch
              id="certification"
              checked={formData.certification_accepted}
              onCheckedChange={(checked) => 
                setFormData({ ...formData, certification_accepted: checked })
              }
              className="mt-1"
            />
            <div className="flex-1">
              <Label 
                htmlFor="certification" 
                className="text-sm font-medium cursor-pointer"
              >
                Je certifie sur l'honneur
              </Label>
              <p className="text-xs text-gray-600 mt-1">
                • Être une personne physique et que le règlement de mon don ne provient pas 
                d'une personne morale (société, association, collectivité...)
                <br />
                • Que le compte bancaire utilisé est un compte personnel ou un compte joint 
                de mon foyer fiscal
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Error Message */}
      {error && (
        <div className="flex items-center p-4 bg-red-50 text-red-800 rounded-lg">
          <AlertCircle className="h-5 w-5 mr-2 flex-shrink-0" />
          <p className="text-sm">{error}</p>
        </div>
      )}

      {/* Submit Button */}
      <Button
        type="submit"
        size="lg"
        className="w-full"
        disabled={loading || !formData.certification_accepted || 
                 (formData.custom_amount ? !customAmount : !formData.amount)}
      >
        {loading ? (
          <>
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            Chargement...
          </>
        ) : (
          <>
            <Heart className="mr-2 h-5 w-5" />
            Continuer vers le paiement sécurisé
          </>
        )}
      </Button>
    </form>
  );
}