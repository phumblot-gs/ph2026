# Correction : Google Places API

## Problème rencontré
L'erreur "adapter http is not available in the build" survenait lors de l'utilisation de l'autocomplétion d'adresse.

## Cause
La bibliothèque `@googlemaps/google-maps-services-js` est conçue pour Node.js et ne peut pas faire d'appels HTTP directement depuis le navigateur.

## Solution mise en place

### 1. Création de routes API côté serveur
- `/api/places/autocomplete` - Pour l'autocomplétion d'adresses
- `/api/places/details` - Pour récupérer les détails d'une adresse

Ces routes font les appels à l'API Google Places depuis le serveur Next.js.

### 2. Nouvelles fonctions client
Créé `/lib/google/places-client.ts` avec des fonctions qui appellent nos routes API au lieu de Google directement :
- `autocompleteAddress()` - Appelle `/api/places/autocomplete`
- `getPlaceDetails()` - Appelle `/api/places/details`

### 3. Architecture

```
Navigateur (Client)
    ↓
Fonctions client (places-client.ts)
    ↓ (fetch)
Routes API Next.js (/api/places/*)
    ↓ (fetch)
Google Places API
```

## Avantages de cette approche
1. ✅ Fonctionne dans le navigateur
2. ✅ Clé API reste côté serveur (plus sécurisé)
3. ✅ Possibilité d'ajouter du cache côté serveur
4. ✅ Meilleur contrôle des erreurs

## Test
Pour tester :
1. Aller sur http://localhost:3000/test-apis
2. Dans la section Google Places, taper une adresse française
3. Les suggestions doivent apparaître

## Notes
- La clé API Google Places doit être configurée dans `.env.local`
- Les restrictions de la clé API doivent autoriser votre domaine
- La facturation Google Cloud doit être activée (200$/mois gratuits)