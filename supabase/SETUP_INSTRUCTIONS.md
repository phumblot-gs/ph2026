# Instructions de configuration Supabase

## 1. Créer un compte et un projet Supabase

1. Allez sur [supabase.com](https://supabase.com) et créez un compte
2. Créez un nouveau projet avec les paramètres suivants :
   - Nom : `ph2026` (ou le nom de votre choix)
   - Région : `Paris (eu-west-3)` ou `Frankfurt (eu-central-1)`
   - Mot de passe base de données : Choisissez un mot de passe fort

## 2. Configurer la base de données

1. Une fois le projet créé, allez dans l'éditeur SQL
2. Copiez et exécutez le contenu du fichier `schema.sql` dans l'éditeur SQL
3. Cliquez sur "Run" pour créer toutes les tables et configurations

## 3. Configurer l'authentification

Dans les paramètres d'authentification de Supabase :

### Email Auth
- Activez l'authentification par email
- Personnalisez les templates d'emails si souhaité

### Google OAuth (optionnel)
1. Allez dans Authentication > Providers > Google
2. Activez Google
3. Pour obtenir les clés Google OAuth :
   - Allez sur [console.cloud.google.com](https://console.cloud.google.com)
   - Créez un nouveau projet ou sélectionnez un existant
   - Activez l'API Google+ 
   - Créez des identifiants OAuth 2.0
   - Ajoutez les URLs de redirection :
     - `https://[votre-projet].supabase.co/auth/v1/callback`
     - `http://localhost:3000/auth/callback` (pour le développement)
4. Copiez les Client ID et Client Secret dans Supabase

## 4. Récupérer les clés API

1. Dans Supabase, allez dans Settings > API
2. Copiez :
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` → `SUPABASE_SERVICE_ROLE_KEY` (gardez cette clé secrète!)

## 5. Configurer les variables d'environnement

1. Copiez `.env.local.example` vers `.env.local`
2. Remplacez les valeurs avec vos vraies clés :

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://[votre-projet].supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=[votre-anon-key]
SUPABASE_SERVICE_ROLE_KEY=[votre-service-role-key]

# Site Configuration
NEXT_PUBLIC_SITE_URL=http://localhost:3000
NEXT_PUBLIC_PARTY_NAME=PH2026
NEXT_PUBLIC_CANDIDATE_NAME=Paul Hatte
```

## 6. Créer le premier utilisateur admin

1. Dans Supabase, allez dans Authentication > Users
2. Cliquez sur "Invite user"
3. Entrez votre email
4. Une fois l'utilisateur créé, exécutez cette requête SQL pour lui donner le rôle admin :

```sql
INSERT INTO members (user_id, email, first_name, last_name, role)
VALUES (
  '[USER_ID_FROM_AUTH_USERS]',
  'votre@email.com',
  'Votre Prénom',
  'Votre Nom',
  'super_admin'
);
```

## 7. Tester la connexion

1. Lancez l'application : `npm run dev`
2. Allez sur http://localhost:3000/login
3. Connectez-vous avec votre email/mot de passe
4. Vous devriez être redirigé vers /admin

## 8. Configuration de production (Vercel)

Quand vous déployez sur Vercel, ajoutez ces variables d'environnement dans les settings Vercel :
- Toutes les variables de `.env.local`
- Changez `NEXT_PUBLIC_SITE_URL` pour votre URL de production

## Dépannage

### Erreur de connexion
- Vérifiez que les clés API sont correctes
- Vérifiez que l'utilisateur existe dans la table `members` avec un rôle approprié

### Erreur de permission
- Vérifiez les Row Level Security policies dans Supabase
- En développement, vous pouvez temporairement désactiver RLS sur les tables

### Google OAuth ne fonctionne pas
- Vérifiez les URLs de callback dans Google Console
- Assurez-vous que le domaine est autorisé dans Google Console