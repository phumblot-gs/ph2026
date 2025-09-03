-- =====================================================
-- CONFIGURATION DU BUCKET DE STOCKAGE POUR LE CHAT
-- =====================================================

-- Créer le bucket pour les fichiers du chat
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'chat',
  'chat',
  false, -- Bucket privé, accès contrôlé par les policies
  52428800, -- 50MB max par fichier
  ARRAY[
    -- Images
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/svg+xml',
    -- Documents
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'text/plain',
    'text/csv',
    -- Audio
    'audio/mpeg',
    'audio/mp3',
    'audio/wav',
    'audio/ogg',
    'audio/webm',
    'audio/mp4',
    'audio/m4a',
    -- Vidéo
    'video/mp4',
    'video/webm',
    'video/ogg',
    'video/quicktime',
    -- Archives
    'application/zip',
    'application/x-zip-compressed',
    'application/x-rar-compressed',
    'application/x-7z-compressed'
  ]
) ON CONFLICT (id) DO UPDATE SET
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- =====================================================
-- POLICIES DE STOCKAGE
-- =====================================================

-- Policy pour SELECT (téléchargement/lecture)
-- Les utilisateurs peuvent lire les fichiers des groupes auxquels ils appartiennent
CREATE POLICY "Users can view chat files from their groups"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'chat' 
  AND auth.uid() IN (
    SELECT ug.user_id 
    FROM user_groups ug
    WHERE ug.group_id::text = SPLIT_PART(name, '/', 1)
  )
);

-- Policy pour INSERT (upload)
-- Les utilisateurs peuvent uploader des fichiers dans leurs groupes
-- Structure attendue : {group_id}/YYYYMM/{file_id}_{filename}
CREATE POLICY "Users can upload chat files to their groups"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'chat'
  AND auth.uid() IN (
    SELECT ug.user_id 
    FROM user_groups ug
    WHERE ug.group_id::text = SPLIT_PART(name, '/', 1)
  )
);

-- Policy pour UPDATE
-- Les utilisateurs peuvent modifier leurs propres fichiers
-- On vérifie via la table chat_files qui est le propriétaire
CREATE POLICY "Users can update their own chat files"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'chat'
  AND EXISTS (
    SELECT 1 
    FROM chat_files cf
    JOIN chat_messages cm ON cf.message_id = cm.id
    WHERE cf.storage_path = name
    AND cm.user_id = auth.uid()
  )
)
WITH CHECK (
  bucket_id = 'chat'
  AND EXISTS (
    SELECT 1 
    FROM chat_files cf
    JOIN chat_messages cm ON cf.message_id = cm.id
    WHERE cf.storage_path = name
    AND cm.user_id = auth.uid()
  )
);

-- Policy pour DELETE
-- Les utilisateurs peuvent supprimer leurs propres fichiers
CREATE POLICY "Users can delete their own chat files"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'chat'
  AND EXISTS (
    SELECT 1 
    FROM chat_files cf
    JOIN chat_messages cm ON cf.message_id = cm.id
    WHERE cf.storage_path = name
    AND cm.user_id = auth.uid()
  )
);

-- =====================================================
-- FONCTION HELPER POUR GÉNÉRER LE PATH DE STOCKAGE
-- =====================================================

-- Fonction pour générer le path de stockage d'un fichier
-- Format : {group_id}/YYYYMM/{file_id}_{safe_filename}
CREATE OR REPLACE FUNCTION generate_chat_file_path(
  p_group_id uuid,
  p_file_id uuid,
  p_filename text
) RETURNS text AS $$
DECLARE
  v_year_month text;
  v_safe_filename text;
BEGIN
  -- Générer YYYYMM
  v_year_month := to_char(CURRENT_DATE, 'YYYYMM');
  
  -- Nettoyer le nom de fichier (garder seulement alphanumériques, tirets, underscores et points)
  v_safe_filename := regexp_replace(p_filename, '[^a-zA-Z0-9._-]', '_', 'g');
  
  -- Limiter la longueur du nom de fichier
  IF length(v_safe_filename) > 100 THEN
    v_safe_filename := substring(v_safe_filename, 1, 100);
  END IF;
  
  -- Retourner le path complet
  RETURN format('%s/%s/%s_%s', 
    p_group_id::text, 
    v_year_month, 
    p_file_id::text,
    v_safe_filename
  );
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Fonction pour générer le path du thumbnail
CREATE OR REPLACE FUNCTION generate_chat_thumbnail_path(
  p_group_id uuid,
  p_file_id uuid
) RETURNS text AS $$
DECLARE
  v_year_month text;
BEGIN
  v_year_month := to_char(CURRENT_DATE, 'YYYYMM');
  RETURN format('%s/%s/thumbnails/%s_thumb.jpg', 
    p_group_id::text, 
    v_year_month, 
    p_file_id::text
  );
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- =====================================================
-- FONCTION DE NETTOYAGE DES VIEUX FICHIERS
-- =====================================================

-- Fonction pour identifier les fichiers à supprimer (plus de 6 mois)
CREATE OR REPLACE FUNCTION get_old_chat_files_to_delete()
RETURNS TABLE (
  storage_path text,
  created_at timestamp with time zone
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    cf.storage_path,
    cf.created_at
  FROM chat_files cf
  WHERE cf.created_at < CURRENT_DATE - INTERVAL '6 months';
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- INDEXES ADDITIONNELS POUR LES FICHIERS
-- =====================================================

-- Index pour faciliter le nettoyage des vieux fichiers
CREATE INDEX idx_chat_files_created_at ON chat_files(created_at);

-- Index pour retrouver rapidement les fichiers par path
CREATE INDEX idx_chat_files_storage_path ON chat_files(storage_path);

-- =====================================================
-- COMMENTAIRES ET DOCUMENTATION
-- =====================================================

COMMENT ON TABLE chat_files IS 'Stockage des métadonnées des fichiers uploadés dans le chat';
COMMENT ON COLUMN chat_files.storage_path IS 'Path complet dans le bucket Supabase Storage au format {group_id}/YYYYMM/{file_id}_{filename}';
COMMENT ON COLUMN chat_files.thumbnail_path IS 'Path du thumbnail pour les images/vidéos au format {group_id}/YYYYMM/thumbnails/{file_id}_thumb.jpg';
COMMENT ON FUNCTION generate_chat_file_path IS 'Génère le path de stockage pour un fichier du chat';
COMMENT ON FUNCTION generate_chat_thumbnail_path IS 'Génère le path de stockage pour un thumbnail';
COMMENT ON FUNCTION get_old_chat_files_to_delete IS 'Retourne la liste des fichiers de plus de 6 mois à supprimer';