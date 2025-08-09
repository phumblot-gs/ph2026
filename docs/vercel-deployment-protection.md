# Protection du site avec Vercel

## ⚠️ Important : Middleware Edge Runtime

Le middleware de Next.js s'exécute dans l'Edge Runtime de Vercel qui a des limitations :
- Les variables `process.env` ne sont pas accessibles de la même manière
- Buffer n'est pas disponible directement

## Solution recommandée : Vercel Deployment Protection

Au lieu d'utiliser l'authentification basique dans le middleware, utilisez **Vercel Deployment Protection** :

### Configuration dans Vercel

1. **Aller dans Vercel Dashboard** → Projet `ph2026`
2. **Settings** → **Deployment Protection**

### Pour protéger TOUS les environnements :

#### Option 1 : Password Protection (Recommandé)
- **Enable Password Protection**
- **Password** : `pierre`
- **Apply to** : 
  - ✅ Production Deployments
  - ✅ Preview Deployments

#### Option 2 : Vercel Authentication
- **Enable Vercel Authentication**
- Les utilisateurs devront se connecter avec un compte Vercel
- Vous pouvez inviter des testeurs spécifiques

### Résultat

- Tous les visiteurs devront entrer le mot de passe `pierre`
- Une fois authentifiés, ils auront accès au site
- Le cookie de session dure 7 jours

## Alternative : Basic Auth avec API Route

Si vous voulez absolument une auth basique custom, créez une API route au lieu du middleware :

```typescript
// app/api/auth/check/route.ts
export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  
  if (!authHeader || !authHeader.startsWith('Basic ')) {
    return new Response('Auth required', {
      status: 401,
      headers: {
        'WWW-Authenticate': 'Basic realm="Protected"',
      },
    })
  }
  
  // Validation...
  return new Response('OK')
}
```

## Configuration actuelle

Pour éviter l'erreur 500, l'authentification basique dans le middleware a été désactivée. Utilisez Vercel Deployment Protection à la place.

## Bandeau d'environnement

Le bandeau fonctionne toujours et nécessite dans Vercel :
- **Production** : `NEXT_PUBLIC_ENV=production` (pas de bandeau)
- **Preview** : `NEXT_PUBLIC_ENV=test` (bandeau orange)
- **Development** : `NEXT_PUBLIC_ENV=development` (bandeau rouge)