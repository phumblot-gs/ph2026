# Configuration Stripe et Google Places API

## 1. Configuration Stripe (Mode Test)

### Étapes pour configurer Stripe en mode test :

1. **Créer un compte Stripe** (si pas déjà fait) :
   - Aller sur https://dashboard.stripe.com/register
   - Créer un compte gratuit

2. **Récupérer les clés de test** :
   - Se connecter au dashboard Stripe : https://dashboard.stripe.com/
   - S'assurer d'être en **mode Test** (toggle en haut à droite du dashboard)
   - Aller dans "Developers" > "API keys"
   - Copier :
     - **Publishable key** (commence par `pk_test_`)
     - **Secret key** (commence par `sk_test_`)

3. **Configurer les webhooks** :
   
   **Pour le développement (localhost) :**
   - Installer Stripe CLI : `brew install stripe/stripe-cli/stripe`
   - Se connecter : `stripe login`
   - Dans un terminal séparé, lancer : `stripe listen --forward-to localhost:3000/api/webhooks/stripe`
   - Copier le **Webhook secret temporaire** affiché (commence par `whsec_`)
   - Le mettre dans `.env.local`
   
   **Pour la production :**
   - Dans "Developers" > "Webhooks"
   - Cliquer sur "Add endpoint"
   - URL endpoint : `https://votre-domaine.com/api/webhooks/stripe`
   - Sélectionner les événements : `checkout.session.completed`, `payment_intent.succeeded`, `payment_intent.payment_failed`
   - Copier le **Webhook secret** (commence par `whsec_`)

4. **Mettre à jour le fichier `.env.local`** :
```env
# Stripe Configuration (Mode Test)
STRIPE_SECRET_KEY=sk_test_51... (votre clé secrète test)
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_51... (votre clé publique test)
STRIPE_WEBHOOK_SECRET=whsec_... (votre webhook secret si configuré)
```

### Cartes de test Stripe

Pour tester les paiements, utiliser ces numéros de carte :

**Paiements réussis :**
- `4242 4242 4242 4242` - Visa (paiement réussi)
- `5555 5555 5555 4444` - Mastercard (paiement réussi)
- Date d'expiration : N'importe quelle date future
- CVV : N'importe quel nombre à 3 chiffres
- Code postal : N'importe quel code postal valide

**Paiements échoués :**
- `4000 0000 0000 0002` - Carte refusée
- `4000 0000 0000 9995` - Fonds insuffisants

**SEPA Test (prélèvement bancaire) :**
- IBAN de test : `FR1420041010050500013M02606`
- Nom : N'importe quel nom

## 2. Configuration Google Places API

### Étapes pour configurer Google Places API :

1. **Accéder à Google Cloud Console** :
   - Aller sur https://console.cloud.google.com/
   - Se connecter avec votre compte Google

2. **Créer un nouveau projet** (ou utiliser un existant) :
   - Cliquer sur le sélecteur de projet en haut
   - "Nouveau projet"
   - Nom : "PH2026" ou similaire
   - Créer

