# Configuration pour développement local

## 1. Configuration de base

### Créer le fichier `.env.local`
```bash
cp .env.example .env.local
```

### Variables requises dans `.env.local` :
```env
# Supabase (récupérer depuis votre dashboard Supabase)
NEXT_PUBLIC_SUPABASE_URL=https://xbwoskydlvjsckpvfnkt.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=votre_anon_key
SUPABASE_SERVICE_ROLE_KEY=votre_service_role_key

# URL locale
NEXT_PUBLIC_SITE_URL=http://localhost:3000

# Email - Laisser vide pour mode simulation
RESEND_API_KEY=
```

## 2. Fonctionnement sans configuration email

**Par défaut, le système fonctionne en mode simulation** :
- Les inscriptions fonctionnent normalement
- Les notifications email sont simulées (logs console)
- Vous verrez dans la console : "Notification simulée (Resend non configuré)"

## 3. Configuration Google OAuth pour localhost

### Dans Supabase Dashboard :
1. Aller dans **Authentication** → **Providers**
2. Cliquer sur **Google**
3. Ajouter `http://localhost:3000` dans les **Redirect URLs**
4. La callback URL doit être : `http://localhost:3000/auth/callback`

### Dans Google Cloud Console :
1. Aller dans votre projet Google Cloud
2. **APIs & Services** → **Credentials**
3. Modifier votre OAuth 2.0 Client
4. Ajouter dans **Authorized redirect URIs** :
   ```
   https://xbwoskydlvjsckpvfnkt.supabase.co/auth/v1/callback
   ```
5. Ajouter dans **Authorized JavaScript origins** :
   ```
   http://localhost:3000
   ```

## 4. Tester en local

### Démarrer le serveur :
```bash
npm run dev
```

### Créer un compte super_admin pour les tests :

1. **Via Supabase Dashboard** :
   - Aller dans **Table Editor** → **members**
   - Créer une ligne avec :
     - `email`: votre-email@test.com
     - `role`: `super_admin`
     - `first_name`: Test
     - `last_name`: Admin

2. **Via SQL** (dans SQL Editor de Supabase) :
```sql
-- Créer un utilisateur test
INSERT INTO auth.users (
  id,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_user_meta_data,
  created_at,
  updated_at
) VALUES (
  gen_random_uuid(),
  'admin@test.local',
  crypt('password123', gen_salt('bf')),
  now(),
  '{"first_name": "Admin", "last_name": "Test"}'::jsonb,
  now(),
  now()
);

-- Récupérer l'ID de l'utilisateur créé
WITH new_user AS (
  SELECT id FROM auth.users WHERE email = 'admin@test.local'
)
-- Créer le membre correspondant
INSERT INTO public.members (
  user_id,
  email,
  first_name,
  last_name,
  role
)
SELECT 
  id,
  'admin@test.local',
  'Admin',
  'Test',
  'super_admin'
FROM new_user;
```

## 5. Flux de test complet

### Test inscription email/password :
1. Aller sur `http://localhost:3000/join`
2. Remplir le formulaire
3. Vérifier dans la console : "Notification simulée"
4. L'utilisateur arrive sur `/pending`

### Test inscription Google OAuth :
1. Aller sur `http://localhost:3000/join`
2. Cliquer sur "Continuer avec Google"
3. Se connecter avec Google
4. Redirection automatique vers `/pending`
5. Vérifier dans la console : "Notification simulée"

### Test modération (en tant que super_admin) :
1. Se connecter avec le compte super_admin
2. Aller sur `http://localhost:3000/admin/moderation`
3. Voir la liste des membres en attente
4. Approuver/Rejeter

## 6. Activer les vrais emails en local (optionnel)

### Option 1 : Avec Resend (recommandé)
1. Créer un compte gratuit sur [Resend.com](https://resend.com)
2. Récupérer votre API Key
3. Ajouter dans `.env.local` :
   ```env
   RESEND_API_KEY=re_xxxxxxxxxxxxx
   ```
4. Les emails seront envoyés depuis `onboarding@resend.dev`

### Option 2 : Avec MailHog (serveur SMTP local)
1. Installer MailHog :
   ```bash
   brew install mailhog  # Mac
   # ou
   docker run -p 1025:1025 -p 8025:8025 mailhog/mailhog  # Docker
   ```
2. Démarrer MailHog :
   ```bash
   mailhog
   ```
3. Interface web : `http://localhost:8025`
4. Modifier `/app/api/notify-admin/route.ts` pour utiliser SMTP local

## 7. Débugger les problèmes courants

### Erreur "Invalid login credentials"
- Vérifier que l'email est confirmé dans Supabase
- Vérifier le mot de passe

### Google OAuth ne fonctionne pas
- Vérifier les Redirect URLs dans Google Cloud Console
- Vérifier que Google est activé dans Supabase

### Membre créé mais pas de notification
- Vérifier la console du navigateur
- Vérifier les logs du serveur Next.js
- S'assurer qu'il y a au moins un super_admin dans la base

### Page /pending ne s'affiche pas
- Vérifier que le rôle est bien "pending" dans la table members
- Vérifier le middleware dans `/lib/supabase/middleware.ts`

## 8. Commandes utiles

```bash
# Voir les logs en temps réel
npm run dev

# Nettoyer le cache Next.js
rm -rf .next

# Réinstaller les dépendances
rm -rf node_modules package-lock.json
npm install

# Vérifier la connexion Supabase
npx supabase status
```

## 9. Variables d'environnement complètes

Voici toutes les variables disponibles :

```env
# === OBLIGATOIRES ===
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=

# === OPTIONNELLES ===
# Service role (pour opérations admin)
SUPABASE_SERVICE_ROLE_KEY=

# URL du site
NEXT_PUBLIC_SITE_URL=http://localhost:3000

# Email (laisser vide pour mode simulation)
RESEND_API_KEY=

# Nom du parti (override le config)
NEXT_PUBLIC_PARTY_NAME=PH2026
NEXT_PUBLIC_PARTY_SLOGAN=Ensemble pour Paris
```

## Support

En cas de problème :
1. Vérifier les logs dans la console du navigateur
2. Vérifier les logs du serveur Next.js
3. Vérifier les logs Supabase (Dashboard → Logs)
4. Consulter la [documentation Supabase](https://supabase.com/docs)