# Guide rapide : Configuration Stripe et Google Places API

## 🚀 Configuration rapide Stripe (5 minutes)

### 1. Créer un compte Stripe Test
1. Aller sur https://dashboard.stripe.com/register
2. Créer un compte gratuit (pas besoin de carte bancaire)

### 2. Récupérer les clés API
1. Se connecter au [Dashboard Stripe](https://dashboard.stripe.com/)
2. **IMPORTANT** : Activer le mode **Test** (toggle en haut à droite)
3. Aller dans **Developers** → **API keys**
4. Copier les deux clés :
   - **Publishable key** : `pk_test_51...`
   - **Secret key** : `sk_test_51...`

### 3. Configurer dans le projet
Éditer le fichier `.env.local` :
```bash
STRIPE_SECRET_KEY=sk_test_51... # Votre clé secrète
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_51... # Votre clé publique
```

### 4. Tester
1. Aller sur http://localhost:3000/test-apis
2. Cliquer sur "Vérifier la configuration" pour Stripe
3. Si ✅ apparaît, c'est configuré !

### Cartes de test
- **Succès** : `4242 4242 4242 4242`
- **Échec** : `4000 0000 0000 0002`
- Date : N'importe quelle date future (ex: 12/25)
- CVV : N'importe quel nombre à 3 chiffres (ex: 123)

---

## 🗺️ Configuration Google Places API (10 minutes)

### 1. Créer un projet Google Cloud
1. Aller sur https://console.cloud.google.com/
2. Se connecter avec votre compte Google
3. Cliquer sur **Select a project** → **NEW PROJECT**
4. Nom : `PH2026` (ou autre)
5. Cliquer **CREATE**

### 2. Activer Places API
1. Dans le menu ☰ → **APIs & Services** → **Library**
2. Rechercher "**Places API**"
3. Cliquer sur **Places API**
4. Cliquer **ENABLE**

### 3. Créer une clé API
1. Menu ☰ → **APIs & Services** → **Credentials**
2. Cliquer **+ CREATE CREDENTIALS** → **API key**
3. La clé est créée ! Copier la clé `AIza...`

### 4. Sécuriser la clé (Recommandé)
1. Cliquer sur la clé créée
2. Dans **Application restrictions** :
   - Sélectionner **HTTP referrers**
   - Ajouter : `http://localhost:3000/*`
3. Dans **API restrictions** :
   - Sélectionner **Restrict key**
   - Cocher : **Places API**
4. Cliquer **SAVE**

### 5. Configurer dans le projet
Éditer le fichier `.env.local` :
```bash
NEXT_PUBLIC_GOOGLE_PLACES_API_KEY=AIza... # Votre clé API
```

### 6. Activer la facturation (Obligatoire mais gratuit)
- Google offre **200$/mois de crédit gratuit**
- Largement suffisant pour le développement
- Menu ☰ → **Billing** → Lier une carte (ne sera pas débitée)

### 7. Tester
1. Aller sur http://localhost:3000/test-apis
2. Cliquer sur "Vérifier la configuration" pour Google Places
3. Taper une adresse française dans le champ test
4. Si les suggestions apparaissent, c'est configuré !

---

## ⚠️ Mode Test vs Production

### Stripe
- **Mode Test** : Clés commencent par `sk_test_` et `pk_test_`
- **Mode Live** : Clés commencent par `sk_live_` et `pk_live_`
- ⚠️ Ne jamais utiliser les clés Live en développement

### Google Places API
- Même clé pour dev et prod
- Changer les restrictions de domaine en production

---

## 🔍 Dépannage

### Stripe ne fonctionne pas
- Vérifier que vous êtes en mode **Test** dans le dashboard
- Vérifier que les clés dans `.env.local` commencent par `_test_`
- Redémarrer le serveur après modification de `.env.local`

### Google Places ne fonctionne pas
- Vérifier que Places API est bien **activée**
- Vérifier que la facturation est configurée
- Attendre 5 minutes après création de la clé
- Vérifier les restrictions de la clé

### Page de test
http://localhost:3000/test-apis permet de vérifier que tout fonctionne.

---

## 📝 Checklist finale

- [ ] Compte Stripe créé et en mode Test
- [ ] Clés Stripe dans `.env.local`
- [ ] Projet Google Cloud créé
- [ ] Places API activée
- [ ] Clé Google API dans `.env.local`
- [ ] Facturation Google configurée
- [ ] Test sur `/test-apis` réussi

Une fois tout coché, le système de donations est prêt ! 🎉