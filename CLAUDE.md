# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

**IMPORTANT INSTRUCTIONS:** Always read PLANNING.md at the start of every new conversation, check TASKS.md before starting your work, mark completed tasks to TASKS.md immediately, and add newly discovered tasks to TASKS.md when found.

**NEW**: Review IMPROVEMENT_ROADMAP.md for architecture improvements and long-term vision based on comprehensive analysis.

## Project Overview

AutoWeave is a revolutionary platform that democratizes AI agent creation. It's a self-weaving agent orchestrator that transforms natural language into production-ready AI agents deployed on Kubernetes via kagent.

### Core Capabilities
- **Natural Language to Agent**: Describe what you need in plain English, AutoWeave creates the agent
- **Kubernetes Native**: Automatic deployment to K8s clusters via kagent runtime
- **Intelligent Memory**: Hybrid memory system with mem0 (contextual) + Memgraph (structural)
- **Multi-Interface**: ChatUI, SillyTavern, Appsmith dashboard, AG-UI WebSocket
- **Protocol Support**: ANP (Agent Network Protocol), MCP (Model Context Protocol), OpenAPI 3.1
- **Configuration Intelligence**: Fresh package discovery across Docker Hub, NPM, Helm, GitHub

### Architecture Components

1. **Core Engine** (`/src/core/`)
   - `agent-weaver.js`: Main orchestration logic
   - `autoweave.js`: Core AutoWeave class
   - `config-intelligence.js`: AI-powered configuration generation

2. **Integration Layer** (`/src/kagent/`)
   - `bridge.js`: AutoWeave to kagent translation
   - `yaml-generator.js`: Kubernetes manifest generation

3. **Memory System** (`/src/memory/`)
   - `hybrid-memory.js`: Fusion of contextual and structural memory
   - `mem0-client.js`: Vector-based contextual memory
   - `graph-client.js`: Graph-based structural memory

4. **Agent Modules** (`/autoweave-repos/`)
   - `autoweave-core`: Core orchestration engine
   - `autoweave-agents`: Specialized agent implementations
   - `autoweave-backend`: API and service management
   - `autoweave-ui`: User interfaces and extensions
   - `autoweave-integrations`: Protocol bridges (ANP, MCP)
   - `autoweave-memory`: Hybrid memory system
   - `autoweave-deployment`: K8s deployment configs

5. **Protocols** (`/src/anp/`, `/src/mcp/`)
   - ANP Server: Agent-to-agent communication (port 8083)
   - MCP Server: LLM tool exposure (port 3002)
   - AG-UI: Dynamic WebSocket UI (port 3000/ws)

## Development Guidelines

### Code Style
- Use ES6+ JavaScript features
- Follow existing patterns in the codebase
- Implement proper error handling with retry logic
- Add comprehensive logging using the logger utility
- Write tests for new functionality

### File Organization
- Core logic in `/src/core/`
- API routes in `/src/routes/`
- Utilities in `/src/utils/`
- Agent-specific code in `/src/agents/`
- Memory components in `/src/memory/`
- Protocol implementations in `/src/anp/` and `/src/mcp/`

### Testing Strategy
- Unit tests in `/tests/unit/`
- Integration tests in `/tests/integration/`
- E2E tests in `/tests/e2e/`
- Run `npm test` before committing

### Environment Variables
Required:
- `OPENAI_API_KEY`: For agent generation
- `KAGENT_NAMESPACE`: K8s namespace (default: "default")
- `LOG_LEVEL`: Logging verbosity

Optional:
- `MEM0_SELF_HOSTED`: Enable self-hosted memory (default: true)
- `QDRANT_HOST`: Vector DB host
- `MEMGRAPH_HOST`: Graph DB host

### API Endpoints
- **Agents**: `/api/agents` (CRUD operations)
- **Memory**: `/api/memory/*` (search, metrics, topology)
- **Config**: `/api/config/*` (configuration generation)
- **Chat**: `/api/chat/completions` (OpenAI-compatible)
- **ANP**: `/agent/*` (protocol operations)
- **Health**: `/health`, `/api/memory/health`

### Working with Agent Modules

Each agent module in `/autoweave-repos/` is a separate npm package:

1. **autoweave-core**: Main orchestration engine
2. **autoweave-agents**: Agent implementations (debugging, integration, self-awareness)
3. **autoweave-backend**: API server and service management
4. **autoweave-ui**: User interfaces (ChatUI, SillyTavern, Appsmith)
5. **autoweave-integrations**: Protocol bridges and external integrations
6. **autoweave-memory**: Hybrid memory system
7. **autoweave-deployment**: Deployment scripts and K8s configs
8. **autoweave-cli**: Command-line interface

### Integration Points
- **kagent**: Kubernetes runtime for agents
- **mem0**: Self-hosted contextual memory
- **Memgraph**: Graph database for relationships
- **Qdrant**: Vector database for embeddings
- **OpenTelemetry**: Observability and tracing

### Common Tasks

1. **Create an Agent**:
   ```bash
   curl -X POST http://localhost:3000/api/agents \
     -H "Content-Type: application/json" \
     -d '{"description": "Your agent description"}'
   ```

2. **Test Memory System**:
   ```bash
   npm run health
   python scripts/mem0-bridge.py health
   ```

3. **Check Agent Status**:
   ```bash
   kubectl get pods -l autoweave.dev/generated=true
   ```

4. **View Logs**:
   ```bash
   npm run logs
   kubectl logs -l app=autoweave
   ```

### Debugging Tips
- Check `/logs/` directory for application logs
- Use `LOG_LEVEL=debug` for verbose output
- Monitor K8s pods with `kubectl get pods -w`
- Test individual components with unit tests
- Use the debugging agent for intelligent diagnosis

### Security Considerations
- Never commit API keys or secrets
- Use K8s secrets for sensitive data
- Implement proper RBAC for agents
- Validate all user inputs
- Follow OWASP best practices

## Project Philosophy

AutoWeave follows these principles:
1. **Simplicity First**: Natural language should be enough
2. **Production Ready**: Every agent is K8s-native
3. **Observable**: Full telemetry and monitoring
4. **Extensible**: Easy to add new capabilities
5. **Self-Improving**: Agents learn and optimize over time

## Quick Reference

- **Main Server**: `npm start` (port 3000)
- **Development**: `npm run dev`
- **Tests**: `npm test`
- **ChatUI**: http://localhost:5173
- **SillyTavern**: http://localhost:8081
- **Appsmith**: http://localhost:8080
- **ANP Server**: http://localhost:8083
- **Health Check**: `npm run health`

Remember: AutoWeave transforms ideas into intelligent agents. Keep this vision in mind when contributing to the project.