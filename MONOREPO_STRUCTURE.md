# AutoWeave Monorepo Structure

## Overview

AutoWeave has been successfully migrated to a unified monorepo structure, resolving the critical dual structure issue where code existed in both `/src` and `/autoweave-repos`.

## New Structure

```
autoweave/
├── packages/                    # All AutoWeave packages
│   ├── core/                   # Core orchestration engine
│   │   ├── src/
│   │   │   ├── autoweave.js
│   │   │   ├── agent-weaver.js
│   │   │   ├── config-intelligence.js
│   │   │   ├── logger.js
│   │   │   └── index.js
│   │   ├── tests/
│   │   ├── package.json
│   │   └── jest.config.js
│   │
│   ├── memory/                 # Hybrid memory system
│   │   ├── src/
│   │   │   ├── hybrid-memory.js
│   │   │   ├── mem0-client.js
│   │   │   ├── graph-client.js
│   │   │   ├── redis-ml-cache.js
│   │   │   ├── coding-memory-manager.js
│   │   │   └── index.js
│   │   └── package.json
│   │
│   ├── agents/                 # Agent implementations
│   │   ├── src/
│   │   │   ├── debugging-agent.js
│   │   │   ├── self-awareness-agent.js
│   │   │   └── integration-agent/
│   │   └── package.json
│   │
│   ├── backend/               # API and services
│   │   ├── src/
│   │   │   ├── routes/
│   │   │   ├── services/
│   │   │   └── index.js
│   │   └── package.json
│   │
│   ├── integrations/         # External integrations
│   │   ├── src/
│   │   │   └── mcp/
│   │   └── package.json
│   │
│   ├── cli/                  # Command-line interface
│   │   ├── src/
│   │   │   └── create-agent.js
│   │   └── package.json
│   │
│   ├── deployment/           # K8s and infrastructure
│   │   ├── src/
│   │   │   ├── helm/
│   │   │   ├── k8s/
│   │   │   └── Dockerfile
│   │   └── package.json
│   │
│   └── shared/              # Shared utilities
│       ├── src/
│       │   └── utils/
│       └── package.json
│
├── .github/
│   └── workflows/
│       ├── monorepo-ci.yml   # CI/CD pipeline
│       └── security.yml       # Security scanning
│
├── scripts/                   # Build and migration scripts
│   ├── migration-helper.js
│   ├── analyze-dependencies.js
│   └── fix-workspace-deps.js
│
├── turbo.json                # Turborepo configuration
├── package.json              # Root workspace configuration
└── README.md                 # Project documentation
```

## Package Dependencies

### Internal Dependencies
- `@autoweave/core` - Used by most packages
- `@autoweave/shared` - Common utilities used everywhere
- `@autoweave/memory` - Used by core, agents, backend
- `@autoweave/agents` - Used by backend, core
- `@autoweave/integrations` - Used by core

### External Dependencies
Major external dependencies include:
- `express` - Web framework
- `openai` - AI provider
- `ioredis` - Redis client
- `neo4j-driver` - Graph database
- `winston` - Logging
- `jest` - Testing
- `turbo` - Build system

## Migration Summary

### What Was Done
1. **Analysis**: Identified 33 duplicate files and 13 diverged files
2. **Structure Creation**: Set up 8 packages with proper boundaries
3. **File Migration**: Intelligently merged diverged files
4. **Import Updates**: Updated all imports to use `@autoweave/*`
5. **Dependency Analysis**: Mapped all internal/external dependencies
6. **Build Configuration**: Set up Turborepo for efficient builds
7. **CI/CD Pipeline**: Created GitHub Actions workflow

### Key Decisions
- Used `/autoweave-repos` versions for better modular structure
- Used `/src` versions when they had more recent updates
- Merged features from both versions for critical files
- Adopted file: protocol for local package references

## Development Workflow

### Install Dependencies
```bash
npm install
```

### Run Development Server
```bash
npm run dev
```

### Run Tests
```bash
npm run test
```

### Build All Packages
```bash
npm run build
```

### Run Specific Package
```bash
cd packages/backend
npm start
```

## Next Steps

1. **Testing**: Run comprehensive tests on each package
2. **Documentation**: Update API documentation for new structure
3. **TypeScript**: Begin progressive TypeScript migration
4. **Performance**: Benchmark and optimize the new structure
5. **Deployment**: Update deployment scripts for monorepo

## Benefits

1. **Single Source of Truth**: No more duplicate/diverged files
2. **Clear Dependencies**: Explicit package boundaries
3. **Efficient Builds**: Turborepo caches and parallelizes
4. **Better Testing**: Isolated package tests
5. **Easier Maintenance**: Clear ownership and structure

## Migration Tools

- `scripts/migration-helper.js` - Automated migration tool
- `scripts/analyze-dependencies.js` - Dependency analyzer
- `scripts/fix-workspace-deps.js` - Workspace dependency fixer

---

The monorepo migration is complete and ready for testing and deployment!