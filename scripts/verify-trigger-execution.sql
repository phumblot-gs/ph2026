-- Script pour vérifier pourquoi le trigger ne crée pas les entrées dans members
-- À exécuter dans Supabase SQL Editor

-- 1. Vérifier les utilisateurs dans auth.users
SELECT 
    id,
    email,
    created_at,
    raw_user_meta_data
FROM auth.users
ORDER BY created_at DESC
LIMIT 5;

-- 2. Vérifier les membres dans public.members
SELECT 
    id,
    user_id,
    email,
    first_name,
    last_name,
    role,
    status,
    created_at
FROM public.members
ORDER BY created_at DESC
LIMIT 5;

-- 3. Trouver les utilisateurs qui ne sont PAS dans members
SELECT 
    u.id as user_id,
    u.email,
    u.created_at,
    u.raw_user_meta_data
FROM auth.users u
LEFT JOIN public.members m ON u.id = m.user_id
WHERE m.user_id IS NULL;

-- 4. Vérifier si le trigger existe et est actif
SELECT 
    tgname as trigger_name,
    tgenabled as is_enabled,
    tgtype as trigger_type
FROM pg_trigger 
WHERE tgrelid = 'auth.users'::regclass;

-- 5. Vérifier les erreurs PostgreSQL récentes (si accessible)
-- Cette requête peut ne pas fonctionner selon les permissions
SELECT 
    query,
    state,
    wait_event_type,
    wait_event
FROM pg_stat_activity 
WHERE state != 'idle' 
ORDER BY query_start DESC 
LIMIT 10;

-- 6. Tester manuellement l'insertion pour un utilisateur existant
-- (Remplacer USER_ID_HERE par un ID d'utilisateur qui n'est pas dans members)
/*
DO $$
DECLARE
    test_user RECORD;
BEGIN
    -- Récupérer un utilisateur qui n'est pas dans members
    SELECT * INTO test_user
    FROM auth.users u
    LEFT JOIN public.members m ON u.id = m.user_id
    WHERE m.user_id IS NULL
    LIMIT 1;
    
    IF test_user.id IS NOT NULL THEN
        -- Essayer d'insérer manuellement
        INSERT INTO public.members (
            user_id, 
            email, 
            first_name, 
            last_name, 
            role,
            status
        ) VALUES (
            test_user.id,
            test_user.email,
            COALESCE(test_user.raw_user_meta_data->>'first_name', ''),
            COALESCE(test_user.raw_user_meta_data->>'last_name', ''),
            'member'::user_role,
            'active'::user_status
        );
        
        RAISE NOTICE 'Utilisateur % ajouté avec succès', test_user.email;
    ELSE
        RAISE NOTICE 'Aucun utilisateur orphelin trouvé';
    END IF;
END $$;
*/