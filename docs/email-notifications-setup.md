# Configuration des Notifications Email

## Vue d'ensemble
Le système envoie automatiquement un email à tous les super-administrateurs lorsqu'un nouveau membre s'inscrit et est en attente de validation.

## Architecture
```
Nouveau membre (Google OAuth ou Email)
    ↓
Trigger PostgreSQL (after INSERT on members)
    ↓
Edge Function Supabase (notify-new-member)
    ↓
API Resend
    ↓
Emails aux super_admins
```

## Configuration requise

### 1. Créer un compte Resend
1. Aller sur [resend.com](https://resend.com)
2. Créer un compte gratuit
3. Vérifier votre domaine (ph2026.fr) ou utiliser le domaine de test
4. Récupérer votre clé API

### 2. Configurer les variables d'environnement Supabase

Dans le dashboard Supabase :
1. Aller dans Settings → Edge Functions
2. Ajouter les secrets suivants :
   ```
   RESEND_API_KEY=re_xxxxxxxxxxxxx
   SITE_URL=https://ph2026.vercel.app
   ```

### 3. Déployer la Edge Function

```bash
# Installer Supabase CLI si ce n'est pas fait
brew install supabase/tap/supabase

# Se connecter à votre projet
supabase login
supabase link --project-ref [votre-project-ref]

# Déployer la fonction
supabase functions deploy notify-new-member
```

### 4. Exécuter les migrations SQL

Dans le SQL Editor de Supabase, exécuter dans l'ordre :
1. `migration-5-google-oauth-handler.sql` (si pas déjà fait)
2. `migration-6-email-notification-trigger.sql`

### 5. Configuration des variables PostgreSQL

Dans le SQL Editor, exécuter :
```sql
-- Remplacer par vos vraies valeurs
ALTER DATABASE postgres SET "app.settings.supabase_project_ref" = 'xbwoskydlvjsckpvfnkt';
ALTER DATABASE postgres SET "app.settings.supabase_anon_key" = 'votre_anon_key';
```

## Alternative sans Edge Functions

Si vous préférez ne pas utiliser les Edge Functions, vous pouvez utiliser un webhook :

1. Dans Supabase Dashboard → Database → Webhooks
2. Créer un nouveau webhook :
   - Table : `members`
   - Events : `INSERT`
   - URL : Votre endpoint (ex: API Route Next.js)
   - Headers : Ajouter un secret pour sécuriser

3. Créer une API Route dans Next.js :
```typescript
// app/api/webhooks/new-member/route.ts
export async function POST(req: Request) {
  // Vérifier le secret
  // Récupérer les données du membre
  // Envoyer les emails via Resend
}
```

## Test de la notification

Pour tester manuellement l'envoi d'une notification :
```sql
-- Remplacer par l'UUID d'un membre en pending
SELECT send_new_member_notification('uuid-du-membre');
```

## Personnalisation du template

Le template HTML de l'email se trouve dans :
`supabase/functions/notify-new-member/index.ts`

Vous pouvez le modifier pour changer :
- Les couleurs et le style
- Le contenu du message
- Les informations affichées
- L'adresse d'expéditeur

## Debugging

### Vérifier les logs de la Edge Function
```bash
supabase functions logs notify-new-member
```

### Vérifier que pg_net est activé
```sql
SELECT * FROM pg_extension WHERE extname = 'pg_net';
```

### Tester l'envoi direct
```bash
curl -X POST https://[project-ref].supabase.co/functions/v1/notify-new-member \
  -H "Authorization: Bearer [anon-key]" \
  -H "Content-Type: application/json" \
  -d '{"member_id": "uuid-du-membre"}'
```

## Considérations de production

1. **Limites d'envoi** : Resend a des limites sur le plan gratuit (100 emails/jour)
2. **Domain verification** : Vérifier le domaine ph2026.fr dans Resend pour éviter que les emails soient marqués comme spam
3. **Rate limiting** : Implémenter un rate limiting si nécessaire
4. **Monitoring** : Configurer des alertes pour les échecs d'envoi

## Support

Pour toute question sur la configuration, contactez l'équipe technique.