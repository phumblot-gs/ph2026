# Guide : Copier Production vers Test dans Supabase

## Méthode 1 : Via l'interface Supabase (Plus simple)

### Étape 1 : Exporter depuis Production
1. Connectez-vous à votre projet **ph2026** (production)
2. Allez dans **SQL Editor**
3. Cliquez sur **"New Query"**
4. Exécutez cette commande pour voir toutes vos tables :
```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public'
ORDER BY table_name;
```

5. Pour chaque table, exportez la structure :
```sql
-- Pour voir la structure d'une table spécifique
\d public.members
```

### Étape 2 : Utiliser Supabase Migration
1. Dans le projet **Production**, allez dans **Database** → **Migrations**
2. Cliquez sur **"Create a new migration"**
3. Supabase va générer automatiquement le SQL de votre schéma actuel
4. Copiez ce SQL

### Étape 3 : Importer dans Test
1. Connectez-vous à **ph2026-test**
2. SQL Editor → New Query
3. Collez et exécutez le SQL

## Méthode 2 : Utiliser pg_dump (Plus complet)

### Sur votre machine locale :
```bash
# Obtenir les connection strings depuis Supabase Dashboard
# Settings → Database → Connection string

# Exporter la production (structure seulement)
pg_dump "postgresql://postgres:[password]@db.[project-ref].supabase.co:5432/postgres" \
  --schema-only \
  --no-owner \
  --no-privileges \
  > production_schema.sql

# Importer dans test
psql "postgresql://postgres:[password]@db.[test-project-ref].supabase.co:5432/postgres" \
  < production_schema.sql
```

## Méthode 3 : Backup Supabase Pro

Si vous avez Supabase Pro :
1. **Production** → Settings → Database → Backups
2. Créez un backup
3. Téléchargez-le
4. **Test** → Restaurez le backup

## Méthode 4 : Script SQL manuel

1. Dans **Production**, exécutez `extract-schema.sql` que j'ai créé
2. Copiez tous les résultats
3. Assemblez-les dans un seul fichier
4. Exécutez dans **Test**

## Important : Après la copie

1. **Vérifiez les variables d'environnement** dans Vercel pour l'environnement test
2. **Vérifiez les URLs de callback OAuth** dans Supabase Test
3. **Créez des comptes de test** (ne copiez pas les données utilisateurs de prod)

## Connection Strings

Vous les trouvez dans :
- Supabase Dashboard → Settings → Database → Connection string
- Ou dans l'API Settings pour les clés Anon et Service Role