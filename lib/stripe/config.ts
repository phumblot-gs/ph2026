import Stripe from 'stripe';

// Check if Stripe is configured
export const isStripeConfigured = () => {
  return !!(
    process.env.STRIPE_SECRET_KEY && 
    process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY &&
    process.env.STRIPE_SECRET_KEY !== 'sk_test_YOUR_STRIPE_SECRET_KEY'
  );
};

// Server-side Stripe configuration
export const stripe = isStripeConfigured() 
  ? new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: '2025-07-30.basil',
      typescript: true,
    })
  : null;

// Client-side Stripe configuration
export const getStripePublicKey = () => {
  const key = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
  if (!key || key === 'pk_test_YOUR_STRIPE_PUBLISHABLE_KEY') {
    console.warn('Stripe publishable key not configured. Using test mode.');
    return null;
  }
  return key;
};

// Stripe webhook secret
export const getStripeWebhookSecret = () => {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    throw new Error('Stripe webhook secret not configured');
  }
  return secret;
};

// Currency configuration
export const CURRENCY = 'eur';
export const MIN_DONATION_AMOUNT = 1; // 1€ minimum
export const MAX_DONATION_AMOUNT = 7500; // Legal limit in France

// Payment methods configuration
export const PAYMENT_METHODS = {
  card: {
    enabled: true,
    label: 'Carte bancaire',
    description: 'Paiement immédiat par carte',
  },
  sepa: {
    enabled: true,
    label: 'Prélèvement SEPA',
    description: 'Prélèvement bancaire (3-5 jours)',
  },
};

// Stripe checkout session configuration
export const getCheckoutSessionConfig = (amount: number, email: string, sessionToken: string) => ({
  payment_method_types: ['card', 'sepa_debit'],
  mode: 'payment' as const,
  customer_email: email,
  line_items: [
    {
      price_data: {
        currency: CURRENCY,
        product_data: {
          name: 'Don à la campagne',
          description: `Soutien à la campagne ${process.env.NEXT_PUBLIC_PARTY_NAME}`,
        },
        unit_amount: Math.round(amount * 100), // Convert to cents
      },
      quantity: 1,
    },
  ],
  metadata: {
    session_token: sessionToken,
    type: 'donation',
  },
  success_url: `${process.env.NEXT_PUBLIC_SITE_URL}/faire-un-don/succes?session_id={CHECKOUT_SESSION_ID}`,
  cancel_url: `${process.env.NEXT_PUBLIC_SITE_URL}/faire-un-don/echec`,
  locale: 'fr',
});