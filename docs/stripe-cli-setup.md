# Configuration Stripe CLI pour le développement local

## 📦 Installation

### macOS (avec Homebrew)
```bash
brew install stripe/stripe-cli/stripe
```

### macOS/Linux (sans Homebrew)
```bash
# Télécharger depuis https://github.com/stripe/stripe-cli/releases
# Puis extraire et ajouter au PATH
```

### Windows
Télécharger l'installateur depuis : https://github.com/stripe/stripe-cli/releases

## 🔑 Configuration

### 1. Se connecter à votre compte Stripe
```bash
stripe login
```
- Une page web s'ouvrira
- Autoriser l'accès
- La CLI sera connectée à votre compte

### 2. Vérifier la connexion
```bash
stripe config --list
```

## 🎧 Écouter les webhooks en local

### Lancer l'écoute (dans un terminal séparé)
```bash
stripe listen --forward-to localhost:3000/api/webhooks/stripe
```

### Ce que fait cette commande :
- ✅ Crée un tunnel sécurisé Stripe ↔ localhost
- ✅ Affiche un webhook secret temporaire
- ✅ Transmet tous les événements à votre API locale
- ✅ Affiche les logs en temps réel

### Output attendu :
```
> Ready! Your webhook signing secret is whsec_xxxxxxxxxxxxx (^C to quit)
```

### 3. Copier le webhook secret
Copier le `whsec_xxxxx` et le mettre dans `.env.local` :
```env
STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxx
```

## 🧪 Tester les webhooks

### Dans un autre terminal, déclencher un événement test :
```bash
# Tester un paiement réussi
stripe trigger payment_intent.succeeded

# Tester une session checkout complétée
stripe trigger checkout.session.completed
```

### Vérifier les logs
Dans le terminal où `stripe listen` tourne, vous verrez :
```
2024-01-15 10:30:00  --> payment_intent.succeeded [evt_xxx]
2024-01-15 10:30:01  <-- [200] POST http://localhost:3000/api/webhooks/stripe
```

## 📝 Commandes utiles

### Voir tous les événements disponibles
```bash
stripe trigger --help
```

### Filtrer les événements écoutés
```bash
stripe listen --forward-to localhost:3000/api/webhooks/stripe \
  --events checkout.session.completed,payment_intent.succeeded
```

### Voir les logs Stripe
```bash
stripe logs tail
```

### Créer un paiement test
```bash
stripe payment_intents create --amount=2000 --currency=eur
```

## 🚀 Workflow de développement

1. **Terminal 1** : Lancer Next.js
```bash
npm run dev
```

2. **Terminal 2** : Lancer Stripe CLI
```bash
stripe listen --forward-to localhost:3000/api/webhooks/stripe
```

3. **Copier le webhook secret** dans `.env.local`

4. **Redémarrer Next.js** (Terminal 1) pour prendre en compte le nouveau secret

5. **Tester** sur http://localhost:3000/faire-un-don

## ⚠️ Important

- Le webhook secret change à chaque `stripe listen`
- Toujours mettre à jour `.env.local` avec le nouveau secret
- La CLI doit rester active pendant le développement
- En production, configurer un vrai webhook endpoint

## 🔍 Débugger

### Si les webhooks ne sont pas reçus :
1. Vérifier que `stripe listen` est actif
2. Vérifier l'URL : `/api/webhooks/stripe`
3. Vérifier le webhook secret dans `.env.local`
4. Vérifier les logs dans le terminal Stripe CLI

### Voir le payload d'un événement
```bash
stripe events retrieve evt_xxxxx
```

## 📚 Documentation
- [Stripe CLI Docs](https://stripe.com/docs/stripe-cli)
- [Webhooks Testing](https://stripe.com/docs/webhooks/test)