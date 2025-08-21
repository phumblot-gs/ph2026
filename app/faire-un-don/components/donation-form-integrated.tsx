'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { 
  Heart, 
  AlertCircle, 
  Sparkles, 
  Trophy, 
  Loader2, 
  Check,
  Euro
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { MIN_DONATION_AMOUNT, MAX_DONATION_AMOUNT } from '@/lib/stripe/config';
import type { DonationExample, DonationFormData } from '@/lib/types/donations';

interface DonationFormIntegratedProps {
  examples: DonationExample[];
}

export default function DonationFormIntegrated({ examples }: DonationFormIntegratedProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
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

  const handleAmountSelect = (example: DonationExample | null) => {
    if (!example) {
      // Custom amount selected
      setSelectedId('custom');
      setFormData({
        ...formData,
        amount: 0,
        custom_amount: true,
        selected_example_id: undefined,
      });
      setCustomAmount('');
    } else {
      // Predefined amount selected
      setSelectedId(example.id);
      setFormData({
        ...formData,
        amount: example.amount,
        custom_amount: false,
        selected_example_id: example.id,
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

  const getIcon = (amount: number) => {
    if (amount >= 1000) return <Trophy className="h-5 w-5" />;
    if (amount >= 100) return <Sparkles className="h-5 w-5" />;
    return <Heart className="h-5 w-5" />;
  };
  
  const getColorClass = (amount: number) => {
    if (amount >= 1000) return 'text-yellow-600 bg-yellow-50 border-yellow-200 hover:border-yellow-400';
    if (amount >= 100) return 'text-purple-600 bg-purple-50 border-purple-200 hover:border-purple-400';
    return 'text-blue-600 bg-blue-50 border-blue-200 hover:border-blue-400';
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
      {/* Donation Examples Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {examples.map((example) => {
          const isSelected = selectedId === example.id;
          const colorClass = getColorClass(example.amount);
          
          return (
            <Card
              key={example.id}
              className={`relative cursor-pointer transition-all duration-200 ${
                isSelected 
                  ? `ring-2 ring-blue-500 ${colorClass}` 
                  : 'hover:shadow-lg'
              }`}
              onClick={() => handleAmountSelect(example)}
            >
              <CardContent className="p-6">
                {isSelected && (
                  <div className="absolute top-2 right-2">
                    <div className="bg-blue-500 text-white rounded-full p-1">
                      <Check className="h-4 w-4" />
                    </div>
                  </div>
                )}
                
                <div className="flex items-center justify-between mb-3">
                  <span className={`${isSelected ? colorClass.split(' ')[0] : 'text-gray-500'}`}>
                    {getIcon(example.amount)}
                  </span>
                  <span className="text-2xl font-bold text-gray-900">
                    {example.amount}€
                  </span>
                </div>
                
                <h3 className="font-semibold text-gray-900 mb-2">
                  {example.title}
                </h3>
                
                {example.description && (
                  <p className="text-sm text-gray-600">
                    {example.description}
                  </p>
                )}
              </CardContent>
            </Card>
          );
        })}
        
        {/* Custom amount card */}
        <Card
          className={`relative cursor-pointer transition-all duration-200 border-dashed ${
            selectedId === 'custom' 
              ? 'ring-2 ring-blue-500 bg-blue-50 border-blue-400' 
              : 'hover:shadow-lg border-gray-300'
          }`}
          onClick={() => handleAmountSelect(null)}
        >
          <CardContent className="p-6 flex flex-col items-center justify-center h-full">
            {selectedId === 'custom' && (
              <div className="absolute top-2 right-2">
                <div className="bg-blue-500 text-white rounded-full p-1">
                  <Check className="h-4 w-4" />
                </div>
              </div>
            )}
            
            <div className="text-center">
              <div className="text-3xl font-bold text-gray-900 mb-2">
                Montant libre
              </div>
              <p className="text-sm text-gray-600">
                Choisissez le montant qui vous convient
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Custom Amount Input (appears when "Montant libre" is selected) */}
      {selectedId === 'custom' && (
        <div className="max-w-md mx-auto">
          <Label htmlFor="custom-amount">Entrez votre montant (en euros)</Label>
          <div className="relative mt-2">
            <Input
              id="custom-amount"
              type="text"
              inputMode="decimal"
              placeholder="Entrez votre montant"
              value={customAmount}
              onChange={(e) => handleCustomAmountChange(e.target.value)}
              className="pr-12 text-lg"
              autoFocus
            />
            <Euro className="absolute right-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
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
        <div className={`max-w-md mx-auto flex items-center justify-center p-4 bg-gray-50 rounded-lg ${feedback.color}`}>
          {feedback.icon}
          <span className="ml-2 font-semibold text-lg">{feedback.text}</span>
        </div>
      )}

      {/* Certification */}
      <div className="max-w-2xl mx-auto">
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
      </div>

      {/* Error Message */}
      {error && (
        <div className="max-w-2xl mx-auto flex items-center p-4 bg-red-50 text-red-800 rounded-lg">
          <AlertCircle className="h-5 w-5 mr-2 flex-shrink-0" />
          <p className="text-sm">{error}</p>
        </div>
      )}

      {/* Submit Button */}
      <div className="max-w-2xl mx-auto">
        <Button
          type="submit"
          size="lg"
          className="w-full"
          disabled={loading || !formData.certification_accepted || 
                   (!formData.amount && !customAmount)}
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
      </div>
    </form>
  );
}