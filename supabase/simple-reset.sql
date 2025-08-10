-- Script simple pour supprimer uniquement le type enum
-- Utiliser ce script si vous avez déjà supprimé les tables manuellement

-- Supprimer le type enum user_role
DROP TYPE IF EXISTS public.user_role CASCADE;

-- Message de confirmation
SELECT 'Type user_role removed. You can now run complete-schema.sql' as message;