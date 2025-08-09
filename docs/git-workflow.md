# Workflow Git & Déploiement

## 🌳 Structure des branches

```
main (production)  ← test (staging) ← dev (développement)
```

### Branches principales

1. **`dev`** - Développement
   - Toutes les nouvelles fonctionnalités
   - Commits quotidiens
   - Peut être instable
   - Déployé sur : localhost

2. **`test`** - Staging/Recette
   - Version stable pour tests
   - Merge depuis `dev` quand prêt
   - Tests d'intégration
   - Déployé sur : ph2026-test.vercel.app

3. **`main`** - Production
   - Version en production
   - Merge depuis `test` après validation
   - Toujours stable
   - Déployé sur : ph2026.vercel.app (et ph2026.fr)

## 📋 Workflow de développement

### 1. Développement quotidien

```bash
# Toujours travailler sur dev
git checkout dev

# Faire vos modifications
# ... éditer des fichiers ...

# Commit et push
git add .
git commit -m "feat: description de la fonctionnalité"
git push origin dev
```

### 2. Déployer en test (staging)

```bash
# S'assurer que dev est à jour
git checkout dev
git pull origin dev

# Passer sur test
git checkout test
git pull origin test

# Merger dev dans test
git merge dev
git push origin test

# Vercel déploie automatiquement sur ph2026-test.vercel.app
```

### 3. Déployer en production

```bash
# S'assurer que test est validé
git checkout test
git pull origin test

# Passer sur main
git checkout main
git pull origin main

# Merger test dans main
git merge test
git push origin main

# Vercel déploie automatiquement sur ph2026.vercel.app
```

## 🚀 Configuration Vercel (3 projets)

### Projet 1 : Production (ph2026)
```
- Branch : main
- URL : ph2026.vercel.app (+ ph2026.fr)
- Variables d'environnement :
  NEXT_PUBLIC_SUPABASE_URL=https://[prod-id].supabase.co
  NEXT_PUBLIC_SUPABASE_ANON_KEY=[prod-anon-key]
  RESEND_API_KEY=[votre-clé-resend]
  NEXT_PUBLIC_SITE_URL=https://ph2026.fr
```

### Projet 2 : Test/Staging (ph2026-test)
```
- Branch : test
- URL : ph2026-test.vercel.app
- Variables d'environnement :
  NEXT_PUBLIC_SUPABASE_URL=https://[test-id].supabase.co
  NEXT_PUBLIC_SUPABASE_ANON_KEY=[test-anon-key]
  RESEND_API_KEY=[votre-clé-resend-test]
  NEXT_PUBLIC_SITE_URL=https://ph2026-test.vercel.app
```

### Projet 3 : Dev (optionnel - ph2026-dev)
```
- Branch : dev
- URL : ph2026-dev.vercel.app
- Variables d'environnement :
  NEXT_PUBLIC_SUPABASE_URL=https://[test-id].supabase.co
  NEXT_PUBLIC_SUPABASE_ANON_KEY=[test-anon-key]
  NEXT_PUBLIC_SITE_URL=https://ph2026-dev.vercel.app
```

## 🗄️ Configuration Supabase (2 projets)

### Projet 1 : Production
- Nom : ph2026-prod
- Région : eu-central-1 (Frankfurt)
- Utilisé par : branche `main`

### Projet 2 : Test/Dev
- Nom : ph2026-test
- Région : eu-central-1 (Frankfurt)
- Utilisé par : branches `test` et `dev`

## 📝 Étapes de configuration

### 1. Créer les projets Vercel

```bash
# Se connecter à Vercel
vercel login

# Créer le projet de test
vercel --name ph2026-test

# Créer le projet de production
vercel --name ph2026
```

