#!/bin/bash

# Script de vérification de la préparation au déploiement AutoWeave
# Vérifie que tous les fichiers critiques sont présents et à jour

set -e

# Couleurs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Variables
ERRORS=0
WARNINGS=0
CHECKS=0

print_header() {
    echo -e "${BLUE}"
    echo "╔══════════════════════════════════════════════════════════════╗"
    echo "║             🔍 AutoWeave Deployment Readiness Check          ║"
    echo "║                  Enterprise Infrastructure                    ║"
    echo "╚══════════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
}

check_file() {
    local file=$1
    local critical=${2:-false}
    CHECKS=$((CHECKS + 1))
    
    if [ -f "$file" ]; then
        echo -e "${GREEN}✓${NC} $file"
        return 0
    else
        if [ "$critical" = true ]; then
            echo -e "${RED}✗ CRITIQUE${NC} $file"
            ERRORS=$((ERRORS + 1))
        else
            echo -e "${YELLOW}⚠ OPTIONNEL${NC} $file"
            WARNINGS=$((WARNINGS + 1))
        fi
        return 1
    fi
}

check_directory() {
    local dir=$1
    local critical=${2:-false}
    CHECKS=$((CHECKS + 1))
    
    if [ -d "$dir" ]; then
        echo -e "${GREEN}✓${NC} $dir/"
        return 0
    else
        if [ "$critical" = true ]; then
            echo -e "${RED}✗ CRITIQUE${NC} $dir/"
            ERRORS=$((ERRORS + 1))
        else
            echo -e "${YELLOW}⚠ OPTIONNEL${NC} $dir/"
            WARNINGS=$((WARNINGS + 1))
        fi
        return 1
    fi
}

check_package_json() {
    CHECKS=$((CHECKS + 1))
    if [ -f "package.json" ]; then
        if grep -q "autoweave" package.json && grep -q "workspaces" package.json; then
            echo -e "${GREEN}✓${NC} package.json (monorepo configuré)"
            return 0
        else
            echo -e "${YELLOW}⚠${NC} package.json (configuration monorepo incomplète)"
            WARNINGS=$((WARNINGS + 1))
            return 1
        fi
    else
        echo -e "${RED}✗ CRITIQUE${NC} package.json"
        ERRORS=$((ERRORS + 1))
        return 1
    fi
}

