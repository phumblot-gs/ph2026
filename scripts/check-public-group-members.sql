-- Vérifier le groupe public
SELECT id, name, description FROM groups WHERE name = 'public';

-- Compter les membres dans le groupe public via user_groups
SELECT COUNT(*) as members_in_user_groups
FROM user_groups ug
JOIN groups g ON g.id = ug.group_id
WHERE g.name = 'public';

-- Compter tous les membres actifs
SELECT COUNT(*) as total_active_members
FROM members
WHERE status = 'active';

-- Vérifier si les membres sont bien associés au groupe public
SELECT 
    m.user_id,
    m.first_name,
    m.last_name,
    m.email,
    CASE 
        WHEN ug.user_id IS NOT NULL THEN 'Oui'
        ELSE 'Non'
    END as dans_groupe_public
FROM members m
LEFT JOIN user_groups ug ON m.user_id = ug.user_id 
    AND ug.group_id = (SELECT id FROM groups WHERE name = 'public')
WHERE m.status = 'active'
ORDER BY dans_groupe_public DESC, m.created_at DESC
LIMIT 10;

-- Si des membres manquent, les ajouter au groupe public
-- INSERT INTO user_groups (user_id, group_id)
-- SELECT 
--     m.user_id,
--     (SELECT id FROM groups WHERE name = 'public')
-- FROM members m
-- WHERE m.status = 'active'
--     AND NOT EXISTS (
--         SELECT 1 FROM user_groups ug 
--         WHERE ug.user_id = m.user_id 
--         AND ug.group_id = (SELECT id FROM groups WHERE name = 'public')
--     );