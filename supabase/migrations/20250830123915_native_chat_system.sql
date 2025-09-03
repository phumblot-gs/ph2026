-- =====================================================
-- SYSTÈME DE CHAT NATIF AVEC SYNCHRONISATION SLACK
-- =====================================================

-- 1. TABLE DES MESSAGES
-- Stockage principal des messages du chat
CREATE TABLE IF NOT EXISTS chat_messages (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id uuid NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  
  -- Contenu du message
  text text NOT NULL,
  formatted_text text, -- Version HTML formatée pour l'affichage
  
  -- Métadonnées temporelles
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  deleted_at timestamp with time zone,
  edited_at timestamp with time zone,
  
  -- Gestion des threads/réponses
  thread_ts uuid REFERENCES chat_messages(id) ON DELETE CASCADE,
  reply_count integer DEFAULT 0,
  latest_reply_at timestamp with time zone,
  reply_users uuid[] DEFAULT '{}', -- Array des user_ids qui ont répondu
  
  -- Synchronisation Slack
  slack_ts text UNIQUE,
  slack_user_id text,
  slack_channel_id text,
  is_from_slack boolean DEFAULT false,
  slack_sync_status text DEFAULT 'pending' CHECK (slack_sync_status IN ('pending', 'synced', 'failed', 'none')),
  slack_sync_error text,
  
  -- Optimisation pour la scalabilité
  created_date date GENERATED ALWAYS AS ((created_at AT TIME ZONE 'UTC')::date) STORED,
  
  -- Métadonnées additionnelles
  metadata jsonb DEFAULT '{}' -- Pour stocker des infos supplémentaires flexibles
);

-- 2. TABLE DES RÉACTIONS
-- Stockage des emojis réactions sur les messages
CREATE TABLE IF NOT EXISTS chat_reactions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  message_id uuid NOT NULL REFERENCES chat_messages(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  emoji text NOT NULL,
  emoji_name text, -- Nom Slack de l'emoji (ex: "thumbsup" pour 👍)
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  
  -- Synchronisation Slack
  slack_user_id text,
  is_from_slack boolean DEFAULT false,
  
  -- Contrainte d'unicité : un utilisateur ne peut mettre qu'une fois le même emoji
  CONSTRAINT unique_user_message_emoji UNIQUE(message_id, user_id, emoji)
);

-- 3. TABLE DES FICHIERS ATTACHÉS
-- Gestion des fichiers uploadés dans le chat
CREATE TABLE IF NOT EXISTS chat_files (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  message_id uuid NOT NULL REFERENCES chat_messages(id) ON DELETE CASCADE,
  
  -- Informations du fichier
  name text NOT NULL,
  original_name text NOT NULL, -- Nom original du fichier uploadé
  mimetype text,
  size bigint,
  storage_path text NOT NULL, -- Path complet dans le bucket Supabase Storage
  thumbnail_path text, -- Path du thumbnail si c'est une image/vidéo
  
  -- Métadonnées pour l'affichage
  width integer, -- Pour les images/vidéos
  height integer,
  duration integer, -- Pour les audios/vidéos en secondes
  
  -- Synchronisation Slack si applicable
  slack_file_id text,
  slack_url text,
  slack_permalink text,
  
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. TABLE DE STATUT DE LECTURE
-- Pour tracker les messages non-lus par utilisateur/groupe
CREATE TABLE IF NOT EXISTS chat_read_status (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  group_id uuid NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  last_read_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  last_read_message_id uuid REFERENCES chat_messages(id) ON DELETE SET NULL,
  unread_count integer DEFAULT 0,
  
  PRIMARY KEY (user_id, group_id)
);

-- 5. TABLE DE TYPING INDICATORS
-- Pour afficher qui est en train de taper
CREATE TABLE IF NOT EXISTS chat_typing (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  group_id uuid NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  started_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  
  PRIMARY KEY (user_id, group_id)
);

-- 6. TABLE DE MENTIONS
-- Pour tracker les @mentions dans les messages
CREATE TABLE IF NOT EXISTS chat_mentions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  message_id uuid NOT NULL REFERENCES chat_messages(id) ON DELETE CASCADE,
  mentioned_user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  mentioned_slack_user_id text, -- Si c'est une mention d'un user Slack
  mention_type text DEFAULT 'user' CHECK (mention_type IN ('user', 'channel', 'here', 'everyone')),
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- =====================================================
-- INDEXES POUR OPTIMISER LES PERFORMANCES
-- =====================================================

-- Indexes pour les requêtes de messages
CREATE INDEX idx_chat_messages_group_created ON chat_messages(group_id, created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX idx_chat_messages_thread ON chat_messages(thread_ts, created_at) WHERE thread_ts IS NOT NULL AND deleted_at IS NULL;
CREATE INDEX idx_chat_messages_slack_ts ON chat_messages(slack_ts) WHERE slack_ts IS NOT NULL;
CREATE INDEX idx_chat_messages_slack_channel ON chat_messages(slack_channel_id, slack_ts) WHERE slack_channel_id IS NOT NULL;
CREATE INDEX idx_chat_messages_created_date ON chat_messages(created_date, group_id);
CREATE INDEX idx_chat_messages_user ON chat_messages(user_id, created_at DESC) WHERE user_id IS NOT NULL;

-- Indexes pour les réactions
CREATE INDEX idx_chat_reactions_message ON chat_reactions(message_id);
CREATE INDEX idx_chat_reactions_user ON chat_reactions(user_id);
CREATE INDEX idx_chat_reactions_emoji ON chat_reactions(message_id, emoji);

-- Indexes pour les fichiers
CREATE INDEX idx_chat_files_message ON chat_files(message_id);

-- Indexes pour le statut de lecture
CREATE INDEX idx_chat_read_status_user_group ON chat_read_status(user_id, group_id);
CREATE INDEX idx_chat_read_status_group ON chat_read_status(group_id, last_read_at);

-- Indexes pour les mentions
CREATE INDEX idx_chat_mentions_message ON chat_mentions(message_id);
CREATE INDEX idx_chat_mentions_user ON chat_mentions(mentioned_user_id) WHERE mentioned_user_id IS NOT NULL;

-- Index pour le typing
CREATE INDEX idx_chat_typing_group ON chat_typing(group_id);

-- =====================================================
-- ROW LEVEL SECURITY (RLS)
-- =====================================================

-- Activer RLS sur toutes les tables
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_read_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_typing ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_mentions ENABLE ROW LEVEL SECURITY;

-- POLICIES POUR CHAT_MESSAGES
-- Les utilisateurs peuvent voir les messages des groupes auxquels ils appartiennent
CREATE POLICY "Users can view messages from their groups" ON chat_messages
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_groups 
      WHERE user_groups.user_id = auth.uid() 
      AND user_groups.group_id = chat_messages.group_id
    )
  );

