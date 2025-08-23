-- Migration pour ajouter le système de donations

-- 1. Étendre la table members avec les informations d'adresse et date de naissance
ALTER TABLE members ADD COLUMN IF NOT EXISTS birth_date DATE;
ALTER TABLE members ADD COLUMN IF NOT EXISTS address_line1 TEXT;
ALTER TABLE members ADD COLUMN IF NOT EXISTS address_line2 TEXT;
ALTER TABLE members ADD COLUMN IF NOT EXISTS postal_code VARCHAR(10);
ALTER TABLE members ADD COLUMN IF NOT EXISTS city VARCHAR(255);
ALTER TABLE members ADD COLUMN IF NOT EXISTS country VARCHAR(100);
ALTER TABLE members ADD COLUMN IF NOT EXISTS google_place_id VARCHAR(255);

-- 2. Créer la table donations
CREATE TABLE IF NOT EXISTS donations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  member_id UUID NOT NULL REFERENCES members(id) ON DELETE RESTRICT,
  amount DECIMAL(10,2) NOT NULL CHECK (amount > 0),
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed', 'refunded')),
  stripe_payment_intent_id VARCHAR(255),
  stripe_checkout_session_id VARCHAR(255),
  payment_method VARCHAR(50),
  refund_amount DECIMAL(10,2) DEFAULT 0 CHECK (refund_amount >= 0),
  refund_reason TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Index pour les recherches fréquentes
