# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

**IMPORTANT INSTRUCTIONS:** Always read PLANNING.md at the start of every new conversation, check TASKS.md before starting your work, mark completed tasks to TASKS.md immediately, and add newly discovered tasks to TASKS.md when found.

**CRITICAL**: Review NEXT_PRIORITIES.md for current urgent priorities and TASKS_AUDIT_RESULTS.md for latest audit findings.

**NEW**: Review IMPROVEMENT_ROADMAP.md for architecture improvements and long-term vision based on comprehensive analysis.

**AUDIT STATUS (15 July 2025)**: Documentation has been fully updated with real implementation status. Current conformity: 74%. Next priorities focus on finalizing E2E tests, validating K8s deployment, and securing secrets management.

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

1. **Core Engine** (`/packages/core/src/`)
   - `autoweave.js`: Main orchestration logic
   - `agent-weaver.js`: Agent creation and management
   - `config-intelligence.js`: AI-powered configuration generation

2. **Memory System** (`/packages/memory/src/`)
   - `hybrid-memory.js`: Fusion of contextual and structural memory
   - `mem0-client.js`: Vector-based contextual memory
   - `graph-client.js`: Graph-based structural memory
   - `redis-ml-cache.js`: ML-powered caching layer

3. **Agent System** (`/packages/agents/src/`)
   - `debugging-agent.js`: Intelligent debugging assistant
   - `self-awareness-agent.js`: Self-monitoring and optimization
   - `integration-agent/`: External service integrations

4. **Backend Services** (`/packages/backend/src/`)
   - `routes/`: REST API endpoints
   - `services/`: Business logic and service layer
   - `index.js`: Express server setup

5. **Integrations** (`/packages/integrations/src/`)
   - `mcp/`: Model Context Protocol server
   - `anp/`: Agent Network Protocol (if implemented)

6. **CLI Tools** (`/packages/cli/src/`)
   - `create-agent.js`: Agent creation command

7. **Shared Utilities** (`/packages/shared/src/`)
   - `utils/`: Common utilities and helpers

8. **Deployment** (`/packages/deployment/src/`)
   - `helm/`: Helm charts for Kubernetes
   - `k8s/`: Kubernetes manifests
   - `Dockerfile`: Container configuration
## Development Guidelines

### Code Style
- Use ES6+ JavaScript features
- Follow existing patterns in the codebase
- Implement proper error handling with retry logic
- Add comprehensive logging using the logger utility
- Write tests for new functionality

### File Organization
- Core logic in `/packages/core/src/`
- API routes in `/packages/backend/src/routes/`
- Utilities in `/packages/shared/src/utils/`
- Agent-specific code in `/packages/agents/src/`
- Memory components in `/packages/memory/src/`
- Protocol implementations in `/packages/integrations/src/`
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
- **Open Source**: `/api/open-source/*` (7 endpoints - discovery, compliance, analysis)
  - `/api/open-source/alternatives` - Discover open source alternatives
  - `/api/open-source/audit-licenses` - Audit project licenses
  - `/api/open-source/compliance-score` - Get compliance score
  - `/api/open-source/migration-plan` - Generate migration plan
  - `/api/open-source/cost-analysis` - Cost savings analysis
  - `/api/open-source/cncf-check` - CNCF compliance validation

### Working with Agent Modules

The project is organized as a monorepo with the following packages:

1. **@autoweave/core**: Main orchestration engine
2. **@autoweave/agents**: Agent implementations (debugging, integration, self-awareness)
3. **@autoweave/backend**: API server and service management
4. **@autoweave/memory**: Hybrid memory system
5. **@autoweave/integrations**: Protocol bridges and external integrations
6. **@autoweave/cli**: Command-line interface
7. **@autoweave/deployment**: Deployment scripts and K8s configs
8. **@autoweave/shared**: Shared utilities and types

Each package has its own `package.json` and can be developed independently while sharing common dependencies through the workspace.
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

5. **Open Source Discovery**:
   ```bash
   # CLI commands
   autoweave discover-alternatives datadog
   autoweave audit-licenses ./
   autoweave compliance-score
   autoweave migrate-to-oss datadog
   autoweave cost-analysis
   autoweave cncf-check
   ```

6. **Run Tests**:
   ```bash
   npm test                    # Unit tests
   npm run test:e2e           # E2E tests with Playwright
   npm run test:integration   # Integration tests
   npm run test:coverage      # Coverage report
   npm run test:load          # Load tests with k6
   ```

7. **Debug Analysis**:
   ```bash
   node debug-analysis.js     # Run debugging analysis
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