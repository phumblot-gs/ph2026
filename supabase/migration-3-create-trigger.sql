-- Script 3 : Créer le trigger
-- EXÉCUTEZ CE SCRIPT APRÈS LE SCRIPT 2

-- Supprimer l'ancien trigger s'il existe
DROP TRIGGER IF EXISTS notify_admins_on_new_member ON members;

-- Créer le nouveau trigger pour notifier les admins
CREATE TRIGGER notify_admins_on_new_member
  AFTER INSERT ON members
  FOR EACH ROW 
  WHEN (NEW.role = 'pending')
  EXECUTE FUNCTION public.notify_admins_new_member();