'use client';

import { loadStripe, Stripe } from '@stripe/stripe-js';
import { getStripePublicKey } from './config';

let stripePromise: Promise<Stripe | null> | null = null;

export const getStripe = () => {
  const key = getStripePublicKey();
  if (!key) {
    console.warn('Stripe not configured. Payment processing disabled.');
    return Promise.resolve(null);
  }
  
  if (!stripePromise) {
    stripePromise = loadStripe(key);
  }
  return stripePromise;
};

export const redirectToCheckout = async (sessionId: string) => {
  const stripe = await getStripe();
  if (!stripe) {
    throw new Error('Stripe not loaded');
  }
  
  const { error } = await stripe.redirectToCheckout({ sessionId });
  
  if (error) {
    throw error;
  }
};