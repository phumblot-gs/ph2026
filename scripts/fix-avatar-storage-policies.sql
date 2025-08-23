-- Script pour corriger les politiques de stockage des avatars
-- Résout l'erreur "new row violates row-level security policy"

-- 1. D'abord, désactiver temporairement RLS sur storage.objects pour nettoyer
ALTER TABLE storage.objects DISABLE ROW LEVEL SECURITY;

-- 2. Supprimer TOUTES les anciennes politiques sur storage.objects
DO $$
DECLARE
    pol RECORD;
BEGIN
    FOR pol IN 
        SELECT policyname 
        FROM pg_policies 
        WHERE schemaname = 'storage' 
        AND tablename = 'objects'
        AND policyname LIKE '%avatar%' OR policyname LIKE '%Avatar%'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', pol.policyname);
    END LOOP;
END $$;

-- 3. Réactiver RLS
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- 4. Créer des politiques très permissives pour le bucket avatars
-- Politique pour SELECT (lecture publique)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'storage' 
        AND tablename = 'objects' 
        AND policyname = 'Avatars are publicly accessible'
    ) THEN
        CREATE POLICY "Avatars are publicly accessible"
        ON storage.objects FOR SELECT
        USING (bucket_id = 'avatars');
    END IF;
END $$;

-- Politique pour INSERT (tout utilisateur authentifié peut uploader)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'storage' 
        AND tablename = 'objects' 
        AND policyname = 'Authenticated users can upload avatars'
    ) THEN
        CREATE POLICY "Authenticated users can upload avatars"
        ON storage.objects FOR INSERT
        TO authenticated
        WITH CHECK (bucket_id = 'avatars');
    END IF;
END $$;

-- Politique pour UPDATE (tout utilisateur authentifié peut mettre à jour)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'storage' 
        AND tablename = 'objects' 
        AND policyname = 'Authenticated users can update avatars'
    ) THEN
        CREATE POLICY "Authenticated users can update avatars"
        ON storage.objects FOR UPDATE
        TO authenticated
        USING (bucket_id = 'avatars')
        WITH CHECK (bucket_id = 'avatars');
    END IF;
END $$;

-- Politique pour DELETE (tout utilisateur authentifié peut supprimer)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'storage' 
        AND tablename = 'objects' 
        AND policyname = 'Authenticated users can delete avatars'
    ) THEN
        CREATE POLICY "Authenticated users can delete avatars"
        ON storage.objects FOR DELETE
        TO authenticated
        USING (bucket_id = 'avatars');
    END IF;
END $$;

-- 5. Vérifier que le bucket existe et est public
UPDATE storage.buckets 
SET public = true 
WHERE id = 'avatars';

-- 6. Afficher les politiques créées pour vérification
SELECT 
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE schemaname = 'storage' 
AND tablename = 'objects'
AND policyname LIKE '%avatar%' OR policyname LIKE '%Avatar%';

-- 7. Vérifier la configuration du bucket
SELECT * FROM storage.buckets WHERE id = 'avatars';