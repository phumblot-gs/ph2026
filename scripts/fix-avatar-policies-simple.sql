-- Script simplifié pour corriger les politiques de stockage des avatars
-- Version sans modification de RLS

-- 1. Supprimer les anciennes politiques liées aux avatars
DROP POLICY IF EXISTS "Avatar images are publicly accessible" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload their own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Avatars are publicly accessible" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload avatars" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update avatars" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete avatars" ON storage.objects;

-- 2. Créer une politique unique très permissive pour tout le bucket avatars
-- Cette approche évite les conflits de politiques

-- Politique pour permettre à tous de lire les avatars
CREATE POLICY "Public avatar read"
ON storage.objects FOR SELECT
USING (bucket_id = 'avatars');

-- Politique pour permettre aux utilisateurs authentifiés toutes les opérations
CREATE POLICY "Auth users full access to avatars"
ON storage.objects FOR ALL
TO authenticated
USING (bucket_id = 'avatars')
WITH CHECK (bucket_id = 'avatars');

-- 3. S'assurer que le bucket est bien configuré
UPDATE storage.buckets 
SET 
  public = true,
  file_size_limit = 5242880,
  allowed_mime_types = ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp']::text[]
WHERE id = 'avatars';

-- 4. Vérifier les politiques créées
SELECT 
    policyname,
    permissive,
    roles,
    cmd,
    qual
FROM pg_policies 
WHERE schemaname = 'storage' 
AND tablename = 'objects'
AND (policyname LIKE '%avatar%' OR qual::text LIKE '%avatars%')
ORDER BY policyname;

-- 5. Vérifier la configuration du bucket
SELECT id, name, public, file_size_limit 
FROM storage.buckets 
WHERE id = 'avatars';