Ou via l'interface web :
1. Aller sur [vercel.com/new](https://vercel.com/new)
2. Importer depuis GitHub : phumblot-gs/ph2026
3. Créer 2 projets distincts :
   - `ph2026` (branch main)
   - `ph2026-test` (branch test)

### 2. Configurer les branches dans Vercel

Pour chaque projet Vercel :
1. Settings → Git
2. Production Branch : 
   - `ph2026` : main
   - `ph2026-test` : test
3. Branch Deployments : Désactiver pour les autres branches

### 3. Créer le projet Supabase de test

1. Aller sur [app.supabase.com](https://app.supabase.com)
2. New Project → `ph2026-test`
3. Copier toutes les migrations SQL
4. Récupérer les clés API

### 4. Variables d'environnement

#### Dans Vercel (ph2026-test) :
```
NEXT_PUBLIC_SUPABASE_URL=https://[test-project-ref].supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=[test-anon-key]
SUPABASE_SERVICE_ROLE_KEY=[test-service-key]
NEXT_PUBLIC_SITE_URL=https://ph2026-test.vercel.app
RESEND_API_KEY=[même-clé-ou-différente]
```

#### Dans Vercel (ph2026) :
```
NEXT_PUBLIC_SUPABASE_URL=https://xbwoskydlvjsckpvfnkt.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=[prod-anon-key]
SUPABASE_SERVICE_ROLE_KEY=[prod-service-key]
NEXT_PUBLIC_SITE_URL=https://ph2026.fr
RESEND_API_KEY=[prod-resend-key]
```

## 🔄 Synchronisation des bases de données

### Migration de dev/test vers prod

```sql
-- Exporter depuis test
pg_dump -h db.[test-ref].supabase.co -U postgres -d postgres > backup.sql

-- Importer vers prod (avec précaution!)
psql -h db.[prod-ref].supabase.co -U postgres -d postgres < backup.sql
```

### Script de migration (à créer)

```bash
# scripts/migrate-to-prod.sh
#!/bin/bash
echo "⚠️  Migration vers production"
echo "Êtes-vous sûr ? (y/n)"
read confirm
if [ "$confirm" = "y" ]; then
  # Exécuter les migrations SQL
  # Synchroniser les Edge Functions
  # etc.
fi
```

## 🧪 Checklist avant merge

### Dev → Test
- [ ] Code review effectuée
- [ ] Tests unitaires passent
- [ ] Lint sans erreurs
- [ ] Build réussi localement
- [ ] Migrations SQL testées

### Test → Production
- [ ] Tests fonctionnels validés
- [ ] Performance acceptable
- [ ] Pas d'erreurs dans les logs
- [ ] Backup de la BDD prod effectué
- [ ] Communication équipe faite

## 🔐 Protection des branches

Dans GitHub :
1. Settings → Branches
2. Add rule pour `main` :
   - Require pull request reviews
   - Require status checks
   - Include administrators
3. Add rule pour `test` :
   - Require pull request reviews (optionnel)

## 📊 Monitoring

- **Production** : Surveiller avec Vercel Analytics
- **Test** : Logs dans Vercel Dashboard
- **Erreurs** : Sentry (à configurer)

## 🆘 Rollback d'urgence

```bash
# Si problème en production
git checkout main
git revert HEAD
git push origin main

# Ou revenir à un commit spécifique
git checkout main
git reset --hard [commit-hash]
git push origin main --force-with-lease
```

## 🤝 Convention de commit

Utiliser les préfixes :
- `feat:` Nouvelle fonctionnalité
- `fix:` Correction de bug
- `docs:` Documentation
- `style:` Formatage
- `refactor:` Refactoring
- `test:` Tests
- `chore:` Maintenance

## 📅 Planning type

- **Lundi-Jeudi** : Dev sur `dev`
- **Vendredi matin** : Merge `dev` → `test`
- **Vendredi après-midi** : Tests
- **Lundi suivant** : Si OK, merge `test` → `main`

## ⚡ Commandes utiles

```bash
# Voir l'état des branches
git branch -a

# Mettre à jour toutes les branches
git fetch --all

# Voir les différences entre branches
git diff dev..test

# Cherry-pick un commit spécifique
git cherry-pick [commit-hash]

# Annuler un merge
git merge --abort
```