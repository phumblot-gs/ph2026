-- =====================================================
-- VUE POUR LE COMPTAGE DES MESSAGES NON LUS
-- =====================================================
-- Cette vue calcule en temps réel le nombre de messages non lus
-- pour chaque utilisateur dans chaque groupe/canal.
-- Conçue pour être compatible avec les futures apps mobiles iOS/Android

-- Supprimer la vue si elle existe déjà
DROP VIEW IF EXISTS chat_unread_counts;

-- Créer la vue pour compter les messages non lus
CREATE OR REPLACE VIEW chat_unread_counts AS
SELECT 
  ug.user_id,
  ug.group_id,
  g.name as group_name,
  g.slack_channel_id,
  -- Date du dernier message lu (ou date très ancienne si jamais lu)
  COALESCE(crs.last_read_at, '1970-01-01'::timestamptz) as last_read_at,
  crs.last_read_message_id,
  -- Compter uniquement les messages non lus
  -- (après last_read_at, pas de l'utilisateur lui-même, non supprimés, pas des threads)
  COUNT(
    CASE 
      WHEN m.created_at > COALESCE(crs.last_read_at, '1970-01-01'::timestamptz)
        AND m.user_id != ug.user_id 
        AND m.deleted_at IS NULL 
        AND m.thread_ts IS NULL
      THEN 1 
    END
  )::integer as unread_count,
  -- Date du dernier message dans le groupe (utile pour trier les canaux)
  MAX(m.created_at) as latest_message_at,
  -- Date du dernier message de l'utilisateur (pour savoir s'il a participé)
  MAX(CASE WHEN m.user_id = ug.user_id THEN m.created_at END) as user_latest_message_at,
  -- Total de messages dans le groupe (pour statistiques)
  COUNT(
    CASE 
      WHEN m.deleted_at IS NULL AND m.thread_ts IS NULL
      THEN 1 
    END
  )::integer as total_messages
FROM user_groups ug
JOIN groups g ON g.id = ug.group_id
LEFT JOIN chat_read_status crs ON crs.user_id = ug.user_id AND crs.group_id = ug.group_id
LEFT JOIN chat_messages m ON m.group_id = ug.group_id
GROUP BY 
  ug.user_id, 
  ug.group_id, 
  g.name, 
  g.slack_channel_id,
  crs.last_read_at,
  crs.last_read_message_id;

-- Créer un index sur la vue matérialisée si on veut l'optimiser plus tard
COMMENT ON VIEW chat_unread_counts IS 'Vue temps réel pour le comptage des messages non lus par utilisateur et par groupe. Compatible avec les futures applications mobiles.';

-- =====================================================
-- FONCTION HELPER POUR MARQUER COMME LU
-- =====================================================
-- Fonction pratique pour marquer tous les messages d'un groupe comme lus
CREATE OR REPLACE FUNCTION mark_channel_as_read(
  p_user_id uuid,
  p_group_id uuid
) RETURNS void AS $$
DECLARE
  v_latest_message_id uuid;
  v_latest_message_at timestamptz;
BEGIN
  -- Récupérer le dernier message du canal
  SELECT id, created_at INTO v_latest_message_id, v_latest_message_at
  FROM chat_messages
  WHERE group_id = p_group_id
    AND deleted_at IS NULL
  ORDER BY created_at DESC
  LIMIT 1;

  -- Mettre à jour ou insérer le statut de lecture
  INSERT INTO chat_read_status (
    user_id,
    group_id,
    last_read_at,
    last_read_message_id,
    unread_count
  ) VALUES (
    p_user_id,
    p_group_id,
    COALESCE(v_latest_message_at, NOW()),
    v_latest_message_id,
    0
  )
  ON CONFLICT (user_id, group_id)
  DO UPDATE SET
    last_read_at = COALESCE(v_latest_message_at, NOW()),
    last_read_message_id = v_latest_message_id,
    unread_count = 0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- FONCTION POUR OBTENIR LE TOTAL DES NON LUS
-- =====================================================
-- Retourne le nombre total de messages non lus pour un utilisateur
CREATE OR REPLACE FUNCTION get_total_unread_count(p_user_id uuid)
RETURNS integer AS $$
  SELECT COALESCE(SUM(unread_count), 0)::integer
  FROM chat_unread_counts
  WHERE user_id = p_user_id;
$$ LANGUAGE sql STABLE;

-- =====================================================
-- SÉCURITÉ ET PERMISSIONS
-- =====================================================

-- Donner les permissions de lecture sur la vue
GRANT SELECT ON chat_unread_counts TO authenticated;

-- Les utilisateurs peuvent exécuter la fonction pour marquer comme lu
GRANT EXECUTE ON FUNCTION mark_channel_as_read(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION get_total_unread_count(uuid) TO authenticated;

-- IMPORTANT: Autoriser les fonctions RPC dans Supabase
-- Créer une politique pour permettre l'exécution de la fonction
CREATE POLICY "Users can mark their own channels as read" 
ON chat_read_status 
FOR ALL 
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- =====================================================
-- OPTIMISATION : INDEX ADDITIONNELS
-- =====================================================
-- Ajouter des index pour améliorer les performances de la vue
CREATE INDEX IF NOT EXISTS idx_chat_messages_group_created_not_deleted 
  ON chat_messages(group_id, created_at DESC) 
  WHERE deleted_at IS NULL AND thread_ts IS NULL;

CREATE INDEX IF NOT EXISTS idx_chat_read_status_user_group_read 
  ON chat_read_status(user_id, group_id, last_read_at);

-- =====================================================
-- CONFIGURATION REALTIME (pour les apps mobiles)
-- =====================================================
-- Note: La vue ne peut pas être ajoutée directement à la publication realtime,
-- mais on peut écouter les changements sur les tables sous-jacentes
-- Les apps mobiles devront écouter chat_messages et chat_read_status
-- puis re-query la vue pour obtenir les compteurs mis à jour

-- =====================================================
-- TESTS DE VALIDATION
-- =====================================================
-- Vérifier que la vue fonctionne correctement
DO $$
BEGIN
  -- Test: La vue doit exister et être accessible
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.views 
    WHERE table_schema = 'public' 
    AND table_name = 'chat_unread_counts'
  ) THEN
    RAISE EXCEPTION 'La vue chat_unread_counts n''a pas été créée correctement';
  END IF;
  
  RAISE NOTICE 'Migration chat_unread_counts_view appliquée avec succès';
END $$;