-- ============================================
-- Migration pour refactoring de l'authentification
-- Date: 2025-01-19
-- Description: Création complète du système d'authentification avec groupes et rôles
-- ============================================

-- 1. CRÉATION DES TYPES ENUM
-- ============================================
-- Type pour le statut utilisateur
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_status') THEN
        CREATE TYPE user_status AS ENUM ('active', 'suspended');
    END IF;
END$$;

-- Type pour les rôles utilisateur
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
        CREATE TYPE user_role AS ENUM ('member', 'admin');
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
  role user_role NOT NULL DEFAULT 'member',
  status user_status NOT NULL DEFAULT 'active',
  expertise TEXT,
  availability TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index pour les performances
CREATE INDEX IF NOT EXISTS idx_members_user_id ON public.members(user_id);
CREATE INDEX IF NOT EXISTS idx_members_email ON public.members(email);
CREATE INDEX IF NOT EXISTS idx_members_role ON public.members(role);
CREATE INDEX IF NOT EXISTS idx_members_status ON public.members(status);

-- 3. CRÉATION DE LA TABLE GROUPS
-- ============================================
CREATE TABLE IF NOT EXISTS public.groups (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index pour les performances
CREATE INDEX IF NOT EXISTS idx_groups_name ON public.groups(name);

-- 4. CRÉATION DE LA TABLE USER_GROUPS (relation many-to-many)
-- ============================================
CREATE TABLE IF NOT EXISTS public.user_groups (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, group_id)
);

-- Index pour les performances
CREATE INDEX IF NOT EXISTS idx_user_groups_user_id ON public.user_groups(user_id);
CREATE INDEX IF NOT EXISTS idx_user_groups_group_id ON public.user_groups(group_id);

-- 5. INSERTION DU GROUPE PUBLIC PAR DÉFAUT
-- ============================================
INSERT INTO public.groups (name, description)
VALUES ('public', 'Groupe par défaut pour tous les utilisateurs')
ON CONFLICT (name) DO NOTHING;

-- 6. FONCTION POUR METTRE À JOUR LE TIMESTAMP
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 7. FONCTION POUR GÉRER LES NOUVEAUX UTILISATEURS
-- ============================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
  full_name TEXT;
  first_name_val TEXT;
  last_name_val TEXT;
  avatar_url_val TEXT;
  public_group_id UUID;
BEGIN
  -- Récupérer l'ID du groupe public
  SELECT id INTO public_group_id FROM public.groups WHERE name = 'public';
  
  -- Récupérer les données depuis les métadonnées de l'utilisateur
  full_name := new.raw_user_meta_data->>'full_name';
  avatar_url_val := new.raw_user_meta_data->>'avatar_url';
  
  -- Si on a un full_name de Google/Twitter, le séparer en prénom et nom
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

  -- Insérer le nouveau membre avec le rôle 'member' et le statut 'active'
  INSERT INTO public.members (
    user_id, 
    email, 
    first_name, 
    last_name, 
    phone, 
    photo_url,
    role,
    status
  ) VALUES (
    new.id,
    new.email,
    first_name_val,
    last_name_val,
    COALESCE(new.raw_user_meta_data->>'phone', ''),
    avatar_url_val,
    'member'::user_role,
    'active'::user_status
  )
  ON CONFLICT (email) 
  DO UPDATE SET
    photo_url = COALESCE(EXCLUDED.photo_url, members.photo_url),
    updated_at = NOW();
  
  -- Ajouter l'utilisateur au groupe public
  IF public_group_id IS NOT NULL THEN
    INSERT INTO public.user_groups (user_id, group_id)
    VALUES (new.id, public_group_id)
    ON CONFLICT (user_id, group_id) DO NOTHING;
  END IF;
    
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. TRIGGER POUR LES NOUVEAUX UTILISATEURS
-- ============================================
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 9. FONCTIONS UTILITAIRES POUR LA VÉRIFICATION DES PERMISSIONS
-- ============================================

