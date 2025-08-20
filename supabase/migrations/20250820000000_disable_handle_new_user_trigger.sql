-- ============================================
-- Migration pour désactiver le trigger handle_new_user
-- Date: 2025-08-20
-- Description: Désactive le trigger car la création des membres est gérée par le callback OAuth
-- ============================================

-- Supprimer les triggers qui dépendent de la fonction
DROP TRIGGER IF EXISTS handle_new_user ON auth.users;
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Supprimer la fonction associée
DROP FUNCTION IF EXISTS handle_new_user() CASCADE;

-- Note: La création des membres est maintenant gérée par :
-- - /api/auth/signup pour les inscriptions email/password
-- - /auth/callback pour les connexions OAuth