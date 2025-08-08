-- Script 4 : Mettre à jour les membres existants (OPTIONNEL)
-- EXÉCUTEZ CE SCRIPT SI VOUS VOULEZ CHANGER LE RÔLE DES MEMBRES EXISTANTS

-- Mettre à jour votre propre compte en super_admin
-- Remplacez 'votre-email@example.com' par votre vraie email
UPDATE members 
SET role = 'super_admin' 
WHERE email = 'votre-email@example.com';

-- Optionnel : Voir tous les membres et leurs rôles
SELECT id, email, first_name, last_name, role, created_at 
FROM members 
ORDER BY created_at DESC;