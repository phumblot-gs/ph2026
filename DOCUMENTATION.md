# Documentation Technique - Plateforme Paul Hatte 2026

## Vue d'ensemble

Cette documentation centralise toutes les informations techniques sur la plateforme de campagne pour Paul Hatte aux élections municipales de Paris 2026.

## 1. Architecture générale

### 1.1 Stack technique
- **Frontend**: React + TypeScript + Tailwind CSS
- **Backend**: Next.js API Routes / Supabase
- **Base de données**: PostgreSQL (via Supabase)
- **Analytics & BI**: Metabase
- **Hébergement**: Vercel (Frontend) + Supabase (Backend/DB)
- **Authentification**: Supabase Auth (compatible avec Metabase)
- **CDN & Médias**: Cloudinary ou Supabase Storage
- **Cartes**: Mapbox ou Leaflet

### 1.2 Structure du projet
```
ph2026/
├── apps/
│   ├── web/                 # Front-office public
│   └── admin/               # Back-office
├── packages/
│   ├── ui/                  # Design system partagé
│   ├── database/            # Schémas et migrations
│   └── shared/              # Utilitaires partagés
└── docs/                    # Documentation
```

## 2. Front-Office Public

### 2.1 Fonctionnalités
- **Page d'accueil**: Présentation de Paul Hatte et vision pour Paris
- **Programme**: Détail des propositions par thématique
- **Actualités**: Actions de campagne et événements
- **Réseaux sociaux**: Intégration X, Instagram, YouTube
- **Newsletter**: Inscription pour recevoir les actualités
- **Dons**: Module de contribution sécurisé (Stripe)
- **Contact**: Formulaire pour rejoindre le mouvement

### 2.2 Pages principales
- `/` - Accueil
- `/programme` - Programme détaillé
- `/actualites` - Blog et actions
- `/participer` - Comment s'engager
- `/contact` - Formulaire de contact
- `/don` - Page de donation

### 2.3 Intégrations API
- Twitter/X API v2
- Instagram Basic Display API
- YouTube Data API v3
- Stripe Payment API

## 3. Back-Office (Accès restreint)

### 3.1 Système d'authentification
- **SSO via Supabase Auth**:
  - Login/mot de passe
  - OAuth Google
  - OAuth GitHub
  - Magic Link email
- **Rôles et permissions**:
  - Super Admin
  - Direction
  - Communication/RP
  - Finance
  - Comités experts
  - Membre standard

### 3.2 Modules fonctionnels

#### 3.2.1 Trombinoscope
- **Données membres**:
  - Photo, nom, prénom
  - Rôle dans l'organisation
  - Groupes d'appartenance
  - Coordonnées (email, téléphone)
  - Compétences/expertise
  - Disponibilités

#### 3.2.2 CRM Soutiens
- **Fiche contact**:
  - Informations personnelles
  - Historique des interactions
  - Niveau d'engagement (sympathisant, militant, donateur)
  - Montant des dons
  - Actions terrain effectuées
  - Tags et segmentation

#### 3.2.3 Cartographie des actions
- **Carte interactive de Paris**:
  - Découpage par bureaux de vote
  - Visualisation des actions terrain:
    - Type (tractage, porte-à-porte, réunion, stand)
    - Date et heure
    - Participants
    - Estimation électeurs touchés
    - Photos/compte-rendu
  - Heatmap de couverture
  - Statistiques par arrondissement

#### 3.2.4 Communication interne
- **Gestion des canaux WhatsApp**:
  - Groupes par zone/thématique
  - Envoi de messages groupés
  - Templates de messages
  - Programmation d'envois
  - Statistiques d'engagement

#### 3.2.5 Veille média
- **Monitoring concurrent**:
  - Scraping articles de presse
  - Suivi réseaux sociaux concurrents
  - Alertes sur mots-clés
  - Tableau de bord analytique
  - Export de rapports

### 3.3 Tableaux de bord Metabase
- Dashboard direction générale
- Suivi financier et dons
- Métriques terrain
- Analytics réseaux sociaux
- Performance communication

## 4. Base de données

### 4.1 Schéma principal

#### Tables principales:
- `users` - Utilisateurs système
- `members` - Membres du parti
- `groups` - Groupes internes
- `contacts` - CRM contacts/soutiens
- `donations` - Dons reçus
- `field_actions` - Actions terrain
- `polling_stations` - Bureaux de vote
- `media_monitoring` - Veille média
- `communications` - Messages envoyés

### 4.2 Relations clés
- Un membre peut appartenir à plusieurs groupes
- Un contact peut avoir plusieurs dons
- Une action terrain est liée à un bureau de vote
- Les participants sont liés aux actions

## 5. Design System

### 5.1 Principes
- **Moderne**: Design épuré et contemporain
- **Accessible**: WCAG 2.1 AA compliant
- **Responsive**: Mobile-first
- **Performant**: Optimisé pour la vitesse

### 5.2 Couleurs
- Primaire: À définir selon charte graphique
- Secondaire: Complémentaire
- Neutres: Grays pour texte et UI
- Succès/Erreur/Warning: Standards

### 5.3 Composants UI
- Buttons (primary, secondary, ghost)
- Forms (inputs, selects, checkboxes)
- Cards
- Modals
- Navigation
- Tables
- Charts
- Maps

## 6. Sécurité

### 6.1 Mesures
- HTTPS obligatoire
- Protection CSRF
- Rate limiting API
- Validation des inputs
- Sanitization des données
- Logs d'audit
- Backup quotidien

### 6.2 RGPD
- Consentement explicite
- Droit d'accès aux données
- Droit à l'effacement
- Export des données
- Politique de confidentialité

## 7. Performance

### 7.1 Optimisations
- SSG/ISR avec Next.js
- Image optimization (next/image)
- Code splitting
- Lazy loading
- CDN pour assets
- Cache API responses

### 7.2 Monitoring
- Web Vitals
- Error tracking (Sentry)
- Uptime monitoring
- Analytics (Plausible/Matomo)

## 8. Déploiement

### 8.1 Environnements
- **Development**: Local
- **Staging**: Vercel Preview
- **Production**: Vercel + Supabase

### 8.2 CI/CD
- GitHub Actions
- Tests automatisés
- Linting/Formatting
- Build verification
- Deploy automatique

## 9. Maintenance et évolutions

### 9.1 Roadmap
- Phase 1: MVP Front-office + Auth
- Phase 2: Back-office core
- Phase 3: CRM et cartographie
- Phase 4: Communication et veille
- Phase 5: Optimisations et features avancées

### 9.2 Historique des modifications
- **2025-08-08**: Création initiale de la documentation

## 10. Ressources

### 10.1 Accès
- GitHub: [à configurer]
- Vercel: [à configurer]
- Supabase: [à configurer]
- Metabase: [à configurer]

### 10.2 Contacts techniques
- Lead Dev: [à définir]
- DevOps: [à définir]
- Support: [à définir]

---

*Cette documentation est maintenue à jour à chaque évolution majeure du projet.*