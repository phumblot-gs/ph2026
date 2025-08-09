# 🚀 Guide de Configuration de l'Environnement TEST

## Étape 1 : Créer le projet Supabase Test

### 1.1 Création du projet

1. Aller sur [app.supabase.com](https://app.supabase.com)
2. Cliquer sur **"New Project"**
3. Remplir les informations :
   - **Organization** : Votre organisation
   - **Project name** : `ph2026-test`
   - **Database Password** : Générer un mot de passe fort et le sauvegarder
   - **Region** : `EU Central (Frankfurt)` pour la proximité avec la France
   - **Pricing Plan** : Free tier

4. Cliquer sur **"Create new project"**
5. Attendre 2-3 minutes que le projet soit créé

### 1.2 Récupérer les clés API

Une fois le projet créé :

1. Aller dans **Settings** (icône engrenage) → **API**
2. Noter les informations suivantes :

```
Project URL : https://[VOTRE-REF-TEST].supabase.co
Anon/Public Key : eyJhbGc...
Service Role Key : eyJhbGc... (dans "Reveal" puis copier)
```

⚠️ **IMPORTANT** : Sauvegarder ces clés dans un gestionnaire de mots de passe

### 1.3 Exécuter le schéma SQL

1. Dans Supabase, aller dans **SQL Editor** (icône terminal)
2. Cliquer sur **"New query"**
3. Copier tout le contenu du fichier `/supabase/complete-schema.sql`
4. Coller dans l'éditeur SQL
5. Cliquer sur **"Run"** (ou Cmd/Ctrl + Enter)

✅ Vous devriez voir un tableau avec les comptes de test créés :
- `admin@test.local` / `Admin123!` (super_admin)
- `pending1@test.local` / `Test123!` (pending)
- `pending2@test.local` / `Test123!` (pending)
- `member@test.local` / `Test123!` (member)

### 1.4 Configurer Google OAuth (optionnel pour test)

Si vous voulez tester Google OAuth sur l'environnement de test :

1. Dans Supabase : **Authentication** → **Providers** → **Google**
2. Toggle **"Enable Google"**
3. Copier le **Callback URL** affiché
4. Dans [Google Cloud Console](https://console.cloud.google.com) :
   - Ajouter le Callback URL aux redirections autorisées
   - Copier Client ID et Client Secret
5. Retour dans Supabase, coller les clés Google
6. Sauvegarder

## Étape 2 : Créer le projet Vercel Test

### 2.1 Import du projet

1. Aller sur [vercel.com/new](https://vercel.com/new)
2. **Import Git Repository**
3. Chercher `phumblot-gs/ph2026`
4. Cliquer sur **Import**

### 2.2 Configuration du projet

Dans la page de configuration :

1. **Configure Project** :
   - **Project Name** : `ph2026-test` (important!)
   - **Framework Preset** : Next.js (auto-détecté)
   - **Root Directory** : `./`
   - **Build Settings** : Laisser par défaut

2. **Environment Variables** : Ajouter les variables suivantes
   (Cliquer sur "Add" pour chaque variable)

```bash
# Copier les valeurs depuis l'étape 1.2
NEXT_PUBLIC_SUPABASE_URL = https://[VOTRE-REF-TEST].supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY = eyJhbGc...votre-anon-key
SUPABASE_SERVICE_ROLE_KEY = eyJhbGc...votre-service-key

# URL du site de test
NEXT_PUBLIC_SITE_URL = https://ph2026-test.vercel.app

# Environment
NEXT_PUBLIC_ENV = test
```

3. Cliquer sur **Deploy**

⏳ Attendre 2-3 minutes pour le premier déploiement

### 2.3 Configuration de la branche

Après le déploiement :

1. Aller dans **Settings** → **Git**
2. Dans **Production Branch** :
   - Changer de `main` à `test`
   - Cliquer sur **Save**
3. Dans **Branch Deployments** :
   - Sélectionner **"Only build production branch"**
   - Save

## Étape 3 : Tester le déploiement

### 3.1 Déclencher un déploiement depuis la branche test

Dans votre terminal local :

```bash
# S'assurer d'être sur la branche dev
git checkout dev

# Déployer vers test
./scripts/deploy-test.sh
```

Ou manuellement :

```bash
git checkout test
git merge dev
git push origin test
```

### 3.2 Vérifier le site

1. Aller sur https://ph2026-test.vercel.app
2. Tester :
   - ✅ La page d'accueil s'affiche
   - ✅ Cliquer sur "Connexion"
   - ✅ Se connecter avec `admin@test.local` / `Admin123!`
   - ✅ Accès à l'espace admin
   - ✅ Page de modération avec les membres pending

### 3.3 Tester l'inscription

1. Se déconnecter
2. Aller sur `/join`
3. Créer un nouveau compte
4. Vérifier la redirection vers `/pending`
5. Se reconnecter en admin
6. Vérifier le nouveau membre dans `/admin/moderation`

## Étape 4 : Configuration des emails (optionnel)

Pour activer les vrais emails sur l'environnement de test :

1. Dans Vercel : **Settings** → **Environment Variables**
2. Ajouter : `RESEND_API_KEY = re_xxxxx` (votre clé Resend)
3. **Save** et redéployer

## 📋 Checklist de validation

- [ ] Projet Supabase `ph2026-test` créé
- [ ] Schéma SQL exécuté avec succès
- [ ] Comptes de test visibles dans la table members
- [ ] Projet Vercel `ph2026-test` créé
- [ ] Variables d'environnement configurées
- [ ] Branche `test` configurée comme production
- [ ] Site accessible sur https://ph2026-test.vercel.app
- [ ] Connexion avec `admin@test.local` fonctionne
- [ ] Inscription de nouveaux membres fonctionne
- [ ] Modération des membres pending fonctionne

## 🔧 Dépannage

### Le site affiche "Application error"

1. Vérifier les logs : Vercel Dashboard → Functions → Logs
2. Vérifier les variables d'environnement
3. S'assurer que le schéma SQL a été exécuté

### Erreur de connexion Supabase

1. Vérifier que les clés API sont correctes
2. Vérifier que l'URL Supabase est correcte (avec https://)
3. Tester la connexion dans Supabase Dashboard

### La connexion échoue

1. Vérifier que l'email est confirmé dans Supabase
2. Vérifier le mot de passe
3. Regarder les logs dans Supabase → Logs → Auth

### Les changements ne sont pas visibles

1. Vider le cache du navigateur
2. Attendre que Vercel finisse le déploiement
3. Vérifier que vous êtes sur la bonne branche

## 📝 Notes importantes

- L'environnement de test partage la même base de code que production
- Les données de test sont isolées de la production
- Toujours tester les nouvelles fonctionnalités sur test avant production
- Le site de test est public mais non référencé

## 🎉 Félicitations !

Votre environnement de test est maintenant configuré. Vous pouvez :

1. Développer sur la branche `dev`
2. Déployer en test avec `./scripts/deploy-test.sh`
3. Valider les changements sur https://ph2026-test.vercel.app
4. Une fois validé, déployer en production avec `./scripts/deploy-prod.sh`

## Support

En cas de problème :
- Documentation Supabase : https://supabase.com/docs
- Documentation Vercel : https://vercel.com/docs
- Logs Vercel : Dashboard → Functions → Logs
- Logs Supabase : Dashboard → Logs