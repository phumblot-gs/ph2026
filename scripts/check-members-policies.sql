-- Vérifier les policies INSERT sur members
SELECT 
    policyname,
    permissive,
    roles,
    cmd,
    qual as using_clause,
    with_check as with_check_clause
FROM pg_policies 
WHERE tablename = 'members'
AND cmd = 'INSERT';

-- Vérifier si un utilisateur peut créer sa propre entrée
-- La policy devrait permettre quelque chose comme : auth.uid() = user_id