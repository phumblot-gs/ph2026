-- Script 6 : Créer un trigger pour notifier les admins des nouvelles inscriptions

-- D'abord, activer l'extension pg_net si elle n'est pas déjà activée
-- Cette extension permet d'appeler des API externes depuis PostgreSQL
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Créer une fonction qui sera appelée par le trigger
CREATE OR REPLACE FUNCTION notify_new_member_registration()
RETURNS trigger AS $$
DECLARE
  edge_function_url TEXT;
  service_role_key TEXT;
BEGIN
  -- Ne notifier que pour les nouveaux membres avec le rôle 'pending'
  IF NEW.role = 'pending' THEN
    -- Récupérer l'URL de la Edge Function (à configurer dans les variables d'environnement)
    -- Pour l'instant on utilise l'URL par défaut de Supabase
    edge_function_url := 'https://' || current_setting('app.settings.supabase_project_ref', true) || '.supabase.co/functions/v1/notify-new-member';
    
    -- Note: En production, le service_role_key devrait être stocké de manière sécurisée
    -- Pour l'instant, on utilisera la Edge Function avec les permissions appropriées
    
    -- Appeler la Edge Function de manière asynchrone
    PERFORM net.http_post(
      url := edge_function_url,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.settings.supabase_anon_key', true)
      ),
      body := jsonb_build_object(
        'member_id', NEW.id::text
      )
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Créer le trigger qui s'exécute après l'insertion d'un nouveau membre
DROP TRIGGER IF EXISTS on_new_member_created ON members;
CREATE TRIGGER on_new_member_created
  AFTER INSERT ON members
  FOR EACH ROW
  EXECUTE FUNCTION notify_new_member_registration();

-- Fonction helper pour envoyer manuellement une notification (utile pour les tests)
CREATE OR REPLACE FUNCTION send_new_member_notification(member_uuid UUID)
RETURNS void AS $$
DECLARE
  edge_function_url TEXT;
BEGIN
  edge_function_url := 'https://' || current_setting('app.settings.supabase_project_ref', true) || '.supabase.co/functions/v1/notify-new-member';
  
  PERFORM net.http_post(
    url := edge_function_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.supabase_anon_key', true)
    ),
    body := jsonb_build_object(
      'member_id', member_uuid::text
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Commenter cette ligne pour l'instant car elle nécessite la configuration des variables
-- COMMENT ON FUNCTION send_new_member_notification IS 'Fonction pour tester l''envoi de notification pour un membre spécifique';

-- Alternative : Utiliser Supabase Realtime + webhooks
-- Si pg_net n'est pas disponible, on peut utiliser une approche différente avec les webhooks Supabase
-- Cette approche sera documentée séparément