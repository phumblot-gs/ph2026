'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle, Heart, Download, Mail, ArrowRight, Loader2, Sparkles } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import Confetti from 'react-confetti';
import { Footer } from '@/components/footer';

function SuccessContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [donation, setDonation] = useState<any>(null);
  const [showConfetti, setShowConfetti] = useState(true);
  
  const sessionId = searchParams.get('session_id');
  const donationId = searchParams.get('donation_id');

  useEffect(() => {
    if (donationId) {
      loadDonation();
    }
    
    // Stop confetti after 5 seconds
    const timer = setTimeout(() => setShowConfetti(false), 5000);
    return () => clearTimeout(timer);
  }, [donationId]);

  async function loadDonation() {
    const supabase = createClient();
    
    const { data } = await supabase
      .from('donations')
      .select(`
        *,
        members (
          first_name,
          last_name,
          email
        )
      `)
      .eq('id', donationId)
      .single();
    
    if (data) {
      setDonation(data);
    }
  }

  const getThankYouMessage = (amount: number) => {
    if (amount >= 1000) {
      return {
        title: "Vous êtes incroyable !",
        message: "Votre générosité exceptionnelle nous permet de porter nos idées encore plus loin.",
        icon: <Sparkles className="h-16 w-16 text-yellow-500" />
      };
    } else if (amount >= 100) {
      return {
        title: "C'est génial !",
        message: "Votre soutien significatif nous aide à organiser des actions concrètes sur le terrain.",
        icon: <Heart className="h-16 w-16 text-purple-500" />
      };
    } else {
      return {
        title: "Merci beaucoup !",
        message: "Chaque contribution compte et nous rapproche de nos objectifs.",
        icon: <Heart className="h-16 w-16 text-red-500" />
      };
    }
  };

  const thankYou = donation ? getThankYouMessage(donation.amount) : null;

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-green-50 to-white relative">
      {/* Confetti animation */}
      {showConfetti && typeof window !== 'undefined' && (
        <Confetti
          width={window.innerWidth}
          height={window.innerHeight}
          recycle={false}
          numberOfPieces={200}
          gravity={0.1}
        />
      )}

      <div className="flex-1">
        <div className="max-w-3xl mx-auto px-4 py-12">
        {/* Success icon and message */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-green-100 rounded-full mb-4">
            <CheckCircle className="h-12 w-12 text-green-600" />
          </div>
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            Paiement réussi !
          </h1>
          <p className="text-xl text-gray-600">
            Votre don a été enregistré avec succès
          </p>
        </div>

        {/* Thank you card */}
        {thankYou && (
          <Card className="mb-8 border-2 border-blue-200 bg-gradient-to-r from-blue-50 to-purple-50">
            <CardContent className="pt-8 text-center">
              <div className="flex justify-center mb-4">
                {thankYou.icon}
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-3">
                {thankYou.title}
              </h2>
              <p className="text-gray-600 max-w-md mx-auto">
                {thankYou.message}
              </p>
            </CardContent>
          </Card>
        )}

        {/* Donation details */}
        {donation && (
          <Card className="mb-8">
            <CardHeader>
              <CardTitle>Détails de votre don</CardTitle>
              <CardDescription>
                Référence : {donation.id.substring(0, 8).toUpperCase()}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between items-center py-2 border-b">
                <span className="text-gray-600">Montant du don</span>
                <span className="text-2xl font-bold text-gray-900">{donation.amount}€</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b">
                <span className="text-gray-600">Déduction fiscale (66%)</span>
                <span className="text-lg font-semibold text-green-600">
                  -{Math.round(donation.amount * 0.66)}€
                </span>
              </div>
              <div className="flex justify-between items-center py-2">
                <span className="text-gray-600">Coût réel après déduction</span>
                <span className="text-xl font-bold">{Math.round(donation.amount * 0.34)}€</span>
              </div>
              <div className="pt-4">
                <p className="text-sm text-gray-600">
                  Date : {new Date().toLocaleDateString('fr-FR', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Next steps */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Prochaines étapes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-start">
              <Mail className="h-5 w-5 text-blue-600 mt-0.5 mr-3 flex-shrink-0" />
              <div>
                <h3 className="font-semibold">Email de confirmation</h3>
                <p className="text-sm text-gray-600 mt-1">
                  Vous allez recevoir un email de confirmation avec tous les détails de votre don.
                </p>
              </div>
            </div>
            <div className="flex items-start">
              <Download className="h-5 w-5 text-blue-600 mt-0.5 mr-3 flex-shrink-0" />
              <div>
                <h3 className="font-semibold">Reçu fiscal</h3>
                <p className="text-sm text-gray-600 mt-1">
                  Votre reçu fiscal sera disponible dans votre espace personnel et envoyé par email 
                  en début d'année prochaine pour votre déclaration d'impôts.
                </p>
              </div>
            </div>
            <div className="flex items-start">
              <Heart className="h-5 w-5 text-blue-600 mt-0.5 mr-3 flex-shrink-0" />
              <div>
                <h3 className="font-semibold">Restez informé</h3>
                <p className="text-sm text-gray-600 mt-1">
                  Nous vous tiendrons informé de l'utilisation de votre don et de l'avancement 
                  de notre campagne.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Action buttons */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link href="/dashboard">
            <Button size="lg" className="w-full sm:w-auto">
              Aller au tableau de bord
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
          <Link href="/">
            <Button variant="outline" size="lg" className="w-full sm:w-auto">
              Retour à l'accueil
            </Button>
          </Link>
        </div>

        {/* Share section */}
        <div className="mt-12 text-center">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Partagez votre soutien
          </h3>
          <div className="flex justify-center gap-4">
            <Button
              variant="outline"
              onClick={() => {
                const text = `Je viens de soutenir ${process.env.NEXT_PUBLIC_PARTY_NAME} ! Rejoignez le mouvement pour transformer Paris 🚀`;
                window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`, '_blank');
              }}
            >
              Partager sur X
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                const url = window.location.origin;
                navigator.clipboard.writeText(url);
                alert('Lien copié !');
              }}
            >
              Copier le lien
            </Button>
          </div>
        </div>
        </div>
      </div>
      <Footer />
    </div>
  );
}

export default function SuccessPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
      </div>
    }>
      <SuccessContent />
    </Suspense>
  );
}