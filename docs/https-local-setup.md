# Configuration HTTPS pour le développement local

## Pourquoi HTTPS en local ?

Slack OAuth nécessite des URLs de redirection HTTPS. Pour le développement local, nous devons donc configurer HTTPS.

## Configuration automatique

Les certificats SSL auto-signés ont déjà été générés dans le dossier `/certificates`.

## Lancer le serveur en HTTPS

```bash
npm run dev:https
```

Le serveur sera accessible sur : **https://localhost:3000**

## Première visite

Lors de votre première visite sur https://localhost:3000, votre navigateur affichera un avertissement de sécurité car le certificat est auto-signé.

### Sur Chrome/Edge :
1. Cliquez sur "Avancé"
2. Cliquez sur "Continuer vers localhost (non sécurisé)"

### Sur Firefox :
1. Cliquez sur "Avancé"
2. Cliquez sur "Accepter le risque et continuer"

### Sur Safari :
1. Cliquez sur "Afficher les détails"
2. Cliquez sur "Visiter ce site web"
3. Entrez votre mot de passe Mac si demandé

## Variables d'environnement

Mettez à jour votre `.env.local` :

```env
# Remplacer l'ancienne URL HTTP
NEXT_PUBLIC_SLACK_REDIRECT_URI=https://localhost:3000/api/slack/callback
```

## Configuration Slack App

Dans votre Slack App (https://api.slack.com/apps) :

1. Allez dans **OAuth & Permissions**
2. Dans **Redirect URLs**, ajoutez :
   - `https://localhost:3000/api/slack/callback`

## Régénérer les certificats (si nécessaire)

Si vous devez régénérer les certificats :

```bash
# Créer le dossier
mkdir -p certificates

# Générer un nouveau certificat auto-signé
openssl req -x509 -out certificates/localhost.crt \
  -keyout certificates/localhost.key \
  -newkey rsa:2048 -nodes -sha256 \
  -subj '/CN=localhost' -days 365
```

## Troubleshooting

### Erreur "EADDRINUSE"
Le port 3000 est déjà utilisé. Arrêtez l'autre processus ou utilisez un port différent :
```bash
npm run dev:https -- -p 3001
```

### Erreur de certificat
Si le certificat n'est pas trouvé, vérifiez que les fichiers existent :
```bash
ls -la certificates/
```

### Slack refuse toujours la connexion
- Vérifiez que l'URL de redirection dans Slack correspond exactement : `https://localhost:3000/api/slack/callback`
- Assurez-vous d'avoir sauvegardé les changements dans Slack App
- Essayez de réinstaller l'app dans votre workspace

## Alternative : ngrok

Si vous préférez utiliser ngrok pour exposer votre serveur local :

```bash
# Installer ngrok
brew install ngrok

# Lancer votre serveur normalement
npm run dev

# Dans un autre terminal, exposer le port 3000
ngrok http 3000

# Utilisez l'URL HTTPS fournie par ngrok dans Slack
```

**Note :** L'URL ngrok change à chaque redémarrage, vous devrez mettre à jour Slack à chaque fois.