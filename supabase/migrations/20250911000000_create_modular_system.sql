-- ============================================
-- Migration pour le système modulaire
-- Date: 2025-09-11
-- Description: Création du système de modules avec permissions granulaires
-- ============================================

-- 1. CRÉATION DE LA TABLE MODULES
-- ============================================
CREATE TABLE IF NOT EXISTS public.modules (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  description TEXT,
  icon TEXT DEFAULT 'square',
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  config JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index pour les performances
CREATE INDEX IF NOT EXISTS idx_modules_name ON public.modules(name);
CREATE INDEX IF NOT EXISTS idx_modules_active ON public.modules(is_active);
CREATE INDEX IF NOT EXISTS idx_modules_sort_order ON public.modules(sort_order);

-- 2. CRÉATION DE LA TABLE GROUP_MODULES (relation many-to-many)
-- ============================================
CREATE TABLE IF NOT EXISTS public.group_modules (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  module_id UUID NOT NULL REFERENCES public.modules(id) ON DELETE CASCADE,
  can_read BOOLEAN DEFAULT true,
  can_write BOOLEAN DEFAULT false,
  can_admin BOOLEAN DEFAULT false,
  config JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(group_id, module_id)
);

-- Index pour les performances
CREATE INDEX IF NOT EXISTS idx_group_modules_group_id ON public.group_modules(group_id);
CREATE INDEX IF NOT EXISTS idx_group_modules_module_id ON public.group_modules(module_id);

-- 3. CRÉATION DE LA TABLE MODULE_DATA_PERMISSIONS
-- ============================================
CREATE TABLE IF NOT EXISTS public.module_data_permissions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  module_id UUID NOT NULL REFERENCES public.modules(id) ON DELETE CASCADE,
  source_group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE, -- qui crée la donnée
  target_group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE, -- qui peut y accéder
  permission_type TEXT NOT NULL CHECK (permission_type IN ('read', 'write')), -- 'read', 'write' seulement
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(module_id, source_group_id, target_group_id, permission_type)
);

-- Migration des données existantes si la colonne resource_type existe encore
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='module_data_permissions' AND column_name='resource_type') THEN
    -- Supprimer les permissions 'delete' existantes
    DELETE FROM public.module_data_permissions WHERE permission_type = 'delete';
    
    -- Créer une table temporaire avec la nouvelle structure
    CREATE TEMP TABLE temp_module_data_permissions AS 
    SELECT DISTINCT 
      id, module_id, source_group_id, target_group_id, permission_type, created_at
    FROM public.module_data_permissions 
    WHERE permission_type IN ('read', 'write');
    
    -- Supprimer l'ancienne table
    DROP TABLE public.module_data_permissions CASCADE;
    
    -- Recréer la table avec la nouvelle structure
    CREATE TABLE public.module_data_permissions (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      module_id UUID NOT NULL REFERENCES public.modules(id) ON DELETE CASCADE,
      source_group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
      target_group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
      permission_type TEXT NOT NULL CHECK (permission_type IN ('read', 'write')),
      created_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(module_id, source_group_id, target_group_id, permission_type)
    );
    
    -- Réinsérer les données migrées
    INSERT INTO public.module_data_permissions (id, module_id, source_group_id, target_group_id, permission_type, created_at)
    SELECT id, module_id, source_group_id, target_group_id, permission_type, created_at
    FROM temp_module_data_permissions
    ON CONFLICT (module_id, source_group_id, target_group_id, permission_type) DO NOTHING;
    
    -- Nettoyer
    DROP TABLE temp_module_data_permissions;
  END IF;
END $$;

-- Index pour les performances
CREATE INDEX IF NOT EXISTS idx_module_data_permissions_module ON public.module_data_permissions(module_id);
CREATE INDEX IF NOT EXISTS idx_module_data_permissions_source ON public.module_data_permissions(source_group_id);
CREATE INDEX IF NOT EXISTS idx_module_data_permissions_target ON public.module_data_permissions(target_group_id);

-- 4. TRIGGERS POUR METTRE À JOUR updated_at
-- ============================================
DROP TRIGGER IF EXISTS update_modules_updated_at ON public.modules;
CREATE TRIGGER update_modules_updated_at
  BEFORE UPDATE ON public.modules
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_group_modules_updated_at ON public.group_modules;
CREATE TRIGGER update_group_modules_updated_at
  BEFORE UPDATE ON public.group_modules
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 5. FONCTIONS UTILITAIRES POUR LES MODULES
-- ============================================

