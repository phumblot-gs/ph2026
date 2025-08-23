-- 1. Vérifier si le trigger handle_new_user existe
SELECT 
    tgname as trigger_name,
    tgrelid::regclass as table_name,
    tgtype,
    tgenabled
FROM pg_trigger 
WHERE tgname = 'handle_new_user';

-- 2. Voir le code de la fonction handle_new_user
SELECT 
    proname as function_name,
    prosrc as function_source
FROM pg_proc 
WHERE proname = 'handle_new_user';

-- 3. Désactiver temporairement le trigger problématique
-- ALTER TABLE auth.users DISABLE TRIGGER handle_new_user;

-- 4. Ou supprimer complètement le trigger s'il est obsolète
-- DROP TRIGGER IF EXISTS handle_new_user ON auth.users;
-- DROP FUNCTION IF EXISTS handle_new_user();

-- 5. Alternative : Recréer le trigger avec le bon schéma
-- CREATE OR REPLACE FUNCTION handle_new_user()
-- RETURNS trigger AS $$
-- BEGIN
--     INSERT INTO public.members (
--         user_id, 
--         email, 
--         first_name, 
--         last_name, 
--         role, 
--         status
--     ) VALUES (
--         NEW.id, 
--         NEW.email,
--         COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
--         COALESCE(NEW.raw_user_meta_data->>'last_name', ''),
--         'member'::public.user_role,  -- Qualifier avec public
--         'active'::public.user_status  -- Qualifier avec public
--     );
--     RETURN NEW;
-- END;
-- $$ LANGUAGE plpgsql SECURITY DEFINER;