# Guide de configuration de l'application Slack

Ce guide vous explique comment créer et configurer votre application Slack pour l'intégration avec PH2026.

## Prérequis

- Un compte Slack avec les permissions pour créer des applications
- Accès à un workspace Slack (gratuit ou payant)
- L'application PH2026 configurée en local ou en production

## Étape 1 : Créer une nouvelle application Slack

1. Allez sur [api.slack.com/apps](https://api.slack.com/apps)
2. Cliquez sur "Create New App"
3. Choisissez "From scratch"
4. Donnez un nom à votre application (ex: "PH2026")
5. Sélectionnez le workspace où installer l'application

## Étape 2 : Configurer OAuth & Permissions

Dans la section "OAuth & Permissions" :

### Redirect URLs
Ajoutez votre URL de callback :
- Pour le développement : `http://localhost:3000/api/slack/callback`
- Pour la production : `https://votre-domaine.com/api/slack/callback`

### Bot Token Scopes
Ajoutez les permissions suivantes :
- `channels:manage` - Créer et gérer les canaux
- `channels:read` - Lire les informations des canaux
- `channels:history` - Lire l'historique des messages
- `groups:write` - Gérer les canaux privés
- `groups:read` - Lire les canaux privés
- `users:read` - Lire les informations des utilisateurs
- `users:read.email` - Lire les emails des utilisateurs
- `chat:write` - Envoyer des messages
- `chat:write.public` - Envoyer des messages dans les canaux publics

### User Token Scopes
- `identity.basic` - Informations basiques de l'utilisateur
- `identity.email` - Email de l'utilisateur
- `identity.avatar` - Avatar de l'utilisateur

## Étape 3 : Installer l'application dans votre workspace

1. Dans "OAuth & Permissions", cliquez sur "Install to Workspace"
2. Autorisez l'application
3. Copiez le "Bot User OAuth Token" (commence par `xoxb-`)

## Étape 4 : Configurer les Event Subscriptions (Optionnel)

Si vous voulez recevoir des événements en temps réel :

1. Dans "Event Subscriptions", activez les events
2. Ajoutez votre Request URL : `https://votre-domaine.com/api/slack/events`
3. Ajoutez les événements bot :
   - `message.channels` - Messages dans les canaux publics
   - `member_joined_channel` - Membre rejoint un canal
   - `member_left_channel` - Membre quitte un canal

## Étape 5 : Récupérer les credentials

Dans "Basic Information" :
- **Client ID** : Dans "App Credentials"
- **Client Secret** : Dans "App Credentials" (cliquez sur "Show")
- **Signing Secret** : Dans "App Credentials" (cliquez sur "Show")

## Étape 6 : Configuration dans l'application

Créez ou modifiez votre fichier `.env.local` :

```env
# Slack Integration
SLACK_CLIENT_ID=your_slack_client_id_here
SLACK_CLIENT_SECRET=your_slack_client_secret_here
SLACK_SIGNING_SECRET=your_slack_signing_secret_here
SLACK_BOT_TOKEN=xoxb-your_bot_token_here
NEXT_PUBLIC_SLACK_REDIRECT_URI=http://localhost:3000/api/slack/callback
```

Pour la production, changez `NEXT_PUBLIC_SLACK_REDIRECT_URI` avec votre domaine.

## Étape 7 : Permissions Admin (Optionnel - Plan payant requis)

Pour les fonctionnalités avancées (workspaces payants uniquement) :

Dans "OAuth & Permissions", ajoutez ces scopes supplémentaires :
- `admin.conversations:write` - Créer des canaux pour d'autres utilisateurs
- `admin.users:read` - Lire tous les utilisateurs du workspace
- `usergroups:read` - Lire les groupes d'utilisateurs
- `usergroups:write` - Gérer les groupes d'utilisateurs

## Limitations selon le plan Slack

### Plan Gratuit
- ✅ Créer des canaux publics/privés
- ✅ Inviter des utilisateurs aux canaux
- ✅ Lire les messages (90 jours d'historique)
- ❌ Créer des canaux pour d'autres utilisateurs
- ❌ Permissions admin avancées

### Plan Payant
- ✅ Toutes les fonctionnalités du plan gratuit
- ✅ Historique illimité des messages
- ✅ Créer des canaux pour d'autres utilisateurs
- ✅ Permissions admin complètes
- ✅ Intégration avec SSO

## Test de l'intégration

1. Connectez-vous à l'application PH2026
2. Allez dans votre profil (`/profile`)
3. Cliquez sur "Connecter Slack"
4. Autorisez l'application
5. Vérifiez que votre compte Slack est bien connecté

## Dépannage

### Erreur "invalid_client"
- Vérifiez que le Client ID et Client Secret sont corrects
- Assurez-vous que l'URL de callback correspond exactement

### Erreur "oauth_authorization_url_mismatch"
- L'URL de callback doit être exactement la même que celle configurée dans Slack
- Attention au protocole (http vs https) et au port

### L'utilisateur ne peut pas créer de canal
- Vérifiez que le bot a les permissions `channels:manage`
- Sur un workspace gratuit, seul l'utilisateur connecté peut créer ses propres canaux

### Messages non visibles
- Le bot doit être membre du canal pour lire les messages
- Vérifiez les permissions `channels:history`