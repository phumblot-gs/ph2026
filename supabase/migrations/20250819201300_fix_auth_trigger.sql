-- Migration: Fix authentication trigger
-- Description: Corriger le trigger handle_new_user pour éviter les erreurs lors de l'inscription
-- Date: 2025-08-19

-- 1. Supprimer les anciens triggers qui peuvent causer des problèmes
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS handle_new_user ON auth.users;

-- 2. Créer une version améliorée du trigger avec gestion d'erreur
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
  full_name TEXT;
  first_name_val TEXT;
  last_name_val TEXT;
  avatar_url_val TEXT;
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

  -- Insérer le nouveau membre
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
    first_name = COALESCE(EXCLUDED.first_name, members.first_name),
    last_name = COALESCE(EXCLUDED.last_name, members.last_name),
    phone = COALESCE(EXCLUDED.phone, members.phone),
    photo_url = COALESCE(EXCLUDED.photo_url, members.photo_url),
    updated_at = NOW();
    
  RETURN new;
EXCEPTION
  WHEN OTHERS THEN
    -- Logger l'erreur mais ne pas faire échouer la création de l'utilisateur
    RAISE WARNING 'Erreur dans handle_new_user: %', SQLERRM;
    RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Recréer le trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW 
  EXECUTE FUNCTION public.handle_new_user();

-- 4. S'assurer que le groupe public existe et ajouter les utilisateurs existants
DO $$
DECLARE
  public_group_id UUID;
BEGIN
  -- S'assurer que le groupe public existe
  INSERT INTO public.groups (name, description)
  VALUES ('public', 'Groupe par défaut pour tous les utilisateurs')
  ON CONFLICT (name) DO NOTHING;
  
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