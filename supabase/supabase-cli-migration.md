# Migration Supabase CLI - Syntaxe correcte

## 1. Installation de Supabase CLI

```bash
# macOS avec Homebrew
brew install supabase/tap/supabase

# Vérifier la version
supabase --version
```

## 2. Initialisation et connexion

```bash
# Se connecter à Supabase
supabase login

# Initialiser dans le dossier du projet
cd /Users/phf/ph2026
supabase init

# Lier au projet de production
supabase link --project-ref [YOUR_PROJECT_REF]
# Le project-ref se trouve dans Supabase Dashboard → Settings → General → Reference ID
```

## 3. Exporter le schéma de PRODUCTION (sans les données)

```bash
# Option A : Utiliser db dump (schéma uniquement)
supabase db dump --schema public --data-only=false > supabase/production_schema.sql

# Option B : Utiliser db dump avec plus de contrôle
supabase db dump \
  --schema public \
  --no-data \
  --no-owner \
  --no-privileges \
  > supabase/production_schema.sql

# Option C : Si les flags ne fonctionnent pas, utiliser pg_dump directement
supabase db dump -f supabase/production_schema.sql
```

## 4. Alternative avec pg_dump direct

```bash
# Obtenir l'URL de connexion
supabase db url

# Ou depuis le Dashboard : Settings → Database → Connection string
# Format : postgresql://postgres:[password]@db.[project-ref].supabase.co:5432/postgres

# Exporter SEULEMENT le schéma (pas de données)
pg_dump \
  "postgresql://postgres:[password]@db.[project-ref].supabase.co:5432/postgres" \
  --schema-only \
  --schema=public \
  --no-owner \
  --no-privileges \
  --no-comments \
  --if-exists \
  --clean \
  > supabase/production_schema.sql
```

## 5. Nettoyer le fichier exporté

Le fichier exporté peut contenir des éléments Supabase spécifiques à retirer :

```bash
# Créer une copie nettoyée
grep -v "COMMENT ON SCHEMA" supabase/production_schema.sql | \
grep -v "CREATE SCHEMA" | \
grep -v "ALTER SCHEMA" | \
grep -v "supabase_" | \
grep -v "auth\." | \
grep -v "storage\." | \
grep -v "graphql" | \
grep -v "pgsodium" | \
grep -v "pgtle" | \
grep -v "vault" > supabase/clean_schema.sql
```

## 6. Appliquer sur l'environnement TEST

### Option A : Via Supabase CLI

```bash
# D'abord, délier du projet production
supabase unlink

# Lier au projet test
supabase link --project-ref [TEST_PROJECT_REF]

# Réinitialiser la base de test (ATTENTION : supprime tout)
supabase db reset

# Appliquer le schéma
supabase db push < supabase/production_schema.sql
```

### Option B : Via SQL Editor dans le Dashboard

1. Ouvrir **ph2026-test** dans Supabase Dashboard
2. Aller dans **SQL Editor**
3. Copier-coller le contenu de `production_schema.sql`
4. Exécuter

### Option C : Via psql direct

```bash
# Connection string de TEST depuis Dashboard
psql "postgresql://postgres:[password]@db.[test-ref].supabase.co:5432/postgres" \
  < supabase/clean_schema.sql
```

## 7. Script bash complet

```bash
#!/bin/bash

# Variables (à remplacer)
PROD_REF="your-prod-ref"
TEST_REF="your-test-ref"
PROD_PASSWORD="your-prod-password"
TEST_PASSWORD="your-test-password"

# Export depuis production (schéma seulement)
echo "Exporting schema from production..."
pg_dump \
  "postgresql://postgres:${PROD_PASSWORD}@db.${PROD_REF}.supabase.co:5432/postgres" \
  --schema-only \
  --schema=public \
  --no-owner \
  --no-privileges \
  --no-comments \
  --if-exists \
  --clean \
  > production_schema.sql

echo "Schema exported successfully"

# Nettoyer le fichier
echo "Cleaning schema file..."
sed -i '' '/^--/d' production_schema.sql  # Retirer les commentaires
sed -i '' '/^$/d' production_schema.sql   # Retirer les lignes vides
sed -i '' '/COMMENT ON/d' production_schema.sql  # Retirer les COMMENT ON

# Appliquer sur test
echo "Applying schema to test environment..."
psql "postgresql://postgres:${TEST_PASSWORD}@db.${TEST_REF}.supabase.co:5432/postgres" \
  < production_schema.sql

echo "Migration complete!"
```

## Notes importantes

1. **--schema-only** ou **--no-data** : Pour exporter SEULEMENT la structure, pas les données
2. **--no-owner** : Pour éviter les problèmes de permissions
3. **--no-privileges** : Pour éviter les conflits de droits
4. **--if-exists --clean** : Pour nettoyer avant de recréer

## Vérification après migration

```sql
-- Dans ph2026-test SQL Editor
-- Lister toutes les tables
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public'
ORDER BY table_name;

-- Compter les lignes (devrait être 0 si pas de données)
SELECT 
  schemaname,
  tablename,
  n_live_tup as row_count
FROM pg_stat_user_tables
ORDER BY n_live_tup DESC;
```