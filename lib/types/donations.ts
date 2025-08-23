// Types pour le système de donations

export type DonationStatus = 'pending' | 'completed' | 'failed' | 'refunded';
export type PaymentMethod = 'card' | 'sepa' | 'bank_transfer';

export interface Donation {
  id: string;
  member_id: string;
  amount: number;
  status: DonationStatus;
  stripe_payment_intent_id?: string;
  stripe_checkout_session_id?: string;
  payment_method?: PaymentMethod;
  refund_amount?: number;
  refund_reason?: string;
  metadata?: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface AppSetting {
  id: string;
  setting_key: string;
  setting_value: string;
  description?: string;
  created_at: string;
  updated_at: string;
}

export interface DonationExample {
  id: string;
  amount: number;
  title: string;
  description?: string;
  display_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CheckoutSession {
  id: string;
  session_token: string;
  email: string;
  amount: number;
  member_data: {
    first_name: string;
    last_name: string;
    birth_date: string;
    address_line1: string;
    address_line2?: string;
    postal_code: string;
    city: string;
    country: string;
    google_place_id?: string;
    phone?: string;
  };
  status: 'pending' | 'completed' | 'expired';
  expires_at: string;
  created_at: string;
  updated_at: string;
}

export interface AdminAuditLog {
  id: string;
  admin_id: string;
  action: string;
  entity_type: string;
  entity_id?: string;
  old_values?: Record<string, any>;
  new_values?: Record<string, any>;
  metadata?: Record<string, any>;
  created_at: string;
}

// Extended Member type with donation fields
export interface MemberWithDonationInfo {
  id: string;
  user_id: string;
  email: string;
  first_name?: string;
  last_name?: string;
  phone?: string;
  birth_date?: string;
  address_line1?: string;
  address_line2?: string;
  postal_code?: string;
  city?: string;
  country?: string;
  google_place_id?: string;
  role: 'admin' | 'member';
  status: 'active' | 'suspended';
  created_at: string;
  updated_at: string;
}

// Validation types
export interface DonationValidationResult {
  can_donate: boolean;
  reason?: string;
  current_total?: number;
  yearly_limit?: number;
  remaining?: number;
  max_allowed?: number;
}

// Form types for UI
export interface DonationFormData {
  amount: number;
  custom_amount?: boolean;
  certification_accepted: boolean;
  selected_example_id?: string;
}

export interface CheckoutStep1FormData {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  birth_date: string;
  address_line1: string;
  address_line2?: string;
  postal_code: string;
  city: string;
  country: string;
  google_place_id?: string;
}

export interface CheckoutStep2FormData {
  payment_method: PaymentMethod;
  stripe_payment_method_id?: string;
}

// Statistics types for admin dashboard
export interface DonationStatistics {
  total_amount: number;
  total_donations: number;
  average_donation: number;
  monthly_total: number;
  yearly_total: number;
  top_donors: Array<{
    member_id: string;
    member_name: string;
    total_amount: number;
    donation_count: number;
  }>;
  recent_donations: Array<Donation & {
    member_name: string;
    member_email: string;
  }>;
}

// Google Places API types
export interface GooglePlaceResult {
  place_id: string;
  formatted_address: string;
  address_components: Array<{
    long_name: string;
    short_name: string;
    types: string[];
  }>;
  geometry: {
    location: {
      lat: number;
      lng: number;
    };
  };
}

export interface GooglePlacePrediction {
  place_id: string;
  description: string;
  structured_formatting: {
    main_text: string;
    secondary_text: string;
  };
}

// Stripe types
export interface StripeCheckoutSessionData {
  sessionId: string;
  url: string;
}

export interface StripePaymentIntentData {
  paymentIntentId: string;
  clientSecret: string;
  amount: number;
  status: string;
}

// Email template data
export interface DonationEmailData {
  donor_name: string;
  donor_email: string;
  amount: number;
  date: string;
  payment_method: string;
  receipt_url?: string;
}

export interface AdminNotificationEmailData {
  donor_name: string;
  donor_email: string;
  amount: number;
  date: string;
  donation_id: string;
}