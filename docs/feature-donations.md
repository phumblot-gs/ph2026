# Développement d'un système de dons pour application politique

## Objectif et contexte général

L'application existante gère actuellement l'authentification et la gestion des membres d'une organisation politique. Elle dispose d'un système complet d'inscription/connexion (email, Google OAuth, Twitter/X) avec gestion des rôles (admin/member) et des groupes.

**Objectif de la fonctionnalité :**
Ajouter un système de collecte de dons conforme à la législation française sur le financement de la vie politique. Ce système doit permettre aux membres de faire des dons en ligne tout en respectant les contraintes légales strictes (plafond de 7500€/an, vérification de l'âge et de la résidence, certification de personne physique).

**Fonctionnement global :**
1. **Page publique de don** : Les visibeurs (connectés ou non) accèdent à une page explicative avec des exemples de dons prédéfinis
2. **Processus de checkout sécurisé** : Validation des informations personnelles (adresse française, âge) puis paiement via Stripe
3. **Gestion administrative** : Interface complète pour les admins permettant de suivre tous les dons, gérer les exemples affichés, et effectuer des remboursements
4. **Conformité légale** : Respect automatique des plafonds, validations obligatoires, et audit complet des flux financiers

Le système s'intègre parfaitement dans l'architecture existante en étendant la base de données actuelle et en utilisant le système d'authentification déjà en place.

## Contexte technique existant

**Stack actuel :**
- Frontend : Next.js 15 avec TypeScript
- Backend : Supabase (PostgreSQL + Auth)
- Déploiement : Vercel (dev, test, prod)
- UI : shadcn/ui + Tailwind CSS + Lucide React
- Emails : Resend
- Paiements : Stripe (à intégrer)
- Validation d'adresse : Google Places API (à intégrer)

**Structure existante :**
- Table `members` : utilisateurs avec rôles (admin/member) et statuts (active/suspended)
- Table `groups` : groupes d'organisation (groupe "public" par défaut)
- Table `user_groups` : associations utilisateurs-groupes
- Authentification complète (email/password, Google OAuth, Twitter/X OAuth)

## Fonctionnalités à développer

### 1. Extension de la base de données

**Étendre la table `members` :**
Ajouter les champs compatibles avec Google Places API :
- `birth_date` (DATE)
- `address_line1` (TEXT)
- `address_line2` (TEXT, nullable)
- `postal_code` (VARCHAR)
- `city` (VARCHAR)
- `country` (VARCHAR)
- `google_place_id` (VARCHAR, nullable)

**Créer la table `donations` :**
Elle contiendra les donations effectuées sur le site.

```sql
- id (UUID, primary key)
- member_id (UUID, foreign key vers members)
- amount (DECIMAL(10,2))
- status (ENUM: pending, completed, failed, refunded)
- stripe_payment_intent_id (VARCHAR, nullable)
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)
```

**Créer la table `app_settings` :**
Elle contiendra des paramètres pour l'ensemble du site.

```sql
- id (UUID, primary key)
- setting_key (VARCHAR(255), unique)
- setting_value (TEXT)
- description (TEXT, nullable)
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)
```

**Créer la table `app_settings_donation` :**
Elle contiendra les exemples de donations à afficher sur la page "Faire un don".

```sql
- id (UUID, primary key)
- amount (DECIMAL(10,2))
- title (VARCHAR(255))
- description (TEXT)
- display_order (INTEGER)
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)
```

### 2. Page "Faire un don"

**Contrôle d'activation :**
- Vérifier le paramètre `donations_enabled` dans `app_settings` avant d'afficher la page, car il indique si la fonctionnalité est activée
- la page est accessible publiquement si la fonctionnalité est activée
- Si désactivé : afficher un message d'information indiquant que la collecte de dons est temporairement suspendue
- Si activé : afficher la page complète comme décrit ci-dessous

**Accès à la page :**
- Depuis une Card "Faire un don" visible sur la page /dashboard accessible aux membres authentifiés
- Depuis une section dédiée affichée avant le footer de la page d'accueil accessibles aux visiteurs non authentifiés.

**Sections à inclure :**

**1. Hero section :**
- Message expliquant que faire un don = participer à la vie démocratique
- Soutenir une équipe qui porte des idées pour faire progresser la société

**2. Section "Qui fait des dons ?" :**
- Expliquer : toute personne de plus de 18 ans
- Diversité des profils : artisans, retraités, salariés, chefs d'entreprise, professions libérales

**3. Section "Quel montant donner ?" :**
- Afficher les exemples de dons depuis `app_settings_donation` (triés par `display_order`)
- Exemples par défaut à créer :
  - 5€ - "Un coup de pouce bienvenu"
  - 20€ - "Nos messages diffusés pendant 3 jours sur les réseaux sociaux"
  - 100€ - "Impression de tracts pour 1 journée d'actions sur le terrain"
  - 500€ - "Un événement local"
  - 1000€ - "Donateur officiel de la campagne"
  - 4000€ - "Grand donateur de la campagne"
- Permettre la sélection d'un exemple OU montant libre

**4. Formulaire de don :**
- Montant (pré-rempli si exemple sélectionné, sinon libre)
- Pictogramme de remerciement selon montant :
  - ≤ 100€ : "Merci" 
  - ≤ 1000€ : "C'est génial"
  - > 1000€ : "Incroyable"
- Switch obligatoire : certification sur l'honneur (personne physique, compte personnel/familial)
- Validation du plafond 7500€/année civile (vérifier cumul des dons existants)

### 3. Processus de checkout

**Étape 1 - Informations personnelles :**
- Intégration Google Places API pour saisie/validation adresse française
- Date de naissance (validation ≥ 18 ans)
- Blocage si non-résident France ou mineur

**Gestion de l'authentification entre étape 1 et 2 :**
- Si utilisateur non authentifié après étape 1 → redirection vers formulaire de création de compte
- Possibilité de créer un compte via :
  - Email/mot de passe (avec validation email obligatoire)
  - Google OAuth
  - Twitter/X OAuth
- **Important** : Pour création par email/mot de passe, après clic sur lien de confirmation → redirection automatique vers étape 2 du checkout (pas vers page d'accueil)
- Stockage temporaire sécurisé des données de l'étape 1 pendant le processus d'inscription

**Étape 2 - Paiement Stripe :**
- Carte bancaire OU prélèvement SEPA
- Information délai SEPA (3-5 jours)
- Création du PaymentIntent Stripe

**Pages de résultat :**
- Succès : remerciement + information sur le suivi des actions
- Échec : message d'erreur + coordonnées support + invitation à réessayer
- La page de résultat contient un bouton de retour vers le dashboard

### 4. Interface d'administration (rôle admin uniquement)

**Page "Groupes" (existante à conserver) :**
- CRUD des groupes

**Page "Membres" (existante à étendre) :**
- Liste des membres avec nouvelles données (adresse, naissance)
- Actions : mise à jour, activation/suspension, changement rôle
- Actions en masse : activation/suspension, changement rôle

**Nouvelle page "Dons" :**
- Activation/désactivation de la fonctionnalité : Switch on/off pour activer/désactiver globalement les dons
- Liste tous les dons (filtres : date, montant, statut, membre)
- Export XLSX
- Gestion manuelle des remboursements (ajout de dons avec montants négatifs et commentaire)
- CRUD des exemples de dons (`app_settings_donation`), avec la possibilité de changer l'ordre des exemples (drag&drop)
- Modification coordonnées support

### 5. Système d'emails (Resend)

**Email de confirmation au donateur :**
- Remerciement personnalisé
- Récapitulatif du don (montant, date)
- Information sur le suivi des actions

**Email de notification aux admins :**
- Nouveau don reçu
- Détails : montant, donateur, date

### 6. Règles de gestion importantes

**Gestion de l'activation/désactivation :**
- Paramètre global `donations_enabled` dans `app_settings`
- Navigation/liens vers la page de don masqués si fonctionnalité désactivée
- Page de don affiche un message informatif si désactivée

**Contraintes légales :**
- Plafond 7500€ par personne et par année civile
- Validation résidence française obligatoire
- Validation âge ≥ 18 ans obligatoire
- Certification personne physique obligatoire

**Gestion des remboursements :**
- Les remboursements libèrent de la capacité de don
- Audit complet des flux (dons + remboursements)

**Sécurité :**
- RLS activé sur toutes les tables
- Aucune donnée bancaire stockée (délégation Stripe)
- Logs d'audit pour actions admin

## Livrables attendus

1. Migrations Supabase pour les nouvelles tables/champs (dont `app_settings`)
2. Système de paramétrage global avec activation/désactivation des dons
3. Composants React avec shadcn/ui pour toutes les interfaces
4. Page de don accessible publiquement (avec contrôle d'activation)
5. Gestion complète du flow d'inscription pendant le checkout
6. Système de stockage temporaire sécurisé des données de checkout
7. Redirection intelligente après confirmation email vers étape 2
8. Intégration Stripe complète (carte + SEPA)
9. Intégration Google Places API pour validation d'adresses
10. Système d'emails Resend avec templates
11. Pages d'administration complètes avec filtres et exports
12. Interface admin pour activer/désactiver la fonctionnalité de dons
13. Validation complète des règles métier et contraintes légales
14. Tests et gestion d'erreurs robuste

## Priorités de développement

1. Base de données et migrations
2. Page de don publique avec validation
3. Interface d'administration
4. Système d'emails
5. Processus de checkout Stripe
6. Tests et optimisations