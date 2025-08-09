#!/bin/bash

# Script pour corriger automatiquement les erreurs de lint
echo "🔧 Correction automatique des erreurs ESLint..."

# Corriger automatiquement ce qui peut l'être
npx next lint --fix

# Si il reste des erreurs, les afficher
echo ""
echo "📋 Vérification des erreurs restantes..."
npm run lint

echo ""
echo "✅ Si tout est OK, vous pouvez relancer ./scripts/deploy-test.sh"