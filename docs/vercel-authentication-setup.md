# Configuration de l'authentification Vercel

## Protection par mot de passe avec Vercel

### Pour les environnements Preview (test/dev)

1. **Dans Vercel Dashboard** → Projet `ph2026`
2. **Settings** → **Deployment Protection**
3. **Protection par mot de passe** :
   - Activer **"Password Protection"**
   - Définir le mot de passe : `pierre` (ou un autre)
   - Appliquer à : **Preview Deployments Only**
   - NE PAS appliquer à Production

### Alternative : Vercel Authentication

1. **Settings** → **Deployment Protection**
2. **Vercel Authentication** :
   - Activer pour Preview deployments
   - Les utilisateurs devront se connecter avec leur compte Vercel
   - Vous pouvez inviter des testeurs spécifiques

### Configuration actuelle dans le code

Le middleware a été configuré avec une authentification basique :
- **Username** : `paul`
- **Password** : `pierre`
- **Active sur** : Environnements dev et test uniquement
- **Désactivé sur** : Production

Cette authentification fonctionne en local mais sur Vercel, il est préférable d'utiliser leur système intégré.

## Variables d'environnement requises

Assurez-vous que ces variables sont définies dans Vercel :

**Pour Preview (test/dev)** :
```
NEXT_PUBLIC_ENV=test  # ou development
```

**Pour Production** :
```
NEXT_PUBLIC_ENV=production
```

## Bandeau d'environnement

Le bandeau apparaît automatiquement :
- **Rouge** : Environnement de développement
- **Orange** : Environnement de test
- **Invisible** : Production

## Test en local

```bash
# Définir l'environnement
export NEXT_PUBLIC_ENV=development

# Lancer le serveur
npm run dev

# Le site demandera paul/pierre
# Le bandeau rouge apparaîtra en haut
```