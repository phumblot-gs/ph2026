-- Ajouter le rôle 'pending' au type enum user_role
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'pending' BEFORE 'member';

-- Mettre à jour la fonction de création automatique de membre pour utiliser 'pending'
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.members (user_id, email, first_name, last_name, phone, role)
  VALUES (
    new.id,
    new.email,
    COALESCE(new.raw_user_meta_data->>'first_name', ''),
    COALESCE(new.raw_user_meta_data->>'last_name', ''),
    COALESCE(new.raw_user_meta_data->>'phone', ''),
    'pending' -- Par défaut, tous les nouveaux utilisateurs sont en attente
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fonction pour notifier les admins d'une nouvelle inscription
CREATE OR REPLACE FUNCTION public.notify_admins_new_member()
RETURNS trigger AS $$
BEGIN
  -- Cette fonction sera appelée via Edge Function pour envoyer les emails
  -- Pour l'instant, on log juste dans une table de notifications
  INSERT INTO public.admin_notifications (
    type,
    data,
    created_at
  ) VALUES (
    'new_member',
    json_build_object(
      'member_id', NEW.id,
      'email', NEW.email,
      'first_name', NEW.first_name,
      'last_name', NEW.last_name
    ),
    NOW()
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Table pour stocker les notifications admin
CREATE TABLE IF NOT EXISTS public.admin_notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  type VARCHAR(50) NOT NULL,
  data JSONB,
  read BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Trigger pour notifier les admins
DROP TRIGGER IF EXISTS notify_admins_on_new_member ON members;
CREATE TRIGGER notify_admins_on_new_member
  AFTER INSERT ON members
  FOR EACH ROW 
  WHEN (NEW.role = 'pending')
  EXECUTE FUNCTION public.notify_admins_new_member();

-- RLS pour la table notifications
ALTER TABLE admin_notifications ENABLE ROW LEVEL SECURITY;

-- Seuls les admins peuvent voir les notifications
CREATE POLICY "Admins can view notifications" ON admin_notifications
  FOR SELECT USING (
    auth.uid() IN (
      SELECT user_id FROM members 
      WHERE role IN ('super_admin', 'admin')
    )
  );