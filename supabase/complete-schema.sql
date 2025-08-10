-- ============================================
-- Script SQL complet pour environnement TEST
-- À exécuter dans Supabase ph2026-test
-- ============================================

-- 1. CRÉATION DU TYPE ENUM POUR LES RÔLES
-- ============================================
-- Créer le type seulement s'il n'existe pas déjà
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
        CREATE TYPE user_role AS ENUM ('pending', 'member', 'admin', 'super_admin');
    END IF;
END$$;

-- 2. CRÉATION DE LA TABLE MEMBERS
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
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index pour les performances
CREATE INDEX idx_members_user_id ON public.members(user_id);
CREATE INDEX idx_members_email ON public.members(email);
CREATE INDEX idx_members_role ON public.members(role);

-- 3. FONCTION POUR GÉRER LES NOUVEAUX UTILISATEURS
-- ============================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
  full_name TEXT;
  first_name_val TEXT;
  last_name_val TEXT;
  avatar_url_val TEXT;
BEGIN
  -- Récupérer les données depuis les métadonnées de l'utilisateur
  full_name := new.raw_user_meta_data->>'full_name';
  avatar_url_val := new.raw_user_meta_data->>'avatar_url';
  
  -- Si on a un full_name de Google, le séparer en prénom et nom
  IF full_name IS NOT NULL AND full_name != '' THEN
    first_name_val := split_part(full_name, ' ', 1);
    IF array_length(string_to_array(full_name, ' '), 1) > 1 THEN
      last_name_val := substring(full_name from length(first_name_val) + 2);
    ELSE
      last_name_val := '';
    END IF;
  ELSE
    -- Sinon utiliser les valeurs individuelles si disponibles
    first_name_val := COALESCE(new.raw_user_meta_data->>'first_name', '');
    last_name_val := COALESCE(new.raw_user_meta_data->>'last_name', '');
  END IF;

  -- Insérer le nouveau membre avec les données récupérées
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
    'pending' -- Tous les nouveaux utilisateurs sont en attente
  )
  ON CONFLICT (email) 
  DO UPDATE SET
    photo_url = COALESCE(EXCLUDED.photo_url, members.photo_url),
    updated_at = NOW();
    
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. TRIGGER POUR LES NOUVEAUX UTILISATEURS
-- ============================================
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 5. FONCTION POUR VÉRIFIER SI UN UTILISATEUR EST PENDING
-- ============================================
CREATE OR REPLACE FUNCTION public.is_user_pending(user_uuid UUID)
RETURNS BOOLEAN AS $$
DECLARE
  user_role user_role;
BEGIN
  SELECT role INTO user_role
  FROM members
  WHERE user_id = user_uuid;
  
  RETURN user_role = 'pending';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. ROW LEVEL SECURITY (RLS)
-- ============================================

-- Activer RLS sur la table members
ALTER TABLE public.members ENABLE ROW LEVEL SECURITY;

-- Politique : Les utilisateurs peuvent voir leur propre profil
CREATE POLICY "Users can view own profile" ON public.members
  FOR SELECT
  USING (auth.uid() = user_id);

-- Politique : Les admins peuvent tout voir
CREATE POLICY "Admins can view all members" ON public.members
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.members
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'super_admin')
    )
  );

-- Politique : Les admins peuvent modifier les membres
CREATE POLICY "Admins can update members" ON public.members
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.members
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'super_admin')
    )
  );

-- Politique : Les utilisateurs peuvent mettre à jour leur propre profil (sauf le rôle)
CREATE POLICY "Users can update own profile" ON public.members
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id AND
    role = (SELECT role FROM public.members WHERE user_id = auth.uid())
  );

-- 7. FONCTION POUR METTRE À JOUR LE TIMESTAMP
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger pour auto-update du champ updated_at
CREATE TRIGGER update_members_updated_at
  BEFORE UPDATE ON public.members
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 8. CRÉER UN COMPTE ADMIN DE TEST
-- ============================================
-- Email: admin@test.local
-- Mot de passe: Admin123!

DO $$
BEGIN
  -- Créer l'utilisateur admin si il n'existe pas
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'admin@test.local') THEN
    -- Insérer dans auth.users
    INSERT INTO auth.users (
      id,
      email,
      encrypted_password,
      email_confirmed_at,
      raw_user_meta_data,
      raw_app_meta_data,
      created_at,
      updated_at
    ) VALUES (
      '00000000-0000-0000-0000-000000000001'::uuid,
      'admin@test.local',
      crypt('Admin123!', gen_salt('bf')),
      now(),
      '{"first_name": "Admin", "last_name": "Test"}'::jsonb,
      '{"provider": "email", "providers": ["email"]}'::jsonb,
      now(),
      now()
    );

    -- Le trigger handle_new_user créera automatiquement le membre
    -- Mais on doit mettre à jour son rôle
    UPDATE public.members 
    SET role = 'super_admin'
    WHERE user_id = '00000000-0000-0000-0000-000000000001'::uuid;
  END IF;
END $$;

-- 9. CRÉER QUELQUES MEMBRES DE TEST
-- ============================================
DO $$
DECLARE
  user_uuid UUID;
BEGIN
  -- Membre test 1 (pending)
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'pending1@test.local') THEN
    user_uuid := gen_random_uuid();
    INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, raw_user_meta_data, created_at, updated_at)
    VALUES (
      user_uuid,
      'pending1@test.local',
      crypt('Test123!', gen_salt('bf')),
      now(),
      '{"first_name": "Pierre", "last_name": "Dupont"}'::jsonb,
      now(),
      now()
    );
  END IF;

  -- Membre test 2 (pending)
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'pending2@test.local') THEN
    user_uuid := gen_random_uuid();
    INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, raw_user_meta_data, created_at, updated_at)
    VALUES (
      user_uuid,
      'pending2@test.local',
      crypt('Test123!', gen_salt('bf')),
      now(),
      '{"first_name": "Marie", "last_name": "Martin"}'::jsonb,
      now(),
      now()
    );
  END IF;

  -- Membre test 3 (member approuvé)
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'member@test.local') THEN
    user_uuid := gen_random_uuid();
    INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, raw_user_meta_data, created_at, updated_at)
    VALUES (
      user_uuid,
      'member@test.local',
      crypt('Test123!', gen_salt('bf')),
      now(),
      '{"first_name": "Jean", "last_name": "Bernard"}'::jsonb,
      now(),
      now()
    );
    
    -- Mettre à jour son rôle en member
    UPDATE public.members 
    SET role = 'member'
    WHERE user_id = user_uuid;
  END IF;
END $$;

-- 10. AFFICHER LES COMPTES CRÉÉS
-- ============================================
SELECT 
  m.email,
  m.first_name || ' ' || m.last_name as name,
  m.role,
  CASE 
    WHEN m.email = 'admin@test.local' THEN 'Admin123!'
    ELSE 'Test123!'
  END as password,
  m.created_at
FROM members m
WHERE m.email LIKE '%@test.local'
ORDER BY 
  CASE m.role 
    WHEN 'super_admin' THEN 1
    WHEN 'admin' THEN 2
    WHEN 'member' THEN 3
    WHEN 'pending' THEN 4
  END,
  m.email;