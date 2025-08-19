# Configuration de l'authentification Supabase

## Configuration requise dans le Dashboard Supabase

### 1. Authentication → URL Configuration

Configurez les URLs suivantes :

- **Site URL**: `http://localhost:3000` (pour dev)
- **Redirect URLs** (ajouter toutes ces URLs):
  ```
  http://localhost:3000/auth/callback
  http://localhost:3000/auth-handler
  http://localhost:3000
  ```

### 2. Authentication → Email Templates

Modifiez le template "Confirm signup" :

- **Subject**: Confirmez votre inscription à PH2026
- **Redirect URL**: Remplacez par `{{ .SiteURL }}/auth/callback`

Le template doit contenir :
```
<h2>Confirmez votre inscription</h2>
<p>Cliquez sur le lien ci-dessous pour confirmer votre email :</p>
<p><a href="{{ .ConfirmationURL }}">Confirmer mon email</a></p>
```

### 3. Authentication → Providers

- **Email**: Activé
- **Google**: Activé (avec vos clés OAuth)
- **Twitter**: Activé (avec vos clés API)

### 4. Pour les environnements Test et Production

Répétez la même configuration en remplaçant `http://localhost:3000` par :
- Test: `https://ph2026-test.vercel.app`
- Production: `https://ph2026.fr`