3. **Activer les APIs nécessaires** :
   - Dans le menu, aller dans "APIs et services" > "Bibliothèque"
   - **IMPORTANT** : Activer ces 3 APIs obligatoirement :
     - **Places API** (⚠️ PAS "Places API (New)" - c'est l'API classique qu'il faut)
     - **Maps JavaScript API**
     - **Geocoding API**
   
   Pour chaque API :
   - Rechercher le nom de l'API
   - Cliquer sur la carte de l'API
   - Cliquer sur **ENABLE** / **ACTIVER**
   
   **Note** : Si vous voyez l'erreur "You're calling a legacy API", c'est que Places API n'est pas activée

4. **Créer une clé API** :
   - Aller dans "APIs et services" > "Identifiants"
   - Cliquer sur "+ CRÉER DES IDENTIFIANTS" > "Clé API"
   - La clé est créée automatiquement

5. **Sécuriser la clé API** (IMPORTANT) :
   - Cliquer sur la clé créée
   - Dans "Restrictions d'application" :
     - Pour le développement : "Référents HTTP (sites Web)"
     - Ajouter les référents autorisés :
       - `http://localhost:3000/*`
       - `https://votre-domaine.com/*`
   - Dans "Restrictions d'API" :
     - Sélectionner "Restreindre la clé"
     - Cocher OBLIGATOIREMENT ces 3 APIs :
       - ✅ Places API
       - ✅ Maps JavaScript API
       - ✅ Geocoding API
   - Cliquer sur **ENREGISTRER**
   - **Attendre 2-5 minutes** que les changements se propagent

6. **Activer la facturation** (obligatoire mais avec crédit gratuit) :
   - Google offre 200$/mois de crédit gratuit
   - Aller dans "Facturation" et lier une carte bancaire
   - Les 200$ couvrent largement un usage normal

7. **Mettre à jour le fichier `.env.local`** :
```env
# Google Places API
NEXT_PUBLIC_GOOGLE_PLACES_API_KEY=AIza... (votre clé API)
```

## 3. Test de la configuration

### Tester Stripe :

**Configuration préalable pour le développement :**
1. Ouvrir un terminal et lancer Stripe CLI :
   ```bash
   stripe listen --forward-to localhost:3000/api/webhooks/stripe
   ```
2. Laisser ce terminal ouvert pendant tout le développement
3. Copier le webhook secret affiché dans `.env.local`
4. Redémarrer le serveur Next.js

**Test des paiements :**
1. Aller sur `/test-apis` pour vérifier la configuration
2. Aller sur `/faire-un-don`
3. Sélectionner un montant
4. Dans le checkout, utiliser la carte test `4242 4242 4242 4242`
5. Vérifier dans le terminal Stripe CLI que les webhooks sont reçus
6. Vérifier dans le dashboard Stripe (mode test) que le paiement apparaît

### Tester Google Places API :
1. Dans le formulaire d'adresse
2. Commencer à taper une adresse française
3. Les suggestions doivent apparaître automatiquement

## 4. Dépannage Google Places API

### Erreur "You're calling a legacy API"
Cette erreur signifie que Places API n'est pas activée :
1. Retourner dans Google Cloud Console
2. APIs & Services > Bibliothèque
3. Rechercher "Places API" (PAS "Places API (New)")
4. Cliquer ENABLE/ACTIVER
5. Attendre 2-5 minutes et retester

### Erreur "REQUEST_DENIED"
La clé API n'est pas valide ou les APIs ne sont pas activées :
1. Vérifier que la clé dans `.env.local` est correcte
2. Vérifier dans APIs & Services > APIs activées que vous avez :
   - Places API ✅
   - Maps JavaScript API ✅
   - Geocoding API ✅
3. Vérifier les restrictions de la clé API

### Les suggestions n'apparaissent pas
1. Ouvrir la console du navigateur (F12)
2. Vérifier les erreurs dans l'onglet Console
3. Vérifier que la clé API est bien configurée dans `.env.local`
4. Vérifier que la facturation est activée dans Google Cloud

## 5. Sécurité et bonnes pratiques

### Pour Stripe :
- **Ne jamais** commiter les clés secrètes dans Git
- Toujours utiliser les clés de test (`pk_test_`, `sk_test_`) en développement
- Utiliser les webhooks pour confirmer les paiements côté serveur
- Valider les montants côté serveur avant de créer les sessions Stripe

### Pour Google Places API :
- Restreindre la clé API aux domaines autorisés
- Limiter aux APIs nécessaires uniquement
- Surveiller l'usage dans Google Cloud Console
- Implémenter un cache côté serveur pour réduire les appels API

## 5. Passage en production

### Stripe :
1. Activer le compte Stripe (vérification d'identité requise)
2. Remplacer les clés test par les clés live :
   - `pk_test_` → `pk_live_`
   - `sk_test_` → `sk_live_`
3. Reconfigurer les webhooks avec l'URL de production

### Google Places API :
1. Mettre à jour les restrictions de référents HTTP
2. Ajouter uniquement le domaine de production
3. Retirer localhost des référents autorisés
4. Vérifier les quotas et ajuster si nécessaire

## 6. Workflow de développement complet

### Lancer l'environnement de développement :

**Terminal 1 - Next.js :**
```bash
npm run dev
```

**Terminal 2 - Stripe CLI (webhooks) :**
```bash
stripe listen --forward-to localhost:3000/api/webhooks/stripe
```
⚠️ Copier le webhook secret affiché et le mettre dans `.env.local`

### URLs importantes :
- **Test des APIs** : http://localhost:3000/test-apis
- **Page de don** : http://localhost:3000/faire-un-don
- **Dashboard** : http://localhost:3000/dashboard

## 7. Monitoring et logs

### Dashboard Stripe :
- Voir tous les paiements : https://dashboard.stripe.com/test/payments
- Logs des événements : https://dashboard.stripe.com/test/logs
- Webhooks : https://dashboard.stripe.com/test/webhooks

### Logs locaux :
- Terminal Stripe CLI : affiche tous les webhooks reçus
- Console navigateur : erreurs JavaScript
- Terminal Next.js : logs serveur

### Google Cloud Console :
- Monitoring API : https://console.cloud.google.com/apis/dashboard
- Quotas : https://console.cloud.google.com/apis/api/places.googleapis.com/quotas
- Logs : https://console.cloud.google.com/logs