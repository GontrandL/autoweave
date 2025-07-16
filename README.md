# AutoWeave

<div align="center">
  <h2>🌌 The Self-Weaving Agent Orchestrator</h2>
  <p><strong>Transform Natural Language into Production-Ready AI Agents</strong></p>
  
  [![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
  [![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue)](https://www.typescriptlang.org/)
  [![Node.js Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)](https://nodejs.org/)
  [![Kubernetes](https://img.shields.io/badge/kubernetes-native-blue)](https://kubernetes.io)
  [![OpenTelemetry](https://img.shields.io/badge/OpenTelemetry-Integrated-orange)](https://opentelemetry.io/)
  [![GraphQL](https://img.shields.io/badge/GraphQL-Federation-pink)](https://graphql.org/)
  [![Status](https://img.shields.io/badge/Status-74%25%20Production%20Ready-yellow)](https://github.com/autoweave/autoweave)
  
  <p><em>"We don't just orchestrate agents. We weave the future of autonomous intelligence."</em></p>
</div>

---

## 🎯 What is AutoWeave?

AutoWeave is a revolutionary platform that democratizes AI agent creation with enterprise-grade infrastructure. Simply describe what you need in natural language, and AutoWeave automatically:

✨ **Generates** intelligent agent workflows with TypeScript  
🚀 **Deploys** to Kubernetes with comprehensive observability  
🔗 **Integrates** with existing APIs via GraphQL federation  
🧠 **Remembers** context with hybrid memory systems  
🤝 **Communicates** via standard protocols (ANP/MCP/OpenTelemetry)  
🔌 **Detects** USB devices with hot-plug support  
⚡ **Processes** jobs with BullMQ queue management  
📊 **Monitors** everything with Grafana stack  

**Example:** *"Create an agent that monitors my Kubernetes cluster and automatically scales based on custom business metrics"*

AutoWeave handles the complexity—you focus on the vision.

## 🌟 Key Features

### 🔧 Enterprise Infrastructure (NEW!)
- **TypeScript Core**: Full TypeScript migration with modern build systems
- **USB Hot-Plug**: Real-time device detection with <50ms latency
- **Plugin System**: Secure VM2 sandbox with hot-swap capabilities
- **BullMQ Queues**: Scalable job processing with multi-queue support
- **GraphQL Federation**: WunderGraph Cosmo with JWT authentication
- **Multi-UI System**: Admin, Dev Studio, and User interfaces

### 🎨 Modern UI Ecosystem (LATEST!)
- **shadcn/ui Integration**: CLI-powered component generation with 15+ components
- **GraphQL Codegen**: Type-safe hooks with automatic code generation
- **Storybook Documentation**: Interactive component playground with visual testing
- **Theme System**: Comprehensive dark/light mode with AutoWeave branding
- **v0 by Vercel Ready**: AI-powered UI generation integration planned
- **Responsive Design**: Mobile-first approach with accessibility compliance

### 📊 Production Observability (NEW!)
- **OpenTelemetry**: Distributed tracing with <1% overhead
- **Grafana Stack**: Tempo, Loki, Prometheus integration
- **SLI/SLO Monitoring**: Real-time compliance tracking
- **Tenant Isolation**: Multi-tenant security and monitoring
- **Performance Intelligence**: Automatic optimization recommendations

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
- **Redis ML Cache**: Intelligent caching with pattern recognition

### 🎛️ Multiple Interfaces
- **Admin UI**: Management interface (Next.js 15)
- **Dev Studio**: Development tools (Next.js 15)
- **User UI**: End-user interface (Next.js 15)
- **GraphQL Playground**: API testing and exploration

### ⚡ Enterprise Ready
- **Kubernetes Native**: Built for cloud-scale deployment
- **Security First**: RBAC, JWT auth, tenant isolation
- **Multi-Architecture**: Docker builds for x86_64 and ARM64
- **Quality Engineering**: SonarCloud integration with 60% test coverage

## 📦 Monorepo Structure

AutoWeave is organized as a modular monorepo with specialized packages:

```
packages/
├── core/                   # Core engine and orchestration (TypeScript)
├── memory/                 # Hybrid memory system (mem0 + Memgraph)
├── agents/                 # Collection of intelligent agents
├── usb-daemon/            # USB hot-plug detection system
├── plugin-loader/         # Secure plugin loading with VM2 sandbox
├── job-queue/             # BullMQ job processing system
├── graphql-gateway/       # GraphQL federation with WunderGraph Cosmo
├── observability/         # OpenTelemetry + Grafana stack
├── integrations/          # MCP, ANP, and kagent integrations
├── backend/               # API server and routes
├── cli/                   # Command-line interface
├── deployment/            # Kubernetes manifests and Helm charts
└── shared/                # Shared utilities and types

apps/
├── admin-ui/              # Admin interface (Next.js 15)
├── dev-studio/            # Development tools (Next.js 15)
└── user-ui/               # End-user interface (Next.js 15)
```

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    AUTOWEAVE ECOSYSTEM v2.0                     │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  │
│  │   Next.js 15    │  │   GraphQL       │  │  Observability  │  │
│  │   Frontend      │──│   Gateway       │──│  Stack (OTel)   │  │
│  │   (3 Apps)      │  │  (WunderGraph)  │  │  (Grafana)      │  │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘  │
│           │                     │                     │         │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  │
│  │   USB Daemon    │  │   Plugin        │  │   BullMQ        │  │
│  │   (Hot-Plug)    │──│   Loader        │──│   Queues        │  │
│  │   <50ms         │  │   (VM2)         │  │   (Redis)       │  │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘  │
│           │                     │                     │         │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │                    CORE AUTOWEAVE ENGINE                    │  │
│  │                                                             │  │
│  │  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  │
│  │  │   TypeScript    │  │   Memory        │  │   Agents        │  │
│  │  │   Core          │  │   System        │  │   Runtime       │  │
│  │  │   (Orchestration)│  │   (Hybrid)      │  │   (Sub-Agents)  │  │
│  │  └─────────────────┘  └─────────────────┘  └─────────────────┘  │
│  └─────────────────────────────────────────────────────────────┘  │
│                                 │                               │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │                   KUBERNETES CLUSTER                        │  │
│  │                                                             │  │
│  │  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  │
│  │  │  Intelligence   │  │  Infrastructure │  │   Services      │  │
│  │  │  Agents         │  │  Components     │  │  (Support)      │  │
│  │  │                 │  │                 │  │                 │  │
│  │  │ • Multi-Agent   │  │ • Docker Images │  │ • Tempo/Loki    │  │
│  │  │ • Orchestration │  │ • Helm Charts   │  │ • Prometheus    │  │
│  │  │ • Production    │  │ • Multi-Arch    │  │ • Quality Gates │  │
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
- **Admin UI**: http://localhost:3001
- **Dev Studio**: http://localhost:3002
- **User UI**: http://localhost:3003
- **GraphQL Gateway**: http://localhost:4000
- **ANP Server**: http://localhost:8083
- **AG-UI WebSocket**: ws://localhost:3000/ws

## 🛠️ Prerequisites

- **Node.js**: 18.0.0 or higher
- **TypeScript**: 5.0+ (automatically installed)
- **Docker**: 20.0.0 or higher
- **Kubernetes cluster**: Local (Kind) or remote
- **Redis**: For BullMQ queues and caching
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

# Using CLI
npx autoweave create-agent "Create a file processing agent that converts CSV to JSON"

# Using API
curl -X POST http://localhost:3000/api/agents \
  -H "Content-Type: application/json" \
  -d '{"description": "Create a file processing agent that converts CSV to JSON"}'

# Using ChatUI
# Navigate to http://localhost:5173
```

### Example: Integration Agent (NEW!)

```bash
# Create an agent from OpenAPI specification
npx autoweave integrate-api https://petstore.swagger.io/v2/swagger.json

# Create an agent from GitHub Actions workflow
npx autoweave integrate-github https://github.com/user/repo/.github/workflows/ci.yml

# Create an agent from Helm chart
npx autoweave integrate-helm https://charts.bitnami.com/bitnami/postgresql
```

### UI Development (NEW!)

```bash
# UI Component Development
cd packages/ui

# Start Storybook for component development
pnpm run storybook
# Open http://localhost:6006

# Generate new components with shadcn/ui
pnpm run ui:add button
pnpm run ui:add form

# GraphQL development with type-safe hooks
cd packages/graphql
pnpm run codegen        # Generate types and hooks
pnpm run codegen:watch  # Watch mode for development

# Build UI package
pnpm run build
```

### Available Interfaces

1. **Admin UI** (http://localhost:3001)
   - System administration and configuration
   - User management and permissions
   - Infrastructure monitoring

2. **Dev Studio** (http://localhost:3002)
   - Agent development and testing
   - Plugin management
   - Performance profiling

3. **User UI** (http://localhost:3003)
   - End-user agent interaction
   - Task management
   - Results visualization

4. **GraphQL Gateway** (http://localhost:4000)
   - Unified API endpoint
   - Real-time subscriptions
   - GraphQL Playground

5. **ANP Server** (http://localhost:8083)
   - Agent discovery
   - Task management
   - OpenAPI validation

## 🧩 Core Components

### Agent Weaver
Transforms natural language descriptions into executable agent workflows using advanced LLM processing.

### Hybrid Memory System
- **Contextual Memory (mem0)**: Stores conversations, user preferences, and session data
- **Structural Memory (Memgraph)**: Maintains relationships, knowledge graphs, and ontologies
- **Redis ML Cache**: Intelligent caching with pattern recognition

### Protocol Support
- **ANP (Agent Network Protocol)**: RESTful API for agent communication
- **MCP (Model Context Protocol)**: Integration with AI models
- **AG-UI (Agent GUI)**: Dynamic UI generation via WebSocket

### Pre-built Systems
1. **USB Daemon**: Real-time device detection and management
2. **Plugin Loader**: Secure plugin execution in VM2 sandbox
3. **BullMQ Queues**: Distributed job processing system
4. **GraphQL Gateway**: Federated API with authentication
5. **Observability Stack**: OpenTelemetry + Grafana monitoring
6. **Multi-UI System**: Admin, Dev Studio, and User interfaces

## 🔧 Development

### Setting up for development

```bash
# Clone the repository
git clone https://github.com/autoweave/autoweave.git
cd autoweave

# Install dependencies
npm install

# Link workspace packages
npm run bootstrap

# Run in development mode
npm run dev
```

### Running tests

```bash
# Unit tests
npm test

# Integration tests
npm run test:integration

# E2E tests
npm run test:e2e

# Test coverage
npm run test:coverage
```

### Building for production

```bash
# Build all packages
npm run build

# Build specific package
npm run build --workspace=@autoweave/core

# Run production build
npm run start:prod
```

## 📚 Documentation

- [Architecture Overview](docs/ARCHITECTURE.md)
- [API Reference](docs/API.md)
- [Deployment Guide](docs/DEPLOYMENT.md)
- [Agent Development](docs/AGENT_DEVELOPMENT.md)
- [Memory System](docs/MEMORY_SYSTEM.md)
- [Protocol Specifications](docs/PROTOCOLS.md)
- [Integration Agent Module](docs/Integration-Agent-Module.md)
- [ANP & AG-UI Implementation](docs/ANP-AG-UI-Implementation-Guide.md)
- [Audit Results](TASKS_AUDIT_RESULTS.md) - Current implementation status
- [Next Priorities](NEXT_PRIORITIES.md) - Immediate action items

## 🛣️ Roadmap

### Phase 1: Foundation (✅ Complete)
- Core agent creation engine
- Hybrid memory system
- Basic protocol support
- CLI and Web UI

### Phase 2: Enterprise Infrastructure (✅ Complete)
- TypeScript migration with modern build systems
- USB hot-plug detection with <50ms latency
- Plugin system with VM2 sandbox security
- BullMQ job queues with Redis backend
- GraphQL federation with WunderGraph Cosmo
- OpenTelemetry observability with <1% overhead
- Multi-UI system with Next.js 15

### Phase 3: Production Ready (🔶 74% Complete)
- ✅ E2E test configuration with Playwright
- ✅ Security pipeline with CodeQL and Dependabot
- ✅ Open source intelligence agents
- ⚠️ Real E2E test implementation
- ⚠️ Kubernetes production validation
- ⚠️ Secrets management security
- ⚠️ Test coverage reporting

### Phase 4: Ecosystem (📅 Planned)
- Plugin marketplace and discovery
- Advanced AI agent templates
- Multi-cloud deployment options
- Enterprise security features
- Advanced analytics and insights

## 🤝 Community

- **Discord**: [Join our community](https://discord.gg/autoweave)
- **GitHub Discussions**: [Discussions](https://github.com/autoweave/autoweave/discussions)
- **Twitter**: [@autoweave](https://twitter.com/autoweave)
- **Blog**: [blog.autoweave.dev](https://blog.autoweave.dev)

## 📄 License

AutoWeave is open source software licensed under the [MIT License](LICENSE).

## 🙏 Acknowledgments

- OpenAI for GPT models
- Kubernetes community
- kagent framework
- mem0 and Qdrant teams
- Memgraph team
- All our contributors

## 📞 Support

- **Issues**: [GitHub Issues](https://github.com/autoweave/autoweave/issues)
- **Discussions**: [GitHub Discussions](https://github.com/autoweave/autoweave/discussions)
- **Email**: support@autoweave.dev
- **Integration Agent Help**: [Integration Agent Documentation](docs/Integration-Agent-Module.md)
- **Current Status**: [Audit Results](TASKS_AUDIT_RESULTS.md) - Real implementation status
- **Next Steps**: [Priorities](NEXT_PRIORITIES.md) - Immediate action items

---

<div align="center">
  <p>Built with ❤️ by the AutoWeave Team</p>
  <p>⭐ Star us on GitHub!</p>
  <p><strong>AutoWeave</strong> - Transforming natural language into cloud-native AI agents 🚀</p>
  <p><em>Now with advanced Integration Agent Module for OpenAPI to Kubernetes transformation!</em></p>
</div>