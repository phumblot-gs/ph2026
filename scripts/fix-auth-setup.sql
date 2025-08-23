-- Script pour corriger complètement le setup d'authentification
-- À exécuter dans Supabase SQL Editor

-- 1. Vérifier s'il y a des doublons dans members
SELECT email, COUNT(*) as count
FROM public.members
GROUP BY email
HAVING COUNT(*) > 1;

-- 2. Nettoyer les doublons éventuels (garder le plus récent)
DELETE FROM public.members
WHERE id NOT IN (
  SELECT DISTINCT ON (email) id
  FROM public.members
  ORDER BY email, created_at DESC
);

-- 3. Vérifier s'il y a des doublons dans groups
SELECT name, COUNT(*) as count
FROM public.groups
GROUP BY name
HAVING COUNT(*) > 1;

-- 4. Nettoyer les doublons dans groups
DELETE FROM public.groups
WHERE id NOT IN (
  SELECT DISTINCT ON (name) id
  FROM public.groups
  ORDER BY name, created_at DESC
);

-- 5. S'assurer que le groupe public existe (une seule fois)
INSERT INTO public.groups (name, description)
VALUES ('public', 'Groupe par défaut pour tous les utilisateurs')
ON CONFLICT (name) DO NOTHING;

-- 6. Vérifier que le groupe public est unique
SELECT id, name, description FROM public.groups WHERE name = 'public';

-- 7. Recréer le trigger corrigé
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

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

  -- Insérer le nouveau membre (utiliser user_id comme clé unique au lieu d'email)
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

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW 
  EXECUTE FUNCTION public.handle_new_user();

-- 8. Ajouter manuellement l'utilisateur existant à members et au groupe public
DO $$
DECLARE
  public_group_id UUID;
BEGIN
  -- Ajouter Pierre Humblot à members
  INSERT INTO public.members (
    user_id,
    email,
    first_name,
    last_name,
    phone,
    role,
    status
  ) VALUES (
    '3fc8e94b-7b6d-4caf-af1d-8c5cb4737334'::uuid,
    'humblot_pierre@yahoo.fr',
    'Pierre',
    'Humblot',
    '',
    'member'::user_role,
    'active'::user_status
  )
  ON CONFLICT (user_id) DO NOTHING;
  
  -- Récupérer l'ID du groupe public
  SELECT id INTO public_group_id FROM public.groups WHERE name = 'public' LIMIT 1;
  
  -- Ajouter au groupe public
  IF public_group_id IS NOT NULL THEN
    INSERT INTO public.user_groups (user_id, group_id)
    VALUES ('3fc8e94b-7b6d-4caf-af1d-8c5cb4737334'::uuid, public_group_id)
    ON CONFLICT (user_id, group_id) DO NOTHING;
  END IF;
END $$;

-- 9. Vérifier le résultat
SELECT 
    m.email,
    m.first_name,
    m.last_name,
    m.role,
    m.status,
    array_agg(g.name) as groups
FROM public.members m
LEFT JOIN public.user_groups ug ON m.user_id = ug.user_id
LEFT JOIN public.groups g ON ug.group_id = g.id
WHERE m.email = 'humblot_pierre@yahoo.fr'
GROUP BY m.id, m.email, m.first_name, m.last_name, m.role, m.status;