-- ============================================
-- Script pour EXTRAIRE le schéma complet
-- À exécuter dans l'environnement PRODUCTION
-- ============================================

-- 1. Lister tous les TYPES personnalisés
SELECT 
    'CREATE TYPE ' || n.nspname || '.' || t.typname || ' AS ENUM (' ||
    string_agg(quote_literal(e.enumlabel), ', ' ORDER BY e.enumsortorder) || ');' as sql_command
FROM pg_type t
JOIN pg_enum e ON t.oid = e.enumtypid
JOIN pg_namespace n ON t.typnamespace = n.oid
WHERE n.nspname = 'public'
GROUP BY n.nspname, t.typname;

-- 2. Lister toutes les TABLES avec leurs colonnes
SELECT 
    'CREATE TABLE ' || table_name || ' (' || chr(10) ||
    string_agg(
        '  ' || column_name || ' ' || 
        data_type || 
        CASE 
            WHEN character_maximum_length IS NOT NULL 
            THEN '(' || character_maximum_length || ')'
            ELSE ''
        END ||
        CASE 
            WHEN is_nullable = 'NO' THEN ' NOT NULL'
            ELSE ''
        END ||
        CASE 
            WHEN column_default IS NOT NULL 
            THEN ' DEFAULT ' || column_default
            ELSE ''
        END,
        ',' || chr(10)
    ) || chr(10) || ');'
FROM information_schema.columns
WHERE table_schema = 'public'
GROUP BY table_name
ORDER BY table_name;

-- 3. Lister tous les INDEX
SELECT 
    pg_get_indexdef(indexrelid) || ';' as sql_command
FROM pg_index
WHERE indrelid IN (
    SELECT oid FROM pg_class 
    WHERE relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
);

-- 4. Lister toutes les FOREIGN KEYS
SELECT 
    'ALTER TABLE ' || tc.table_name || 
    ' ADD CONSTRAINT ' || tc.constraint_name || 
    ' FOREIGN KEY (' || kcu.column_name || ')' ||
    ' REFERENCES ' || ccu.table_name || '(' || ccu.column_name || ');'
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY' 
    AND tc.table_schema = 'public';

-- 5. Lister toutes les FONCTIONS
SELECT 
    pg_get_functiondef(oid) || ';' as sql_command
FROM pg_proc
WHERE pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');

-- 6. Lister tous les TRIGGERS
SELECT 
    pg_get_triggerdef(oid) || ';' as sql_command
FROM pg_trigger
WHERE tgrelid IN (
    SELECT oid FROM pg_class 
    WHERE relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
);

-- 7. Lister toutes les POLITIQUES RLS
SELECT 
    'CREATE POLICY ' || pol.polname || ' ON ' || 
    n.nspname || '.' || c.relname || 
    ' AS ' || pol.polpermissive::text ||
    ' FOR ' || pol.polcmd::text ||
    ' TO ' || pg_get_userbyid(pol.polroles[1]) ||
    ' USING (' || pg_get_expr(pol.polqual, pol.polrelid) || ')' ||
    CASE 
        WHEN pol.polwithcheck IS NOT NULL 
        THEN ' WITH CHECK (' || pg_get_expr(pol.polwithcheck, pol.polrelid) || ')'
        ELSE ''
    END || ';'
FROM pg_policy pol
JOIN pg_class c ON pol.polrelid = c.oid
JOIN pg_namespace n ON c.relnamespace = n.oid
WHERE n.nspname = 'public';

-- 8. Vérifier si RLS est activé sur les tables
SELECT 
    'ALTER TABLE ' || schemaname || '.' || tablename || 
    ' ENABLE ROW LEVEL SECURITY;' as sql_command
FROM pg_tables
WHERE schemaname = 'public' 
    AND rowsecurity = true;