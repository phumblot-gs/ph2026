# Configuration Google OAuth pour PH2026

## 1. Créer un projet Google Cloud

1. Allez sur [console.cloud.google.com](https://console.cloud.google.com)
2. Créez un nouveau projet :
   - **Nom du projet** : PH2026
   - **ID du projet** : ph2026 (ou ph2026-prod)

## 2. Configurer l'écran de consentement OAuth

1. Dans le menu, allez dans **APIs & Services** → **OAuth consent screen**
2. Choisissez **External** (pour permettre à n'importe qui avec un compte Google de se connecter)
3. Remplissez les informations :
   - **App name** : PH2026
   - **User support email** : votre-email@example.com
   - **App logo** : (optionnel) Logo de la campagne
   - **Application home page** : https://votre-domaine.fr (ou http://localhost:3000 pour dev)
   - **Application privacy policy** : https://votre-domaine.fr/privacy
   - **Application terms of service** : https://votre-domaine.fr/terms
   - **Authorized domains** : 
     - supabase.co
     - votre-domaine.fr (quand vous l'aurez)
   - **Developer contact** : votre-email@example.com

## 3. Créer les identifiants OAuth 2.0

1. Allez dans **APIs & Services** → **Credentials**
2. Cliquez sur **Create Credentials** → **OAuth client ID**
3. Choisissez **Web application**
4. Configurez :
   - **Name** : Supabase Auth
   - **Authorized JavaScript origins** :
     - https://xbwoskydlvjsckpvfnkt.supabase.co
     - http://localhost:3000 (pour le dev local)
   - **Authorized redirect URIs** :
     - https://xbwoskydlvjsckpvfnkt.supabase.co/auth/v1/callback
     - http://localhost:3000/auth/callback

5. Copiez le **Client ID** et **Client Secret**

## 4. Configurer dans Supabase

1. Dans Supabase Dashboard, allez dans **Authentication** → **Providers**
2. Cliquez sur **Google**
3. Activez le provider
4. Collez :
   - **Client ID** : votre_client_id
   - **Client Secret** : votre_client_secret

## 5. URLs de callback importantes

### Pour Supabase :
```
https://xbwoskydlvjsckpvfnkt.supabase.co/auth/v1/callback
```

### Pour votre domaine personnalisé (futur) :
```
https://votre-domaine.fr/auth/callback
```

## 6. Test de connexion

1. Allez sur votre site
2. Cliquez sur "Se connecter avec Google"
3. Le popup devrait maintenant afficher "PH2026" au lieu de l'URL Supabase

## 7. Notes importantes

- **En développement** : L'application restera en mode "Testing" dans Google Cloud
- **En production** : Vous devrez soumettre l'app pour vérification si vous dépassez 100 utilisateurs
- **Scopes** : Par défaut, seuls email et profil sont demandés (suffisant pour l'authentification)

## 8. Sécurité

- Ne jamais committer les Client ID/Secret dans le code
- Utiliser les variables d'environnement
- Restreindre les domaines autorisés en production