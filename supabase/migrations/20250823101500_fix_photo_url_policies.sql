-- Migration: Corriger les politiques RLS pour photo_url
-- Description: Permettre aux utilisateurs de mettre à jour leur propre photo_url
-- Date: 2025-08-23

-- Supprimer les anciennes politiques si elles existent
DROP POLICY IF EXISTS "Users can update own photo_url" ON public.members;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.members;
DROP POLICY IF EXISTS "Enable update for users based on user_id" ON public.members;

-- Créer une politique complète pour permettre aux utilisateurs de mettre à jour leur profil
CREATE POLICY "Users can update their own profile"
  ON public.members
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- S'assurer que les utilisateurs peuvent lire leur propre profil
DROP POLICY IF EXISTS "Users can view their own profile" ON public.members;
CREATE POLICY "Users can view their own profile"
  ON public.members
  FOR SELECT
  USING (auth.uid() = user_id);

-- Permettre aux admins de tout voir et modifier
DROP POLICY IF EXISTS "Admins can do everything" ON public.members;
CREATE POLICY "Admins can do everything"
  ON public.members
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.members
      WHERE user_id = auth.uid()
      AND role = 'admin'
    )
  );

-- Vérifier que RLS est activé sur la table members
ALTER TABLE public.members ENABLE ROW LEVEL SECURITY;