# Instructions de migration pour le système de modération

## ⚠️ IMPORTANT : Exécutez les scripts dans l'ordre

PostgreSQL nécessite que les nouvelles valeurs d'enum soient committées avant d'être utilisées dans des triggers ou des contraintes.

## 📋 Étapes à suivre dans l'éditeur SQL de Supabase :

### 1. **Exécuter le Script 1** (`migration-1-add-pending-role.sql`)
```sql
-- Ajoute le rôle 'pending' au type enum
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'pending' AFTER 'expert';
```
✅ Cliquez sur "Run" et attendez que ce soit terminé

### 2. **Exécuter le Script 2** (`migration-2-update-functions.sql`)
- Copier tout le contenu du fichier
- Coller dans l'éditeur SQL
- Cliquer sur "Run"

Ce script :
- Met à jour la fonction `handle_new_user()` 
- Crée la table `admin_notifications`
- Crée la fonction `notify_admins_new_member()`
- Configure les permissions RLS

### 3. **Exécuter le Script 3** (`migration-3-create-trigger.sql`)
- Copier tout le contenu du fichier
- Coller dans l'éditeur SQL
- Cliquer sur "Run"

Ce script crée le trigger qui notifie les admins lors d'une nouvelle inscription.

### 4. **Exécuter le Script 4** (`migration-4-update-existing.sql`) - OPTIONNEL
⚠️ **N'oubliez pas de remplacer l'email par le vôtre !**

Ce script permet de :
- Mettre à jour votre compte en `super_admin`
- Voir la liste des membres

## 🔍 Vérification

Pour vérifier que tout fonctionne :

```sql
-- Vérifier les valeurs du type enum
SELECT unnest(enum_range(NULL::user_role));

-- Vérifier que la table notifications existe
SELECT * FROM admin_notifications;

-- Vérifier les membres
SELECT email, role FROM members;
```

## 🚨 En cas d'erreur

Si vous avez une erreur "type already exists" ou similaire :
1. Vous pouvez ignorer et passer au script suivant
2. Ou supprimer et recréer :
```sql
-- Pour voir les types existants
SELECT typname FROM pg_type WHERE typname = 'user_role';

-- Pour voir les valeurs actuelles de l'enum
SELECT unnest(enum_range(NULL::user_role));
```

## ✅ Test final

1. Créez un nouveau compte via `/join`
2. Vérifiez dans Supabase que le membre a bien le rôle `pending`
3. Connectez-vous en tant que super_admin
4. Allez sur `/admin/moderation` pour voir les inscriptions en attente