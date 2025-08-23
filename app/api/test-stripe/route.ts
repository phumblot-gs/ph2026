import { NextRequest, NextResponse } from 'next/server';
import { stripe, isStripeConfigured } from '@/lib/stripe/config';

export async function POST(request: NextRequest) {
  try {
    // Check if Stripe is configured
    if (!isStripeConfigured() || !stripe) {
      return NextResponse.json({
        success: false,
        error: 'Stripe n\'est pas configuré. Veuillez ajouter les clés API dans .env.local'
      });
    }

    const { amount } = await request.json();
    
    if (!amount || amount < 1) {
      return NextResponse.json({
        success: false,
        error: 'Montant invalide'
      });
    }

    // Create a test checkout session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      line_items: [
        {
          price_data: {
            currency: 'eur',
            product_data: {
              name: 'Test de donation',
              description: 'Ceci est un test en mode développement',
            },
            unit_amount: Math.round(amount * 100), // Convert to cents
          },
          quantity: 1,
        },
      ],
      success_url: `${process.env.NEXT_PUBLIC_SITE_URL}/test-apis?success=true&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.NEXT_PUBLIC_SITE_URL}/test-apis?canceled=true`,
    });

    return NextResponse.json({
      success: true,
      sessionId: session.id,
      url: session.url,
      message: 'Session de test créée avec succès. Vous pouvez utiliser la carte 4242 4242 4242 4242 pour tester.'
    });
  } catch (error: any) {
    console.error('Stripe test error:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Erreur lors de la création de la session de test'
    });
  }
}