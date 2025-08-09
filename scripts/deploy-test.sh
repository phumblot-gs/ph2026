#!/bin/bash

# Script pour déployer dev vers test
# Usage: ./scripts/deploy-test.sh

set -e

echo "🚀 Déploiement vers TEST"
echo "========================"

# Couleurs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Vérifier qu'on est sur dev
CURRENT_BRANCH=$(git branch --show-current)
if [ "$CURRENT_BRANCH" != "dev" ]; then
    echo -e "${RED}❌ Vous devez être sur la branche 'dev'${NC}"
    echo "Branche actuelle: $CURRENT_BRANCH"
    echo "Utilisez: git checkout dev"
    exit 1
fi

# Vérifier qu'il n'y a pas de changements non commités
if ! git diff-index --quiet HEAD --; then
    echo -e "${YELLOW}⚠️  Vous avez des changements non commités${NC}"
    echo "Committez ou stashez vos changements avant de continuer"
    exit 1
fi

# Mettre à jour dev
echo "📥 Mise à jour de la branche dev..."
git pull origin dev

# Lancer les tests
echo "🧪 Exécution des tests..."
npm run lint || {
    echo -e "${RED}❌ Lint failed${NC}"
    exit 1
}

npm run build || {
    echo -e "${RED}❌ Build failed${NC}"
    exit 1
}

echo -e "${GREEN}✅ Tests passés${NC}"

# Demander confirmation
echo ""
echo -e "${YELLOW}Êtes-vous sûr de vouloir déployer vers TEST? (y/n)${NC}"
read -r response

if [ "$response" != "y" ]; then
    echo "Déploiement annulé"
    exit 0
fi

# Passer sur test
echo "🔄 Passage sur la branche test..."
git checkout test
git pull origin test

# Merger dev dans test
echo "🔀 Merge de dev dans test..."
git merge dev -m "chore: deploy dev to test $(date '+%Y-%m-%d %H:%M')"

# Pousser vers origin
echo "📤 Push vers origin/test..."
git push origin test

echo -e "${GREEN}✅ Déploiement vers TEST réussi!${NC}"
echo ""
echo "📍 URL de test: https://ph2026-test.vercel.app"
echo "⏳ Le déploiement Vercel va prendre 2-3 minutes"
echo ""
echo "Prochaines étapes:"
echo "1. Vérifier le site de test"
echo "2. Effectuer les tests de validation"
echo "3. Si OK, lancer ./scripts/deploy-prod.sh"

# Retourner sur dev
git checkout dev