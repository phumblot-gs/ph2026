-- Script pour corriger les problèmes de RLS et permettre l'insertion dans members
-- À exécuter dans Supabase SQL Editor

-- 1. Créer une politique qui permet au service role d'insérer dans members
CREATE POLICY "Service role can insert members" ON public.members
  FOR INSERT
  WITH CHECK (true);

-- 2. Créer une politique qui permet d'insérer son propre profil
CREATE POLICY "Users can insert own member profile" ON public.members
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- 3. Permettre aussi l'insertion dans user_groups
CREATE POLICY "Service role can insert user_groups" ON public.user_groups
  FOR INSERT
  WITH CHECK (true);

-- 4. Vérifier les politiques existantes
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE tablename IN ('members', 'user_groups')
ORDER BY tablename, policyname;