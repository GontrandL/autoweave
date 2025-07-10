# AutoWeave

<div align="center">
  <h2>🌌 The Self-Weaving Agent Orchestrator</h2>
  <p><strong>Transform Natural Language into Production-Ready AI Agents</strong></p>
  
  [![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
  [![Node.js Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)](https://nodejs.org/)
  [![Kubernetes](https://img.shields.io/badge/kubernetes-native-blue)](https://kubernetes.io)
  [![ANP Protocol](https://img.shields.io/badge/ANP-1.0-purple)](docs/ANP-AG-UI-Implementation-Guide.md)
  
  <p><em>"We don't just orchestrate agents. We weave the future of autonomous intelligence."</em></p>
</div>

---

## 🎯 What is AutoWeave?

AutoWeave is a revolutionary platform that democratizes AI agent creation. Simply describe what you need in natural language, and AutoWeave automatically:

✨ **Generates** intelligent agent workflows  
🚀 **Deploys** to Kubernetes via kagent  
🔗 **Integrates** with existing APIs and services  
🧠 **Remembers** context with hybrid memory  
🤝 **Communicates** via standard protocols (ANP/MCP)  

**Example:** *"Create an agent that monitors my Kubernetes cluster and automatically scales based on custom business metrics"*

AutoWeave handles the complexity—you focus on the vision.

## 🌟 Key Features

### 🧠 AI Intelligence Ecosystem (NEW!)
- **6 Specialized Agents**: Diagnostic, Security, Analytics, Monitoring, Performance, Configuration
- **ML-Based Cache**: Redis cache with pattern recognition and auto-optimization
- **Self-Learning System**: Continuous performance improvement and optimization
- **95/100 Intelligence Score**: Exceptional self-awareness and system intelligence

### 🚀 Zero-Config Installation (NEW!)
- **One-Command Setup**: `curl -sSL https://get.autoweave.ai | bash --deploy-agents`
- **Multi-Platform**: Linux, macOS, Windows (WSL) support
- **Auto-Agent Deployment**: All 6 intelligence agents deployed automatically
- **Production Ready**: Enterprise-grade setup with monitoring and security

### 🧠 Intelligent Agent Creation
- **Natural Language Processing**: Describe agents in plain English
- **Automatic Workflow Generation**: AI-powered workflow synthesis
- **Smart Tool Selection**: Automatic capability matching
- **Production Deployment**: Direct to Kubernetes with full observability

### 🚀 Configuration Intelligence
- **Fresh Sources Discovery**: Real-time package version detection
- **Multi-Registry Support**: Docker Hub, NPM, Helm Charts, GitHub Container Registry
- **Intelligent Configuration**: Generate optimal configs with latest versions
- **GitOps Ready**: Automated GitOps patterns with best practices

### 🔗 Universal Integration
- **OpenAPI → Kubernetes**: Transform any API into a deployable agent
- **Protocol Support**: ANP, MCP, OpenAPI 3.1
- **Service Discovery**: Automatic tool and service detection
- **MCP Server**: Expose AutoWeave capabilities to LLMs

### 💾 Advanced Memory System
- **Hybrid Architecture**: Contextual (mem0) + Structural (Memgraph)
- **Self-Hosted**: Complete data privacy and control
- **Continuous Learning**: Agents that improve over time

### 🐛 Advanced Debugging
- **OpenTelemetry Integration**: Distributed tracing and metrics
- **Intelligent Diagnosis**: AI-powered issue analysis
- **Real-time Monitoring**: Live agent health tracking

### 🎛️ Multiple Interfaces
- **ChatUI**: Modern web interface (Port 5173)
- **SillyTavern**: Conversational agent creation (Port 8081)
- **Appsmith**: Visual dashboard (Port 8080)
- **AG-UI**: Dynamic WebSocket UI generation

### ⚡ Enterprise Ready
- **Kubernetes Native**: Built for cloud-scale deployment
- **GitOps Integration**: Automated deployment pipelines
- **Real-time Monitoring**: Prometheus metrics and observability
- **Security First**: RBAC, network policies, secret management

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        AUTOWEAVE ECOSYSTEM                       │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  │
│  │   AutoWeave     │  │  Integration    │  │     kagent      │  │
│  │   Core Engine   │──│  Agent Module   │──│   Runtime       │  │
│  │                 │  │                 │  │                 │  │
│  │ • Agent Weaver  │  │ • OpenAPI Parse │  │ • K8s Deploy    │  │
│  │ • MCP Discovery │  │ • Pydantic Gen  │  │ • Pod Mgmt      │  │
│  │ • ANP Server    │  │ • GitOps Flow   │  │ • Observability │  │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘  │
│           │                     │                     │         │
│           └─────────────────────┼─────────────────────┘         │
│                                 │                               │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │                      USER INTERFACES                        │  │
│  │                                                             │  │
│  │  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  │
│  │  │   ChatUI        │  │   SillyTavern   │  │    Appsmith     │  │
│  │  │ (Port 5173)     │  │  (Port 8081)    │  │  (Port 8080)    │  │
│  │  │                 │  │                 │  │                 │  │
│  │  │ • Web Interface │  │ • Chat-based    │  │ • Dashboard     │  │
│  │  │ • Direct API    │  │ • Extensions    │  │ • Monitoring    │  │
│  │  │ • OpenAI Compat │  │ • Slash Cmds    │  │ • Management    │  │
│  │  └─────────────────┘  └─────────────────┘  └─────────────────┘  │
│  └─────────────────────────────────────────────────────────────┘  │
│                                 │                               │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │                   KUBERNETES CLUSTER                        │  │
│  │                                                             │  │
│  │  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  │
│  │  │  Regular Agents │  │ Integration     │  │   Services      │  │
│  │  │  (AutoWeave)    │  │ Agents (APIs)   │  │  (Support)      │  │
│  │  │                 │  │                 │  │                 │  │
│  │  │ • NL Generated  │  │ • OpenAPI Based │  │ • Qdrant/Vector │  │
│  │  │ • Custom Logic  │  │ • Pydantic      │  │ • Memgraph      │  │
│  │  │ • Task Specific │  │ • Auto-validated│  │ • Prometheus    │  │
│  │  └─────────────────┘  └─────────────────┘  └─────────────────┘  │
│  └─────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

## 🌐 ANP & AG-UI Systems

### Agent Network Protocol (ANP)
- **Port**: 8083
- **Purpose**: Standardized agent-to-agent communication
- **Features**: OpenAPI 3.1 generation, task management, agent discovery
- **Endpoints**: `/agent`, `/agent/tasks`, `/agent/openapi/validate`

### Agent-GUI (AG-UI)
- **Port**: 3000 (WebSocket: `/ws`)
- **Purpose**: Dynamic user interface generation
- **Features**: Real-time events, template-based UI, session management
- **Event Types**: Chat, display, input, status, command

### Key URLs
- **AutoWeave API**: http://localhost:3000/api
- **ChatUI Interface**: http://localhost:5173
- **ANP Server**: http://localhost:8083
- **AG-UI WebSocket**: ws://localhost:3000/ws
- **SillyTavern**: http://localhost:8081
- **Appsmith Dashboard**: http://localhost:8080

## 🛠️ Prerequisites

- **Node.js**: 18.0.0 or higher
- **Python**: 3.8+ (for mem0 self-hosted)
- **Docker**: 20.0.0 or higher
- **Kubernetes cluster**: Local (Kind) or remote
- **OpenAI API Key**: For agent generation and embeddings

## 📦 Installation

### 1. Clone and Setup

```bash
git clone https://github.com/autoweave/autoweave.git
cd autoweave
npm install
```

### 2. Environment Setup

```bash
# Copy environment template
cp .env.example .env

# Edit .env with your OpenAI API key
nano .env
```

### 3. Setup kagent Cluster

```bash
# Run the automated setup script
npm run setup

# This will:
# - Install Kind and kubectl (if needed)
# - Create a local Kubernetes cluster
# - Install kagent
# - Deploy SillyTavern and Appsmith
# - Verify the setup
```

### 4. Deploy Memory System

```bash
# Deploy Qdrant and Memgraph for memory system
./scripts/setup-memory-system.sh

# Setup Python environment for mem0
python3 -m venv venv
source venv/bin/activate
pip install mem0ai langchain-memgraph
```

### 5. Setup Integration Agent Module (NEW! 🎉)

```bash
# Setup Python environment and CLI tools for Integration Agent
npm run setup-integration-agent

# This will:
# - Create dedicated Python virtual environment
# - Install OpenAPI parsing dependencies (openapi-core, pydantic)
# - Install Kubernetes validation tools (kubeconform, conftest)
# - Setup GitOps dependencies (gitpython, langchain)
# - Configure the Python bridge for OpenAPI → Kubernetes
```

### 6. Health Check

```bash
# Verify everything is working
npm run health

# Check memory system
source venv/bin/activate
python scripts/mem0-bridge.py health
```

## 🚀 Quick Start

### Creating Your First Agent

```bash
# Start the AutoWeave server
npm start

# Create an agent via API
curl -X POST http://localhost:3000/api/agents \
  -H "Content-Type: application/json" \
  -d '{"description": "Create a file processing agent that reads CSV files and generates reports"}'
```

### Using Configuration Intelligence

```bash
# Generate configuration with fresh package versions
curl -X POST http://localhost:3000/api/config/generate-with-fresh \
  -H "Content-Type: application/json" \
  -d '{
    "intent": "Deploy Redis with persistence and monitoring",
    "options": {"includeObservability": true}
  }'

# Search for packages across registries
curl -X POST http://localhost:3000/api/config/sources/search \
  -H "Content-Type: application/json" \
  -d '{"query": "postgresql"}'

# Check if your versions are outdated
curl -X POST http://localhost:3000/api/config/sources/check-outdated \
  -H "Content-Type: application/json" \
  -d '{"packages": [
    {"type": "helm", "name": "redis", "currentVersion": "17.0.0"}
  ]}'
```

### Using ChatUI Interface

```bash
# Access ChatUI at http://localhost:5173
# Direct integration with AutoWeave API
# Use natural language to create agents:
# "create agent for monitoring system logs"
```

### Using SillyTavern

```bash
# Access SillyTavern at http://localhost:8081
# 1. Configure AutoWeave as OpenAI-compatible API
# 2. Set endpoint to http://localhost:3000/api/chat
# 3. Use natural language to create agents:
#    "create agent for monitoring system logs"
```

### Using Appsmith Dashboard

```bash
# Access Appsmith at http://localhost:8080
# - Monitor agent status
# - View memory metrics
# - Manage system topology
```

### Using MCP Server

```bash
# AutoWeave exposes MCP tools at port 3002
# List available tools
curl http://localhost:3002/mcp/v1/tools

# Use create-config tool
curl -X POST http://localhost:3002/mcp/v1/tools/create-config \
  -H "Content-Type: application/json" \
  -d '{
    "intent": "Deploy PostgreSQL with replication",
    "options": {"platform": "kubernetes"}
  }'

# Find fresh sources
curl -X POST http://localhost:3002/mcp/v1/tools/find-fresh-sources \
  -H "Content-Type: application/json" \
  -d '{"packages": {"docker": ["nginx", "redis"], "helm": ["postgresql"]}}'
```

## 📚 Usage Examples

### 1. File Processing Agent

```bash
npm run create-agent -- --description "Create an agent that reads CSV files from a directory, processes the data, and generates summary reports"
```

### 2. Kubernetes Monitoring Agent

```bash
npm run create-agent -- --description "Create an agent that monitors Kubernetes pods in the default namespace and sends alerts when pods are not healthy"
```

### 3. Development Assistant Agent

```bash
npm run create-agent -- --description "Create an agent that analyzes code repositories, identifies potential issues, and suggests improvements"
```

### 4. Integration Agent - OpenAPI to Kubernetes 🎯

#### Via REST API

```bash
# Create an integration agent from a Pet Store API
curl -X POST http://localhost:3000/api/agents/integration \
  -H "Content-Type: application/json" \
  -d '{
    "openapi_url": "https://petstore.swagger.io/v2/swagger.json",
    "target_namespace": "petstore",
    "git_repo": "https://github.com/myorg/k8s-deployments",
    "deploy_config": {
      "replicas": 3,
      "resources": {
        "requests": { "memory": "128Mi", "cpu": "100m" },
        "limits": { "memory": "512Mi", "cpu": "500m" }
      }
    }
  }'
```

#### Via ChatUI Interface

```bash
# Access ChatUI at http://localhost:5173
# Use natural language:
"Create an integration agent for the Stripe API at https://api.stripe.com/openapi.json and deploy it to the payments namespace"
```

#### Via SillyTavern

```bash
# Access SillyTavern at http://localhost:8081
# Use conversational commands:
"I need to integrate the GitHub API into my Kubernetes cluster. Can you create an agent for https://api.github.com/openapi.json?"
```

### 5. Integration Agent - Advanced Workflow

```bash
# Create an integration agent with full GitOps pipeline
curl -X POST http://localhost:3000/api/agents/integration \
  -H "Content-Type: application/json" \
  -d '{
    "openapi_url": "https://api.shopify.com/admin/api/2023-10/openapi.json",
    "target_namespace": "ecommerce",
    "git_repo": "https://github.com/myorg/shopify-k8s",
    "deploy_config": {
      "replicas": 2,
      "ingress": {
        "enabled": true,
        "host": "shopify.mycompany.com",
        "tls": true
      },
      "secrets": {
        "api_key": "shopify-api-key",
        "webhook_secret": "shopify-webhook-secret"
      }
    }
  }'
```

## 🔧 Development Commands

```bash
# Development server with auto-reload
npm run dev

# Run tests
npm test
npm run test:e2e
npm run test:coverage

# Linting
npm run lint
npm run lint:fix

# kagent UI access
npm run dev:ui

# Clean up test resources
npm run dev:clean
```

## 📖 API Reference

### Core Agent Endpoints

#### POST /api/agents
Create and deploy a new agent

**Request Body:**
```json
{
  "description": "Natural language description of the agent"
}
```

**Response:**
```json
{
  "workflow": { ... },
  "deployment": { ... },
  "status": "deployed"
}
```

#### GET /api/agents/:id
Get agent status

**Response:**
```json
{
  "id": "agent-123",
  "name": "file-processor",
  "status": "Running",
  "createdAt": "2023-12-01T10:00:00Z",
  "kagentDetails": { ... }
}
```

#### GET /api/agents
List all agents

#### DELETE /api/agents/:id
Delete an agent

### Integration Agent Endpoints 🎯

#### POST /api/agents/integration
Create an integration agent from OpenAPI specification

**Request Body:**
```json
{
  "openapi_url": "https://api.example.com/openapi.json",
  "target_namespace": "my-namespace",
  "git_repo": "https://github.com/myorg/k8s-deployments",
  "deploy_config": {
    "replicas": 3,
    "resources": {
      "requests": { "memory": "128Mi", "cpu": "100m" },
      "limits": { "memory": "512Mi", "cpu": "500m" }
    },
    "ingress": {
      "enabled": true,
      "host": "api.mycompany.com",
      "tls": true
    }
  }
}
```

**Response:**
```json
{
  "success": true,
  "plan": {
    "type": "reasoning",
    "content": "Integration plan with AI-powered analysis",
    "estimatedDuration": "15 minutes"
  },
  "openAPISpec": {
    "openapi": "3.0.0",
    "info": { "title": "My API", "version": "1.0.0" },
    "paths": { ... }
  },
  "pydanticModels": {
    "modelsCode": "class MyModel(BaseModel):\n    name: str\n    id: int",
    "modelsInfo": { "models": ["MyModel"] }
  },
  "kubernetesManifests": {
    "deployment": { "apiVersion": "apps/v1", "kind": "Deployment" },
    "service": { "apiVersion": "v1", "kind": "Service" },
    "ingress": { "apiVersion": "networking.k8s.io/v1", "kind": "Ingress" }
  },
  "deploymentResult": {
    "gitOpsCommit": "abc123",
    "argocdApplication": "my-api-integration",
    "deploymentStatus": "synced"
  },
  "duration": 45000,
  "timestamp": "2023-12-01T10:00:00Z"
}
```

#### GET /api/agents/integration
List all integration agents

**Response:**
```json
{
  "success": true,
  "agents": [
    {
      "id": "integration-123",
      "name": "petstore-integration",
      "status": "running",
      "namespace": "petstore",
      "createdAt": "2023-12-01T10:00:00Z",
      "openAPIUrl": "https://petstore.swagger.io/v2/swagger.json"
    }
  ],
  "count": 1
}
```

#### GET /api/agents/integration/:id
Get integration agent status

**Response:**
```json
{
  "id": "integration-123",
  "name": "petstore-integration",
  "status": "running",
  "namespace": "petstore",
  "createdAt": "2023-12-01T10:00:00Z",
  "openAPIUrl": "https://petstore.swagger.io/v2/swagger.json",
  "kubernetesStatus": {
    "deployment": "Ready",
    "service": "Active",
    "ingress": "Ready"
  }
}
```

#### DELETE /api/agents/integration/:id
Delete an integration agent

**Response:**
```json
{
  "success": true,
  "agentId": "integration-123",
  "deletedAt": "2023-12-01T10:00:00Z"
}
```

#### GET /api/agents/integration/metrics
Get integration agent metrics

**Response:**
```json
{
  "success": true,
  "metrics": {
    "totalIntegrations": 10,
    "successfulIntegrations": 8,
    "failedIntegrations": 2,
    "averageDuration": 42000,
    "apiComplexityDistribution": {
      "simple": 3,
      "moderate": 5,
      "complex": 2
    },
    "namespaceDistribution": {
      "default": 2,
      "production": 3,
      "staging": 3,
      "development": 2
    },
    "timestamp": "2023-12-01T10:00:00Z"
  }
}
```

### Chat & Completion Endpoints

#### POST /api/chat
Legacy chat endpoint

#### POST /api/chat/completions
OpenAI-compatible chat endpoint for SillyTavern and ChatUI

```json
{
  "messages": [
    {"role": "user", "content": "create agent for file processing"}
  ],
  "model": "gpt-3.5-turbo",
  "max_tokens": 1000
}
```

### Memory API

#### POST /api/memory/search
Search hybrid memory (contextual + structural)

#### GET /api/memory/health
Check memory system health

#### POST /api/memory/agent/:id/memory
Add memory for specific agent

#### GET /api/memory/metrics
Get memory system metrics

#### GET /api/memory/system/topology
Get system topology and relationships

## 🧪 Testing

### Unit Tests
```bash
npm run test
```

### Integration Tests
```bash
npm run test:integration
```

### End-to-End Tests
```bash
npm run test:e2e
```

### Coverage Report
```bash
npm run test:coverage
```

## 🔍 Monitoring

### Health Checks
```bash
# System health
npm run health

# API health
curl http://localhost:3000/health
```

### Logs
```bash
# AutoWeave logs
npm start

# kagent logs
kubectl logs -n kagent-system -l app=kagent-controller

# Agent logs
kubectl logs -l autoweave.dev/generated=true
```

## 🛠️ Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `OPENAI_API_KEY` | - | OpenAI API key (required) |
| `PORT` | 3000 | AutoWeave server port |
| `LOG_LEVEL` | info | Logging level (debug, info, warn, error) |
| `KAGENT_NAMESPACE` | default | Kubernetes namespace for agents |
| `KAGENT_TIMEOUT` | 30000 | Timeout for kagent operations |
| `MCP_DISCOVERY_ENABLED` | true | Enable MCP server discovery |
| `MEM0_SELF_HOSTED` | true | Enable self-hosted mem0 |
| `QDRANT_HOST` | qdrant-service | Qdrant vector database host |
| `MEMGRAPH_HOST` | memgraph-service | Memgraph graph database host |
| `MEMORY_FUSION_WEIGHT` | 0.5 | Weight for memory fusion algorithm |

### Configuration Files

- `config/autoweave/config.js` - Main configuration
- `config/autoweave/config.test.js` - Test configuration
- `jest.config.js` - Test runner configuration

## 🐛 Troubleshooting

### Common Issues

#### 1. kagent Not Found
```bash
# Install kagent
curl -fsSL https://raw.githubusercontent.com/kagent-dev/kagent/main/scripts/get-kagent | bash

# Add to PATH
export PATH=$PATH:$HOME/.local/bin
```

#### 2. Kind Cluster Issues
```bash
# Delete and recreate cluster
kind delete cluster --name autoweave
npm run setup
```

#### 3. OpenAI API Issues
```bash
# Check API key
echo $OPENAI_API_KEY

# Test API connection
curl -H "Authorization: Bearer $OPENAI_API_KEY" https://api.openai.com/v1/models
```

#### 4. Port Conflicts
```bash
# Change port in .env
PORT=3001

# Or specify when starting
PORT=3001 npm start
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit your changes: `git commit -m 'Add amazing feature'`
4. Push to the branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

### Development Setup

```bash
# Install dependencies
npm install

# Setup development environment
npm run setup

# Run tests
npm test

# Start development server
npm run dev
```

## 🔌 API Reference - Configuration Intelligence

### Configuration Generation

#### POST /api/config/generate-with-fresh
Generate intelligent configuration with fresh package versions

**Request:**
```json
{
  "intent": "Deploy Redis with persistence and monitoring",
  "options": {
    "platform": "kubernetes",
    "includeObservability": true,
    "namespace": "redis-system"
  }
}
```

**Response:**
```json
{
  "success": true,
  "configuration": {
    "name": "redis-deployment",
    "metadata": {
      "versions": {
        "docker": {"redis": {"latest": "8.0.3"}},
        "helm": {"redis": {"latestVersion": "21.2.9"}}
      }
    },
    "gitopsLabels": {
      "autoweave.io/generated": "true",
      "autoweave.io/version": "1.0.0"
    },
    "observability": {
      "metrics": {"enabled": true, "port": 9090},
      "tracing": {"enabled": true, "exporter": "otlp"}
    }
  }
}
```

### Fresh Sources Discovery

#### GET /api/config/sources/latest/:type/:name
Get latest version information for a specific package

**Parameters:**
- `type`: docker | npm | helm | github
- `name`: Package name

**Example:** `GET /api/config/sources/latest/helm/postgresql`

#### POST /api/config/sources/search
Search packages across multiple registries

**Request:**
```json
{
  "query": "redis",
  "options": {
    "includeDocker": true,
    "includeHelm": true
  }
}
```

#### POST /api/config/sources/check-outdated
Check if package versions are outdated

**Request:**
```json
{
  "packages": [
    {"type": "docker", "name": "nginx", "currentVersion": "1.19.0"},
    {"type": "helm", "name": "redis", "currentVersion": "17.0.0"}
  ]
}
```

### MCP Tools

#### GET http://localhost:3002/mcp/v1/tools
List all available MCP tools

#### POST http://localhost:3002/mcp/v1/tools/:toolName
Execute a specific MCP tool

**Available Tools:**
- `create-config`: Generate configuration from intent
- `find-fresh-sources`: Find latest package versions
- `search-package`: Search across registries
- `check-outdated`: Version comparison
- `generate-gitops`: Create GitOps manifests

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [kagent](https://github.com/kagent-dev/kagent) - Kubernetes native agent runtime
- [OpenAI](https://openai.com) - AI model provider
- [Kubernetes](https://kubernetes.io) - Container orchestration
- [Kind](https://kind.sigs.k8s.io) - Local Kubernetes clusters

## 📚 Documentation

- **[Integration Agent Module](docs/Integration-Agent-Module.md)** - Complete guide for OpenAPI to Kubernetes agent transformation
- **[Module Integration Agent Study](docs/Module%20Integration%20Agent.md)** - Technical specification and implementation guide
- **[API Reference](docs/api-reference.md)** - Comprehensive API documentation
- **[Architecture Guide](docs/architecture.md)** - System architecture and design patterns
- **[Contributing Guide](CONTRIBUTING.md)** - How to contribute to AutoWeave

## 🔧 Advanced Configuration

### Integration Agent Configuration

```javascript
// config/integration-agent.js
module.exports = {
  python: {
    executable: 'python3',
    virtualEnv: './integration-agent-env',
    timeout: 30000
  },
  kubernetes: {
    namespace: 'default',
    timeout: 60000,
    validation: {
      kubeconform: true,
      conftest: true
    }
  },
  gitops: {
    enabled: true,
    defaultBranch: 'main',
    commitMessage: 'feat: Add integration agent deployment',
    argoCd: {
      enabled: true,
      namespace: 'argocd'
    }
  },
  ai: {
    orchestration: {
      enabled: true,
      reasoning: true,
      optimization: true
    }
  },
  metrics: {
    enabled: true,
    port: 9090,
    path: '/metrics'
  }
};
```

### Memory System Configuration

```javascript
// config/memory.js
module.exports = {
  mem0: {
    selfHosted: true,
    qdrant: {
      host: 'qdrant-service',
      port: 6333,
      collection: 'autoweave-memory'
    }
  },
  memgraph: {
    host: 'memgraph-service',
    port: 7687,
    database: 'autoweave'
  },
  fusion: {
    enabled: true,
    weight: 0.5,
    threshold: 0.7
  }
};
```

## 📞 Support

- **Issues**: [GitHub Issues](https://github.com/autoweave/autoweave/issues)
- **Discussions**: [GitHub Discussions](https://github.com/autoweave/autoweave/discussions)
- **Email**: support@autoweave.dev
- **Integration Agent Help**: [Integration Agent Documentation](docs/Integration-Agent-Module.md)

---

**AutoWeave** - Transforming natural language into cloud-native AI agents 🚀

*Now with advanced Integration Agent Module for OpenAPI to Kubernetes transformation!*