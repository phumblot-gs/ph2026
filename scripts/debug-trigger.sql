-- Script de débogage pour identifier le problème avec le trigger
-- À exécuter dans le SQL Editor de Supabase Dashboard

-- 1. Vérifier la structure de la table members
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
AND table_name = 'members'
ORDER BY ordinal_position;

-- 2. Vérifier quelle fonction est appelée par le trigger
SELECT 
    t.tgname as trigger_name,
    p.proname as function_name,
    pg_get_functiondef(p.oid) as function_definition
FROM pg_trigger t
JOIN pg_proc p ON t.tgfoid = p.oid
WHERE t.tgname = 'on_auth_user_created';

-- 3. Vérifier s'il y a des erreurs dans les logs PostgreSQL
-- (Cette requête peut ne pas fonctionner selon les permissions)
SELECT * FROM pg_stat_activity WHERE state = 'idle in transaction';

-- 4. Vérifier les types ENUM
SELECT typname, enumlabel 
FROM pg_type t 
JOIN pg_enum e ON t.oid = e.enumtypid  
WHERE typname IN ('user_role', 'user_status')
ORDER BY typname, enumsortorder;

-- 5. Vérifier les contraintes sur la table members
SELECT 
    conname AS constraint_name,
    contype AS constraint_type,
    pg_get_constraintdef(oid) AS definition
FROM pg_constraint 
WHERE conrelid = 'public.members'::regclass;

-- 5. Si l'insertion manuelle fonctionne, le problème est dans le trigger
-- Vérifier si le groupe 'public' existe
SELECT * FROM public.groups WHERE name = 'public';

-- 6. Si le groupe n'existe pas, le créer
INSERT INTO public.groups (name, description)
VALUES ('public', 'Groupe par défaut pour tous les utilisateurs')
ON CONFLICT (name) DO NOTHING;