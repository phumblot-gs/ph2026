-- Script pour vérifier spécifiquement le problème avec user_role
-- À exécuter dans Supabase SQL Editor

-- 1. Vérifier si le type user_role existe et ses valeurs
SELECT EXISTS (
   SELECT 1 FROM pg_type WHERE typname = 'user_role'
) as user_role_exists;

-- 2. Lister toutes les valeurs du type enum user_role
SELECT enumlabel as role_value
FROM pg_enum 
WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'user_role')
ORDER BY enumsortorder;

-- 3. Vérifier la colonne role dans members
SELECT 
    column_name,
    data_type,
    udt_name,
    column_default
FROM information_schema.columns
WHERE table_name = 'members' 
AND column_name = 'role';

-- 4. Essayer de voir si on peut caster la valeur
SELECT 'member'::user_role;

-- 5. Si le type n'existe pas ou n'a pas les bonnes valeurs, le recréer
-- (Décommenter et exécuter si nécessaire)
/*
DROP TYPE IF EXISTS user_role CASCADE;
CREATE TYPE user_role AS ENUM ('member', 'admin');

ALTER TABLE public.members 
ALTER COLUMN role TYPE user_role 
USING role::text::user_role;
*/