-- ============================================
-- Script SQL COMPLET pour PH2026
-- Toutes les tables pour le back-office
-- ============================================

-- 1. TYPES ENUM
-- ============================================
-- Type pour les rôles utilisateur
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
        CREATE TYPE user_role AS ENUM ('pending', 'member', 'admin', 'super_admin');
    END IF;
END$$;

-- Type pour les statuts de donation
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'donation_status') THEN
        CREATE TYPE donation_status AS ENUM ('pending', 'completed', 'failed', 'refunded');
    END IF;
END$$;

-- Type pour les types d'événements
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'event_type') THEN
        CREATE TYPE event_type AS ENUM ('meeting', 'rally', 'door_to_door', 'phone_banking', 'fundraiser', 'other');
    END IF;
END$$;

-- Type pour les types de contact
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'contact_type') THEN
        CREATE TYPE contact_type AS ENUM ('supporter', 'volunteer', 'donor', 'press', 'partner', 'other');
    END IF;
END$$;

-- 2. TABLE MEMBERS (déjà existante, on la garde)
-- ============================================
CREATE TABLE IF NOT EXISTS public.members (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  first_name TEXT NOT NULL DEFAULT '',
  last_name TEXT NOT NULL DEFAULT '',
  phone TEXT DEFAULT '',
  photo_url TEXT,
  bio TEXT,
  role user_role NOT NULL DEFAULT 'pending',
  groups TEXT[] DEFAULT '{}',
  skills TEXT[] DEFAULT '{}', -- Compétences du membre
  availability JSONB DEFAULT '{}', -- Disponibilités
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index pour les performances
CREATE INDEX IF NOT EXISTS idx_members_user_id ON public.members(user_id);
CREATE INDEX IF NOT EXISTS idx_members_email ON public.members(email);
CREATE INDEX IF NOT EXISTS idx_members_role ON public.members(role);

-- 3. TABLE CONTACTS (CRM)
-- ============================================
CREATE TABLE IF NOT EXISTS public.contacts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  type contact_type NOT NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  address TEXT,
  postal_code TEXT,
  city TEXT DEFAULT 'Paris',
  arrondissement INTEGER, -- 1 à 20 pour Paris
  notes TEXT,
  tags TEXT[] DEFAULT '{}',
  assigned_to UUID REFERENCES public.members(id),
  last_contact_date DATE,
  created_by UUID REFERENCES public.members(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_contacts_type ON public.contacts(type);
CREATE INDEX IF NOT EXISTS idx_contacts_arrondissement ON public.contacts(arrondissement);
CREATE INDEX IF NOT EXISTS idx_contacts_assigned_to ON public.contacts(assigned_to);

-- 4. TABLE DONATIONS
-- ============================================
CREATE TABLE IF NOT EXISTS public.donations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  contact_id UUID REFERENCES public.contacts(id),
  member_id UUID REFERENCES public.members(id), -- Si c'est un membre qui donne
  amount DECIMAL(10, 2) NOT NULL,
  status donation_status DEFAULT 'pending',
  payment_method TEXT, -- CB, virement, chèque, espèces
  payment_reference TEXT, -- Référence de transaction
  receipt_number TEXT, -- Numéro de reçu fiscal
  notes TEXT,
  donated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_donations_contact_id ON public.donations(contact_id);
CREATE INDEX IF NOT EXISTS idx_donations_status ON public.donations(status);
CREATE INDEX IF NOT EXISTS idx_donations_donated_at ON public.donations(donated_at);

-- 5. TABLE EVENTS
-- ============================================
CREATE TABLE IF NOT EXISTS public.events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  type event_type NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  location TEXT,
  address TEXT,
  postal_code TEXT,
  arrondissement INTEGER,
  start_date TIMESTAMPTZ NOT NULL,
  end_date TIMESTAMPTZ,
  max_participants INTEGER,
  is_public BOOLEAN DEFAULT false,
  registration_required BOOLEAN DEFAULT false,
  created_by UUID REFERENCES public.members(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_events_type ON public.events(type);
CREATE INDEX IF NOT EXISTS idx_events_start_date ON public.events(start_date);
CREATE INDEX IF NOT EXISTS idx_events_arrondissement ON public.events(arrondissement);

-- 6. TABLE EVENT_PARTICIPANTS
-- ============================================
CREATE TABLE IF NOT EXISTS public.event_participants (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID REFERENCES public.events(id) ON DELETE CASCADE,
  member_id UUID REFERENCES public.members(id),
  contact_id UUID REFERENCES public.contacts(id),
  status TEXT DEFAULT 'registered', -- registered, attended, cancelled, no-show
  notes TEXT,
  registered_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(event_id, member_id),
  UNIQUE(event_id, contact_id)
);

CREATE INDEX IF NOT EXISTS idx_event_participants_event_id ON public.event_participants(event_id);
CREATE INDEX IF NOT EXISTS idx_event_participants_member_id ON public.event_participants(member_id);

-- 7. TABLE FIELD_ACTIONS (Actions terrain)
-- ============================================
CREATE TABLE IF NOT EXISTS public.field_actions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  type TEXT NOT NULL, -- tractage, collage, porte-à-porte, etc.
  location TEXT,
  arrondissement INTEGER,
  bureau_vote TEXT, -- Bureau de vote ciblé
  date DATE NOT NULL,
  start_time TIME,
  end_time TIME,
  participants UUID[] DEFAULT '{}', -- Array des member_id
  leader_id UUID REFERENCES public.members(id),
  notes TEXT,
  results JSONB DEFAULT '{}', -- Statistiques de l'action
  created_by UUID REFERENCES public.members(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_field_actions_date ON public.field_actions(date);
CREATE INDEX IF NOT EXISTS idx_field_actions_arrondissement ON public.field_actions(arrondissement);
CREATE INDEX IF NOT EXISTS idx_field_actions_leader_id ON public.field_actions(leader_id);

-- 8. TABLE VOTING_BUREAUS (Bureaux de vote)
-- ============================================
CREATE TABLE IF NOT EXISTS public.voting_bureaus (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT UNIQUE NOT NULL, -- Code officiel du bureau
  name TEXT NOT NULL,
  address TEXT NOT NULL,
  arrondissement INTEGER NOT NULL,
  circonscription INTEGER,
  registered_voters INTEGER, -- Nombre d'inscrits
  coordinates POINT, -- Coordonnées GPS
  responsible_member_id UUID REFERENCES public.members(id),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_voting_bureaus_arrondissement ON public.voting_bureaus(arrondissement);
CREATE INDEX IF NOT EXISTS idx_voting_bureaus_responsible_member_id ON public.voting_bureaus(responsible_member_id);

-- 9. TABLE WHATSAPP_GROUPS
-- ============================================
CREATE TABLE IF NOT EXISTS public.whatsapp_groups (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  invite_link TEXT,
  arrondissement INTEGER,
  type TEXT, -- general, local, thematic, coordination
  admin_id UUID REFERENCES public.members(id),
  member_count INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_groups_arrondissement ON public.whatsapp_groups(arrondissement);
CREATE INDEX IF NOT EXISTS idx_whatsapp_groups_admin_id ON public.whatsapp_groups(admin_id);

-- 10. TABLE MEDIA_MONITORING (Veille médias)
-- ============================================
CREATE TABLE IF NOT EXISTS public.media_monitoring (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  source TEXT NOT NULL, -- Nom du média
  url TEXT,
  title TEXT NOT NULL,
  content TEXT,
  author TEXT,
  published_at TIMESTAMPTZ,
  sentiment TEXT, -- positive, neutral, negative
  tags TEXT[] DEFAULT '{}',
  competitor_mentioned TEXT[], -- Liste des concurrents mentionnés
  notes TEXT,
  archived BOOLEAN DEFAULT false,
  created_by UUID REFERENCES public.members(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_media_monitoring_published_at ON public.media_monitoring(published_at);
CREATE INDEX IF NOT EXISTS idx_media_monitoring_sentiment ON public.media_monitoring(sentiment);

-- 11. TABLE BLOG_POSTS (Articles du site)
-- ============================================
CREATE TABLE IF NOT EXISTS public.blog_posts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  excerpt TEXT,
  content TEXT NOT NULL,
  featured_image TEXT,
  category TEXT,
  tags TEXT[] DEFAULT '{}',
  author_id UUID REFERENCES public.members(id),
  published BOOLEAN DEFAULT false,
  published_at TIMESTAMPTZ,
  views INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_blog_posts_slug ON public.blog_posts(slug);
CREATE INDEX IF NOT EXISTS idx_blog_posts_published ON public.blog_posts(published);
CREATE INDEX IF NOT EXISTS idx_blog_posts_published_at ON public.blog_posts(published_at);

-- 12. TABLE PROGRAM_ITEMS (Éléments du programme)
-- ============================================
CREATE TABLE IF NOT EXISTS public.program_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  category TEXT NOT NULL, -- Transport, Logement, Sécurité, etc.
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  details TEXT,
  priority INTEGER DEFAULT 0, -- Ordre d'affichage
  icon TEXT, -- Nom de l'icône
  published BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_program_items_category ON public.program_items(category);
CREATE INDEX IF NOT EXISTS idx_program_items_published ON public.program_items(published);

-- 13. FONCTIONS UTILITAIRES
-- ============================================
-- Fonction pour update automatique du champ updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 14. TRIGGERS POUR updated_at
-- ============================================
-- Créer les triggers pour toutes les tables avec updated_at
DO $$ 
DECLARE
  t TEXT;
BEGIN
  FOR t IN 
    SELECT table_name 
    FROM information_schema.columns 
    WHERE column_name = 'updated_at' 
    AND table_schema = 'public'
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS update_%s_updated_at ON public.%s', t, t);
    EXECUTE format('CREATE TRIGGER update_%s_updated_at BEFORE UPDATE ON public.%s FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()', t, t);
  END LOOP;
END $$;

-- 15. ROW LEVEL SECURITY (RLS)
-- ============================================
-- Activer RLS sur toutes les tables
ALTER TABLE public.members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.donations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.field_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.voting_bureaus ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.media_monitoring ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blog_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.program_items ENABLE ROW LEVEL SECURITY;

-- 16. POLITIQUES RLS DE BASE
-- ============================================
-- Politique pour members
CREATE POLICY "Members can view their own profile" ON public.members
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all members" ON public.members
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.members 
      WHERE user_id = auth.uid() 
      AND role IN ('admin', 'super_admin')
    )
  );

-- Politique pour contacts (exemple)
CREATE POLICY "Members can view contacts" ON public.contacts
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.members 
      WHERE user_id = auth.uid() 
      AND role IN ('member', 'admin', 'super_admin')
    )
  );

-- 17. FONCTION handle_new_user (mise à jour)
-- ============================================
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS trigger AS $$
DECLARE
  full_name_val TEXT;
  first_name_val TEXT;
  last_name_val TEXT;
  avatar_url_val TEXT;
BEGIN
  -- Récupérer les métadonnées de l'utilisateur
  full_name_val := COALESCE(new.raw_user_meta_data->>'full_name', '');
  avatar_url_val := COALESCE(
    new.raw_user_meta_data->>'avatar_url',
    new.raw_user_meta_data->>'picture',
    ''
  );
  
  -- Gérer le nom complet
  IF full_name_val != '' THEN
    first_name_val := SPLIT_PART(full_name_val, ' ', 1);
    last_name_val := SUBSTRING(full_name_val FROM LENGTH(first_name_val) + 2);
  ELSE
    first_name_val := COALESCE(new.raw_user_meta_data->>'first_name', '');
    last_name_val := COALESCE(new.raw_user_meta_data->>'last_name', '');
  END IF;

  -- Insérer le nouveau membre
  INSERT INTO public.members (
    user_id, 
    email, 
    first_name, 
    last_name, 
    phone, 
    photo_url,
    role
  ) VALUES (
    new.id,
    new.email,
    first_name_val,
    last_name_val,
    COALESCE(new.raw_user_meta_data->>'phone', ''),
    avatar_url_val,
    'pending'
  )
  ON CONFLICT (email) 
  DO UPDATE SET
    photo_url = COALESCE(EXCLUDED.photo_url, members.photo_url),
    updated_at = NOW();
    
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 18. TRIGGER POUR NOUVEAUX UTILISATEURS
-- ============================================
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 19. DONNÉES DE TEST
-- ============================================
-- Créer quelques catégories de programme
INSERT INTO public.program_items (category, title, description, priority) VALUES
  ('Transport', 'Gratuité des transports en commun pour les jeunes', 'Mise en place de la gratuité totale des transports en commun pour les moins de 25 ans.', 1),
  ('Logement', '30% de logements sociaux dans chaque arrondissement', 'Objectif de 30% minimum de logements sociaux dans tous les arrondissements parisiens.', 1),
  ('Environnement', 'Paris 100% cyclable', 'Création d''un réseau cyclable sécurisé couvrant 100% de la capitale.', 2),
  ('Sécurité', 'Police municipale de proximité', 'Création d''une police municipale présente dans chaque quartier.', 3)
ON CONFLICT DO NOTHING;

-- Message de fin
SELECT 'Full schema created successfully!' as message;