-- Les utilisateurs peuvent créer des messages dans leurs groupes
CREATE POLICY "Users can create messages in their groups" ON chat_messages
  FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM user_groups 
      WHERE user_groups.user_id = auth.uid() 
      AND user_groups.group_id = chat_messages.group_id
    )
  );

-- Les utilisateurs peuvent modifier leurs propres messages
CREATE POLICY "Users can update their own messages" ON chat_messages
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Les utilisateurs peuvent soft-delete leurs propres messages
CREATE POLICY "Users can delete their own messages" ON chat_messages
  FOR DELETE
  USING (auth.uid() = user_id);

-- POLICIES POUR CHAT_REACTIONS
-- Les utilisateurs peuvent voir toutes les réactions des messages qu'ils peuvent voir
CREATE POLICY "Users can view reactions" ON chat_reactions
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM chat_messages m
      JOIN user_groups ug ON ug.group_id = m.group_id
      WHERE m.id = chat_reactions.message_id
      AND ug.user_id = auth.uid()
    )
  );

-- Les utilisateurs peuvent ajouter leurs propres réactions
CREATE POLICY "Users can add their reactions" ON chat_reactions
  FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM chat_messages m
      JOIN user_groups ug ON ug.group_id = m.group_id
      WHERE m.id = chat_reactions.message_id
      AND ug.user_id = auth.uid()
    )
  );

-- Les utilisateurs peuvent retirer leurs propres réactions
CREATE POLICY "Users can remove their reactions" ON chat_reactions
  FOR DELETE
  USING (auth.uid() = user_id);

-- POLICIES POUR CHAT_FILES
-- Les utilisateurs peuvent voir les fichiers des messages qu'ils peuvent voir
CREATE POLICY "Users can view files" ON chat_files
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM chat_messages m
      JOIN user_groups ug ON ug.group_id = m.group_id
      WHERE m.id = chat_files.message_id
      AND ug.user_id = auth.uid()
    )
  );

-- Les utilisateurs peuvent uploader des fichiers pour leurs messages
CREATE POLICY "Users can upload files" ON chat_files
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM chat_messages m
      WHERE m.id = chat_files.message_id
      AND m.user_id = auth.uid()
    )
  );

-- POLICIES POUR CHAT_READ_STATUS
-- Les utilisateurs peuvent voir et modifier leur propre statut de lecture
CREATE POLICY "Users can manage their read status" ON chat_read_status
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- POLICIES POUR CHAT_TYPING
-- Les utilisateurs peuvent voir qui tape dans leurs groupes
CREATE POLICY "Users can view typing indicators" ON chat_typing
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_groups 
      WHERE user_groups.user_id = auth.uid() 
      AND user_groups.group_id = chat_typing.group_id
    )
  );

