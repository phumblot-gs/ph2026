export type UserRole = 'super_admin' | 'admin' | 'direction' | 'communication' | 'finance' | 'expert' | 'member'
export type ActionType = 'tractage' | 'porte_a_porte' | 'reunion' | 'stand' | 'autre'
export type EngagementLevel = 'sympathisant' | 'militant' | 'donateur' | 'benevole_actif'

export interface Group {
  id: string
  name: string
  description?: string
  created_at: string
  updated_at: string
}

export interface Member {
  id: string
  user_id?: string
  email: string
  first_name: string
  last_name: string
  phone?: string
  photo_url?: string
  role: UserRole
  expertise?: string
  availability?: string
  is_active: boolean
  created_at: string
  updated_at: string
  groups?: Group[]
}

export interface Contact {
  id: string
  email?: string
  first_name?: string
  last_name?: string
  phone?: string
  address?: string
  postal_code?: string
  arrondissement?: number
  engagement_level: EngagementLevel
  notes?: string
  tags?: string[]
  created_by?: string
  created_at: string
  updated_at: string
}

export interface Donation {
  id: string
  contact_id: string
  amount: number
  date: string
  payment_method?: string
  receipt_number?: string
  notes?: string
  created_at: string
  contact?: Contact
}

export interface PollingStation {
  id: string
  code: string
  name?: string
  address?: string
  arrondissement: number
  latitude?: number
  longitude?: number
  geojson?: any
  created_at: string
}

export interface FieldAction {
  id: string
  title: string
  type: ActionType
  date: string
  time?: string
  duration_minutes?: number
  polling_station_id?: string
  address?: string
  description?: string
  estimated_contacts?: number
  materials_used?: string
  created_by?: string
  created_at: string
  updated_at: string
  polling_station?: PollingStation
  participants?: Member[]
}

export interface Communication {
  id: string
  title?: string
  message: string
  whatsapp_groups?: string[]
  scheduled_at?: string
  sent_at?: string
  sent_by?: string
  recipient_count?: number
  created_at: string
}

export interface MediaMonitoring {
  id: string
  source: string
  url?: string
  title?: string
  content?: string
  candidate_mentioned?: string
  sentiment?: string
  keywords?: string[]
  published_at?: string
  created_at: string
}

export interface NewsletterSubscription {
  id: string
  email: string
  first_name?: string
  postal_code?: string
  subscribed_at: string
  unsubscribed_at?: string
  is_active: boolean
}