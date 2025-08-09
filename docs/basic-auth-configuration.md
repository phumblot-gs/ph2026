# Configuration de l'authentification basique

## 🔒 Protection du site avec authentification basique

Le site peut être protégé par une authentification basique (style htaccess) contrôlée par des variables d'environnement.

## Variables d'environnement

| Variable | Description | Valeur par défaut |
|----------|-------------|-------------------|
| `BASIC_AUTH_ENABLED` | Active/désactive l'auth basique | `false` |
| `BASIC_AUTH_USER` | Nom d'utilisateur | `paul` |
| `BASIC_AUTH_PASSWORD` | Mot de passe | `pierre` |

## Configuration par environnement

### 🔧 Local (.env.local)
```env
BASIC_AUTH_ENABLED=true
BASIC_AUTH_USER=paul
BASIC_AUTH_PASSWORD=pierre
```

### 🌐 Vercel

Dans **Settings → Environment Variables** :

#### Pour tous les environnements (site privé)
```
BASIC_AUTH_ENABLED = true
BASIC_AUTH_USER = paul
BASIC_AUTH_PASSWORD = pierre
```
Appliquer à : ✅ Production, ✅ Preview, ✅ Development

#### Pour désactiver en production seulement
1. Créer `BASIC_AUTH_ENABLED = false` pour Production uniquement
2. Créer `BASIC_AUTH_ENABLED = true` pour Preview uniquement

## Utilisation

### Activer la protection
1. Dans Vercel, ajouter `BASIC_AUTH_ENABLED = true`
2. Redéployer
3. Le site demandera paul/pierre pour y accéder

### Désactiver la protection (rendre public)
1. Dans Vercel, changer `BASIC_AUTH_ENABLED = false`
2. Redéployer
3. Le site sera accessible publiquement

## Routes exclues

L'authentification ne s'applique PAS aux :
- `/api/*` - Routes API
- `/auth/*` - Callbacks d'authentification
- Assets statiques (images, CSS, JS)

## Comportement

Quand `BASIC_AUTH_ENABLED=true` :
1. Première visite → Popup de connexion du navigateur
2. Entrer : `paul` / `pierre`
3. Le navigateur mémorise les credentials pour la session

## 🎯 Configuration recommandée actuelle

Tant que le site n'est pas prêt pour le public :

**Production (ph2026.fr)** :
```
BASIC_AUTH_ENABLED=true
BASIC_AUTH_USER=paul
BASIC_AUTH_PASSWORD=pierre
NEXT_PUBLIC_ENV=production
```

**Preview/Test** :
```
BASIC_AUTH_ENABLED=true
BASIC_AUTH_USER=paul
BASIC_AUTH_PASSWORD=pierre
NEXT_PUBLIC_ENV=test
```

## Quand rendre le site public

Pour le lancement officiel :
1. Mettre `BASIC_AUTH_ENABLED=false` en Production
2. Garder `BASIC_AUTH_ENABLED=true` en Preview/Test
3. Le site production sera public, les environnements test resteront protégés

## Test en local

```bash
# Avec protection
BASIC_AUTH_ENABLED=true npm run dev

# Sans protection
BASIC_AUTH_ENABLED=false npm run dev
# ou simplement
npm run dev
```

## Notes importantes

- L'authentification basique est une protection simple mais efficace
- Les credentials transitent en Base64 (utiliser HTTPS en production)
- Pour une sécurité renforcée, utiliser Vercel Deployment Protection en complément
- Les navigateurs gardent les credentials en cache, utiliser une navigation privée pour tester