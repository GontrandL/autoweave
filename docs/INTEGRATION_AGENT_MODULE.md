# AutoWeave Integration Agent Module

## 🎯 Vue d'ensemble

Le Module Integration Agent d'AutoWeave transforme automatiquement les spécifications OpenAPI en agents intelligents déployés sur Kubernetes. Il combine l'analyse d'API, la génération de code Python, l'orchestration Kubernetes et les workflows GitOps pour créer une solution complète d'intégration.

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    MODULE INTEGRATION AGENT                      │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  │
│  │   OpenAPI       │  │   Pydantic      │  │   LangChain     │  │
│  │   Parser        │  │   Generator     │  │  Orchestrator   │  │
│  │                 │  │                 │  │                 │  │
│  │ • Validation    │  │ • Model Gen     │  │ • AI Planning   │  │
│  │ • Analysis      │  │ • Type Safety   │  │ • Tool Calling  │  │
│  │ • Metadata      │  │ • Integration   │  │ • Reasoning     │  │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘  │
│           │                     │                     │         │
│           └─────────────────────┼─────────────────────┘         │
│                                 │                               │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │                 INTEGRATION AGENT CORE                      │  │
│  │                                                             │  │
│  │  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  │
│  │  │  K8s Manifest   │  │   GitOps        │  │   Metrics       │  │
│  │  │   Generator     │  │   Manager       │  │  Collector      │  │
│  │  │                 │  │                 │  │                 │  │
│  │  │ • YAML Gen      │  │ • Git Push      │  │ • Prometheus    │  │
│  │  │ • Validation    │  │ • Argo CD       │  │ • Performance   │  │
│  │  │ • Templates     │  │ • Automation    │  │ • Monitoring    │  │
│  │  └─────────────────┘  └─────────────────┘  └─────────────────┘  │
│  └─────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

## 🚀 Fonctionnalités

### 🔍 Analyse OpenAPI Avancée
- **Validation complète** : OpenAPI 3.0/3.1 avec `openapi-core`
- **Extraction de métadonnées** : Endpoints, schémas, authentification
- **Analyse de complexité** : Recommandations automatiques
- **Support multi-formats** : JSON, YAML, URL, fichiers locaux

### 🐍 Génération Python Automatique
- **Modèles Pydantic V2** : Type safety et validation runtime
- **Code d'intégration** : Client HTTP avec métriques Prometheus
- **Templates personnalisables** : Adaptés au contexte API
- **Documentation intégrée** : Auto-générée depuis OpenAPI

### ☸️ Déploiement Kubernetes Native
- **Manifests optimisés** : Deployment, Service, ConfigMap, ServiceMonitor
- **Validation multi-niveaux** : kubeconform, conftest, kubectl dry-run
- **Sécurité intégrée** : RBAC, Network Policies, Secrets
- **Observabilité complète** : Logs, métriques, traces

### 🔄 Pipeline GitOps Intégré
- **Git automation** : Clone, commit, push automatique
- **Argo CD integration** : Applications déclaratives
- **Validation continue** : Policies OPA avec conftest
- **Rollback automatique** : En cas d'échec de déploiement

### 🤖 Orchestration IA
- **Raisonnement structuré** : Planning intelligent des étapes
- **Tool calling** : Utilisation optimale des outils disponibles
- **Adaptation dynamique** : Réponse aux erreurs et contraintes
- **Recommandations contextuelles** : Basées sur l'analyse API

## 📋 Prérequis

### Environnement Système
```bash
# Node.js 18+ pour AutoWeave
node --version  # >= 18.0.0

# Python 3.8+ pour bridge Pydantic
python3 --version  # >= 3.8.0

# Docker pour conteneurisation
docker --version

# Kubernetes cluster (local ou distant)
kubectl cluster-info
```

### Outils CLI Requis
```bash
# kubeconform pour validation K8s
kubeconform --version

# conftest pour policies OPA
conftest --version

# Optionnel : Argo CD CLI
argocd version
```

## 🛠️ Installation

### 1. Setup automatique complet
```bash
# Depuis le répertoire AutoWeave
npm run setup-integration-agent
```

### 2. Setup manuel par étapes

