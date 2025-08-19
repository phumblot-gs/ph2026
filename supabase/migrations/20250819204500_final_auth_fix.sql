-- Migration: Configuration finale du système d'authentification
-- Description: Version corrigée et testée du trigger et des groupes
-- Date: 2025-08-19

-- 1. Nettoyer les doublons éventuels dans members
DELETE FROM public.members
WHERE id NOT IN (
  SELECT DISTINCT ON (email) id
  FROM public.members
  ORDER BY email, created_at DESC
);

-- 2. Nettoyer les doublons éventuels dans groups
DELETE FROM public.groups
WHERE id NOT IN (
  SELECT DISTINCT ON (name) id
  FROM public.groups
  ORDER BY name, created_at DESC
);

-- 3. S'assurer que le groupe public existe (une seule fois)
INSERT INTO public.groups (name, description)
VALUES ('public', 'Groupe par défaut pour tous les utilisateurs')
ON CONFLICT (name) DO NOTHING;

-- 4. Supprimer l'ancien trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- 5. Créer la version finale du trigger
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
  full_name TEXT;
  first_name_val TEXT;
  last_name_val TEXT;
  avatar_url_val TEXT;
  public_group_id UUID;
BEGIN
  -- Récupérer les données depuis les métadonnées de l'utilisateur
  full_name := COALESCE(new.raw_user_meta_data->>'full_name', '');
  avatar_url_val := COALESCE(new.raw_user_meta_data->>'avatar_url', '');
  
  -- Récupérer prénom et nom
  first_name_val := COALESCE(
    new.raw_user_meta_data->>'first_name',
    CASE 
      WHEN full_name != '' THEN split_part(full_name, ' ', 1)
      ELSE ''
    END
  );
  
  last_name_val := COALESCE(
    new.raw_user_meta_data->>'last_name',
    CASE 
      WHEN full_name != '' AND array_length(string_to_array(full_name, ' '), 1) > 1 
      THEN substring(full_name from length(split_part(full_name, ' ', 1)) + 2)
      ELSE ''
    END
  );

  -- Insérer le nouveau membre (utiliser user_id comme clé unique)
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
  ON CONFLICT (user_id) DO UPDATE SET
    email = EXCLUDED.email,
    first_name = COALESCE(EXCLUDED.first_name, members.first_name),
    last_name = COALESCE(EXCLUDED.last_name, members.last_name),
    phone = COALESCE(EXCLUDED.phone, members.phone),
    photo_url = COALESCE(EXCLUDED.photo_url, members.photo_url),
    updated_at = NOW();
  
  -- Ajouter au groupe public
  SELECT id INTO public_group_id FROM public.groups WHERE name = 'public' LIMIT 1;
  
  IF public_group_id IS NOT NULL THEN
    INSERT INTO public.user_groups (user_id, group_id)
    VALUES (new.id, public_group_id)
    ON CONFLICT (user_id, group_id) DO NOTHING;
  END IF;
    
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Recréer le trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW 
  EXECUTE FUNCTION public.handle_new_user();

-- 7. Ajouter les utilisateurs existants qui ne sont pas dans members
INSERT INTO public.members (
    user_id,
    email,
    first_name,
    last_name,
    phone,
    role,
    status
)
SELECT 
    u.id,
    u.email,
    COALESCE(u.raw_user_meta_data->>'first_name', ''),
    COALESCE(u.raw_user_meta_data->>'last_name', ''),
    COALESCE(u.raw_user_meta_data->>'phone', ''),
    'member'::user_role,
    'active'::user_status
FROM auth.users u
LEFT JOIN public.members m ON u.id = m.user_id
WHERE m.user_id IS NULL
ON CONFLICT (user_id) DO NOTHING;

-- 8. Ajouter tous les membres au groupe public s'ils n'y sont pas déjà
WITH public_group AS (
    SELECT id FROM public.groups WHERE name = 'public' LIMIT 1
)
INSERT INTO public.user_groups (user_id, group_id)
SELECT 
    m.user_id,
    pg.id
FROM public.members m
CROSS JOIN public_group pg
WHERE m.user_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.user_groups ug 
    WHERE ug.user_id = m.user_id 
    AND ug.group_id = pg.id
  )
ON CONFLICT (user_id, group_id) DO NOTHING;