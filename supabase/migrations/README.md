# Dossier Migrations

Ce dossier contient toutes les migrations de base de données versionnées.

## Format des fichiers

- **Nommage** : `YYYYMMDDHHMMSS_description.sql`
- **Généré par** : `supabase db diff` ou `supabase migration new`
- **Ordre** : Exécutées dans l'ordre chronologique

## Workflow

1. **Développer localement** avec `supabase studio`
2. **Générer la migration** avec `supabase db diff`
3. **Tester** avec `supabase db reset`
4. **Déployer** via Git push

## Important

- ❌ Ne JAMAIS modifier une migration existante
- ❌ Ne pas supprimer de migrations
- ✅ Pour annuler : créer une nouvelle migration de rollback

Voir `/supabase/README.md` pour le guide complet.