check_env_example() {
    CHECKS=$((CHECKS + 1))
    if [ -f ".env.example" ]; then
        local required_vars=("OPENAI_API_KEY" "NODE_ENV" "PORT")
        local missing=()
        
        for var in "${required_vars[@]}"; do
            if ! grep -q "^$var=" .env.example; then
                missing+=("$var")
            fi
        done
        
        if [ ${#missing[@]} -eq 0 ]; then
            echo -e "${GREEN}✓${NC} .env.example (toutes les variables requises)"
            return 0
        else
            echo -e "${YELLOW}⚠${NC} .env.example (variables manquantes: ${missing[*]})"
            WARNINGS=$((WARNINGS + 1))
            return 1
        fi
    else
        echo -e "${RED}✗ CRITIQUE${NC} .env.example"
        ERRORS=$((ERRORS + 1))
        return 1
    fi
}

check_docker_files() {
    CHECKS=$((CHECKS + 1))
    local docker_files=("Dockerfile" "docker-compose.yml" ".dockerignore")
    local found=0
    
    for file in "${docker_files[@]}"; do
        if [ -f "$file" ]; then
            found=$((found + 1))
        fi
    done
    
    if [ $found -gt 0 ]; then
        echo -e "${GREEN}✓${NC} Configuration Docker ($found/$((${#docker_files[@]})) fichiers)"
        return 0
    else
        echo -e "${YELLOW}⚠${NC} Aucun fichier Docker trouvé"
        WARNINGS=$((WARNINGS + 1))
        return 1
    fi
}

check_github_workflows() {
    CHECKS=$((CHECKS + 1))
    if [ -d ".github/workflows" ]; then
        local workflow_count=$(find .github/workflows -name "*.yml" -o -name "*.yaml" | wc -l)
        if [ $workflow_count -gt 0 ]; then
            echo -e "${GREEN}✓${NC} GitHub Workflows ($workflow_count workflows)"
            return 0
        else
            echo -e "${YELLOW}⚠${NC} Dossier .github/workflows vide"
            WARNINGS=$((WARNINGS + 1))
            return 1
        fi
    else
        echo -e "${YELLOW}⚠${NC} Pas de workflows GitHub"
        WARNINGS=$((WARNINGS + 1))
        return 1
    fi
}

check_monorepo_structure() {
    CHECKS=$((CHECKS + 1))
    local required_packages=("core" "memory" "agents" "backend" "cli")
    local found=0
    
    if [ -d "packages" ]; then
        for pkg in "${required_packages[@]}"; do
            if [ -d "packages/$pkg" ]; then
                found=$((found + 1))
            fi
        done
        
        if [ $found -eq ${#required_packages[@]} ]; then
            echo -e "${GREEN}✓${NC} Structure monorepo complète ($found/$((${#required_packages[@]})) packages)"
            return 0
        else
            echo -e "${YELLOW}⚠${NC} Structure monorepo incomplète ($found/$((${#required_packages[@]})) packages)"
            WARNINGS=$((WARNINGS + 1))
            return 1
        fi
    else
        echo -e "${RED}✗ CRITIQUE${NC} Dossier packages/ manquant"
        ERRORS=$((ERRORS + 1))
        return 1
    fi
}

check_security_files() {
    local security_files=(
        ".github/workflows/codeql-analysis.yml"
        ".github/workflows/secret-scanning.yml"
        ".github/workflows/security.yml"
        ".github/dependabot.yml"
    )
    
    local found=0
    for file in "${security_files[@]}"; do
        if [ -f "$file" ]; then
            found=$((found + 1))
        fi
    done
    
    CHECKS=$((CHECKS + 1))
    if [ $found -gt 2 ]; then
        echo -e "${GREEN}✓${NC} Configuration sécurité ($found/$((${#security_files[@]})) fichiers)"
        return 0
    else
        echo -e "${YELLOW}⚠${NC} Configuration sécurité incomplète ($found/$((${#security_files[@]})) fichiers)"
        WARNINGS=$((WARNINGS + 1))
        return 1
    fi
}

print_header

echo -e "${BLUE}🔍 Vérification des fichiers critiques...${NC}"
echo

echo "📦 Configuration de base:"
check_package_json
check_env_example
check_file "README.md" true
check_file "CLAUDE.md" true
check_file "PLANNING.md" false
check_file "TASKS.md" false

echo
echo "🚀 Scripts de déploiement:"
check_file "install.sh" true
check_file "start-autoweave.sh" true
check_file "UBUNTU_DEPLOYMENT_GUIDE.md" true
check_file "scripts/setup-memory-system.sh" false

echo
echo "🏗️ Infrastructure:"
check_docker_files
check_github_workflows
check_monorepo_structure
check_security_files

echo
echo "📁 Dossiers critiques:"
check_directory "packages" true
check_directory "src" true
check_directory "scripts" false
check_directory "tests" false
check_directory "k8s" false
check_directory "helm" false

echo
echo "🔧 Fichiers de configuration:"
check_file "turbo.json" false
check_file "pnpm-workspace.yaml" false
check_file "playwright.config.ts" false
check_file "tsconfig.json" false
check_file ".gitignore" true

echo
echo "📚 Documentation spécialisée:"
check_file "IMPROVEMENT_ROADMAP.md" false
check_file "TASKS_AUDIT_RESULTS.md" false
check_file "NEXT_PRIORITIES.md" false
check_file "UBUNTU_DEPLOYMENT_COMMANDS.md" false

echo
echo "🔒 Sécurité et qualité:"
check_file ".github/workflows/codeql-analysis.yml" false
check_file ".github/workflows/e2e-tests.yml" false
check_file "sonar-project.properties" false
check_file ".size-limit.js" false

echo
echo -e "${BLUE}📊 Résumé de la vérification:${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "Total des vérifications: ${BLUE}$CHECKS${NC}"
echo -e "Erreurs critiques: ${RED}$ERRORS${NC}"
echo -e "Avertissements: ${YELLOW}$WARNINGS${NC}"
echo -e "Réussites: ${GREEN}$((CHECKS - ERRORS - WARNINGS))${NC}"

echo
if [ $ERRORS -eq 0 ]; then
    if [ $WARNINGS -eq 0 ]; then
        echo -e "${GREEN}🎉 PARFAIT!${NC} Tous les fichiers sont présents et AutoWeave est prêt pour le déploiement!"
        echo -e "${GREEN}✅ Le déploiement Ubuntu peut procéder sans problème.${NC}"
        exit 0
    else
        echo -e "${YELLOW}⚠️  PRÊT AVEC AVERTISSEMENTS${NC} AutoWeave peut être déployé mais quelques fichiers optionnels manquent."
        echo -e "${YELLOW}💡 Le déploiement Ubuntu fonctionnera mais pourrait manquer de certaines fonctionnalités.${NC}"
        exit 0
    fi
else
    echo -e "${RED}❌ PROBLÈMES CRITIQUES${NC} Des fichiers essentiels manquent!"
    echo -e "${RED}🚫 Le déploiement Ubuntu échouera probablement.${NC}"
    echo
    echo -e "${YELLOW}💡 Actions recommandées:${NC}"
    echo "1. Vérifier que vous êtes dans le bon répertoire AutoWeave"
    echo "2. Faire un 'git pull' pour récupérer les derniers fichiers"
    echo "3. Vérifier que la branche est 'feat/typescript-migration'"
    echo "4. Relancer ce script après corrections"
    exit 1
fi