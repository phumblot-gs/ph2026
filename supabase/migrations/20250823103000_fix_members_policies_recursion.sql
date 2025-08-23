-- Migration: Corriger la récursion infinie dans les politiques de la table members
-- Description: Résout l'erreur "infinite recursion detected in policy for relation members"
-- Date: 2025-08-23

-- 1. Supprimer TOUTES les politiques existantes sur members pour repartir sur une base saine
DROP POLICY IF EXISTS "Users can update own photo_url" ON public.members;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.members;
DROP POLICY IF EXISTS "Users can view their own profile" ON public.members;
DROP POLICY IF EXISTS "Admins can do everything" ON public.members;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.members;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON public.members;
DROP POLICY IF EXISTS "Enable update for users based on user_id" ON public.members;
DROP POLICY IF EXISTS "Enable delete for users based on user_id" ON public.members;
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.members;
DROP POLICY IF EXISTS "Users can update own profiles" ON public.members;
DROP POLICY IF EXISTS "Users can view own profile" ON public.members;
DROP POLICY IF EXISTS "Anyone can view members" ON public.members;
DROP POLICY IF EXISTS "Users can update own profile" ON public.members;
DROP POLICY IF EXISTS "System can insert members" ON public.members;
DROP POLICY IF EXISTS "Authenticated users can view members" ON public.members;
DROP POLICY IF EXISTS "Users update own profile" ON public.members;
DROP POLICY IF EXISTS "System inserts members" ON public.members;

-- 2. Créer des politiques simples et non-récursives

-- Les utilisateurs authentifiés peuvent voir tous les membres
-- (nécessaire pour les fonctionnalités de groupe et admin)
CREATE POLICY "Authenticated users can view members"
  ON public.members
  FOR SELECT
  TO authenticated
  USING (true);

-- Les utilisateurs peuvent mettre à jour leur propre profil
-- SANS vérifier le rôle dans la même table (évite la récursion)
CREATE POLICY "Users update own profile"
  ON public.members
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Permettre l'insertion via le système (triggers auth)
-- Restreint aux utilisateurs qui s'inscrivent eux-mêmes
CREATE POLICY "System inserts members"
  ON public.members
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- 3. S'assurer que RLS est activé
ALTER TABLE public.members ENABLE ROW LEVEL SECURITY;