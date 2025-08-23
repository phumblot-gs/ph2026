-- Migration: Synchroniser les avatars des utilisateurs existants
-- Description: Récupère les avatars depuis auth.users pour les membres existants
-- Date: 2025-08-23

-- 1. Supprimer d'abord tout trigger existant qui pourrait dépendre de photo_url
DROP TRIGGER IF EXISTS sync_avatar_on_member_update ON public.members;

-- 2. S'assurer que la colonne photo_url peut stocker des URLs longues
-- Vérifier le type actuel et le modifier seulement si nécessaire
DO $$ 
BEGIN
  -- Modifier le type seulement si ce n'est pas déjà TEXT
  IF EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'members' 
    AND column_name = 'photo_url'
    AND data_type != 'text'
  ) THEN
    ALTER TABLE public.members 
    ALTER COLUMN photo_url TYPE TEXT;
  END IF;
END $$;

-- 3. Mettre à jour les photo_url existantes depuis les métadonnées auth.users
UPDATE public.members m
SET photo_url = COALESCE(
  u.raw_user_meta_data->>'avatar_url',
  u.raw_user_meta_data->>'picture',
  m.photo_url
),
updated_at = NOW()
FROM auth.users u
WHERE m.user_id = u.id
  AND (m.photo_url IS NULL OR m.photo_url = '');

-- 4. Créer une fonction pour synchroniser l'avatar lors de la mise à jour du profil
CREATE OR REPLACE FUNCTION public.sync_user_avatar()
RETURNS trigger AS $$
BEGIN
  -- Si photo_url est modifiée dans members, mettre à jour les métadonnées auth
  IF NEW.photo_url IS DISTINCT FROM OLD.photo_url THEN
    UPDATE auth.users
    SET raw_user_meta_data = jsonb_set(
      COALESCE(raw_user_meta_data, '{}'::jsonb),
      '{avatar_url}',
      to_jsonb(NEW.photo_url)
    )
    WHERE id = NEW.user_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Créer le trigger pour synchroniser les avatars
DROP TRIGGER IF EXISTS sync_avatar_on_member_update ON public.members;
CREATE TRIGGER sync_avatar_on_member_update
  AFTER UPDATE OF photo_url ON public.members
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_user_avatar();

-- 6. Créer une politique RLS pour permettre aux utilisateurs de mettre à jour leur propre photo
-- Vérifier si la politique existe déjà avant de la créer
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'members' 
    AND policyname = 'Users can update own photo_url'
  ) THEN
    CREATE POLICY "Users can update own photo_url" ON public.members
      FOR UPDATE 
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- 7. Ajouter un index pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_members_photo_url ON public.members(photo_url) WHERE photo_url IS NOT NULL;