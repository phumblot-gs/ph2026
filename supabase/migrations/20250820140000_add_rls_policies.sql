-- ============================================
-- Migration pour ajouter les policies RLS manquantes
-- Date: 2025-08-20
-- Description: Policies pour members et user_groups avec permissions appropriées
-- Version 2: Simplifiées pour éviter la récursion infinie
-- ============================================

-- ====== SUPPRIMER TOUTES LES POLICIES EXISTANTES ======

-- Supprimer les policies existantes sur members
DROP POLICY IF EXISTS "Users can create their own member entry" ON public.members;
DROP POLICY IF EXISTS "Users can view their own member entry" ON public.members;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.members;
DROP POLICY IF EXISTS "Admins can view all members" ON public.members;
DROP POLICY IF EXISTS "Admins can update all members" ON public.members;
DROP POLICY IF EXISTS "Admins can delete members" ON public.members;
DROP POLICY IF EXISTS "Users can insert own member" ON public.members;
DROP POLICY IF EXISTS "Anyone can view members" ON public.members;
DROP POLICY IF EXISTS "Users can update own member" ON public.members;
DROP POLICY IF EXISTS "Admins can do everything on members" ON public.members;
DROP POLICY IF EXISTS "Active admins can view all members" ON public.members;
DROP POLICY IF EXISTS "Active admins can update members" ON public.members;

-- Supprimer les policies existantes sur user_groups
DROP POLICY IF EXISTS "Users can join public group only" ON public.user_groups;
DROP POLICY IF EXISTS "Users can view their own groups" ON public.user_groups;
DROP POLICY IF EXISTS "Admins can view all user groups" ON public.user_groups;
DROP POLICY IF EXISTS "Admins can manage all group memberships" ON public.user_groups;
DROP POLICY IF EXISTS "Admins can update group memberships" ON public.user_groups;
DROP POLICY IF EXISTS "Admins can remove users from groups" ON public.user_groups;
DROP POLICY IF EXISTS "Users can insert into user_groups" ON public.user_groups;
DROP POLICY IF EXISTS "Users can view own groups" ON public.user_groups;
DROP POLICY IF EXISTS "Admins can do everything on user_groups" ON public.user_groups;
DROP POLICY IF EXISTS "Admins can manage user groups" ON public.user_groups;

-- Supprimer les policies existantes sur groups
DROP POLICY IF EXISTS "Everyone can view groups" ON public.groups;
DROP POLICY IF EXISTS "Anyone can view groups" ON public.groups;
DROP POLICY IF EXISTS "Admins can create groups" ON public.groups;
DROP POLICY IF EXISTS "Admins can update groups" ON public.groups;
DROP POLICY IF EXISTS "Admins can delete groups" ON public.groups;
DROP POLICY IF EXISTS "Admins can do everything on groups" ON public.groups;
DROP POLICY IF EXISTS "Admins can manage groups" ON public.groups;

-- Supprimer toutes les versions de la fonction helper avec CASCADE
DROP FUNCTION IF EXISTS is_admin() CASCADE;
DROP FUNCTION IF EXISTS is_admin(uuid) CASCADE;
DROP FUNCTION IF EXISTS is_admin(text) CASCADE;
DROP FUNCTION IF EXISTS public.is_admin() CASCADE;
DROP FUNCTION IF EXISTS public.is_admin(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.is_admin(text) CASCADE;

-- ====== CRÉER LA FONCTION HELPER POUR ÉVITER LA RÉCURSION ======
-- Cette fonction peut être utilisée dans les policies sans créer de récursion

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.members 
        WHERE user_id = auth.uid() 
        AND role = 'admin'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- ====== POLICIES SIMPLES POUR LA TABLE MEMBERS ======

-- Supprimer les policies existantes avant de les recréer
DROP POLICY IF EXISTS "Users can insert own member" ON public.members;
DROP POLICY IF EXISTS "Anyone can view members" ON public.members;
DROP POLICY IF EXISTS "Users can update own member" ON public.members;
DROP POLICY IF EXISTS "Admins can do everything on members" ON public.members;

-- Permettre aux utilisateurs de créer leur propre entrée member
CREATE POLICY "Users can insert own member" 
ON public.members
FOR INSERT 
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Permettre à tous de voir tous les membres (simplifié)
CREATE POLICY "Anyone can view members" 
ON public.members
FOR SELECT 
TO authenticated
USING (true);

-- Permettre aux users de modifier leur propre profil
CREATE POLICY "Users can update own member" 
ON public.members
FOR UPDATE 
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Admins peuvent tout faire sur members (utilise la fonction helper)
CREATE POLICY "Admins can do everything on members" 
ON public.members
FOR ALL 
TO authenticated
USING (is_admin())
WITH CHECK (is_admin());

-- ====== POLICIES SIMPLES POUR LA TABLE USER_GROUPS ======

-- Supprimer les policies existantes avant de les recréer
DROP POLICY IF EXISTS "Users can insert into user_groups" ON public.user_groups;
DROP POLICY IF EXISTS "Users can view own groups" ON public.user_groups;
DROP POLICY IF EXISTS "Admins can do everything on user_groups" ON public.user_groups;

-- Permettre l'insertion dans user_groups pour son propre user_id
-- Note: La vérification du groupe public se fait dans la logique métier
CREATE POLICY "Users can insert into user_groups" 
ON public.user_groups
FOR INSERT 
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Permettre de voir ses propres groupes
CREATE POLICY "Users can view own groups" 
ON public.user_groups
FOR SELECT 
TO authenticated
USING (auth.uid() = user_id);

-- Admins peuvent tout faire sur user_groups (utilise la fonction helper)
CREATE POLICY "Admins can do everything on user_groups" 
ON public.user_groups
FOR ALL 
TO authenticated
USING (is_admin())
WITH CHECK (is_admin());

-- ====== POLICIES SIMPLES POUR LA TABLE GROUPS ======

-- Supprimer les policies existantes avant de les recréer
DROP POLICY IF EXISTS "Anyone can view groups" ON public.groups;
DROP POLICY IF EXISTS "Admins can do everything on groups" ON public.groups;

-- Tout le monde peut voir les groupes
CREATE POLICY "Anyone can view groups" 
ON public.groups
FOR SELECT 
TO authenticated
USING (true);

-- Admins peuvent tout faire sur groups (utilise la fonction helper)
CREATE POLICY "Admins can do everything on groups" 
ON public.groups
FOR ALL 
TO authenticated
USING (is_admin())
WITH CHECK (is_admin());