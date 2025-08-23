-- Migration pour ajouter l'intégration Slack
-- Ajoute les colonnes nécessaires pour l'authentification et la gestion des canaux Slack

-- ==========================================
-- 1. Ajouter colonnes Slack à la table members
-- ==========================================
ALTER TABLE members ADD COLUMN IF NOT EXISTS slack_user_id TEXT;
ALTER TABLE members ADD COLUMN IF NOT EXISTS slack_access_token TEXT;
ALTER TABLE members ADD COLUMN IF NOT EXISTS slack_connected_at TIMESTAMPTZ;

-- Créer un index sur slack_user_id pour les recherches rapides
CREATE INDEX IF NOT EXISTS idx_members_slack_user_id ON members(slack_user_id);

-- ==========================================
-- 2. Ajouter colonne Slack à la table groups
-- ==========================================
ALTER TABLE groups ADD COLUMN IF NOT EXISTS slack_channel_id TEXT;

-- Créer un index sur slack_channel_id
CREATE INDEX IF NOT EXISTS idx_groups_slack_channel_id ON groups(slack_channel_id);

-- ==========================================
-- 3. Table pour stocker les tokens Slack App
-- ==========================================
CREATE TABLE IF NOT EXISTS slack_app_config (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  bot_token TEXT NOT NULL,
  app_token TEXT,
  team_id TEXT NOT NULL,
  team_name TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES members(user_id),
  UNIQUE(team_id)
);

-- ==========================================
-- 4. Table pour logger les actions Slack
-- ==========================================
CREATE TABLE IF NOT EXISTS slack_activity_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES members(user_id),
  action_type TEXT NOT NULL, -- 'connect', 'disconnect', 'channel_created', 'channel_deleted', 'user_added', 'user_removed'
  group_id UUID REFERENCES groups(id),
  slack_channel_id TEXT,
  slack_user_id TEXT,
  details JSONB,
  error TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Index pour les requêtes fréquentes
CREATE INDEX IF NOT EXISTS idx_slack_activity_log_user_id ON slack_activity_log(user_id);
CREATE INDEX IF NOT EXISTS idx_slack_activity_log_group_id ON slack_activity_log(group_id);
CREATE INDEX IF NOT EXISTS idx_slack_activity_log_created_at ON slack_activity_log(created_at DESC);

-- ==========================================
-- 5. Policies RLS
-- ==========================================

-- Policies pour slack_app_config (admin seulement)
ALTER TABLE slack_app_config ENABLE ROW LEVEL SECURITY;

-- Supprimer les policies existantes avant de les recréer
DROP POLICY IF EXISTS "Admin can view Slack app config" ON slack_app_config;
DROP POLICY IF EXISTS "Admin can insert Slack app config" ON slack_app_config;
DROP POLICY IF EXISTS "Admin can update Slack app config" ON slack_app_config;
DROP POLICY IF EXISTS "Admin can delete Slack app config" ON slack_app_config;

-- Admin peut voir la config
CREATE POLICY "Admin can view Slack app config" ON slack_app_config
  FOR SELECT 
  USING (
    EXISTS (
      SELECT 1 FROM members 
      WHERE members.user_id = auth.uid() 
      AND members.role = 'admin'
    )
  );

-- Admin peut insérer la config
CREATE POLICY "Admin can insert Slack app config" ON slack_app_config
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM members 
      WHERE members.user_id = auth.uid() 
      AND members.role = 'admin'
    )
  );

-- Admin peut mettre à jour la config
CREATE POLICY "Admin can update Slack app config" ON slack_app_config
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM members 
      WHERE members.user_id = auth.uid() 
      AND members.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM members 
      WHERE members.user_id = auth.uid() 
      AND members.role = 'admin'
    )
  );

-- Admin peut supprimer la config
CREATE POLICY "Admin can delete Slack app config" ON slack_app_config
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM members 
      WHERE members.user_id = auth.uid() 
      AND members.role = 'admin'
    )
  );

-- Policies pour slack_activity_log
ALTER TABLE slack_activity_log ENABLE ROW LEVEL SECURITY;

-- Supprimer les policies existantes avant de les recréer
DROP POLICY IF EXISTS "Admin can view all Slack logs" ON slack_activity_log;
DROP POLICY IF EXISTS "Users can view own Slack logs" ON slack_activity_log;
DROP POLICY IF EXISTS "Users can insert own Slack logs" ON slack_activity_log;
DROP POLICY IF EXISTS "No one can update Slack logs" ON slack_activity_log;
DROP POLICY IF EXISTS "Admin can delete Slack logs" ON slack_activity_log;

-- Les admins peuvent voir tous les logs
CREATE POLICY "Admin can view all Slack logs" ON slack_activity_log
  FOR SELECT 
  USING (
    EXISTS (
      SELECT 1 FROM members 
      WHERE members.user_id = auth.uid() 
      AND members.role = 'admin'
    )
  );

-- Les utilisateurs peuvent voir leurs propres logs
CREATE POLICY "Users can view own Slack logs" ON slack_activity_log
  FOR SELECT 
  USING (user_id = auth.uid());

-- Les utilisateurs authentifiés peuvent insérer leurs propres logs
CREATE POLICY "Users can insert own Slack logs" ON slack_activity_log
  FOR INSERT 
  WITH CHECK (
    auth.uid() IS NOT NULL 
    AND (
      user_id = auth.uid() 
      OR EXISTS (
        SELECT 1 FROM members 
        WHERE members.user_id = auth.uid() 
        AND members.role = 'admin'
      )
    )
  );

-- Les logs sont immutables (pas de modification)
CREATE POLICY "No one can update Slack logs" ON slack_activity_log
  FOR UPDATE
  USING (false);

