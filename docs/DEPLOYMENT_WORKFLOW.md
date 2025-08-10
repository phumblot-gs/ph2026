# Workflow de déploiement PH2026

## Vue d'ensemble

Le projet utilise un workflow de déploiement en 3 environnements :

```
dev → test → main
 ↓     ↓      ↓
Local  Test   Production
```

## Environnements

### 1. **Développement (dev)**
- **Branche** : `dev`
- **Base de données** : Supabase local
- **Application** : http://localhost:3000
- **Utilisation** : Développement de nouvelles fonctionnalités

### 2. **Test (test)**
- **Branche** : `test`
- **Base de données** : Supabase ph2026-test
- **Application** : https://test.ph2026.fr
- **Utilisation** : Tests et validation avant production

### 3. **Production (main)**
- **Branche** : `main`
- **Base de données** : Supabase ph2026 (production)
- **Application** : https://ph2026.fr
- **Utilisation** : Site en production

## Processus de déploiement

### 1. Développement d'une fonctionnalité

```bash
# Sur la branche dev
git checkout dev
git pull origin dev

# Développer la fonctionnalité
# - Code Next.js
# - Migrations Supabase (voir supabase/README.md)

# Tester localement
npm run dev
supabase start
```

### 2. Déploiement vers Test

```bash
# Créer une PR ou merger directement
git checkout test
git pull origin test
git merge dev
git push origin test

# Vérifications automatiques :
# - Vercel déploie sur test.ph2026.fr
# - Supabase applique les migrations sur ph2026-test
```

### 3. Validation sur Test

- Tester sur https://test.ph2026.fr
- Vérifier les fonctionnalités
- Valider avec l'équipe

### 4. Déploiement en Production

```bash
# Une fois validé sur test
git checkout main
git pull origin main
git merge test
git push origin main

# Déploiements automatiques :
# - Vercel déploie sur ph2026.fr
# - Supabase applique les migrations sur ph2026 (prod)
```

## Scripts de déploiement (legacy)

Les scripts `deploy-test.sh` et `deploy-prod.sh` dans `/scripts` sont conservés mais ne sont plus nécessaires avec l'intégration GitHub.

## Intégrations automatiques

### Vercel
- **dev** : Déploiements preview
- **test** : Environnement test (test.ph2026.fr)
- **main** : Production (ph2026.fr)

### Supabase
- **Migrations** : Appliquées automatiquement via GitHub integration
- **Dossier** : `/supabase`
- **test** : ph2026-test
- **main** : ph2026

## Variables d'environnement

Gérées dans Vercel par environnement :

### Development (local)
- Fichier : `.env.local`

### Test (preview)
- Vercel Dashboard → Settings → Environment Variables → Preview

### Production
- Vercel Dashboard → Settings → Environment Variables → Production

## Checklist de déploiement

### Avant de merger vers test
- [ ] Code testé localement
- [ ] Migrations Supabase testées avec `supabase db reset`
- [ ] Build réussi : `npm run build`
- [ ] Lint passé : `npm run lint`

### Avant de merger vers main
- [ ] Fonctionnalité validée sur test.ph2026.fr
- [ ] Pas d'erreurs dans les logs Vercel
- [ ] Pas d'erreurs dans les logs Supabase
- [ ] Performance acceptable

## Rollback

### Application (Vercel)
1. Aller dans Vercel Dashboard
2. Deployments → Choisir un déploiement précédent
3. "Promote to Production"

### Base de données (Supabase)
1. Créer une migration de rollback
2. La déployer via le workflow normal

```bash
# Créer une migration de rollback
supabase migration new rollback_feature_x

# Éditer pour défaire les changements
# Puis suivre le workflow normal : dev → test → main
```

## Monitoring

### Vercel
- Dashboard : https://vercel.com/dashboard
- Logs : Functions → Logs

### Supabase
- Dashboard : https://app.supabase.com
- Logs : Project → Logs

## Contacts

- **Problème Vercel** : Vérifier les Environment Variables
- **Problème Supabase** : Vérifier les migrations dans `/supabase/migrations`
- **Problème DNS** : Configuration dans OVH/Cloudflare