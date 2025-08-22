-- Script pour déboguer le trigger en détail
-- À exécuter dans Supabase SQL Editor

-- 1. Voir la définition actuelle de la fonction handle_new_user
SELECT pg_get_functiondef(oid) as function_definition
FROM pg_proc 
WHERE proname = 'handle_new_user';

-- 2. Remplacer le trigger par une version qui LOG les erreurs
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
  full_name TEXT;
  first_name_val TEXT;
  last_name_val TEXT;
  avatar_url_val TEXT;
  public_group_id UUID;
BEGIN
  -- LOG pour debug
  RAISE LOG 'handle_new_user déclenché pour user %', new.email;
  
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

  RAISE LOG 'Données extraites - first_name: %, last_name: %', first_name_val, last_name_val;

  -- Insérer le nouveau membre
  BEGIN
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
    
    RAISE LOG 'Member créé avec succès pour %', new.email;
  EXCEPTION 
    WHEN OTHERS THEN
      RAISE LOG 'ERREUR lors de la création du member: %', SQLERRM;
      RAISE WARNING 'Impossible de créer le member pour %: %', new.email, SQLERRM;
  END;
  
  -- Ajouter au groupe public
  BEGIN
    -- Récupérer l'ID du groupe public
    SELECT id INTO public_group_id FROM public.groups WHERE name = 'public';
    
    IF public_group_id IS NOT NULL THEN
      INSERT INTO public.user_groups (user_id, group_id)
      VALUES (new.id, public_group_id)
      ON CONFLICT (user_id, group_id) DO NOTHING;
      
      RAISE LOG 'Utilisateur % ajouté au groupe public', new.email;
    ELSE
      RAISE LOG 'Groupe public non trouvé';
    END IF;
  EXCEPTION
    WHEN OTHERS THEN
      RAISE LOG 'ERREUR lors de l''ajout au groupe: %', SQLERRM;
      RAISE WARNING 'Impossible d''ajouter % au groupe public: %', new.email, SQLERRM;
  END;
    
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Vérifier que le groupe public existe
SELECT * FROM public.groups WHERE name = 'public';

-- Si le groupe n'existe pas, le créer
INSERT INTO public.groups (name, description)
VALUES ('public', 'Groupe par défaut pour tous les utilisateurs')
ON CONFLICT (name) DO NOTHING;