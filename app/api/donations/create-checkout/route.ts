import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { stripe, isStripeConfigured } from '@/lib/stripe/config';

export async function POST(request: NextRequest) {
  try {
    // Check if Stripe is configured
    if (!isStripeConfigured() || !stripe) {
      return NextResponse.json({
        success: false,
        error: 'Le système de paiement n\'est pas configuré'
      }, { status: 500 });
    }

    // Get request data
    const { amount, member_id, session_token, payment_method, member_data } = await request.json();
    
    // Validate input
    if (!amount || amount < 1 || amount > 7500) {
      return NextResponse.json({
        success: false,
        error: 'Montant invalide'
      }, { status: 400 });
    }

    // Check authentication
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json({
        success: false,
        error: 'Non authentifié'
      }, { status: 401 });
    }

    // Verify member exists and matches authenticated user
    const { data: member } = await supabase
      .from('members')
      .select('*')
      .eq('id', member_id)
      .eq('user_id', user.id)
      .single();

    if (!member) {
      return NextResponse.json({
        success: false,
        error: 'Membre non trouvé'
      }, { status: 404 });
    }

    // Check yearly donation limit
    const { data: validationResult } = await supabase
      .rpc('can_member_donate', { 
        p_member_id: member_id, 
        p_amount: amount 
      });

    if (!validationResult?.can_donate) {
      return NextResponse.json({
        success: false,
        error: validationResult?.reason || 'Vous avez atteint le plafond annuel de dons'
      }, { status: 400 });
    }

    // Create initial donation record
    const { data: donation, error: donationError } = await supabase
      .from('donations')
      .insert({
        member_id: member_id,
        amount: amount,
        status: 'pending',
        payment_method: payment_method || 'card',
        metadata: {
          session_token,
          member_name: `${member_data.first_name} ${member_data.last_name}`,
        }
      })
      .select()
      .single();

    if (donationError) {
      console.error('Error creating donation:', donationError);
      return NextResponse.json({
        success: false,
        error: 'Erreur lors de la création du don'
      }, { status: 500 });
    }

    // Create Stripe checkout session
    const checkoutSession = await stripe.checkout.sessions.create({
      payment_method_types: payment_method === 'sepa' ? ['sepa_debit'] : ['card'],
      mode: 'payment',
      customer_email: member.email,
      client_reference_id: donation.id,
      line_items: [
        {
          price_data: {
            currency: 'eur',
            product_data: {
              name: `Don à ${process.env.NEXT_PUBLIC_PARTY_NAME || 'la campagne'}`,
              description: `Soutien à la campagne - ${new Date().toLocaleDateString('fr-FR')}`,
              metadata: {
                donation_id: donation.id,
                member_id: member_id,
              }
            },
            unit_amount: Math.round(amount * 100), // Convert to cents
          },
          quantity: 1,
        },
      ],
      metadata: {
        donation_id: donation.id,
        member_id: member_id,
        session_token: session_token,
        type: 'donation',
      },
      success_url: `${process.env.NEXT_PUBLIC_SITE_URL}/faire-un-don/succes?session_id={CHECKOUT_SESSION_ID}&donation_id=${donation.id}`,
      cancel_url: `${process.env.NEXT_PUBLIC_SITE_URL}/faire-un-don/echec?donation_id=${donation.id}`,
      locale: 'fr',
      // Enable adjustable quantity for testing purposes
      allow_promotion_codes: false,
      // Billing address collection for compliance
      billing_address_collection: 'required',
      // Customer creation for receipts
      customer_creation: 'if_required',
      // Set payment intent data
      payment_intent_data: {
        metadata: {
          donation_id: donation.id,
          member_id: member_id,
        },
      },
    });

    // Update donation with Stripe session ID
    await supabase
      .from('donations')
      .update({
        stripe_checkout_session_id: checkoutSession.id,
        updated_at: new Date().toISOString(),
      })
      .eq('id', donation.id);

    // Update checkout session status
    await supabase
      .from('checkout_sessions')
      .update({
        status: 'processing',
        stripe_checkout_session_id: checkoutSession.id,
        updated_at: new Date().toISOString(),
      })
      .eq('session_token', session_token);

    return NextResponse.json({
      success: true,
      sessionId: checkoutSession.id,
      url: checkoutSession.url,
      donation_id: donation.id,
    });
  } catch (error: any) {
    console.error('Stripe checkout error:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Erreur lors de la création de la session de paiement'
    }, { status: 500 });
  }
}