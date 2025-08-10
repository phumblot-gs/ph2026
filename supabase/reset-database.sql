-- Script pour réinitialiser complètement la base de données
-- À exécuter avant complete-schema.sql

-- Supprimer les triggers
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS update_members_updated_at ON public.members;

-- Supprimer les fonctions
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;
DROP FUNCTION IF EXISTS public.update_updated_at_column() CASCADE;

-- Supprimer les tables (si elles existent encore)
DROP TABLE IF EXISTS public.members CASCADE;

-- Supprimer les types enum
DROP TYPE IF EXISTS public.user_role CASCADE;

-- Supprimer les politiques RLS si elles existent
DROP POLICY IF EXISTS "Users can view their own member profile" ON public.members;
DROP POLICY IF EXISTS "Admins can view all members" ON public.members;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.members;
DROP POLICY IF EXISTS "Super admins can update all profiles" ON public.members;
DROP POLICY IF EXISTS "Super admins can delete members" ON public.members;

-- Message de confirmation
SELECT 'Database reset complete. You can now run complete-schema.sql' as message;