-- Fonction pour vérifier si un utilisateur est admin
CREATE OR REPLACE FUNCTION public.is_admin(user_uuid UUID DEFAULT auth.uid())
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.members
    WHERE user_id = user_uuid
    AND role = 'admin'::user_role
    AND status = 'active'::user_status
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fonction pour vérifier si un utilisateur est actif
CREATE OR REPLACE FUNCTION public.is_active_user(user_uuid UUID DEFAULT auth.uid())
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.members
    WHERE user_id = user_uuid
    AND status = 'active'::user_status
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fonction pour obtenir les groupes d'un utilisateur
CREATE OR REPLACE FUNCTION public.get_user_groups(user_uuid UUID DEFAULT auth.uid())
RETURNS TABLE(group_id UUID, group_name TEXT) AS $$
BEGIN
  RETURN QUERY
  SELECT g.id, g.name
  FROM public.groups g
  JOIN public.user_groups ug ON g.id = ug.group_id
  WHERE ug.user_id = user_uuid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fonction pour vérifier si un utilisateur appartient à un groupe
CREATE OR REPLACE FUNCTION public.user_in_group(group_name TEXT, user_uuid UUID DEFAULT auth.uid())
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 
    FROM public.user_groups ug
    JOIN public.groups g ON g.id = ug.group_id
    WHERE ug.user_id = user_uuid
    AND g.name = group_name
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 10. TRIGGERS POUR METTRE À JOUR updated_at
-- ============================================
CREATE TRIGGER update_members_updated_at
  BEFORE UPDATE ON public.members
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_groups_updated_at
  BEFORE UPDATE ON public.groups
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 11. ROW LEVEL SECURITY (RLS) POUR LES NOUVELLES TABLES
-- ============================================

-- RLS pour la table groups
ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;

-- Tous les utilisateurs actifs peuvent voir les groupes
CREATE POLICY "Active users can view groups" ON public.groups
  FOR SELECT
  USING (public.is_active_user());

-- Seuls les admins peuvent modifier les groupes
CREATE POLICY "Admins can manage groups" ON public.groups
  FOR ALL
  USING (public.is_admin());

-- RLS pour la table user_groups
ALTER TABLE public.user_groups ENABLE ROW LEVEL SECURITY;

-- Les utilisateurs peuvent voir leurs propres groupes
CREATE POLICY "Users can view own groups" ON public.user_groups
  FOR SELECT
  USING (auth.uid() = user_id);

-- Les admins peuvent tout voir
CREATE POLICY "Admins can view all user groups" ON public.user_groups
  FOR SELECT
  USING (public.is_admin());

-- Les admins peuvent gérer les affectations de groupes
CREATE POLICY "Admins can manage user groups" ON public.user_groups
  FOR ALL
  USING (public.is_admin());

-- 12. ROW LEVEL SECURITY POUR LA TABLE MEMBERS
-- ============================================

-- Activer RLS sur la table members
ALTER TABLE public.members ENABLE ROW LEVEL SECURITY;

-- Nouvelle politique : Les utilisateurs actifs peuvent voir leur propre profil
CREATE POLICY "Active users can view own profile" ON public.members
  FOR SELECT
  USING (auth.uid() = user_id AND status = 'active'::user_status);

-- Nouvelle politique : Les admins actifs peuvent tout voir
CREATE POLICY "Active admins can view all members" ON public.members
  FOR SELECT
  USING (public.is_admin());

-- Nouvelle politique : Les admins actifs peuvent modifier les membres
CREATE POLICY "Active admins can update members" ON public.members
  FOR UPDATE
  USING (public.is_admin());

-- Nouvelle politique : Les utilisateurs actifs peuvent mettre à jour leur propre profil (sauf rôle et statut)
CREATE POLICY "Active users can update own profile" ON public.members
  FOR UPDATE
  USING (auth.uid() = user_id AND status = 'active'::user_status)
  WITH CHECK (
    auth.uid() = user_id AND
    role = (SELECT role FROM public.members WHERE user_id = auth.uid()) AND
    status = (SELECT status FROM public.members WHERE user_id = auth.uid())
  );

-- 13. MIGRATION DES UTILISATEURS EXISTANTS VERS LE GROUPE PUBLIC
-- ============================================
-- Cette partie sera exécutée seulement s'il y a des utilisateurs existants
DO $$
DECLARE
  public_group_id UUID;
BEGIN
  -- Récupérer l'ID du groupe public
  SELECT id INTO public_group_id FROM public.groups WHERE name = 'public';
  
  -- Ajouter tous les utilisateurs existants au groupe public
  IF public_group_id IS NOT NULL THEN
    INSERT INTO public.user_groups (user_id, group_id)
    SELECT user_id, public_group_id
    FROM public.members
    WHERE user_id IS NOT NULL
    ON CONFLICT (user_id, group_id) DO NOTHING;
  END IF;
END $$;