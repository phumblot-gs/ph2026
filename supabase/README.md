# Supabase - Workflow de développement et déploiement

## 📁 Structure

```
supabase/
├── migrations/      # Migrations SQL versionnées
├── config.toml      # Configuration Supabase (à créer)
├── seed.sql         # Données de test (optionnel)
└── archive/         # Anciens fichiers SQL (à ignorer)
```

## 🔄 Workflow Git & Environnements

### Branches et environnements

```
dev (développement local)
  ↓ PR + review
test (environnement de test Supabase)
  ↓ PR + review
main (production Supabase)
```

- **`dev`** : Développement local avec Supabase CLI
- **`test`** : Environnement de test/preview dans Supabase
- **`main`** : Production

### Intégration GitHub configurée

- Supabase est connecté au repo GitHub
- Le dossier `/supabase` est le point d'installation
- Les migrations sont appliquées automatiquement lors des push

## 🚀 Guide de développement

### 1. Installation initiale

```bash
# Installer Supabase CLI
brew install supabase/tap/supabase

# Initialiser le projet (si pas déjà fait)
cd /Users/phf/ph2026
supabase init

# Lier au projet Supabase
supabase link --project-ref [YOUR_PROJECT_REF]
```

### 2. Développement d'une nouvelle fonctionnalité

```bash
# 1. Être sur la branche dev
git checkout dev
git pull origin dev

# 2. Démarrer Supabase localement
supabase start

# 3. Ouvrir le Studio local pour faire vos modifications
supabase studio
# URL: http://localhost:54323

# 4. Faire vos modifications dans le Studio ou via SQL
# Exemple : créer une nouvelle table, ajouter des colonnes, etc.

# 5. Générer la migration automatiquement
supabase db diff --use-migra nom_de_la_fonctionnalite

# 6. Vérifier la migration créée
cat supabase/migrations/[timestamp]_nom_de_la_fonctionnalite.sql

# 7. Tester la migration
supabase db reset

# 8. Commiter et pusher
git add supabase/migrations/
git commit -m "feat: description de la fonctionnalité"
git push origin dev
```

### 3. Déploiement vers Test

```bash
# 1. Créer une PR de dev vers test
git checkout test
git pull origin test
git merge dev

# 2. Pusher vers test
git push origin test

# 3. Vérifier dans Supabase Dashboard
# Les migrations sont appliquées automatiquement
# URL test : test.ph2026.fr
```

### 4. Déploiement vers Production

```bash
# 1. Une fois validé sur test, créer une PR vers main
git checkout main
git pull origin main
git merge test

# 2. Pusher vers main
git push origin main

# 3. Les migrations sont appliquées automatiquement en production
# URL prod : ph2026.fr
```

## 📝 Commandes utiles

### Développement local

```bash
# Démarrer/arrêter Supabase local
supabase start
supabase stop

# Ouvrir le Studio local
supabase studio

# Voir les logs
supabase logs

# Status de la DB locale
supabase status
```

### Migrations

```bash
# Créer une migration manuellement
supabase migration new nom_migration

# Générer une migration depuis les changements locaux
supabase db diff --use-migra nom_migration

# Lister les migrations
supabase migration list

# Réinitialiser la DB locale (réapplique toutes les migrations)
supabase db reset

# Appliquer les migrations sans reset
supabase migration up
```

### Synchronisation

```bash
# Récupérer le schéma de production vers local
supabase db pull

# Pousser les migrations vers remote (sans Git)
supabase db push

# Voir les différences local vs remote
supabase db diff
```

## ⚠️ Règles importantes

### ✅ À FAIRE

1. **Toujours développer localement d'abord**
2. **Utiliser `supabase db diff` pour générer les migrations**
3. **Tester avec `supabase db reset` avant de pusher**
4. **Suivre le flow : dev → test → main**
5. **Faire des PR pour review avant merge**

### ❌ À NE PAS FAIRE

1. **Ne JAMAIS modifier une migration déjà pushée**
2. **Ne pas faire de changements manuels en production**
3. **Ne pas supprimer de migrations**
4. **Ne pas modifier directement sur main**

## 🔧 Configuration Supabase (config.toml)

```toml
# A générer avec supabase init
[project]
id = "votre-project-ref"

[api]
enabled = true
port = 54321
schemas = ["public", "auth", "storage"]

[db]
port = 54322
schema = ["public"]

[studio]
enabled = true
port = 54323
```

## 🐛 Troubleshooting

### Erreur : "Database is not running"

```bash
supabase start
```

### Erreur : "Migration already exists"

```bash
# Vérifier les migrations
supabase migration list

# Si besoin, reset
supabase db reset
```

### Synchroniser avec production

```bash
# Si vous avez fait des changements manuels en prod (à éviter)
supabase db pull

# Puis continuer le workflow normal
```

### Rollback d'une migration

Pour annuler une migration, créer une nouvelle migration qui défait les changements :

```bash
# Créer une migration de rollback
supabase migration new rollback_nom_fonctionnalite

# Éditer le fichier pour défaire les changements
# Exemple : DROP TABLE, DROP COLUMN, etc.
```

## 📊 Monitoring

- **Logs Supabase** : Dashboard → Logs
- **Migrations appliquées** : Dashboard → Database → Migrations
- **Statut GitHub** : Dashboard → Settings → GitHub

## 🔐 Variables d'environnement

Les variables sont gérées dans Vercel, pas dans Supabase :

- **Dev** : `.env.local`
- **Test** : Variables Vercel environnement Preview
- **Prod** : Variables Vercel environnement Production

## 📚 Documentation

- [Supabase CLI](https://supabase.com/docs/guides/cli)
- [Database Migrations](https://supabase.com/docs/guides/deployment/database-migrations)
- [GitHub Integration](https://supabase.com/docs/guides/platform/github-integration)