CREATE INDEX IF NOT EXISTS idx_donations_member_id ON donations(member_id);
CREATE INDEX IF NOT EXISTS idx_donations_status ON donations(status);
CREATE INDEX IF NOT EXISTS idx_donations_created_at ON donations(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_donations_stripe_payment_intent ON donations(stripe_payment_intent_id);

-- 3. Créer la table app_settings pour les paramètres globaux
CREATE TABLE IF NOT EXISTS app_settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  setting_key VARCHAR(255) NOT NULL UNIQUE,
  setting_value TEXT,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Insérer les paramètres par défaut
INSERT INTO app_settings (setting_key, setting_value, description) VALUES
  ('donations_enabled', 'false', 'Active ou désactive la fonctionnalité de dons sur le site'),
  ('donation_yearly_limit', '7500', 'Plafond annuel de donation par personne en euros (législation française)'),
  ('donation_minimum_age', '18', 'Âge minimum pour faire un don'),
  ('support_email', 'support@ph2026.fr', 'Email de support pour les questions sur les dons')
ON CONFLICT (setting_key) DO NOTHING;

-- 4. Créer la table app_settings_donation pour les exemples de dons
CREATE TABLE IF NOT EXISTS app_settings_donation (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  amount DECIMAL(10,2) NOT NULL CHECK (amount > 0),
  title VARCHAR(255) NOT NULL,
  description TEXT,
  display_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Index pour le tri
CREATE INDEX IF NOT EXISTS idx_app_settings_donation_order ON app_settings_donation(display_order, amount);

-- Insérer les exemples de dons par défaut
INSERT INTO app_settings_donation (amount, title, description, display_order) VALUES
  (5, 'Un coup de pouce bienvenu', 'Chaque euro compte pour faire avancer nos idées', 1),
  (20, 'Communication digitale', 'Nos messages diffusés pendant 3 jours sur les réseaux sociaux', 2),
  (100, 'Mobilisation terrain', 'Impression de tracts pour 1 journée d''actions sur le terrain', 3),
  (500, 'Un événement local', 'Organisation d''une rencontre citoyenne dans votre quartier', 4),
  (1000, 'Donateur officiel', 'Vous devenez donateur officiel de la campagne', 5),
  (4000, 'Grand donateur', 'Vous devenez grand donateur de la campagne', 6);

-- 5. Créer une table pour stocker temporairement les données de checkout
CREATE TABLE IF NOT EXISTS checkout_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_token VARCHAR(255) NOT NULL UNIQUE,
  email VARCHAR(255) NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  member_data JSONB NOT NULL,
  status VARCHAR(50) DEFAULT 'pending',
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Index pour les tokens et l'expiration
CREATE INDEX IF NOT EXISTS idx_checkout_sessions_token ON checkout_sessions(session_token);
CREATE INDEX IF NOT EXISTS idx_checkout_sessions_expires ON checkout_sessions(expires_at);

-- 6. Créer une table d'audit pour les actions administratives
CREATE TABLE IF NOT EXISTS admin_audit_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  admin_id UUID NOT NULL REFERENCES members(id) ON DELETE RESTRICT,
  action VARCHAR(100) NOT NULL,
  entity_type VARCHAR(50) NOT NULL,
  entity_id UUID,
  old_values JSONB,
  new_values JSONB,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Index pour l'audit
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_admin ON admin_audit_log(admin_id);
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_entity ON admin_audit_log(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_created ON admin_audit_log(created_at DESC);

-- 7. Fonction pour calculer le total des dons d'un membre sur l'année en cours
CREATE OR REPLACE FUNCTION get_member_yearly_donations(p_member_id UUID)
RETURNS DECIMAL AS $$
DECLARE
  total_amount DECIMAL(10,2);
BEGIN
  SELECT COALESCE(SUM(amount - refund_amount), 0)
  INTO total_amount
  FROM donations
  WHERE member_id = p_member_id
    AND status = 'completed'
    AND EXTRACT(YEAR FROM created_at) = EXTRACT(YEAR FROM CURRENT_DATE);
  
  RETURN total_amount;
END;
$$ LANGUAGE plpgsql;

-- 8. Fonction pour vérifier si un membre peut faire un don
CREATE OR REPLACE FUNCTION can_member_donate(
  p_member_id UUID,
  p_amount DECIMAL
)
RETURNS JSONB AS $$
DECLARE
  member_record RECORD;
  yearly_total DECIMAL;
  yearly_limit DECIMAL;
  min_age INTEGER;
  result JSONB;
BEGIN
  -- Récupérer les informations du membre
  SELECT * INTO member_record
  FROM members
  WHERE id = p_member_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'can_donate', false,
      'reason', 'Member not found'
    );
  END IF;
  
  -- Récupérer les paramètres
  SELECT setting_value::DECIMAL INTO yearly_limit
  FROM app_settings
  WHERE setting_key = 'donation_yearly_limit';
  
  SELECT setting_value::INTEGER INTO min_age
  FROM app_settings
  WHERE setting_key = 'donation_minimum_age';
  
  -- Vérifier l'âge
  IF member_record.birth_date IS NULL THEN
    RETURN jsonb_build_object(
      'can_donate', false,
      'reason', 'Birth date not provided'
    );
  END IF;
  
  IF DATE_PART('year', AGE(member_record.birth_date)) < min_age THEN
    RETURN jsonb_build_object(
      'can_donate', false,
      'reason', 'Under minimum age'
    );
  END IF;
  
  -- Vérifier le pays (doit être France)
  IF member_record.country IS NULL OR member_record.country != 'France' THEN
    RETURN jsonb_build_object(
      'can_donate', false,
      'reason', 'Not a French resident'
    );
  END IF;
  
  -- Calculer le total des dons de l'année
  yearly_total := get_member_yearly_donations(p_member_id);
  
  -- Vérifier le plafond
  IF yearly_total + p_amount > yearly_limit THEN
    RETURN jsonb_build_object(
      'can_donate', false,
      'reason', 'Exceeds yearly limit',
      'current_total', yearly_total,
      'yearly_limit', yearly_limit,
      'max_allowed', yearly_limit - yearly_total
    );
  END IF;
  
  RETURN jsonb_build_object(
    'can_donate', true,
    'current_total', yearly_total,
    'yearly_limit', yearly_limit,
    'remaining', yearly_limit - yearly_total
  );
END;
$$ LANGUAGE plpgsql;

-- 9. Trigger pour mettre à jour updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = TIMEZONE('utc', NOW());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Appliquer le trigger aux nouvelles tables
DROP TRIGGER IF EXISTS update_donations_updated_at ON donations;
CREATE TRIGGER update_donations_updated_at BEFORE UPDATE ON donations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_app_settings_updated_at ON app_settings;
CREATE TRIGGER update_app_settings_updated_at BEFORE UPDATE ON app_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_app_settings_donation_updated_at ON app_settings_donation;
CREATE TRIGGER update_app_settings_donation_updated_at BEFORE UPDATE ON app_settings_donation
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_checkout_sessions_updated_at ON checkout_sessions;
CREATE TRIGGER update_checkout_sessions_updated_at BEFORE UPDATE ON checkout_sessions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 10. RLS (Row Level Security) pour les tables
ALTER TABLE donations ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_settings_donation ENABLE ROW LEVEL SECURITY;
ALTER TABLE checkout_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_audit_log ENABLE ROW LEVEL SECURITY;

-- Policies pour donations
CREATE POLICY "Members can view their own donations" ON donations
  FOR SELECT USING (auth.uid() = (SELECT user_id FROM members WHERE id = member_id));

CREATE POLICY "Members can insert their own donations" ON donations
  FOR INSERT WITH CHECK (auth.uid() = (SELECT user_id FROM members WHERE id = member_id));

CREATE POLICY "Admins can view all donations" ON donations
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM members 
      WHERE user_id = auth.uid() 
      AND role = 'admin'
    )
  );