#### Environnement Python
```bash
# Créer environnement virtuel
python3 -m venv integration-agent-env
source integration-agent-env/bin/activate

# Installer dépendances Python
pip install openapi-core==0.19.5 \
            pydantic==2.8.2 \
            datamodel-code-generator==0.25.6 \
            kubernetes==30.1.0 \
            langchain==0.2.14 \
            gitpython==3.1.43 \
            prometheus-client==0.20.0
```

#### Outils CLI
```bash
# kubeconform
curl -L https://github.com/yannh/kubeconform/releases/latest/download/kubeconform-linux-amd64.tar.gz | tar -xzf -
sudo mv kubeconform /usr/local/bin/

# conftest
curl -L https://github.com/open-policy-agent/conftest/releases/latest/download/conftest_Linux_x86_64.tar.gz | tar -xzf -
sudo mv conftest /usr/local/bin/
```

#### Dépendances Node.js
```bash
# Depuis le répertoire AutoWeave
npm install simple-git
```

### 3. Configuration environnement
```bash
# Activer l'environnement
source activate-integration-agent.sh

# Vérifier installation
python3 src/agents/integration-agent/python-bridge.py --help
```

## 🚀 Utilisation

### Via API REST

#### Créer un agent d'intégration
```bash
curl -X POST http://localhost:3000/api/agents/integration \
  -H "Content-Type: application/json" \
  -d '{
    "openapi_url": "https://petstore.swagger.io/v2/swagger.json",
    "target_namespace": "petstore",
    "git_repo": "https://github.com/myorg/gitops-repo.git",
    "deploy_config": {
      "replicas": 2,
      "resources": {
        "requests": { "cpu": "100m", "memory": "128Mi" },
        "limits": { "cpu": "500m", "memory": "512Mi" }
      }
    }
  }'
```

#### Lister les agents d'intégration
```bash
curl http://localhost:3000/api/agents/integration
```

#### Obtenir le statut d'un agent
```bash
curl http://localhost:3000/api/agents/integration/integration-agent-1
```

#### Métriques de performance
```bash
# Métriques JSON
curl http://localhost:3000/api/agents/integration/metrics

# Métriques Prometheus
curl http://localhost:3000/api/agents/integration/metrics/prometheus
```

### Via Interface Conversationnelle

#### ChatUI (port 5173)
```
Utilisateur: "Crée un agent d'intégration pour l'API Stripe avec déploiement en staging"

AutoWeave: "Je vais créer un agent d'intégration pour l'API Stripe. Voici mon plan :

1. 🔍 Analyser la spécification OpenAPI de Stripe
2. 🐍 Générer les modèles Pydantic pour les types Stripe
3. ☸️ Créer les manifests Kubernetes pour le namespace staging
4. 🔄 Configurer le pipeline GitOps pour le déploiement
5. 📊 Mettre en place la supervision avec Prometheus

Durée estimée : 20-30 minutes
Ressources requises : Cluster Kubernetes, accès Git, clés API Stripe

Voulez-vous procéder ?"
```

#### SillyTavern (port 8081)
```
/autoweave integration create --api=https://api.stripe.com/openapi.json --namespace=payments
```

### Via CLI Direct
```bash
# Utilisation du bridge Python
python3 src/agents/integration-agent/python-bridge.py parse \
  --spec https://api.github.com/schema/openapi.json

python3 src/agents/integration-agent/python-bridge.py generate \
  --spec ./examples/petstore-openapi.json \
  --output ./generated/petstore_models.py
```

## 📊 Exemple de Workflow Complet

### 1. Analyse de spécification
```json
{
  "spec_analysis": {
    "title": "Pet Store API",
    "version": "1.0.0",
    "complexity": "medium",
    "endpoints": 12,
    "schemas": 8,
    "authentication": ["bearer_token"],
    "patterns": ["REST API", "CRUD operations"],
    "recommendations": [
      "Consider implementing rate limiting",
      "Add health check endpoints",
      "Use consistent error responses"
    ]
  }
}
```

### 2. Génération de modèles Pydantic
```python
# Généré automatiquement
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime

class Pet(BaseModel):
    id: Optional[int] = Field(None, description="Unique identifier")
    name: str = Field(..., description="Pet name")
    category: Optional[Category] = None
    photo_urls: List[str] = Field(default=[], alias="photoUrls")
    tags: List[Tag] = Field(default=[])
    status: Optional[PetStatus] = None

class Category(BaseModel):
    id: Optional[int] = None
    name: Optional[str] = None

# Client d'intégration avec métriques
class PetStoreIntegration:
    def __init__(self, base_url: str, api_key: str):
        self.client = httpx.AsyncClient(base_url=base_url)
        self.api_key = api_key
    
    async def get_pets(self) -> List[Pet]:
        # Implémentation avec métriques Prometheus
        pass
```

