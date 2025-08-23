-- Créer la table de tracking des migrations si elle n'existe pas
CREATE TABLE IF NOT EXISTS supabase_migrations (
    version text PRIMARY KEY,
    inserted_at timestamptz DEFAULT now() NOT NULL
);

-- Vérifier les migrations existantes
SELECT * FROM supabase_migrations ORDER BY inserted_at;

-- Si la table est vide, marquer les migrations comme appliquées
-- (décommente les lignes suivantes si nécessaire)
-- INSERT INTO supabase_migrations (version) VALUES 
--     ('20250819000000_auth_refactor'),
--     ('20250819201300_fix_auth_trigger'),
--     ('20250819204500_final_auth_fix')
-- ON CONFLICT (version) DO NOTHING;

-- Vérifier que les tables existent
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('members', 'groups', 'user_groups')
ORDER BY table_name;