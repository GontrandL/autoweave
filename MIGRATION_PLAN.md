# 🛡️ Plan de Migration Sécurisée AutoWeave

## Objectif
Réorganiser le projet AutoWeave avec une approche **ZÉRO PERTE** - tous les fichiers sont sauvegardés avant réorganisation.

## Structure de Sauvegarde

### 📁 archive/legacy-interfaces/
**Contenu :** SillyTavern, interfaces multiples, UI expérimentales
**Taille :** ~3.5GB
**Justification :** Interfaces peuvent être des dépendances externes
**Action :** Déplacement vers archive, pas suppression

### 📁 archive/documentation-backup/
**Contenu :** 15+ fichiers MD redondants à la racine
**Justification :** Documentation éparpillée, beaucoup de doublons
**Action :** Consolidation dans docs/ avec les éléments essentiels

### 📁 archive/build-artifacts/
**Contenu :** node_modules/, venv/, logs/
**Taille :** ~3GB
**Justification :** Artifacts de build régénérables
**Action :** Déplacement, reconstruction avec npm install

### 📁 archive/experimental-components/
**Contenu :** Components non intégrés (gitea, kotaemon, taskcafe)
**Justification :** Composants en développement non utilisés actuellement
**Action :** Sauvegarde pour évaluation future

### 📁 archive/review-later/
**Contenu :** Fichiers à examiner individuellement
**Justification :** Éléments nécessitant une analyse détaillée
**Action :** Review manuel avant décision finale

## Fichiers ESSENTIELS à Conserver

### ✅ Code Core (src/)
```
src/core/agent-weaver.js        # Orchestrateur principal
src/core/autoweave.js          # Moteur AutoWeave  
src/memory/hybrid-memory.js    # Système mémoire hybride
src/cache/redis-ml-cache.js    # Cache ML intelligent
src/agents/                    # 6 agents d'intelligence
src/routes/                    # API REST
src/utils/logger.js            # Logging avec Sentry
```

### ✅ Configuration Essentielle
```
package.json                   # Dépendances principales
.env.example                   # Configuration template
install.sh                     # Installateur zero-config
Dockerfile                     # Container production
```

### ✅ Documentation Principale
```
README.md                      # Documentation principale
CHANGELOG.md                   # Historique versions
CONTRIBUTING.md                # Guide contribution
```

### ✅ Tests et Scripts
```
tests/                         # Suite de tests
scripts/setup/                 # Scripts d'installation
jest.config.js                # Configuration tests
```

## Processus de Migration

### Phase 1: Préparation
1. Créer tous les répertoires archive/
2. Documenter le contenu de chaque catégorie
3. Créer un inventaire détaillé

### Phase 2: Migration Sécurisée
1. **DÉPLACER** (mv) vers archive/ - pas de rm
2. Vérifier que chaque fichier est bien dans archive/
3. Créer la nouvelle structure propre

### Phase 3: Validation
1. Tester le fonctionnement des 6 agents d'intelligence
2. Vérifier l'intégrité des fonctionnalités core
3. Valider l'installation zero-config

### Phase 4: Review Graduelle
1. Examiner archive/review-later/ individuellement
2. Réintégrer les éléments nécessaires identifiés
3. Confirmer l'obsolescence des autres éléments

## Sécurités Supplémentaires

### 🔒 Backup Git
```bash
# Créer une branche de sauvegarde complète
git checkout -b backup-before-cleanup
git add .
git commit -m "Backup complet avant réorganisation"

# Créer une branche pour le nettoyage
git checkout -b clean-architecture
```

### 🔒 Inventaire Automatique
```bash
# Générer un inventaire avant migration
find . -type f -exec ls -la {} \; > inventory-before.txt
du -sh * > sizes-before.txt
```

### 🔒 Validation Continue
```bash
# Après chaque étape, vérifier l'intégrité
npm test
./scripts/health-check.sh
```

## Critères de Succès

1. **Fonctionnalité Préservée :** Les 6 agents d'intelligence fonctionnent
2. **Performance :** Installation < 2 minutes
3. **Taille Optimisée :** Projet < 500MB 
4. **Structure Claire :** Navigation intuitive
5. **Aucune Perte :** Tous les fichiers tracés dans archive/

## Rollback Plan

En cas de problème :
```bash
# Retour à l'état initial
git checkout backup-before-cleanup
mv archive/* ./
```

---

**Principe Directeur :** Sauvegarder d'abord, nettoyer ensuite, valider toujours.