### 3. Manifests Kubernetes
```yaml
# Déploiement principal
apiVersion: apps/v1
kind: Deployment
metadata:
  name: petstore-integration-agent
  namespace: petstore
  labels:
    autoweave.dev/agent-type: integration-agent
    autoweave.dev/api: petstore
spec:
  replicas: 2
  selector:
    matchLabels:
      app: petstore-integration
  template:
    spec:
      containers:
      - name: integration-agent
        image: autoweave/integration-agent:latest
        env:
        - name: PETSTORE_API_URL
          value: "https://petstore.swagger.io/v2"
        - name: PETSTORE_API_KEY
          valueFrom:
            secretKeyRef:
              name: petstore-credentials
              key: api-key
        ports:
        - containerPort: 8080
          name: http
        - containerPort: 9090
          name: metrics
        resources:
          requests:
            cpu: 100m
            memory: 128Mi
          limits:
            cpu: 500m
            memory: 512Mi

---
# Service pour exposition
apiVersion: v1
kind: Service
metadata:
  name: petstore-integration-service
  namespace: petstore
spec:
  selector:
    app: petstore-integration
  ports:
  - name: http
    port: 8080
    targetPort: 8080
  - name: metrics
    port: 9090
    targetPort: 9090

---
# ServiceMonitor pour Prometheus
apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  name: petstore-integration-metrics
  namespace: petstore
spec:
  selector:
    matchLabels:
      app: petstore-integration
  endpoints:
  - port: metrics
    interval: 30s
    path: /metrics
```

### 4. Application Argo CD
```yaml
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: autoweave-petstore-integration
  namespace: argocd
spec:
  project: default
  source:
    repoURL: https://github.com/myorg/gitops-repo.git
    path: manifests/petstore
    targetRevision: HEAD
  destination:
    server: https://kubernetes.default.svc
    namespace: petstore
  syncPolicy:
    automated:
      prune: true
      selfHeal: true
    syncOptions:
    - CreateNamespace=true
```

## 📈 Métriques et Observabilité

### Métriques Prometheus
```prometheus
# Métriques d'intégration
autoweave_integrations_total{status="success",api_type="rest"} 15
autoweave_integrations_total{status="failed",api_type="rest"} 2
autoweave_integration_duration_seconds_bucket{operation="full_integration",status="success",le="30"} 12

# Métriques API
autoweave_api_requests_total{endpoint="/pets",method="GET",status="success"} 1250
autoweave_openapi_specs_parsed_total{status="success",version="3.0.0"} 8

# Métriques Git
autoweave_git_operations_total{operation="push",status="success"} 15
autoweave_kubernetes_manifests_generated_total{type="deployment",namespace="petstore"} 1
```

### Dashboards Appsmith
- **Vue d'ensemble** : Agents actifs, taux de succès, performance
- **Détails agents** : Status, logs, métriques par agent
- **Analyse API** : Complexité, patterns, recommandations
- **GitOps status** : Déploiements, sync status, health

## 🔧 Configuration Avancée

### Variables d'environnement
```bash
# Core AutoWeave
export OPENAI_API_KEY="sk-your-openai-key"
export AUTOWEAVE_INTEGRATION_AGENT_ENABLED=true
export AUTOWEAVE_PYTHON_BRIDGE="/path/to/python-bridge.py"

# GitOps configuration
export AUTOWEAVE_GIT_USERNAME="autoweave-bot"
export AUTOWEAVE_GIT_EMAIL="autoweave@myorg.com"
export AUTOWEAVE_DEFAULT_GIT_REPO="https://github.com/myorg/gitops.git"

# Kubernetes configuration
export KUBECONFIG="/path/to/kubeconfig"
export AUTOWEAVE_DEFAULT_NAMESPACE="autoweave"

# Monitoring
export PROMETHEUS_ENABLED=true
export METRICS_PORT=9090
```

### Configuration des policies OPA
```rego
# conftest policy pour validation
package kubernetes.admission

deny[msg] {
    input.kind == "Deployment"
    not input.metadata.labels["autoweave.dev/agent-type"]
    msg := "Missing autoweave agent-type label"
}

deny[msg] {
    input.kind == "Deployment"
    not input.spec.template.spec.containers[_].resources.requests
    msg := "Resource requests must be specified"
}
```

