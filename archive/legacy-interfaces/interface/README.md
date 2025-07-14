# AutoWeave Complete Project Management Interface

Cette interface combine HuggingFace Chat-UI avec un ensemble complet d'outils pour la gestion de projet, l'orchestration d'agents, et la collaboration en temps réel.

## 🏗️ Architecture

```
AutoWeave Project Management Suite:
├── autoweave-interface/          # HuggingFace Chat-UI (SvelteKit)
├── rasa-integration/             # Rasa NLU pour compréhension naturelle
├── project-components/           # Composants projet (kotaemon, Taskcafe, etc.)
├── monitoring-stack/             # Prometheus, Grafana, EFK
├── collaboration-tools/          # Yjs, temps réel, notifications
└── k8s-deployments/             # Déploiements Kubernetes
```

## 🚀 Composants Intégrés

### 1. Chat & AI
- **HuggingFace Chat-UI**: Interface conversationnelle moderne (SvelteKit)
- **Rasa NLU**: Compréhension du langage naturel
- **AutoWeave API**: Orchestration d'agents (existant)
- **AG-UI WebSocket**: Temps réel (existant)

### 2. Gestion de Fichiers & Contenu
- **kotaemon**: Navigation et visualisation multi-format
- **Système de mémoire hybride**: mem0 + GraphRAG (existant)
- **WizMap**: Visualisation embeddings WebGL

### 3. Visualisation & Workflows
- **Bluefish**: Diagrammes déclaratifs JavaScript
- **Graphologue**: Diagrammes LLM temps réel
- **React Flow**: Constructeur de workflows

### 4. Gestion de Projet
- **Taskcafe**: Task management GraphQL
- **Gitea**: Git forge léger
- **Yjs + svelt-yjs**: Collaboration temps réel

### 5. Monitoring & Analytics
- **Prometheus + Grafana**: Métriques système
- **EFK Stack**: Logs et recherche
- **Netdata**: Monitoring temps réel

## 📋 Phase d'Implémentation

### Phase 1: Foundation (Semaines 1-3)
- [x] Setup HuggingFace Chat-UI
- [ ] Configuration AutoWeave API
- [ ] Intégration Rasa NLU
- [ ] Bridge kotaemon

### Phase 2: Project Management (Semaines 4-6)
- [ ] Déploiement Taskcafe
- [ ] Intégration Gitea
- [ ] Configuration Yjs collaboration

### Phase 3: Visualisation (Semaines 7-9)
- [ ] Bluefish workflows
- [ ] Graphologue diagrammes
- [ ] WizMap embeddings

### Phase 4: Monitoring (Semaines 10-12)
- [ ] Prometheus + Grafana
- [ ] EFK stack
- [ ] Dashboards temps réel

## 🔧 Configuration

### Prérequis
- Node.js 18+
- Python 3.10+
- Kubernetes cluster
- Docker

### Installation
```bash
# 1. Interface principale
cd autoweave-interface
npm install

# 2. Rasa NLU
cd ../rasa-integration
pip install -r requirements.txt

# 3. Composants projet
cd ../project-components
./setup.sh

# 4. Monitoring
cd ../monitoring-stack
helm install prometheus ./prometheus-chart
```

## 📊 Statut du Projet

- **HuggingFace Chat-UI**: ✅ Cloné et configuré
- **Structure projet**: ✅ Créée
- **Rasa Integration**: 🔄 En cours
- **Project Components**: ⏳ En attente
- **Monitoring Stack**: ⏳ En attente
- **Collaboration Tools**: ⏳ En attente

## 🤝 Intégration avec AutoWeave

Cette interface s'intègre parfaitement avec l'écosystème AutoWeave existant :

- **API AutoWeave**: Endpoint principal (port 3002)
- **AG-UI WebSocket**: Temps réel natif
- **Mémoire hybride**: mem0 + GraphRAG
- **kagent**: Runtime Kubernetes
- **ANP**: Communication inter-agents

## 📝 Documentation

- [Configuration détaillée](./docs/configuration.md)
- [Guide développeur](./docs/development.md)
- [Déploiement Kubernetes](./docs/deployment.md)
- [Intégration API](./docs/api-integration.md)

## 🚀 Démarrage Rapide

```bash
# Lancer l'interface complète
./start-interface.sh

# Accès
- Interface principale: http://localhost:3000
- Taskcafe: http://localhost:3333
- Gitea: http://localhost:3001
- Grafana: http://localhost:3001
```

---

*AutoWeave Project Management Interface v1.0*
*Une interface complète pour l'orchestration d'agents IA et la gestion de projet*