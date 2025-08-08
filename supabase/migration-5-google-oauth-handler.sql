-- Script 5 : Améliorer la gestion des inscriptions Google OAuth
-- Ce script améliore la fonction handle_new_user pour récupérer les infos Google

-- Mettre à jour la fonction pour mieux gérer les données Google OAuth
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
  full_name TEXT;
  first_name_val TEXT;
  last_name_val TEXT;
  avatar_url_val TEXT;
BEGIN
  -- Récupérer les données depuis les métadonnées de l'utilisateur
  -- Google OAuth fournit : full_name, avatar_url, email_verified, etc.
  full_name := new.raw_user_meta_data->>'full_name';
  avatar_url_val := new.raw_user_meta_data->>'avatar_url';
  
  -- Si on a un full_name de Google, le séparer en prénom et nom
  IF full_name IS NOT NULL AND full_name != '' THEN
    -- Séparer le nom complet (premier mot = prénom, reste = nom)
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
    -- Si l'utilisateur existe déjà (reconnexion), mettre à jour certaines infos
    photo_url = COALESCE(EXCLUDED.photo_url, members.photo_url),
    updated_at = NOW();
    
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fonction pour vérifier si un utilisateur est pending
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