## 🚨 Dépannage

### Erreurs courantes

#### Environnement Python non activé
```bash
# Symptôme
Error: Python bridge not available at /path/to/python-bridge.py

# Solution
source activate-integration-agent.sh
```

#### Validation OpenAPI échouée
```bash
# Symptôme
OpenAPIError: Invalid specification

# Debug
python3 src/agents/integration-agent/python-bridge.py validate \
  --spec https://problematic-api.com/openapi.json

# Solutions
- Vérifier la syntaxe OpenAPI
- Valider avec swagger-editor
- Utiliser une version compatible (3.0/3.1)
```

#### Échec de déploiement Kubernetes
```bash
# Symptôme
kubectl apply failed: validation error

# Debug
kubeconform -strict -summary manifests/
conftest test manifests/

# Solutions
- Corriger les erreurs de validation
- Vérifier les permissions RBAC
- Valider la connectivité cluster
```

#### GitOps push échec
```bash
# Symptôme
Git push failed: authentication failed

# Solutions
- Configurer les credentials Git
- Utiliser SSH keys ou tokens
- Vérifier les permissions repository
```

### Logs de debug
```bash
# Logs AutoWeave
tail -f logs/autoweave.log | grep IntegrationAgent

# Logs Python bridge
python3 src/agents/integration-agent/python-bridge.py parse \
  --spec test.json 2>&1 | grep ERROR

# Logs Kubernetes
kubectl logs -l autoweave.dev/agent-type=integration-agent -f
```

## 🎯 Cas d'Usage Avancés

### 1. Intégration Multi-API
```javascript
// Orchestration de plusieurs APIs liées
const integrations = await Promise.all([
  integrationAgent.createIntegrationAgent({
    openapi_url: 'https://api.payment.com/openapi.json',
    target_namespace: 'payments'
  }),
  integrationAgent.createIntegrationAgent({
    openapi_url: 'https://api.inventory.com/openapi.json',
    target_namespace: 'inventory'
  })
]);
```

### 2. Pipeline CI/CD Intégré
```yaml
# GitHub Actions workflow
name: Deploy Integration Agent
on:
  push:
    paths: ['apis/**.json']

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v3
    - name: Deploy Integration Agent
      run: |
        curl -X POST $AUTOWEAVE_API/agents/integration \
          -H "Authorization: Bearer $API_TOKEN" \
          -d @integration-config.json
```

### 3. Monitoring et Alerting
```yaml
# Prometheus alerting rules
groups:
- name: autoweave-integration-agents
  rules:
  - alert: IntegrationAgentDown
    expr: up{job="autoweave-integration"} == 0
    for: 5m
    annotations:
      summary: "Integration agent {{ $labels.instance }} is down"
      
  - alert: HighIntegrationFailureRate
    expr: rate(autoweave_integrations_total{status="failed"}[5m]) > 0.1
    for: 2m
    annotations:
      summary: "High integration failure rate detected"
```

## 🔮 Feuille de Route

### Prochaines Fonctionnalités (Q3 2025)
- **Support AsyncAPI** : Intégration d'APIs événementielles
- **Multi-cloud** : Déploiement AWS EKS, Azure AKS, GCP GKE
- **Agent Marketplace** : Partage d'agents préconfigurés
- **GraphQL Support** : Intégration d'APIs GraphQL
- **Advanced Security** : mTLS, Vault integration, SPIFFE/SPIRE

### Améliorations Long Terme
- **Edge Computing** : Déploiement sur edge clusters
- **Service Mesh** : Intégration Istio/Linkerd native
- **AI/ML Pipelines** : Intégration avec Kubeflow
- **Observability Advanced** : OpenTelemetry, Jaeger tracing

---

## 📞 Support et Contribution

- **Issues** : [GitHub Issues](https://github.com/autoweave/autoweave/issues)
- **Documentation** : [Wiki AutoWeave](https://github.com/autoweave/autoweave/wiki)
- **Community** : [Discord AutoWeave](https://discord.gg/autoweave)
- **Email** : integration-support@autoweave.dev

---

*Module Integration Agent - AutoWeave v0.1.0 | Transforming APIs into Intelligent Agents*