-- Fonction pour obtenir les modules accessibles à un utilisateur
CREATE OR REPLACE FUNCTION public.get_user_modules(user_uuid UUID DEFAULT auth.uid())
RETURNS TABLE(
  module_id UUID,
  module_name TEXT,
  display_name TEXT,
  description TEXT,
  icon TEXT,
  sort_order INTEGER,
  can_read BOOLEAN,
  can_write BOOLEAN,
  can_admin BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    m.id,
    m.name,
    m.display_name,
    m.description,
    m.icon,
    m.sort_order,
    -- Agréger les permissions : un utilisateur a une permission s'il l'a dans au moins un de ses groupes
    MAX(gm.can_read::int)::boolean AS can_read,
    MAX(gm.can_write::int)::boolean AS can_write,
    MAX(gm.can_admin::int)::boolean AS can_admin
  FROM public.modules m
  JOIN public.group_modules gm ON m.id = gm.module_id
  JOIN public.user_groups ug ON gm.group_id = ug.group_id
  WHERE ug.user_id = user_uuid
    AND m.is_active = true
  GROUP BY m.id, m.name, m.display_name, m.description, m.icon, m.sort_order
  ORDER BY m.sort_order ASC, m.display_name ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fonction pour vérifier l'accès d'un utilisateur à un module
CREATE OR REPLACE FUNCTION public.user_can_access_module(
  module_name TEXT,
  permission_type TEXT DEFAULT 'read', -- 'read', 'write', 'admin'
  user_uuid UUID DEFAULT auth.uid()
)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.modules m
    JOIN public.group_modules gm ON m.id = gm.module_id
    JOIN public.user_groups ug ON gm.group_id = ug.group_id
    WHERE ug.user_id = user_uuid
      AND m.name = module_name
      AND m.is_active = true
      AND (
        (permission_type = 'read' AND gm.can_read = true) OR
        (permission_type = 'write' AND gm.can_write = true) OR
        (permission_type = 'admin' AND gm.can_admin = true)
      )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fonction pour vérifier l'accès aux données d'un module
CREATE OR REPLACE FUNCTION public.user_can_access_module_data(
  module_name TEXT,
  source_group_id UUID,
  permission_type TEXT DEFAULT 'read',
  user_uuid UUID DEFAULT auth.uid()
)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.modules m
    JOIN public.module_data_permissions mdp ON m.id = mdp.module_id
    JOIN public.user_groups ug ON mdp.target_group_id = ug.group_id
    WHERE ug.user_id = user_uuid
      AND m.name = module_name
      AND mdp.source_group_id = source_group_id
      AND mdp.permission_type = permission_type
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. ROW LEVEL SECURITY POUR LES NOUVELLES TABLES
-- ============================================

-- RLS pour la table modules
ALTER TABLE public.modules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Active users can view modules" ON public.modules;
DROP POLICY IF EXISTS "Admins can manage modules" ON public.modules;

-- Tous les utilisateurs actifs peuvent voir les modules actifs
CREATE POLICY "Active users can view modules" ON public.modules
  FOR SELECT
  USING (public.is_active_user() AND is_active = true);

-- Seuls les admins peuvent gérer les modules
CREATE POLICY "Admins can manage modules" ON public.modules
  FOR ALL
  USING (public.is_admin());

-- RLS pour la table group_modules
ALTER TABLE public.group_modules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view accessible group modules" ON public.group_modules;
DROP POLICY IF EXISTS "Admins can view all group modules" ON public.group_modules;
DROP POLICY IF EXISTS "Admins can manage group modules" ON public.group_modules;

-- Les utilisateurs peuvent voir les modules de leurs groupes
CREATE POLICY "Users can view accessible group modules" ON public.group_modules
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_groups ug 
      WHERE ug.user_id = auth.uid() 
        AND ug.group_id = group_modules.group_id
    )
  );

-- Les admins peuvent tout voir
CREATE POLICY "Admins can view all group modules" ON public.group_modules
  FOR SELECT
  USING (public.is_admin());

-- Les admins peuvent gérer les affectations de modules
CREATE POLICY "Admins can manage group modules" ON public.group_modules
  FOR ALL
  USING (public.is_admin());

-- RLS pour la table module_data_permissions
ALTER TABLE public.module_data_permissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view all module data permissions" ON public.module_data_permissions;
DROP POLICY IF EXISTS "Admins can manage module data permissions" ON public.module_data_permissions;

-- Seuls les admins peuvent voir et gérer les permissions de données
CREATE POLICY "Admins can view all module data permissions" ON public.module_data_permissions
  FOR SELECT
  USING (public.is_admin());

CREATE POLICY "Admins can manage module data permissions" ON public.module_data_permissions
  FOR ALL
  USING (public.is_admin());

-- 7. INSERTION DES MODULES INITIAUX
-- ============================================

-- Insérer le module Discussions (existant)
INSERT INTO public.modules (name, display_name, description, icon, sort_order)
VALUES ('discussions', 'Discussions', 'Messages et discussions de groupe', 'message-square', 1)
ON CONFLICT (name) DO NOTHING;

-- Insérer les autres modules prévus
INSERT INTO public.modules (name, display_name, description, icon, sort_order, is_active) VALUES
  ('events', 'Événements', 'Gestion des événements et rendez-vous', 'calendar', 2, false),
  ('programme', 'Programme', 'Programme politique et propositions', 'file-text', 3, false),
  ('veille', 'Veille Politique', 'Actualités et veille politique', 'eye', 4, false),
  ('communication', 'Communication', 'Outils de communication externe', 'megaphone', 5, false)
ON CONFLICT (name) DO NOTHING;

-- 8. ATTRIBUTION DU MODULE DISCUSSIONS À TOUS LES GROUPES EXISTANTS
-- ============================================
DO $$
DECLARE
  discussions_module_id UUID;
BEGIN
  -- Récupérer l'ID du module discussions
  SELECT id INTO discussions_module_id FROM public.modules WHERE name = 'discussions';
  
  -- Attribuer le module discussions à tous les groupes existants avec permissions read/write
  IF discussions_module_id IS NOT NULL THEN
    INSERT INTO public.group_modules (group_id, module_id, can_read, can_write)
    SELECT g.id, discussions_module_id, true, true
    FROM public.groups g
    ON CONFLICT (group_id, module_id) DO NOTHING;
    
    -- Créer les permissions de données par défaut : chaque groupe peut lire/écrire ses propres données
    INSERT INTO public.module_data_permissions (module_id, source_group_id, target_group_id, permission_type)
    SELECT discussions_module_id, g.id, g.id, 'read'
    FROM public.groups g
    ON CONFLICT (module_id, source_group_id, target_group_id, permission_type) DO NOTHING;
    
    INSERT INTO public.module_data_permissions (module_id, source_group_id, target_group_id, permission_type)
    SELECT discussions_module_id, g.id, g.id, 'write'
    FROM public.groups g
    ON CONFLICT (module_id, source_group_id, target_group_id, permission_type) DO NOTHING;
  END IF;
END $$;