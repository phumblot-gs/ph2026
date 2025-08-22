import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { stripe } from '@/lib/stripe/config';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  const body = await request.text();
  const signature = request.headers.get('stripe-signature');

  if (!signature) {
    return NextResponse.json(
      { error: 'No signature provided' },
      { status: 400 }
    );
  }

  if (!stripe) {
    console.error('Stripe not configured');
    return NextResponse.json(
      { error: 'Stripe not configured' },
      { status: 500 }
    );
  }

  let event: Stripe.Event;

  try {
    // Verify webhook signature
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!webhookSecret) {
      console.error('Webhook secret not configured');
      return NextResponse.json(
        { error: 'Webhook secret not configured' },
        { status: 500 }
      );
    }

    event = stripe.webhooks.constructEvent(
      body,
      signature,
      webhookSecret
    );
  } catch (err: any) {
    console.error(`Webhook signature verification failed:`, err.message);
    return NextResponse.json(
      { error: `Webhook Error: ${err.message}` },
      { status: 400 }
    );
  }

  // Handle the event
  try {
    const supabase = await createClient();
    
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        console.log('✅ Checkout session completed:', session.id);
        
        // Update donation status in database
        if (session.metadata?.session_token) {
          const { error } = await supabase
            .from('checkout_sessions')
            .update({ 
              status: 'completed',
              stripe_checkout_session_id: session.id,
              updated_at: new Date().toISOString()
            })
            .eq('session_token', session.metadata.session_token);
            
          if (error) {
            console.error('Error updating checkout session:', error);
          }
        }
        
        // Create or update donation record
        if (session.customer_email && session.amount_total) {
          // Find member by email
          const { data: member } = await supabase
            .from('members')
            .select('id')
            .eq('email', session.customer_email)
            .single();
            
          if (member) {
            const { error } = await supabase
              .from('donations')
              .insert({
                member_id: member.id,
                amount: session.amount_total / 100, // Convert from cents
                status: 'completed',
                stripe_payment_intent_id: session.payment_intent as string,
                stripe_checkout_session_id: session.id,
                payment_method: session.payment_method_types?.[0] || 'card',
                metadata: {
                  customer_email: session.customer_email,
                  session_id: session.id
                }
              });
              
            if (error) {
              console.error('Error creating donation record:', error);
            } else {
              console.log('✅ Donation record created');
            }
          }
        }
        break;
      }
      
      case 'payment_intent.succeeded': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        console.log('✅ Payment succeeded:', paymentIntent.id);
        
        // Update donation if exists
        const { error } = await supabase
          .from('donations')
          .update({ 
            status: 'completed',
            updated_at: new Date().toISOString()
          })
          .eq('stripe_payment_intent_id', paymentIntent.id);
          
        if (error) {
          console.error('Error updating donation:', error);
        }
        break;
      }
      
      case 'payment_intent.payment_failed': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        console.log('❌ Payment failed:', paymentIntent.id);
        
        // Update donation status
        const { error } = await supabase
          .from('donations')
          .update({ 
            status: 'failed',
            updated_at: new Date().toISOString()
          })
          .eq('stripe_payment_intent_id', paymentIntent.id);
          
        if (error) {
          console.error('Error updating failed donation:', error);
        }
        break;
      }
      
      default:
        console.log(`Unhandled event type: ${event.type}`);
    }
    
    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Error processing webhook:', error);
    return NextResponse.json(
      { error: 'Error processing webhook' },
      { status: 500 }
    );
  }
}