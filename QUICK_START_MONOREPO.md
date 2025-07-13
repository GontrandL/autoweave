# AutoWeave Monorepo - Quick Start Guide

## 🚀 Installation Rapide (Ubuntu)

### Prérequis
- Node.js 18+ et npm 9+
- Git
- Docker (optionnel)

### Installation en 3 étapes

```bash
# 1. Cloner le repo
git clone [VOTRE_REPO_URL] autoweave-monorepo
cd autoweave-monorepo

# 2. Installer les dépendances
npm install

# 3. Configurer l'environnement
cp .env.example .env
# Éditer .env et ajouter votre OPENAI_API_KEY
```

### Démarrage Rapide

```bash
# Lancer le backend
cd packages/backend
npm start

# Dans un autre terminal - Lancer les tests
npm test

# Ou utiliser le script de test global
node scripts/run-all-tests.js
```

## 📁 Structure du Monorepo

```
packages/
├── core/          # Moteur d'orchestration
├── memory/        # Système de mémoire hybride
├── agents/        # Implémentations des agents
├── backend/       # API et services
├── integrations/  # Intégrations externes
├── cli/           # Interface ligne de commande
├── deployment/    # K8s et infrastructure
└── shared/        # Utilitaires partagés
```

## 🔧 Configuration Minimale

Pour un test rapide, vous n'avez besoin que de :
```env
NODE_ENV=development
PORT=3000
OPENAI_API_KEY=votre_clé_ici
ENABLE_MOCKS=true  # Active les mocks pour tester sans services externes
```

## 🧪 Tests

```bash
# Tester tous les packages
node scripts/run-all-tests.js

# Tester un package spécifique
cd packages/core && npm test

# Avec couverture
npm test -- --coverage
```

## 🐛 Dépannage

### Erreur npm install
```bash
# Si erreur avec les workspaces
rm -rf node_modules package-lock.json
npm cache clean --force
npm install
```

### Erreur de permission
```bash
# Donner les permissions d'exécution aux scripts
chmod +x scripts/*.js
chmod +x scripts/*.sh
```

### Services non disponibles
```bash
# Activer le mode mock
export ENABLE_MOCKS=true
export MOCK_MEM0=true
export MOCK_MEMGRAPH=true
```

## 📊 Vérification de l'Installation

```bash
# Vérifier la structure
ls -la packages/

# Vérifier les dépendances
npm ls --depth=0

# Vérifier la configuration
node -e "console.log(require('./packages/shared/src/env-validator.js').new().validate())"
```

## 🎯 Premier Test

1. Démarrer le backend :
```bash
cd packages/backend
npm start
```

2. Tester l'API :
```bash
curl http://localhost:3000/health
```

3. Créer un agent :
```bash
curl -X POST http://localhost:3000/api/agents \
  -H "Content-Type: application/json" \
  -d '{"description": "Test agent from monorepo"}'
```

## 📝 Notes Importantes

- La migration monorepo a consolidé tout le code en une structure unifiée
- Les mocks sont activés par défaut pour faciliter les tests
- Tous les packages utilisent des références locales (file:)
- Les imports ont été mis à jour pour utiliser @autoweave/*

## 🆘 Support

En cas de problème :
1. Vérifier les logs dans `packages/*/logs/`
2. Consulter `TEST_AND_MOCK_REPORT.md`
3. Vérifier `MIGRATION_PLAN.md` pour comprendre la structure

---

Version: Monorepo v2.0 - Post-migration
Date: 2025-07-13