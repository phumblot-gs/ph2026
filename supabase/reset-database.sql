-- Script pour réinitialiser complètement la base de données
-- À exécuter avant complete-schema.sql
-- Les erreurs "does not exist" sont normales et peuvent être ignorées

-- Supprimer les triggers (ignore l'erreur si n'existe pas)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Supprimer les fonctions
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;
DROP FUNCTION IF EXISTS public.update_updated_at_column() CASCADE;

-- Supprimer les tables (si elles existent encore)
DROP TABLE IF EXISTS public.members CASCADE;

-- Supprimer les types enum
DROP TYPE IF EXISTS public.user_role CASCADE;

-- Note: Les politiques RLS sont automatiquement supprimées avec la table

-- Message de confirmation
SELECT 'Database reset complete. You can now run complete-schema.sql' as message;