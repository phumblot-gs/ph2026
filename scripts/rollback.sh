#!/bin/bash

# Script de rollback d'urgence
# Usage: ./scripts/rollback.sh [version-tag]

set -e

echo "🔙 ROLLBACK DE PRODUCTION"
echo "========================="

# Couleurs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Vérifier le paramètre
if [ -z "$1" ]; then
    echo -e "${RED}❌ Veuillez spécifier une version${NC}"
    echo "Usage: ./scripts/rollback.sh v20240101-1234"
    echo ""
    echo "Versions disponibles:"
    git tag -l "v*" | tail -10
    exit 1
fi

VERSION=$1

# Vérifier que le tag existe
if ! git rev-parse "$VERSION" >/dev/null 2>&1; then
    echo -e "${RED}❌ La version $VERSION n'existe pas${NC}"
    echo "Versions disponibles:"
    git tag -l "v*" | tail -10
    exit 1
fi

echo -e "${YELLOW}⚠️  ATTENTION: Rollback vers $VERSION${NC}"
echo "Cela va remplacer la production actuelle!"
echo ""
echo -e "${RED}Tapez 'ROLLBACK' pour confirmer:${NC}"
read -r response

if [ "$response" != "ROLLBACK" ]; then
    echo "Rollback annulé"
    exit 0
fi

# Sauvegarder l'état actuel
echo "💾 Sauvegarde de l'état actuel..."
BACKUP_TAG="backup-$(date '+%Y%m%d-%H%M')"
git tag -a "$BACKUP_TAG" -m "Backup before rollback to $VERSION"

# Passer sur main
echo "🔄 Passage sur la branche main..."
git checkout main

# Revenir à la version spécifiée
echo "⏪ Rollback vers $VERSION..."
git reset --hard "$VERSION"

# Forcer le push
echo "📤 Push forcé vers origin/main..."
git push origin main --force-with-lease

echo ""
echo -e "${GREEN}✅ ROLLBACK EFFECTUÉ!${NC}"
echo ""
echo "📍 Version en production: $VERSION"
echo "💾 État précédent sauvegardé: $BACKUP_TAG"
echo "⏳ Le déploiement Vercel va prendre 2-3 minutes"
echo ""
echo -e "${YELLOW}Actions requises:${NC}"
echo "1. Vérifier le site en production"
echo "2. Informer l'équipe du rollback"
echo "3. Investiguer le problème dans la branche test"

# Log du rollback
echo "$(date '+%Y-%m-%d %H:%M:%S') - Rollback to $VERSION (backup: $BACKUP_TAG)" >> deployments.log