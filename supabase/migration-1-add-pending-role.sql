-- Script 1 : Ajouter le rôle 'pending' au type enum
-- EXÉCUTEZ CE SCRIPT EN PREMIER ET ATTENDEZ QU'IL SE TERMINE

-- Ajouter la valeur 'pending' au type enum user_role
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'pending' AFTER 'expert';