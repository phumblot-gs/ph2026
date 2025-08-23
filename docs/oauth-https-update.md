# Mise à jour des configurations OAuth pour HTTPS

Maintenant que le serveur de développement utilise HTTPS (`https://localhost:3000`), vous devez mettre à jour les URLs de redirection dans tous vos providers OAuth.

## 1. Google OAuth

### Console Google Cloud
1. Allez sur [Google Cloud Console](https://console.cloud.google.com/)
2. Sélectionnez votre projet
3. Menu → APIs & Services → Credentials
4. Cliquez sur votre OAuth 2.0 Client ID
5. Dans **Authorized redirect URIs**, ajoutez :
   - `https://localhost:3000/auth/callback`
   - `https://nzdtnhdgekawwmjrpako.supabase.co/auth/v1/callback`
6. Sauvegardez

### Dans Supabase Dashboard
1. Allez sur [Supabase Dashboard](https://supabase.com/dashboard)
2. Sélectionnez votre projet
3. Authentication → Providers → Google
4. Vérifiez que le Redirect URL est bien configuré

## 2. X (Twitter) OAuth

### X Developer Portal
1. Allez sur [X Developer Portal](https://developer.twitter.com/en/portal/dashboard)
2. Sélectionnez votre app
3. Dans "User authentication settings" → Edit
4. **Callback URI / Redirect URL** :
   - Ajoutez : `https://nzdtnhdgekawwmjrpako.supabase.co/auth/v1/callback`
   - Gardez aussi la version HTTP pour la production si nécessaire
5. **Website URL** : `https://localhost:3000` (pour le dev)
6. Sauvegardez

### Dans Supabase Dashboard
1. Authentication → Providers → Twitter
2. Les credentials restent les mêmes (API Key et API Secret)
3. Le Redirect URL devrait être : `https://nzdtnhdgekawwmjrpako.supabase.co/auth/v1/callback`

## 3. Slack OAuth

✅ **Déjà configuré** - Les URLs ont été mises à jour pour HTTPS :
- Redirect URL : `https://localhost:3000/api/slack/callback`

## 4. Supabase Auth Configuration

Les URLs de callback Supabase utilisent automatiquement le domaine Supabase (qui est déjà en HTTPS), donc pas de changement nécessaire côté Supabase.

### Vérification dans Supabase
1. Authentication → URL Configuration
2. **Site URL** : `https://localhost:3000`
3. **Redirect URLs** : Ajoutez `https://localhost:3000/**`

## Important pour X (Twitter)

⚠️ **Note**: X (Twitter) OAuth peut être plus restrictif avec les URLs localhost. Si vous rencontrez des problèmes :

1. **Option 1 : Utiliser ngrok** (recommandé pour X)
   ```bash
   # Installer ngrok si pas déjà fait
   brew install ngrok
   
   # Exposer votre serveur HTTPS local
   ngrok http https://localhost:3000
   
   # Utilisez l'URL HTTPS fournie par ngrok dans X Developer Portal
   ```

2. **Option 2 : Domaine local personnalisé**
   - Ajoutez dans `/etc/hosts` : `127.0.0.1 dev.ph2026.local`
   - Utilisez `https://dev.ph2026.local:3000` au lieu de localhost
   - Mettez à jour X avec ce domaine

## Tester les connexions

Après avoir mis à jour toutes les configurations :

1. **Google** : https://localhost:3000/login → "Se connecter avec Google"
2. **X/Twitter** : https://localhost:3000/login → "Se connecter avec X"
3. **Slack** : https://localhost:3000/profile → "Se connecter à Slack"

## Troubleshooting

### Erreur "redirect_uri_mismatch" (Google)
- Vérifiez que l'URL correspond EXACTEMENT (y compris https://)
- Attendez quelques minutes après la sauvegarde

### Erreur "Callback URL not approved" (X/Twitter)
- X peut mettre jusqu'à 15 minutes pour appliquer les changements
- Essayez avec ngrok si localhost ne fonctionne pas

### Erreur générale OAuth
- Vérifiez les logs du serveur : `npm run dev:https`
- Vérifiez la console du navigateur pour les erreurs CORS
- Assurez-vous que les cookies tiers sont autorisés

## Pour la production

N'oubliez pas de garder/ajouter les URLs de production dans chaque provider :
- Google : `https://votre-domaine.com/auth/callback`
- X : `https://votre-domaine.com/auth/callback`
- Slack : `https://votre-domaine.com/api/slack/callback`