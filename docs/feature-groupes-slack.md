# Intégration Slack - Canaux privés par groupe

## Contexte
L'application dispose déjà d'un système d'authentification complet, de gestion de groupes, et de donations. Il faut maintenant intégrer Slack pour que chaque groupe ait son canal privé et que les utilisateurs puissent accéder aux canaux de leurs groupes.

## Architecture existante
- **Tables** : `members`, `groups`, `user_groups`, `checkout_sessions`, `donations`, `admin_audit_log`, `app_settings`, `app_settings_donation`
- **Authentification** : Email/password, Google OAuth, Twitter/X OAuth
- **Rôles** : admin, member
- **Groupes** : Groupe "public" par défaut, système `user_groups` pour associations multiples

## Fonctionnalités à développer

### 1. Configuration Slack App (Guide pas à pas)
- Créer un guide complet pour configurer une Slack App dans le workspace
- Expliquer la création des scopes OAuth nécessaires
- Configuration des permissions pour créer/gérer canaux et utilisateurs
- Configuration des URLs de redirection OAuth
- Stockage sécurisé des clés API Slack (variables d'environnement)

### 2. Modifications de la base de données
**Table `members` - Ajouter colonnes :**
- `slack_user_id` (string, nullable) : ID utilisateur Slack
- `slack_access_token` (string, nullable) : Token d'accès Slack actif
- `slack_connected_at` (timestamp, nullable) : Date de connexion Slack

**Table `groups` - Ajouter colonnes :**
- `slack_channel_id` (string, nullable) : ID du canal Slack associé

### 3. Authentification Slack sur /profile
- Bouton "Connecter à Slack" si non connecté
- Affichage du statut de connexion si connecté (nom utilisateur, date de connexion)
- Liste des canaux accessibles (noms des groupes de l'utilisateur)
- Bouton "Se déconnecter de Slack" avec confirmation
- Gestion des erreurs d'authentification et d'API Slack

### 4. Gestion automatique des canaux Slack
**Création de canal :**
- À la création d'un groupe → créer automatiquement un canal privé Slack (nom = nom du groupe)
- Stocker l'ID du canal dans `groups.slack_channel_id`
- Ajouter tous les utilisateurs connectés à Slack de ce groupe au canal

**Suppression de canal :**
- À la suppression d'un groupe → supprimer le canal Slack correspondant
- Nettoyer `groups.slack_channel_id`

**Gestion des utilisateurs dans les canaux :**
- Ajout utilisateur à un groupe → l'ajouter au canal Slack correspondant (si connecté à Slack)
- Suppression utilisateur d'un groupe → le retirer immédiatement du canal Slack
- Connexion Slack utilisateur → l'ajouter à tous les canaux de ses groupes
- Déconnexion Slack → le laisser dans les groupes mais plus d'accès Slack

### 5. Gestion des changements de rôles
- ⚠️ **Note : Nécessite un workspace Slack payant**
- Changement member → admin : mettre à jour les permissions Slack (admin workspace)
- Changement admin → member : retirer les permissions admin Slack
- Utiliser l'API Slack pour gérer les rôles dans le workspace
- **Si workspace gratuit** : Les changements de rôles dans PH2026 n'affecteront pas les rôles Slack

### 6. Page d'administration /admin
- Ajouter un onglet "Groupes" après l'onglet "Membres" pour lister les groupes et pour chaque groupe le nombre de membres associés
- Pouvoir filtrer les groupes dans la liste est exporter la liste au format XLS comme pour la liste des membres
- Pouvoir ajouter un groupe
- Dans la liste des groupe, ajouter un icon "pencil" sur chaque ligne (comme pour la liste des membres) pour rediriger vers /admin/group/:group_id
- dans la liste des membres, retirer la colonne Adresse et la remplacer par une colonne "Groupes" qui affiche les groupes auxquels chaque membre est associé.
- dans la liste des membres, dans la colonne membre remplacer la date de naissance par le statut de connexion slack. Il faut pouvoir filtrer les membres avec ceux qui sont authentifiés sur slack et ceux qui ne le sont pas
- il faut pouvoir filtrer la liste des membres par groupe

### 7. Page d'administration /admin/group/:group_id
- Interface pour modifier un groupe
- Pouvoir ajouter et retirer des membres pour le groupe
- Bouton "Recréer le canal" pour les canaux supprimés manuellement
- Gestion des erreurs et statuts des canaux
- Logs des actions dans `admin_audit_log`

### 8. Dashboard - Cards des groupes
**Pour chaque groupe de l'utilisateur :**
- Titre du groupe
- Si utilisateur connecté à Slack :
  - Affichage des 5 derniers messages du canal (auteur, date, contenu tronqué à ~100 caractères)
  - Lien "Ouvrir dans Slack" (nouvelle fenêtre)
  - Gestion des erreurs (canal supprimé, accès refusé, API indisponible)
- Si utilisateur non connecté à Slack :
  - Message "Connectez-vous à Slack pour voir les discussions"
  - Lien vers /profile

### 8. Initialisation pour le groupe "public"
- Créer automatiquement le canal Slack pour le groupe "public" existant
- Ajouter tous les utilisateurs connectés à Slack au canal "public"

## Spécifications techniques

### APIs Slack à utiliser
- **OAuth** : `oauth.v2.access` pour l'authentification
- **Channels** : `conversations.create`, `conversations.archive` pour gérer les canaux
- **Users** : `conversations.invite`, `conversations.kick` pour gérer les membres
- **Messages** : `conversations.history` pour récupérer les messages
- **Admin** : `admin.users.setOwner`, `admin.users.setRegular` pour les rôles

### Gestion des erreurs
- Connexions API Slack échouées : messages d'erreur explicites
- Canaux supprimés manuellement : détection et possibilité de recréation
- Tokens expirés : redirection vers réauthentification
- Utilisateurs non trouvés dans Slack : logs et gestion gracieuse

### Sécurité
- Validation des tokens Slack avant chaque requête API
- Chiffrement des tokens stockés si nécessaire
- Audit de toutes les actions admin dans `admin_audit_log`
- Gestion des timeouts et rate limiting Slack

### Performance
- Délai acceptable de quelques secondes pour les synchronisations
- Cache temporaire des messages récents (pas de stockage en base)
- Gestion asynchrone des opérations Slack quand possible

## Points d'attention
1. Bien gérer tous les cas de connexion/déconnexion Slack
2. Synchronisation bidirectionnelle groupes ↔ canaux Slack
3. Interface admin intuitive pour diagnostiquer les problèmes
4. Messages d'erreur clairs pour les utilisateurs finaux
5. Respect des bonnes pratiques de sécurité Slack

Développer cette intégration en suivant les patterns existants de l'application et en maintenant la cohérence du code.