# Synchronisation Slack

## Architecture

Le système de synchronisation Slack fonctionne avec une architecture serveur-client découplée :

### Côté Serveur (Cron Job)
- **Endpoint** : `/api/cron/sync-slack`
- **Fréquence** : Toutes les 30 secondes (configurable dans `vercel.json`)
- **Fonction** : Récupère les messages depuis Slack et les insère dans Supabase

### Côté Client
- **Écoute uniquement Supabase Realtime**
- **Pas de synchronisation directe avec Slack**
- **Pas de polling côté client**

## Flux de données

```
Slack API --> Cron Job (serveur) --> Supabase --> Realtime --> Clients
```

## Configuration

### Variables d'environnement requises

```env
# Slack
SLACK_BOT_TOKEN=xoxb-...
SLACK_SIGNING_SECRET=...

# Cron (générer avec: openssl rand -base64 32)
CRON_SECRET=...
```

### Configuration Vercel

Le cron job est configuré dans `vercel.json` :

```json
{
  "crons": [
    {
      "path": "/api/cron/sync-slack",
      "schedule": "*/30 * * * *"  // Toutes les 30 secondes
    }
  ]
}
```

## Test en local

Pour tester le cron job en développement :

```bash
node scripts/test-slack-cron.js
```

## Monitoring

Les logs du cron job sont préfixés avec `[Cron]` pour faciliter le debugging :

- `[Cron] Début de la synchronisation Slack`
- `[Cron] X groupe(s) à synchroniser`
- `[Cron] Synchronisation terminée en Xms - Total: X messages`

## Avantages de cette architecture

1. **Pas de doublons** : Les messages sont insérés une seule fois côté serveur
2. **Performance** : Les clients n'ont pas besoin de faire des appels API Slack
3. **Scalabilité** : Un seul point de synchronisation pour tous les clients
4. **Fiabilité** : Si le cron échoue, les messages seront récupérés au prochain passage
5. **Temps réel** : Les messages apparaissent instantanément via Supabase Realtime

## Sécurité

- Le cron job utilise `CRON_SECRET` pour l'authentification en production
- Le service client Supabase a les permissions admin nécessaires
- Les clients n'ont jamais accès directement à l'API Slack

## Troubleshooting

### Les messages Slack n'apparaissent pas
1. Vérifier que le cron job s'exécute (logs Vercel)
2. Vérifier que `SLACK_BOT_TOKEN` est valide
3. Vérifier que le bot est dans le canal Slack
4. Vérifier les logs avec le préfixe `[Cron]`

### Messages en double
1. Vérifier qu'il n'y a pas de synchronisation côté client
2. Vérifier que `slack_ts` est bien unique dans la base