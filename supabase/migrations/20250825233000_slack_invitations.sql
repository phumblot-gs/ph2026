-- Créer la table pour stocker les demandes d'invitation Slack
CREATE TABLE IF NOT EXISTS slack_invitations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  first_name TEXT,
  last_name TEXT,
  requested_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,
  completed_by UUID REFERENCES auth.users(id),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'cancelled')),
  UNIQUE(user_id)
);

-- Index pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_slack_invitations_status ON slack_invitations(status);
CREATE INDEX IF NOT EXISTS idx_slack_invitations_user ON slack_invitations(user_id);
CREATE INDEX IF NOT EXISTS idx_slack_invitations_requested ON slack_invitations(requested_at DESC);

-- Activer RLS
ALTER TABLE slack_invitations ENABLE ROW LEVEL SECURITY;

-- Politique pour les utilisateurs : peuvent voir et créer leurs propres demandes
CREATE POLICY "Users can view own invitations" ON slack_invitations
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create own invitations" ON slack_invitations
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Politique pour les admins : accès complet
CREATE POLICY "Admins can view all invitations" ON slack_invitations
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM members 
      WHERE members.user_id = auth.uid() 
      AND members.role = 'admin'
    )
  );

CREATE POLICY "Admins can update invitations" ON slack_invitations
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM members 
      WHERE members.user_id = auth.uid() 
      AND members.role = 'admin'
    )
  );

-- Définir le canal Slack par défaut pour le groupe public
-- Le canal #tous-nous-parisiens est imposé par Slack et doit être utilisé pour le groupe public
UPDATE groups
SET slack_channel_id = 'C09BSD59352'  -- ID du canal #tous-nous-parisiens (à remplacer par l'ID réel)
WHERE LOWER(name) = 'public';