-- Les utilisateurs peuvent gérer leur propre indicateur de typing
CREATE POLICY "Users can manage their typing indicator" ON chat_typing
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- POLICIES POUR CHAT_MENTIONS
-- Les utilisateurs peuvent voir les mentions dans les messages qu'ils peuvent voir
CREATE POLICY "Users can view mentions" ON chat_mentions
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM chat_messages m
      JOIN user_groups ug ON ug.group_id = m.group_id
      WHERE m.id = chat_mentions.message_id
      AND ug.user_id = auth.uid()
    )
  );

-- =====================================================
-- TRIGGERS ET FONCTIONS
-- =====================================================

-- Fonction pour mettre à jour updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger pour auto-update updated_at
CREATE TRIGGER update_chat_messages_updated_at BEFORE UPDATE ON chat_messages
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Fonction pour mettre à jour le compteur de réponses
CREATE OR REPLACE FUNCTION update_reply_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.thread_ts IS NOT NULL THEN
    UPDATE chat_messages 
    SET 
      reply_count = reply_count + 1,
      latest_reply_at = NEW.created_at,
      reply_users = array_append(
        array_remove(reply_users, NEW.user_id), 
        NEW.user_id
      )
    WHERE id = NEW.thread_ts;
  ELSIF TG_OP = 'DELETE' AND OLD.thread_ts IS NOT NULL THEN
    UPDATE chat_messages 
    SET reply_count = GREATEST(0, reply_count - 1)
    WHERE id = OLD.thread_ts;
  END IF;
  RETURN NULL;
END;
$$ language 'plpgsql';

-- Triggers pour maintenir le compteur de réponses (séparés pour INSERT et DELETE)
CREATE TRIGGER update_thread_reply_count_on_insert
  AFTER INSERT ON chat_messages
  FOR EACH ROW
  WHEN (NEW.thread_ts IS NOT NULL)
  EXECUTE FUNCTION update_reply_count();

CREATE TRIGGER update_thread_reply_count_on_delete
  AFTER DELETE ON chat_messages
  FOR EACH ROW
  WHEN (OLD.thread_ts IS NOT NULL)
  EXECUTE FUNCTION update_reply_count();

-- Fonction pour nettoyer les vieux indicateurs de typing (plus de 10 secondes)
CREATE OR REPLACE FUNCTION cleanup_old_typing()
RETURNS void AS $$
BEGIN
  DELETE FROM chat_typing 
  WHERE started_at < timezone('utc'::text, now()) - interval '10 seconds';
END;
$$ language 'plpgsql';

-- =====================================================
-- VUES UTILES
-- =====================================================

-- Vue pour avoir les messages avec toutes les infos jointes
CREATE OR REPLACE VIEW chat_messages_full AS
SELECT 
  m.*,
  u.email as user_email,
  p.first_name,
  p.last_name,
  p.photo_url,
  COALESCE(
    json_agg(
      DISTINCT jsonb_build_object(
        'id', f.id,
        'name', f.name,
        'mimetype', f.mimetype,
        'size', f.size,
        'storage_path', f.storage_path,
        'thumbnail_path', f.thumbnail_path
      )
    ) FILTER (WHERE f.id IS NOT NULL),
    '[]'::json
  ) as files,
  COALESCE(
    json_agg(
      DISTINCT jsonb_build_object(
        'emoji', r.emoji,
        'users', r.user_ids,
        'count', r.reaction_count
      )
    ) FILTER (WHERE r.emoji IS NOT NULL),
    '[]'::json
  ) as reactions
FROM chat_messages m
LEFT JOIN auth.users u ON m.user_id = u.id
LEFT JOIN members p ON m.user_id = p.user_id
LEFT JOIN chat_files f ON f.message_id = m.id
LEFT JOIN (
  SELECT 
    message_id,
    emoji,
    array_agg(user_id) as user_ids,
    count(*) as reaction_count
  FROM chat_reactions
  GROUP BY message_id, emoji
) r ON r.message_id = m.id
WHERE m.deleted_at IS NULL
GROUP BY m.id, u.email, p.first_name, p.last_name, p.photo_url;

-- =====================================================
-- CONFIGURATION POUR REALTIME
-- =====================================================

-- Ajouter les tables à la publication existante supabase_realtime
-- (La publication est créée automatiquement par Supabase)
ALTER PUBLICATION supabase_realtime ADD TABLE chat_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE chat_reactions;
ALTER PUBLICATION supabase_realtime ADD TABLE chat_typing;