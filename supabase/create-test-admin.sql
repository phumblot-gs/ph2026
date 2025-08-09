-- Script pour créer un compte super_admin de test en local
-- ⚠️  NE PAS EXÉCUTER EN PRODUCTION ⚠️

-- Email et mot de passe du compte test
-- Email: admin@test.local
-- Mot de passe: Admin123!

-- Créer l'utilisateur dans auth.users
INSERT INTO auth.users (
  id,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_user_meta_data,
  raw_app_meta_data,
  created_at,
  updated_at,
  confirmation_token,
  email_change,
  email_change_token_new,
  recovery_token
) VALUES (
  '00000000-0000-0000-0000-000000000001'::uuid, -- ID fixe pour faciliter les tests
  'admin@test.local',
  crypt('Admin123!', gen_salt('bf')), -- Mot de passe hashé
  now(),
  '{"first_name": "Admin", "last_name": "Test"}'::jsonb,
  '{"provider": "email", "providers": ["email"]}'::jsonb,
  now(),
  now(),
  '',
  '',
  '',
  ''
) ON CONFLICT (id) DO UPDATE SET
  email = EXCLUDED.email,
  encrypted_password = EXCLUDED.encrypted_password,
  updated_at = now();

-- Créer le membre correspondant avec le rôle super_admin
INSERT INTO public.members (
  user_id,
  email,
  first_name,
  last_name,
  phone,
  role,
  created_at,
  updated_at
) VALUES (
  '00000000-0000-0000-0000-000000000001'::uuid,
  'admin@test.local',
  'Admin',
  'Test',
  '',
  'super_admin',
  now(),
  now()
) ON CONFLICT (user_id) DO UPDATE SET
  role = 'super_admin',
  updated_at = now();

-- Créer quelques membres pending pour tester la modération
INSERT INTO auth.users (
  id,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_user_meta_data,
  created_at,
  updated_at
) VALUES 
  (
    gen_random_uuid(),
    'pending1@test.local',
    crypt('Test123!', gen_salt('bf')),
    now(),
    '{"first_name": "Pierre", "last_name": "Dupont"}'::jsonb,
    now(),
    now()
  ),
  (
    gen_random_uuid(),
    'pending2@test.local',
    crypt('Test123!', gen_salt('bf')),
    now(),
    '{"first_name": "Marie", "last_name": "Martin"}'::jsonb,
    now(),
    now()
  ),
  (
    gen_random_uuid(),
    'pending3@test.local',
    crypt('Test123!', gen_salt('bf')),
    now(),
    '{"first_name": "Jean", "last_name": "Bernard"}'::jsonb,
    now(),
    now()
  )
ON CONFLICT DO NOTHING;

-- Créer les membres correspondants avec le rôle pending
INSERT INTO public.members (user_id, email, first_name, last_name, role)
SELECT 
  id,
  email,
  raw_user_meta_data->>'first_name',
  raw_user_meta_data->>'last_name',
  'pending'
FROM auth.users 
WHERE email IN ('pending1@test.local', 'pending2@test.local', 'pending3@test.local')
ON CONFLICT DO NOTHING;

-- Afficher les comptes créés
SELECT 
  m.email,
  m.first_name || ' ' || m.last_name as name,
  m.role,
  CASE 
    WHEN m.email = 'admin@test.local' THEN 'Admin123!'
    ELSE 'Test123!'
  END as password
FROM members m
WHERE m.email LIKE '%@test.local'
ORDER BY m.role DESC, m.email;