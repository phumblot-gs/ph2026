#!/bin/bash

# Script pour déployer test vers production
# Usage: ./scripts/deploy-prod.sh

set -e

echo "🚀 Déploiement vers PRODUCTION"
echo "=============================="

# Couleurs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Vérifier qu'on est sur test
CURRENT_BRANCH=$(git branch --show-current)
if [ "$CURRENT_BRANCH" != "test" ]; then
    echo -e "${RED}❌ Vous devez être sur la branche 'test'${NC}"
    echo "Branche actuelle: $CURRENT_BRANCH"
    echo "Utilisez: git checkout test"
    exit 1
fi

# Vérifier qu'il n'y a pas de changements non commités
if ! git diff-index --quiet HEAD --; then
    echo -e "${YELLOW}⚠️  Vous avez des changements non commités${NC}"
    echo "Committez ou stashez vos changements avant de continuer"
    exit 1
fi

# Mettre à jour test
echo "📥 Mise à jour de la branche test..."
git pull origin test

# Checklist de validation
echo ""
echo -e "${BLUE}📋 CHECKLIST AVANT PRODUCTION${NC}"
echo "================================"
echo ""
echo "Avez-vous vérifié :"
echo "  ✓ Le site de test fonctionne correctement ?"
echo "  ✓ L'authentification fonctionne ?"
echo "  ✓ Les nouvelles fonctionnalités sont testées ?"
echo "  ✓ Pas d'erreurs dans la console ?"
echo "  ✓ La base de données prod est sauvegardée ?"
echo ""
echo -e "${YELLOW}⚠️  ATTENTION: Vous allez déployer en PRODUCTION${NC}"
echo -e "${YELLOW}Cette action affectera les vrais utilisateurs!${NC}"
echo ""
echo -e "${RED}Tapez 'DEPLOY' pour confirmer:${NC}"
read -r response

if [ "$response" != "DEPLOY" ]; then
    echo "Déploiement annulé"
    exit 0
fi

# Créer un tag de version
echo "📌 Création d'un tag de version..."
VERSION="v$(date '+%Y%m%d-%H%M')"
git tag -a "$VERSION" -m "Production deployment $VERSION"

# Passer sur main
echo "🔄 Passage sur la branche main..."
git checkout main
git pull origin main

# Merger test dans main
echo "🔀 Merge de test dans main..."
git merge test -m "chore: deploy test to production $VERSION"

# Pousser vers origin avec le tag
echo "📤 Push vers origin/main..."
git push origin main
git push origin "$VERSION"

echo ""
echo -e "${GREEN}✅ DÉPLOIEMENT EN PRODUCTION RÉUSSI!${NC}"
echo ""
echo "📍 URL de production: https://ph2026.fr (ou ph2026.vercel.app)"
echo "🏷️  Version déployée: $VERSION"
echo "⏳ Le déploiement Vercel va prendre 2-3 minutes"
echo ""
echo -e "${YELLOW}IMPORTANT:${NC}"
echo "1. Surveillez le site en production"
echo "2. Vérifiez les logs dans Vercel"
echo "3. En cas de problème: ./scripts/rollback.sh $VERSION"

# Retourner sur dev
git checkout dev

# Log du déploiement
echo "$(date '+%Y-%m-%d %H:%M:%S') - Deployed $VERSION to production" >> deployments.log