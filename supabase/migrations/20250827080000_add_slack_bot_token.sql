-- Script pour ajouter le token du bot Slack dans app_settings
-- IMPORTANT: Remplacez 'xoxb-YOUR-BOT-TOKEN' par votre vrai token de bot Slack

-- Vérifier si le token existe déjà
DO $$
BEGIN
    -- Si le token n'existe pas, l'insérer
    IF NOT EXISTS (
        SELECT 1 FROM app_settings 
        WHERE setting_key = 'slack_bot_token'
    ) THEN
        INSERT INTO app_settings (id, setting_key, setting_value, description, created_at, updated_at)
        VALUES (
            gen_random_uuid(),
            'slack_bot_token', 
            'xoxb-YOUR-BOT-TOKEN',
            'Token du bot Slack pour envoyer des messages',
            NOW(),
            NOW()
        );
        RAISE NOTICE 'Bot token ajouté dans app_settings';
    ELSE
        RAISE NOTICE 'Bot token existe déjà dans app_settings';
    END IF;
END $$;

-- Pour obtenir votre bot token :
-- 1. Allez sur https://api.slack.com/apps
-- 2. Sélectionnez votre application
-- 3. Allez dans "OAuth & Permissions"
-- 4. Copiez le "Bot User OAuth Token" (commence par xoxb-)
-- 5. Remplacez 'xoxb-YOUR-BOT-TOKEN' ci-dessus par ce token
-- 6. Exécutez ce script dans Supabase

-- Pour mettre à jour un token existant :
-- UPDATE app_settings 
-- SET setting_value = 'xoxb-YOUR-NEW-BOT-TOKEN'
-- WHERE setting_key = 'slack_bot_token';