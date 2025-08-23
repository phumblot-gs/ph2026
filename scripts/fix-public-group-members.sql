-- Script pour corriger les membres du groupe public dans user_groups

-- 1. Vérifier l'ID du groupe public
SELECT id, name, description 
FROM groups 
WHERE name = 'public';

-- 2. Vérifier les associations existantes dans user_groups pour le groupe public
SELECT COUNT(*) as existing_members_count
FROM user_groups
WHERE group_id = 'dc2ca80a-48b7-492a-aa32-67b9322c951b';

-- 3. Compter tous les membres actifs qui devraient être dans le groupe public
SELECT COUNT(*) as total_active_members
FROM members
WHERE status = 'active';

-- 4. Identifier les membres actifs qui ne sont PAS dans le groupe public
SELECT m.user_id, m.first_name, m.last_name, m.email
FROM members m
WHERE m.status = 'active'
  AND NOT EXISTS (
    SELECT 1 
    FROM user_groups ug 
    WHERE ug.user_id = m.user_id 
      AND ug.group_id = 'dc2ca80a-48b7-492a-aa32-67b9322c951b'
  );

-- 5. CORRECTION: Ajouter tous les membres actifs au groupe public s'ils n'y sont pas déjà
INSERT INTO user_groups (user_id, group_id, created_at, updated_at)
SELECT 
    m.user_id,
    'dc2ca80a-48b7-492a-aa32-67b9322c951b' as group_id,
    COALESCE(m.created_at, NOW()) as created_at,
    NOW() as updated_at
FROM members m
WHERE m.status = 'active'
  AND NOT EXISTS (
    SELECT 1 
    FROM user_groups ug 
    WHERE ug.user_id = m.user_id 
      AND ug.group_id = 'dc2ca80a-48b7-492a-aa32-67b9322c951b'
  )
ON CONFLICT (user_id, group_id) DO NOTHING;

-- 6. Vérifier après correction
SELECT COUNT(*) as members_after_fix
FROM user_groups
WHERE group_id = 'dc2ca80a-48b7-492a-aa32-67b9322c951b';

-- 7. Afficher les membres du groupe public après correction
SELECT 
    ug.user_id,
    m.first_name,
    m.last_name,
    m.email,
    ug.created_at as joined_group_at
FROM user_groups ug
JOIN members m ON m.user_id = ug.user_id
WHERE ug.group_id = 'dc2ca80a-48b7-492a-aa32-67b9322c951b'
ORDER BY m.created_at DESC;