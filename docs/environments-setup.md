# Configuration des Environnements

## 🎯 Vue d'ensemble

| Environnement | Branche Git | URL | Base de données | Usage |
|--------------|-------------|-----|-----------------|-------|
| **Development** | `dev` | localhost:3000 | Supabase Test | Développement quotidien |
| **Test/Staging** | `test` | ph2026-test.vercel.app | Supabase Test | Tests & validation |
| **Production** | `main` | ph2026.fr | Supabase Prod | Utilisateurs réels |

## 📦 1. Configuration Supabase

### Créer le projet Test/Staging

1. Aller sur [app.supabase.com](https://app.supabase.com)
2. **New Project** avec ces paramètres :
   - Name: `ph2026-test`
   - Database Password: (générer et sauvegarder)
   - Region: `eu-central-1` (Frankfurt)
   - Plan: Free

3. Une fois créé, récupérer les clés :
   - Settings → API
   - Copier : `URL`, `anon public`, `service_role`

### Migrer le schéma vers Test

Dans le SQL Editor du nouveau projet test, exécuter dans l'ordre :

```sql
-- 1. Tables de base
migration-1-init.sql

-- 2. Trigger pour nouveaux users
migration-2-handle-new-user.sql

-- 3. Ajout du rôle admin
migration-3-add-admin-role.sql

-- 4. Ajout du rôle pending
migration-4-add-pending-role.sql

-- 5. Google OAuth handler
migration-5-google-oauth-handler.sql

-- 6. Email notification trigger (optionnel)
migration-6-email-notification-trigger.sql

-- 7. Créer des comptes de test
create-test-admin.sql
```

### Configurer Google OAuth pour Test

1. Dans Supabase Test : Authentication → Providers → Google
2. Copier le `Callback URL`
3. Dans Google Cloud Console, ajouter cette URL aux redirections autorisées
4. Copier les Client ID/Secret de Google dans Supabase

## 🚀 2. Configuration Vercel

### Créer le projet Test

#### Option A : Via Vercel CLI
```bash
# Installer Vercel CLI si nécessaire
npm i -g vercel

# Se connecter
vercel login

# Depuis le dossier du projet
vercel

# Répondre aux questions :
# - Link to existing project? No
# - What's your project name? ph2026-test
# - In which scope? (votre compte)
# - Link to different directory? No
```

#### Option B : Via l'interface web

1. Aller sur [vercel.com/new](https://vercel.com/new)
2. Import Git Repository → `phumblot-gs/ph2026`
3. Configure Project :
   - Project Name: `ph2026-test`
   - Framework: Next.js (auto-détecté)
   - Root Directory: `./` 
   - Build Command: (laisser par défaut)

### Configurer les branches

Dans Vercel Dashboard → `ph2026-test` → Settings → Git :

1. **Production Branch** : `test` (important!)
2. **Branch Deployments** : 
   - Cocher "Only build production branch"

### Ajouter les variables d'environnement

Dans Settings → Environment Variables, ajouter :

```bash
# Supabase Test
NEXT_PUBLIC_SUPABASE_URL=https://[votre-test-ref].supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=[votre-test-anon-key]
SUPABASE_SERVICE_ROLE_KEY=[votre-test-service-key]

# URL
NEXT_PUBLIC_SITE_URL=https://ph2026-test.vercel.app

# Email (optionnel pour test)
RESEND_API_KEY=[même clé ou clé de test]

# Environment
NEXT_PUBLIC_ENV=test
```

### Déclencher le premier déploiement

```bash
git checkout test
git push origin test
```

Vérifier sur : https://ph2026-test.vercel.app

## 🏭 3. Configuration Production

### Mettre à jour le projet Vercel existant

Dans Vercel Dashboard → `ph2026` → Settings :

1. **Git** :
   - Production Branch : `main` (vérifier)
   - Branch Deployments : Only production

2. **Environment Variables** :
   ```bash
   NEXT_PUBLIC_SUPABASE_URL=https://xbwoskydlvjsckpvfnkt.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=[prod-anon-key]
   SUPABASE_SERVICE_ROLE_KEY=[prod-service-key]
   NEXT_PUBLIC_SITE_URL=https://ph2026.fr
   RESEND_API_KEY=[prod-resend-key]
   NEXT_PUBLIC_ENV=production
   ```

3. **Domains** (quand prêt) :
   - Add → `ph2026.fr`
   - Add → `www.ph2026.fr`
   - Suivre les instructions DNS

## 🔄 4. Workflow quotidien

### Développeur

```bash
# Matin : mettre à jour dev
git checkout dev
git pull origin dev

# Travailler...
git add .
git commit -m "feat: nouvelle fonctionnalité"
git push origin dev

# Fin de semaine : déployer en test
./scripts/deploy-test.sh
```

### Responsable projet

```bash
# Après validation en test
./scripts/deploy-prod.sh

# Si problème
./scripts/rollback.sh v20240101-1234
```

## 🧪 5. Tests par environnement

### Local (dev)
- Tests unitaires : `npm test`
- Lint : `npm run lint`
- Build : `npm run build`
- E2E : `npm run test:e2e` (à configurer)

### Test/Staging
- Tests fonctionnels manuels
- Tests d'intégration
- Tests de performance
- Validation métier

### Production
- Monitoring (Vercel Analytics)
- Logs (Vercel Functions)
- Alertes (à configurer avec Sentry)

## 📊 6. Monitoring

### Vercel Analytics (gratuit)

Dans chaque projet Vercel :
1. Analytics → Enable
2. Ajouter le script dans `app/layout.tsx`

### Logs

```bash
# Voir les logs de fonction
vercel logs --project ph2026-test

# Voir les builds
vercel list --project ph2026-test
```

## 🔐 7. Sécurité

### Variables sensibles
- Ne JAMAIS commiter de `.env` files
- Utiliser Vercel pour les variables
- Rotation régulière des clés API

### Protection des branches
Dans GitHub → Settings → Branches :
- `main` : Protection complète
- `test` : Require PR reviews

### Backup base de données

```bash
# Backup quotidien de production
pg_dump -h db.[prod-ref].supabase.co \
  -U postgres \
  -d postgres \
  > backup-$(date +%Y%m%d).sql
```

## ❓ FAQ

### Comment ajouter une variable d'environnement ?

1. Local : Ajouter dans `.env.local`
2. Test : Vercel Dashboard → ph2026-test → Settings → Env Variables
3. Prod : Vercel Dashboard → ph2026 → Settings → Env Variables

### Comment voir quelle version est en production ?

```bash
git describe --tags --abbrev=0 origin/main
```

### Comment synchroniser les bases de données ?

```bash
# Export from test
pg_dump ... > test-data.sql

# Import to prod (ATTENTION!)
psql ... < test-data.sql
```

### Le build échoue sur Vercel ?

1. Vérifier les logs : Vercel Dashboard → Functions → Logs
2. Vérifier les variables d'environnement
3. Tester le build en local : `npm run build`

## 📞 Support

- Documentation Vercel : [vercel.com/docs](https://vercel.com/docs)
- Documentation Supabase : [supabase.com/docs](https://supabase.com/docs)
- Issues GitHub : [github.com/phumblot-gs/ph2026/issues](https://github.com/phumblot-gs/ph2026/issues)