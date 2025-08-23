-- 1. Vérifier si RLS est activé sur les tables
SELECT 
    tablename,
    rowsecurity
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN ('members', 'user_groups', 'groups');

-- 2. Vérifier les policies sur members
SELECT 
    policyname,
    cmd,
    roles,
    qual,
    with_check
FROM pg_policies 
WHERE tablename = 'members';

-- 3. Vérifier les policies sur user_groups
SELECT 
    policyname,
    cmd,
    roles,
    qual,
    with_check
FROM pg_policies 
WHERE tablename = 'user_groups';

-- 4. Vérifier si le groupe public existe
SELECT * FROM groups WHERE name = 'public';

-- 5. Vérifier les derniers users créés via OAuth
SELECT 
    id,
    email,
    created_at,
    raw_user_meta_data->>'full_name' as full_name,
    raw_user_meta_data->>'provider' as provider
FROM auth.users 
ORDER BY created_at DESC 
LIMIT 5;

-- 6. Vérifier s'il y a des entrées members correspondantes
SELECT 
    m.*
FROM members m
JOIN auth.users u ON u.id = m.user_id
WHERE u.created_at > NOW() - INTERVAL '1 hour';

-- 7. Tester manuellement l'insertion (remplace USER_ID par un vrai ID)
-- INSERT INTO members (user_id, email, first_name, last_name, role, status)
-- VALUES ('[USER_ID]', 'test@example.com', 'Test', 'User', 'member', 'active');