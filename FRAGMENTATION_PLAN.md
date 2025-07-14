# 🔧 Plan de Fragmentation Modulaire AutoWeave

## 📋 Contexte
Suite à l'échec du nettoyage destructif dans `autoweave-clean`, nous devons récupérer le code depuis `archive/` et appliquer une fragmentation modulaire sécurisée.

## 🎯 Objectif
Créer une organisation multi-repository sur GitHub avec des modules indépendants mais interconnectés.

## 📦 Structure des Repositories

### 1. autoweave/autoweave-core
**Description**: Moteur principal d'orchestration
```
autoweave-core/
├── src/
│   ├── core/
│   │   ├── autoweave.js
│   │   └── agent-weaver.js
│   ├── services/
│   │   └── agent-service.js
│   └── utils/
│       ├── logger.js
│       ├── retry.js
│       └── validation.js
├── package.json
├── README.md
└── CHANGELOG.md
```

### 2. autoweave/autoweave-memory
**Description**: Système de mémoire hybride (mem0 + GraphRAG)
```
autoweave-memory/
├── src/
│   ├── mem0-client.js
│   ├── graph-client.js
│   └── hybrid-memory.js
├── scripts/
│   ├── mem0-bridge.py
│   └── setup-memory-system.sh
├── docker-compose.yml
└── package.json
```

### 3. autoweave/autoweave-integrations
**Description**: Intégrations MCP, ANP, kagent
```
autoweave-integrations/
├── src/
│   ├── mcp/
│   │   ├── discovery.js
│   │   └── autoweave-mcp-server.js
│   ├── kagent/
│   │   ├── bridge.js
│   │   └── yaml-generator.js
│   └── anp/
│       └── anp-server.js
└── package.json
```

### 4. autoweave/autoweave-agents
**Description**: Agents spécialisés et Intelligence
```
autoweave-agents/
├── src/
│   ├── integration-agent/
│   ├── debugging-agent.js
│   ├── self-awareness-agent.js
│   └── config-intelligence.js
├── examples/
└── package.json
```

### 5. autoweave/autoweave-ui
**Description**: Interfaces utilisateur (AG-UI, WebSocket)
```
autoweave-ui/
├── src/
│   ├── agui/
│   │   └── ui-agent.js
│   └── routes/
│       ├── index.js
│       └── [all routes]
├── extensions/
│   └── sillytavern/
└── package.json
```

### 6. autoweave/autoweave-cache
**Description**: Système de cache Redis ML
```
autoweave-cache/
├── src/
│   └── redis-ml-cache.js
├── docker-compose.yml
└── package.json
```

### 7. autoweave/autoweave-cli
**Description**: Interface ligne de commande
```
autoweave-cli/
├── src/
│   └── create-agent.js
├── bin/
│   └── autoweave.js
└── package.json
```

### 8. autoweave/autoweave-deployment
**Description**: Scripts de déploiement et configuration
```
autoweave-deployment/
├── k8s/
├── scripts/
│   ├── setup/
│   ├── dev/
│   └── cleanup/
├── docker/
└── config/
```

## 🔄 Plan de Migration

### Phase 1: Préparation (Jour 1)
1. **Créer l'organisation GitHub `autoweave`**
2. **Préparer la structure locale**
   ```bash
   mkdir -p ~/autoweave-repos
   cd ~/autoweave-repos
   ```

### Phase 2: Récupération depuis Archive (Jour 1-2)
```bash
# Script de récupération
#!/bin/bash
ARCHIVE_PATH="/home/gontrand/AutoWeave/archive"
REPOS_PATH="~/autoweave-repos"

# 1. Core
mkdir -p $REPOS_PATH/autoweave-core/src
cp -r $ARCHIVE_PATH/src/core $REPOS_PATH/autoweave-core/src/
cp -r $ARCHIVE_PATH/src/services $REPOS_PATH/autoweave-core/src/
cp -r $ARCHIVE_PATH/src/utils $REPOS_PATH/autoweave-core/src/

# 2. Memory
mkdir -p $REPOS_PATH/autoweave-memory/src
cp -r $ARCHIVE_PATH/src/memory/* $REPOS_PATH/autoweave-memory/src/
cp -r $ARCHIVE_PATH/scripts/mem0-bridge.py $REPOS_PATH/autoweave-memory/scripts/

# ... continuer pour chaque module
```

### Phase 3: Configuration des Dépendances (Jour 2-3)

#### Package.json Principal (autoweave-core)
```json
{
  "name": "@autoweave/core",
  "version": "1.0.0",
  "dependencies": {
    "@autoweave/memory": "^1.0.0",
    "@autoweave/integrations": "^1.0.0"
  }
}
```

#### Utilisation de npm workspaces
```json
{
  "workspaces": [
    "packages/*"
  ]
}
```

### Phase 4: Tests et Validation (Jour 3-4)
1. **Tests unitaires par module**
2. **Tests d'intégration inter-modules**
3. **Build et packaging**

### Phase 5: Publication GitHub (Jour 4-5)
```bash
# Pour chaque module
cd autoweave-core
git init
git add .
git commit -m "Initial commit: AutoWeave Core module"
git remote add origin https://github.com/autoweave/autoweave-core.git
git push -u origin main
```

## 📊 Matrice de Dépendances

| Module | Dépend de | Utilisé par |
|--------|-----------|--------------|
| core | memory, integrations | ui, cli, agents |
| memory | - | core, agents |
| integrations | - | core |
| agents | core, memory | ui |
| ui | core, agents | - |
| cache | - | memory, core |
| cli | core | - |
| deployment | - | tous |

## ✅ Checklist de Migration

- [ ] Organisation GitHub créée
- [ ] Repositories créés
- [ ] Code récupéré depuis archive/
- [ ] Dependencies configurées
- [ ] Tests passent pour chaque module
- [ ] CI/CD configuré
- [ ] Documentation mise à jour
- [ ] Semantic versioning appliqué
- [ ] npm packages publiés (optionnel)
- [ ] Docker images créées

## 🔒 Points de Contrôle Sécurité

1. **Aucun `rm -rf`** - Toujours copier
2. **Branches de sauvegarde** avant chaque étape
3. **Tests après chaque migration**
4. **Validation des dépendances**
5. **Scan de sécurité** (secrets, vulnérabilités)

## 📈 Avantages de cette Approche

1. **Modularité**: Chaque équipe peut travailler indépendamment
2. **Réutilisabilité**: Les modules peuvent être utilisés séparément
3. **Versioning**: Gestion fine des versions par module
4. **Performance**: Installation plus rapide (moins de deps)
5. **Maintenabilité**: Plus facile à comprendre et maintenir
6. **CI/CD**: Builds plus rapides et ciblés

## 🚀 Prochaines Étapes

1. Valider ce plan
2. Créer l'organisation GitHub
3. Commencer la récupération depuis archive/
4. Appliquer la fragmentation progressivement

---
*Plan créé le 11 Juillet 2025 - AutoWeave Fragmentation v2.0*