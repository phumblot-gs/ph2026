-- Script rapide pour créer un admin sans confirmation email
-- À exécuter dans l'éditeur SQL de Supabase

-- 1. Désactiver temporairement RLS sur la table members
ALTER TABLE members DISABLE ROW LEVEL SECURITY;

-- 2. Vérifier si vous avez des utilisateurs
SELECT id, email, created_at, email_confirmed_at 
FROM auth.users 
ORDER BY created_at DESC;

-- 3. Si vous avez un utilisateur non confirmé, confirmez-le
-- Remplacez 'votre-email@example.com' par votre vraie email
UPDATE auth.users 
SET email_confirmed_at = NOW(), 
    confirmed_at = NOW()
WHERE email = 'votre-email@example.com';

-- 4. Vérifier/créer l'entrée dans members
-- D'abord, récupérez l'ID de votre utilisateur
SELECT id, email FROM auth.users WHERE email = 'votre-email@example.com';

-- 5. Si aucune entrée dans members, créez-la
-- Remplacez 'USER_ID_HERE' par l'ID obtenu ci-dessus
INSERT INTO members (user_id, email, first_name, last_name, role)
VALUES (
  'USER_ID_HERE',
  'votre-email@example.com',
  'Admin',
  'PH2026',
  'super_admin'
)
ON CONFLICT (email) 
DO UPDATE SET role = 'super_admin';

-- 6. Vérifier que tout est OK
SELECT * FROM members WHERE email = 'votre-email@example.com';

-- 7. Réactiver RLS
ALTER TABLE members ENABLE ROW LEVEL SECURITY;