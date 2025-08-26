'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertCircle, LogOut } from 'lucide-react';

export default function SuspendedPage() {
  const router = useRouter();

  useEffect(() => {
    // Définir le status code 403 via un meta tag (côté client)
    if (typeof window !== 'undefined') {
      document.title = '403 - Accès interdit | ' + process.env.NEXT_PUBLIC_PARTY_NAME;
    }
  }, []);

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <Card className="max-w-md w-full">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 h-20 w-20 rounded-full bg-red-100 flex items-center justify-center">
            <AlertCircle className="h-10 w-10 text-red-600" />
          </div>
          <CardTitle className="text-2xl font-bold text-gray-900">
            403 - Accès interdit
          </CardTitle>
          <CardDescription className="text-base mt-2">
            Votre compte a été suspendu
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-center text-gray-600">
            Si vous pensez qu'il s'agit d'une erreur, veuillez contacter un administrateur.
          </p>
          
          <div className="pt-4 space-y-3">
            <Button 
              onClick={handleSignOut}
              variant="default"
              className="w-full"
            >
              <LogOut className="mr-2 h-4 w-4" />
              Se connecter avec un autre compte
            </Button>
            
            <Button 
              onClick={() => router.push('/')}
              variant="outline"
              className="w-full"
            >
              Retour à l'accueil
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}