-- Seuls les admins peuvent supprimer des logs (pour RGPD)
CREATE POLICY "Admin can delete Slack logs" ON slack_activity_log
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM members 
      WHERE members.user_id = auth.uid() 
      AND members.role = 'admin'
    )
  );

-- ==========================================
-- 6. Fonctions utilitaires
-- ==========================================

-- Fonction pour obtenir les membres d'un groupe connectés à Slack
CREATE OR REPLACE FUNCTION get_slack_connected_group_members(p_group_id UUID)
RETURNS TABLE (
  user_id UUID,
  slack_user_id TEXT,
  first_name TEXT,
  last_name TEXT,
  email TEXT
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    m.user_id,
    m.slack_user_id,
    m.first_name,
    m.last_name,
    m.email
  FROM members m
  INNER JOIN user_groups ug ON ug.user_id = m.user_id
  WHERE ug.group_id = p_group_id
    AND m.slack_user_id IS NOT NULL;
END;
$$;

-- Fonction pour obtenir les groupes d'un utilisateur avec leurs canaux Slack
CREATE OR REPLACE FUNCTION get_user_groups_with_slack(p_user_id UUID)
RETURNS TABLE (
  group_id UUID,
  group_name TEXT,
  slack_channel_id TEXT,
  user_slack_connected BOOLEAN
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    g.id AS group_id,
    g.name AS group_name,
    g.slack_channel_id,
    (m.slack_user_id IS NOT NULL) AS user_slack_connected
  FROM groups g
  INNER JOIN user_groups ug ON ug.group_id = g.id
  LEFT JOIN members m ON m.user_id = p_user_id
  WHERE ug.user_id = p_user_id;
END;
$$;

-- ==========================================
-- 7. Triggers pour audit
-- ==========================================

-- Trigger pour mettre à jour updated_at sur slack_app_config
CREATE OR REPLACE FUNCTION update_slack_app_config_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_slack_app_config_updated_at ON slack_app_config;
CREATE TRIGGER update_slack_app_config_updated_at
  BEFORE UPDATE ON slack_app_config
  FOR EACH ROW
  EXECUTE FUNCTION update_slack_app_config_updated_at();

-- ==========================================
-- 8. Permissions supplémentaires
-- ==========================================

-- Permettre aux admins de mettre à jour les colonnes Slack des membres
GRANT UPDATE (slack_user_id, slack_access_token, slack_connected_at) ON members TO authenticated;

-- Permettre aux admins de mettre à jour slack_channel_id des groupes
GRANT UPDATE (slack_channel_id) ON groups TO authenticated;

-- ==========================================
-- 9. Contraintes de validation
-- ==========================================

-- Vérifier que slack_user_id a le bon format (commence par U)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'check_slack_user_id_format'
  ) THEN
    ALTER TABLE members 
      ADD CONSTRAINT check_slack_user_id_format 
      CHECK (slack_user_id IS NULL OR slack_user_id ~ '^U[A-Z0-9]+$');
  END IF;
END $$;

-- Vérifier que slack_channel_id a le bon format (commence par C)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'check_slack_channel_id_format'
  ) THEN
    ALTER TABLE groups 
      ADD CONSTRAINT check_slack_channel_id_format 
      CHECK (slack_channel_id IS NULL OR slack_channel_id ~ '^C[A-Z0-9]+$');
  END IF;
END $$;

-- Vérifier que action_type est valide
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'check_action_type_valid'
  ) THEN
    ALTER TABLE slack_activity_log
      ADD CONSTRAINT check_action_type_valid
      CHECK (action_type IN (
        'connect', 'disconnect', 
        'channel_created', 'channel_deleted', 
        'user_added', 'user_removed',
        'channel_sync', 'message_sent'
      ));
  END IF;
END $$;

-- ==========================================
-- 10. Indexes supplémentaires pour performance
-- ==========================================

-- Index sur slack_connected_at pour les requêtes de tri
CREATE INDEX IF NOT EXISTS idx_members_slack_connected_at 
  ON members(slack_connected_at DESC) 
  WHERE slack_user_id IS NOT NULL;

-- Index composite pour les requêtes fréquentes
CREATE INDEX IF NOT EXISTS idx_slack_activity_log_user_action 
  ON slack_activity_log(user_id, action_type, created_at DESC);

-- ==========================================
-- 11. Grants pour les fonctions
-- ==========================================

-- Permettre aux utilisateurs authentifiés d'utiliser les fonctions utilitaires
GRANT EXECUTE ON FUNCTION get_slack_connected_group_members(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_groups_with_slack(UUID) TO authenticated;

-- ==========================================
-- 12. Commentaires pour documentation
-- ==========================================

COMMENT ON COLUMN members.slack_user_id IS 'ID utilisateur Slack (format: U1234567890)';
COMMENT ON COLUMN members.slack_access_token IS 'Token OAuth Slack chiffré de l''utilisateur';
COMMENT ON COLUMN members.slack_connected_at IS 'Date de connexion à Slack';
COMMENT ON COLUMN groups.slack_channel_id IS 'ID du canal Slack associé au groupe (format: C1234567890)';
COMMENT ON TABLE slack_app_config IS 'Configuration globale de l''application Slack';
COMMENT ON TABLE slack_activity_log IS 'Journal des activités Slack pour audit et debug';
COMMENT ON CONSTRAINT check_slack_user_id_format ON members IS 'Format Slack user ID: U suivi de lettres/chiffres majuscules';
COMMENT ON CONSTRAINT check_slack_channel_id_format ON groups IS 'Format Slack channel ID: C suivi de lettres/chiffres majuscules';
COMMENT ON CONSTRAINT check_action_type_valid ON slack_activity_log IS 'Types d''actions Slack autorisées';