-- 1. Vérifier dans quel schéma le type existe
SELECT 
    n.nspname as schema,
    t.typname as type_name,
    t.typtype
FROM pg_type t
JOIN pg_namespace n ON n.oid = t.typnamespace
WHERE t.typname IN ('user_role', 'user_status')
ORDER BY n.nspname, t.typname;

-- 2. Vérifier la structure de la table members
SELECT 
    column_name,
    data_type,
    udt_name,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'members' 
AND table_schema = 'public'
ORDER BY ordinal_position;

-- 3. Vérifier le search_path actuel
SHOW search_path;

-- 4. Si le type existe dans un autre schéma, le créer dans public
-- DO $$ 
-- BEGIN
--     IF NOT EXISTS (
--         SELECT 1 FROM pg_type t 
--         JOIN pg_namespace n ON n.oid = t.typnamespace 
--         WHERE t.typname = 'user_role' 
--         AND n.nspname = 'public'
--     ) THEN
--         CREATE TYPE public.user_role AS ENUM ('member', 'admin');
--     END IF;
-- END $$;

-- 5. Vérifier les permissions sur le type
SELECT 
    n.nspname as schema,
    t.typname,
    pg_catalog.array_to_string(t.typacl, E'\n') AS privileges
FROM pg_type t
JOIN pg_namespace n ON n.oid = t.typnamespace
WHERE t.typname = 'user_role';

-- 6. Accorder les permissions si nécessaire
-- GRANT USAGE ON TYPE public.user_role TO authenticated;
-- GRANT USAGE ON TYPE public.user_role TO anon;
-- GRANT USAGE ON TYPE public.user_role TO service_role;