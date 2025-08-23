-- Script pour réinitialiser complètement le trigger
-- À exécuter dans Supabase SQL Editor

-- 1. Vérifier quels triggers existent sur auth.users
SELECT 
    tgname as trigger_name,
    proname as function_name
FROM pg_trigger t
JOIN pg_proc p ON t.tgfoid = p.oid
WHERE t.tgrelid = 'auth.users'::regclass;

-- 2. Supprimer TOUS les triggers custom sur auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS handle_new_user ON auth.users;

-- 3. Supprimer les anciennes versions de la fonction
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;
DROP FUNCTION IF EXISTS public.handle_new_user_v2() CASCADE;

-- 4. Créer une version TRÈS SIMPLE du trigger pour tester
CREATE OR REPLACE FUNCTION public.handle_new_user_simple()
RETURNS trigger AS $$
BEGIN
  -- Version minimale : juste créer l'entrée dans members
  INSERT INTO public.members (
    user_id, 
    email, 
    first_name, 
    last_name, 
    role,
    status
  ) VALUES (
    new.id,
    new.email,
    COALESCE(new.raw_user_meta_data->>'first_name', ''),
    COALESCE(new.raw_user_meta_data->>'last_name', ''),
    'member'::user_role,
    'active'::user_status
  )
  ON CONFLICT (user_id) DO NOTHING;
  
  -- Ajouter au groupe public de manière simple
  INSERT INTO public.user_groups (user_id, group_id)
  SELECT new.id, id
  FROM public.groups
  WHERE name = 'public'
  ON CONFLICT (user_id, group_id) DO NOTHING;
    
  RETURN new;
EXCEPTION WHEN OTHERS THEN
  -- En cas d'erreur, on continue quand même
  RAISE WARNING 'Erreur handle_new_user_simple: %', SQLERRM;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Créer le nouveau trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW 
  EXECUTE FUNCTION public.handle_new_user_simple();

-- 6. Vérifier que le trigger est bien créé
SELECT 
    tgname as trigger_name,
    tgenabled as is_enabled,
    proname as function_name
FROM pg_trigger t
JOIN pg_proc p ON t.tgfoid = p.oid
WHERE t.tgrelid = 'auth.users'::regclass
AND tgname = 'on_auth_user_created';