CREATE POLICY "Admins can update donations" ON donations
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM members 
      WHERE user_id = auth.uid() 
      AND role = 'admin'
    )
  );

-- Policies pour app_settings
CREATE POLICY "Anyone can read app_settings" ON app_settings
  FOR SELECT USING (true);

CREATE POLICY "Admins can update app_settings" ON app_settings
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM members 
      WHERE user_id = auth.uid() 
      AND role = 'admin'
    )
  );

-- Policies pour app_settings_donation
CREATE POLICY "Anyone can read active donation examples" ON app_settings_donation
  FOR SELECT USING (is_active = true);

CREATE POLICY "Admins can manage donation examples" ON app_settings_donation
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM members 
      WHERE user_id = auth.uid() 
      AND role = 'admin'
    )
  );

-- Policies pour checkout_sessions
CREATE POLICY "Users can read their own checkout sessions" ON checkout_sessions
  FOR SELECT USING (email = (SELECT email FROM members WHERE user_id = auth.uid()));

CREATE POLICY "Users can create checkout sessions" ON checkout_sessions
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can update their own checkout sessions" ON checkout_sessions
  FOR UPDATE USING (email = (SELECT email FROM members WHERE user_id = auth.uid()));

-- Policies pour admin_audit_log
CREATE POLICY "Admins can view audit logs" ON admin_audit_log
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM members 
      WHERE user_id = auth.uid() 
      AND role = 'admin'
    )
  );

CREATE POLICY "System can insert audit logs" ON admin_audit_log
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM members 
      WHERE user_id = auth.uid() 
      AND role = 'admin'
    )
  );

-- 11. Fonction pour nettoyer les sessions de checkout expirées
CREATE OR REPLACE FUNCTION cleanup_expired_checkout_sessions()
RETURNS void AS $$
BEGIN
  DELETE FROM checkout_sessions
  WHERE expires_at < CURRENT_TIMESTAMP
    AND status = 'pending';
END;
$$ LANGUAGE plpgsql;

-- Commentaires pour la documentation
COMMENT ON TABLE donations IS 'Stocke tous les dons effectués sur la plateforme';
COMMENT ON TABLE app_settings IS 'Paramètres globaux de l''application';
COMMENT ON TABLE app_settings_donation IS 'Exemples de montants de dons à afficher sur la page publique';
COMMENT ON TABLE checkout_sessions IS 'Sessions temporaires pour le processus de checkout en plusieurs étapes';
COMMENT ON TABLE admin_audit_log IS 'Journal d''audit des actions administratives';
COMMENT ON FUNCTION get_member_yearly_donations IS 'Calcule le total des dons d''un membre sur l''année en cours';
COMMENT ON FUNCTION can_member_donate IS 'Vérifie si un membre peut faire un don selon les contraintes légales';