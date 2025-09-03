-- =====================================================
-- FIX: INCLURE LES RÉPONSES DANS LE COMPTAGE DES NON LUS
-- =====================================================
-- Cette migration corrige la vue chat_unread_counts pour inclure
-- les réponses (thread_ts non null) dans le comptage des messages non lus

-- Supprimer la vue existante
DROP VIEW IF EXISTS chat_unread_counts;

-- Recréer la vue en incluant les réponses
CREATE OR REPLACE VIEW chat_unread_counts AS
SELECT 
  ug.user_id,
  ug.group_id,
  g.name as group_name,
  g.slack_channel_id,
  -- Date du dernier message lu (ou date très ancienne si jamais lu)
  COALESCE(crs.last_read_at, '1970-01-01'::timestamptz) as last_read_at,
  crs.last_read_message_id,
  -- Compter tous les messages non lus (incluant les réponses)
  -- (après last_read_at, pas de l'utilisateur lui-même, non supprimés)
  COUNT(
    CASE 
      WHEN m.created_at > COALESCE(crs.last_read_at, '1970-01-01'::timestamptz)
        AND m.user_id != ug.user_id 
        AND m.deleted_at IS NULL 
      THEN 1 
    END
  )::integer as unread_count,
  -- Date du dernier message dans le groupe (utile pour trier les canaux)
  MAX(m.created_at) as latest_message_at,
  -- Date du dernier message de l'utilisateur (pour savoir s'il a participé)
  MAX(CASE WHEN m.user_id = ug.user_id THEN m.created_at END) as user_latest_message_at,
  -- Total de messages dans le groupe (incluant les réponses)
  COUNT(
    CASE 
      WHEN m.deleted_at IS NULL
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

-- Recréer les permissions
GRANT SELECT ON chat_unread_counts TO authenticated;

-- Mettre à jour l'index pour inclure tous les messages
DROP INDEX IF EXISTS idx_chat_messages_group_created_not_deleted;
CREATE INDEX idx_chat_messages_group_created_not_deleted 
  ON chat_messages(group_id, created_at DESC) 
  WHERE deleted_at IS NULL;

-- Ajouter un commentaire
COMMENT ON VIEW chat_unread_counts IS 'Vue temps réel pour le comptage des messages non lus (incluant les réponses) par utilisateur et par groupe. Compatible avec les futures applications mobiles.';

-- =====================================================
-- TESTS DE VALIDATION
-- =====================================================
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
  
  RAISE NOTICE 'Migration fix_chat_unread_counts_replies appliquée avec succès';
END $$;