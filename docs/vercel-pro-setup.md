# Configuration Vercel Pro avec Environnements Multiples

## 🎯 Configuration avec Vercel Pro

Avec Vercel Pro, vous pouvez gérer plusieurs environnements dans un seul projet, ce qui simplifie grandement la gestion.

### Structure des environnements

| Branche | Environnement Vercel | URL | Usage |
|---------|---------------------|-----|-------|
| `main` | Production | ph2026.vercel.app (+ ph2026.fr) | Production |
| `test` | Preview | ph2026-[hash].vercel.app | Staging/Test |
| `dev` | Preview | ph2026-[hash].vercel.app | Développement |

## 📋 Configuration dans Vercel

### 1. Settings → Git

- **Production Branch** : `main`
- **Preview Branches** : `test`, `dev`

### 2. Settings → Environment Variables

#### Variables pour TOUS les environnements :
```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
RESEND_API_KEY
```

#### Variables spécifiques par environnement :

**Production (main)** :
```
NEXT_PUBLIC_SITE_URL = https://ph2026.fr
NEXT_PUBLIC_ENV = production
# Utilise Supabase production
NEXT_PUBLIC_SUPABASE_URL = https://xbwoskydlvjsckpvfnkt.supabase.co
```

**Preview - Test (test)** :
```
NEXT_PUBLIC_SITE_URL = [URL automatique de preview]
NEXT_PUBLIC_ENV = test
# Utilise Supabase test
NEXT_PUBLIC_SUPABASE_URL = https://[test-ref].supabase.co
```

**Preview - Dev (dev)** :
```
NEXT_PUBLIC_SITE_URL = [URL automatique de preview]
NEXT_PUBLIC_ENV = development
# Utilise Supabase test (même que test)
NEXT_PUBLIC_SUPABASE_URL = https://[test-ref].supabase.co
```

### 3. Configuration des variables par environnement

Dans Vercel Dashboard :

1. **Settings** → **Environment Variables**
2. Pour chaque variable, cliquer sur **Edit**
3. Décocher/cocher les environnements appropriés :
   - ✅ Production
   - ✅ Preview 
   - ✅ Development

4. Pour les variables spécifiques, créer plusieurs entrées :
   - Une pour Production uniquement
   - Une pour Preview uniquement

## 🔄 Workflow avec Vercel Pro

### Déploiement automatique

- **Push sur `main`** → Déploiement Production
- **Push sur `test`** → Déploiement Preview (stable)
- **Push sur `dev`** → Déploiement Preview (instable)

### URLs de preview

Vercel génère automatiquement des URLs pour les branches preview :
- Format : `ph2026-[branch]-[account].vercel.app`
- Exemple : `ph2026-test-phumblot.vercel.app`

Pour obtenir une URL stable pour test, vous pouvez :
1. Aller dans **Settings** → **Domains**
2. Ajouter un domaine comme `test.ph2026.fr`
3. L'assigner à la branche `test`

## 📝 Scripts de déploiement adaptés

Les scripts restent les mêmes :

```bash
# Dev vers Test
./scripts/deploy-test.sh

# Test vers Production
./scripts/deploy-prod.sh
```

## 🎯 Avantages de Vercel Pro

1. **Un seul projet** à gérer
2. **Variables d'environnement** centralisées
3. **Preview automatiques** pour chaque PR
4. **Commentaires** sur les PR avec les liens de preview
5. **Analytics** consolidées
6. **Rollback** facilité

## 🔧 Configuration des alias de domaine

Pour avoir des URLs stables :

1. **Production** : 
   - ph2026.fr → branche `main`
   - www.ph2026.fr → branche `main`

2. **Test** (optionnel) :
   - test.ph2026.fr → branche `test`
   - staging.ph2026.fr → branche `test`

## 📊 Monitoring

Dans Vercel Dashboard :
- **Deployments** : Voir tous les déploiements
- **Analytics** : Métriques par environnement
- **Functions** : Logs des API routes
- **Speed Insights** : Performance par environnement

## ⚠️ Points d'attention

1. Les variables d'environnement peuvent être différentes entre Production et Preview
2. Vérifier que les bonnes variables Supabase sont utilisées pour chaque environnement
3. Les preview branches créent des déploiements pour CHAQUE commit
4. Utiliser les "Deployment Protection" pour sécuriser la production

## 🔒 Protection de la production

Dans **Settings** → **Deployment Protection** :
- Activer "Vercel Authentication"
- Ou configurer un mot de passe
- Appliquer uniquement à l'environnement Production