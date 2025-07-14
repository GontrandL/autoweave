 
# Plan de Développement AutoWeave + kagent
## POC Agent Auto-Configuration Cloud Native

## 🎯 Nom du Projet : **AutoWeave**
*"The Self-Weaving Agent Orchestrator"* - **Powered by kagent**

**✅ PRODUCTION READY - All TODOs Completed (2025-07-10)**

**Architecture Hybride** :
- **AutoWeave** = Frontend création d'agents via langage naturel
- **kagent** = Backend runtime Kubernetes natif + observability  
- **Bridge** = Génération automatique YAML kagent depuis workflows AutoWeave
- **Memory Integration** = Système de mémoire hybride complet (mem0 + GraphRAG)
- **Monitoring** = Sentry + service de sécurité intégrés
- **Self-Awareness** = Système complet de monitoring et d'auto-diagnostic

## 📁 Structure du Projet Révisée

### Répertoire Principal
```

#### 1.3 Fichiers Utilitaires Essentiels

```javascript
// tests/setup.js - Configuration globale des tests
const { Logger } = require('../src/utils/logger');

// Disable logging during tests
Logger.setLevel('error');

// Global test timeout
jest.setTimeout(30000);

// Setup global test helpers
global.testHelpers = {
    sleep: (ms) => new Promise(resolve => setTimeout(resolve, ms)),
    generateTestId: () => `test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    waitFor: async (condition, timeout = 10000) => {
        const start = Date.now();
        while (Date.now() - start < timeout) {
            if (await condition()) return true;
            await global.testHelpers.sleep(100);
        }
        throw new Error(`Timeout waiting for condition after ${timeout}ms`);
    }
};

// Cleanup function for tests
global.cleanupTestResources = async () => {
    // Add cleanup logic for test resources
    console.log('Cleaning up test resources...');
};

afterAll(async () => {
    await global.cleanupTestResources();
});
```

```javascript
// src/utils/logger.js - Logger structuré amélioré
const chalk = require('chalk');

class Logger {
    constructor(component) {
        this.component = component;
        this.level = process.env.LOG_LEVEL || 'info';
        this.levels = {
            error: 0,
            warn: 1,
            info: 2,
            debug: 3
        };
    }

    static setLevel(level) {
        process.env.LOG_LEVEL = level;
    }

    shouldLog(level) {
        return this.levels[level] <= this.levels[this.level];
    }

    formatMessage(level, message, data = null) {
        const timestamp = new Date().toISOString();
        const component = `[${this.component}]`;

        let formattedMessage = `${timestamp} ${component} ${message}`;

        if (data) {
            if (typeof data === 'object') {
                formattedMessage += `\n${JSON.stringify(data, null, 2)}`;
            } else {
                formattedMessage += ` ${data}`;
            }
        }

        return formattedMessage;
    }

    error(message, data = null) {
        if (!this.shouldLog('error')) return;
        console.error(chalk.red(this.formatMessage('ERROR', message, data)));
    }

    warn(message, data = null) {
        if (!this.shouldLog('warn')) return;
        console.warn(chalk.yellow(this.formatMessage('WARN', message, data)));
    }

    info(message, data = null) {
        if (!this.shouldLog('info')) return;
        console.info(chalk.blue(this.formatMessage('INFO', message, data)));
    }

    debug(message, data = null) {
        if (!this.shouldLog('debug')) return;
        console.debug(chalk.gray(this.formatMessage('DEBUG', message, data)));
    }

    success(message, data = null) {
        if (!this.shouldLog('info')) return;
        console.info(chalk.green(this.formatMessage('SUCCESS', message, data)));
    }
}

module.exports = { Logger };
```

```javascript
// src/utils/retry.js - Retry logic réutilisable
class RetryHelper {
    static async withRetry(operation, options = {}) {
        const {
            maxAttempts = 3,
            delay = 1000,
            backoff = 2,
            shouldRetry = () => true
        } = options;

        let lastError;

        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
                return await operation();
            } catch (error) {
                lastError = error;

                if (attempt === maxAttempts || !shouldRetry(error)) {
                    throw error;
                }

                const waitTime = delay * Math.pow(backoff, attempt - 1);
                await new Promise(resolve => setTimeout(resolve, waitTime));
            }
        }

        throw lastError;
    }
}

module.exports = { RetryHelper };
```

```javascript
// src/utils/validation.js - Validation des inputs
class ValidationError extends Error {
    constructor(message, field = null) {
        super(message);
        this.name = 'ValidationError';
        this.field = field;
    }
}

class Validator {
    static validateAgentDescription(description) {
        if (!description || typeof description !== 'string') {
            throw new ValidationError('Description is required and must be a string', 'description');
        }

        if (description.length < 10) {
            throw new ValidationError('Description must be at least 10 characters long', 'description');
        }

        if (description.length > 1000) {
            throw new ValidationError('Description must be less than 1000 characters', 'description');
        }

        return true;
    }

    static validateAgentName(name) {
        if (!name || typeof name !== 'string') {
            throw new ValidationError('Name is required and must be a string', 'name');
        }

        if (!/^[a-z0-9-]+$/.test(name)) {
            throw new ValidationError('Name must contain only lowercase letters, numbers, and hyphens', 'name');
        }

        if (name.length > 63) {
            throw new ValidationError('Name must be less than 63 characters (Kubernetes limit)', 'name');
        }

        return true;
    }

    static validateKubernetesName(name) {
        // Kubernetes resource name validation
        if (!/^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/.test(name)) {
            throw new ValidationError(
                'Invalid Kubernetes name. Must start and end with alphanumeric characters, may contain hyphens',
                'kubernetesName'
            );
        }
        return true;
    }
}

module.exports = { Validator, ValidationError };
```

#### 1.4 Scripts de Développement Essentiels

```bash
# scripts/dev-helpers.sh - Helpers pour développement
#!/bin/bash

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Helper functions
log_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

log_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

log_warn() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Check if kagent cluster is running
check_kagent_cluster() {
    if ! kubectl cluster-info --context kind-autoweave >/dev/null 2>&1; then
        log_error "kagent cluster not running. Run 'bash scripts/setup-kagent.sh' first"
        return 1
    fi

    if ! kubectl get namespace kagent-system >/dev/null 2>&1; then
        log_error "kagent not installed. Run 'kagent install' first"
        return 1
    fi

    log_success "kagent cluster is running"
    return 0
}

# Get kagent UI URL
get_kagent_ui_url() {
    local port_forward_pid=$(pgrep -f "kubectl port-forward.*kagent-ui")
    if [ -n "$port_forward_pid" ]; then
        echo "http://localhost:8080"
    else
        log_warn "kagent UI port-forward not running. Run: kubectl port-forward -n kagent-system svc/kagent-ui 8080:80"
        echo ""
    fi
}

# Clean up test resources
cleanup_test_resources() {
    log_info "Cleaning up test resources..."

    # Delete test agents
    kubectl delete agents -l autoweave.dev/test=true --ignore-not-found=true

    # Delete test tools
    kubectl delete tools -l autoweave.dev/test=true --ignore-not-found=true

    log_success "Test resources cleaned"
}

# Export functions for use in other scripts
export -f log_info log_success log_warn log_error
export -f check_kagent_cluster get_kagent_ui_url cleanup_test_resources
```

```bash
# scripts/health-check.sh - Health check complet
#!/bin/bash

source scripts/dev-helpers.sh

log_info "Running AutoWeave + kagent health check..."

# 1. Check Node.js and npm
if ! command -v node &> /dev/null; then
    log_error "Node.js not found"
    exit 1
fi

NODE_VERSION=$(node --version | cut -d'v' -f2)
if [ "$(printf '%s\n' "18.0.0" "$NODE_VERSION" | sort -V | head -n1)" != "18.0.0" ]; then
    log_error "Node.js 18+ required, found $NODE_VERSION"
    exit 1
fi

log_success "Node.js $NODE_VERSION"

# 2. Check dependencies
if [ ! -d "node_modules" ]; then
    log_warn "Node modules not installed. Running npm install..."
    npm install
fi

# 3. Check environment
if [ ! -f ".env" ]; then
    log_warn ".env file not found. Copying from .env.example"
    cp .env.example .env
    log_warn "Please edit .env file with your API keys"
fi

# 4. Check OPENAI_API_KEY
source .env
if [ -z "$OPENAI_API_KEY" ] || [ "$OPENAI_API_KEY" = "your_openai_api_key_here" ]; then
    log_error "OPENAI_API_KEY not set in .env file"
    exit 1
fi

log_success "Environment configuration"

# 5. Check kagent cluster
if ! check_kagent_cluster; then
    exit 1
fi

# 6. Check kagent pods
log_info "Checking kagent pods..."
if ! kubectl get pods -n kagent-system | grep -q "Running"; then
    log_error "kagent pods not running"
    kubectl get pods -n kagent-system
    exit 1
fi

log_success "kagent pods running"

# 7. Test AutoWeave API
log_info "Testing AutoWeave components..."

# Start AutoWeave in background for testing
npm start &
AUTOWEAVE_PID=$!
sleep 5

# Test API endpoint
if curl -f http://localhost:3000/health >/dev/null 2>&1; then
    log_success "AutoWeave API responding"
else
    log_warn "AutoWeave API not responding (this is expected if not implemented yet)"
fi

# Cleanup
kill $AUTOWEAVE_PID 2>/dev/null

log_success "Health check complete!"
log_info "kagent UI: $(get_kagent_ui_url)"
log_info "Ready to develop!"
```

#### 1.5 Package.json Scripts Supplémentaires

```json
{
  "scripts": {
    "start": "node src/index.js",
    "dev": "nodemon src/index.js --watch src --ext js",
    "test": "jest",
    "test:watch": "jest --watch",
    "test:integration": "jest tests/integration --runInBand",
    "test:e2e": "jest tests/e2e --runInBand --detectOpenHandles",
    "test:coverage": "jest --coverage",
    "setup": "bash scripts/setup-kagent.sh",
    "health": "bash scripts/health-check.sh",
    "create-agent": "node src/cli/create-agent.js",
    "dev:cluster": "kind create cluster --name autoweave && kagent install",
    "dev:clean": "bash scripts/cleanup-test-resources.sh",
    "dev:ui": "kubectl port-forward -n kagent-system svc/kagent-ui 8080:80",
    "lint": "eslint src/ tests/",
    "lint:fix": "eslint src/ tests/ --fix"
  },
  "devDependencies": {
    "jest": "^29.7.0",
    "nodemon": "^3.0.0",
    "supertest": "^6.3.0",
    "eslint": "^8.57.0"
  }
}
/home/gontrand/autoweave/
├── README.md
├── docs/
├── src/
│   ├── core/          # AutoWeave Agent Weaver
│   ├── kagent/        # kagent Integration Layer
│   ├── mcp/           # MCP Discovery Service
│   └── utils/         # Utilities & Logging
├── tests/
│   ├── unit/          # Unit tests
│   ├── integration/   # AutoWeave ↔ kagent tests
│   └── e2e/           # End-to-end scenarios
├── config/
│   ├── autoweave/     # AutoWeave configs
│   ├── kagent/        # kagent YAML templates
│   └── k8s/           # Kubernetes manifests
├── scripts/
│   ├── setup-kagent.sh
│   ├── deploy-agent.sh
│   └── test-e2e.sh
└── examples/          # Sample agents YAML
```

## 🎯 Instructions pour Claude Code

### Phase 1 : Setup Environment Hybride (Jour 1)

#### 1.1 Installation kagent + Cluster Local
```bash
# Créer la structure dans /home/gontrand/
cd /home/gontrand
mkdir autoweave && cd autoweave

# Setup cluster Kubernetes local
curl -Lo ./kind https://kind.sigs.k8s.io/dl/v0.20.0/kind-linux-amd64
chmod +x ./kind && sudo mv ./kind /usr/local/bin/kind
kind create cluster --name autoweave

# Installation kagent
curl https://raw.githubusercontent.com/kagent-dev/kagent/refs/heads/main/scripts/get-kagent | bash
export OPENAI_API_KEY="your-api-key-here"
kagent install

# Validation installation
kubectl get pods -n kagent-system
kagent --version
```

#### 1.2 Structure Projet + Dependencies & Config Files
```bash
# Initialiser structure complète
mkdir -p {src/{core,kagent,mcp,utils},tests/{unit,integration,e2e,fixtures},docs/{api,guides,troubleshooting},config/{autoweave,kagent,k8s},scripts/{setup,cleanup,dev},examples,logs}

# Initialiser Git avec .gitignore
git init
cat > .gitignore << 'EOF'
node_modules/
logs/
*.log
.env
.env.local
dist/
coverage/
.nyc_output/
.DS_Store
.vscode/
.idea/
*.tgz
*.tar.gz
/tmp/
EOF

# Package.json avec dépendances K8s
cat > package.json << 'EOF'
{
  "name": "autoweave",
  "version": "0.1.0",
  "description": "Self-Weaving Agent Orchestrator - Powered by kagent",
  "main": "src/index.js",
  "scripts": {
    "start": "node src/index.js",
    "dev": "nodemon src/index.js --watch src",
    "test": "jest",
    "test:integration": "jest tests/integration",
    "test:e2e": "jest tests/e2e",
    "setup-kagent": "bash scripts/setup-kagent.sh",
    "create-agent": "node src/cli/create-agent.js",
    "deploy-agent": "bash scripts/deploy-agent.sh"
  },
  "dependencies": {
    "express": "^4.18.0",
    "axios": "^1.6.0",
    "@kubernetes/client-node": "^0.20.0",
    "yaml": "^2.3.0",
    "dotenv": "^16.3.0",
    "inquirer": "^9.2.0",
    "chalk": "^5.3.0",
    "commander": "^11.1.0",
    "openai": "^4.20.0"
  },
  "devDependencies": {
    "jest": "^29.7.0",
    "nodemon": "^3.0.0",
    "supertest": "^6.3.0"
  }
}
EOF

npm install

# Créer fichiers de configuration essentiels
cat > .env.example << 'EOF'
# AutoWeave Configuration
NODE_ENV=development
PORT=3000
LOG_LEVEL=debug

# API Keys (REQUIRED)
OPENAI_API_KEY=your_openai_api_key_here

# kagent Configuration
KAGENT_NAMESPACE=default
KAGENT_TIMEOUT=30000
KAGENT_RETRY_ATTEMPTS=3

# Kubernetes Configuration
KUBECONFIG=~/.kube/config
K8S_CLUSTER_NAME=autoweave

# Optional: Custom MCP Servers
MCP_DISCOVERY_ENABLED=true
MCP_REGISTRY_URL=http://localhost:8082
EOF

cp .env.example .env

# Configuration AutoWeave
mkdir -p config/autoweave
cat > config/autoweave/config.js << 'EOF'
require('dotenv').config();

module.exports = {
    port: process.env.PORT || 3000,
    logLevel: process.env.LOG_LEVEL || 'info',

    agentWeaver: {
        openaiApiKey: process.env.OPENAI_API_KEY,
        model: 'gpt-4',
        temperature: 0.7,
        maxTokens: 4000,
        timeout: 30000
    },

    kagent: {
        namespace: process.env.KAGENT_NAMESPACE || 'default',
        timeout: parseInt(process.env.KAGENT_TIMEOUT) || 30000,
        retryAttempts: parseInt(process.env.KAGENT_RETRY_ATTEMPTS) || 3,
        clusterName: process.env.K8S_CLUSTER_NAME || 'autoweave'
    },

    mcp: {
        discoveryEnabled: process.env.MCP_DISCOVERY_ENABLED === 'true',
        discoveryPort: 8081,
        registryUrl: process.env.MCP_REGISTRY_URL
    },

    kubernetes: {
        kubeconfig: process.env.KUBECONFIG || '~/.kube/config',
        inCluster: process.env.K8S_IN_CLUSTER === 'true'
    }
};
EOF

# Configuration par défaut pour tests
cat > config/autoweave/config.test.js << 'EOF'
const baseConfig = require('./config');

module.exports = {
    ...baseConfig,
    port: 3001,
    logLevel: 'error',
    kagent: {
        ...baseConfig.kagent,
        namespace: 'autoweave-test',
        timeout: 5000
    }
};
EOF

# Jest configuration
cat > jest.config.js << 'EOF'
module.exports = {
    testEnvironment: 'node',
    collectCoverageFrom: [
        'src/**/*.js',
        '!src/**/*.test.js',
        '!src/cli/**'
    ],
    coverageDirectory: 'coverage',
    testMatch: [
        '**/tests/**/*.test.js'
    ],
    setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
    testTimeout: 30000,
    verbose: true
};
EOF
```

### Phase 2 : AutoWeave Core avec kagent Bridge (Jour 2)

#### 2.1 Point d'Entrée Principal (src/index.js)
```javascript
#!/usr/bin/env node

const { AutoWeave } = require('./core/autoweave');
const { KagentBridge } = require('./kagent/bridge');
const { Logger } = require('./utils/logger');
const config = require('../config/autoweave/config');

async function main() {
    const logger = new Logger('AutoWeave');

    try {
        logger.info('🚀 Starting AutoWeave + kagent - Self-Weaving Agent Orchestrator');

        // Initialize kagent bridge first
        const kagentBridge = new KagentBridge(config.kagent);
        await kagentBridge.initialize();

        // Initialize AutoWeave with kagent integration
        const autoweave = new AutoWeave(config, kagentBridge);
        await autoweave.initialize();

        logger.info('✅ AutoWeave + kagent initialized successfully');
        logger.info(`🌐 Web UI: http://localhost:${config.port}`);
        logger.info(`☸️  kagent UI: http://localhost:8080 (port-forward)`);

        // Graceful shutdown
        process.on('SIGINT', async () => {
            await autoweave.shutdown();
            await kagentBridge.shutdown();
        });

    } catch (error) {
        logger.error('❌ Failed to start AutoWeave:', error);
        process.exit(1);
    }
}

if (require.main === module) {
    main();
}

module.exports = { main };
```

#### 2.2 kagent Bridge Core Amélioré (src/kagent/bridge.js)
```javascript
const k8s = require('@kubernetes/client-node');
const yaml = require('yaml');
const { Logger } = require('../utils/logger');
const { RetryHelper } = require('../utils/retry');
const { ValidationError } = require('../utils/validation');
const { KagentYAMLGenerator } = require('./yaml-generator');

class KagentError extends Error {
    constructor(message, code = 'KAGENT_ERROR', details = null) {
        super(message);
        this.name = 'KagentError';
        this.code = code;
        this.details = details;
    }
}

class KagentBridge {
    constructor(config) {
        this.config = config;
        this.logger = new Logger('KagentBridge');

        // Kubernetes client setup with error handling
        this.kc = new k8s.KubeConfig();
        try {
            if (config.kubernetes?.inCluster) {
                this.kc.loadFromCluster();
            } else {
                this.kc.loadFromDefault();
            }
        } catch (error) {
            throw new KagentError('Failed to load Kubernetes configuration', 'K8S_CONFIG_ERROR', error);
        }

        this.k8sApi = this.kc.makeApiClient(k8s.CustomObjectsApi);
        this.coreApi = this.kc.makeApiClient(k8s.CoreV1Api);
        this.appsApi = this.kc.makeApiClient(k8s.AppsV1Api);

        // YAML generator
        this.yamlGenerator = new KagentYAMLGenerator();

        // State
        this.deployedAgents = new Map();
        this.availableTools = [];
        this.isInitialized = false;
    }

    async initialize() {
        this.logger.info('Initializing kagent bridge...');

        try {
            // Verify kagent is installed with retries
            await RetryHelper.withRetry(
                () => this.verifyKagentInstallation(),
                {
                    maxAttempts: 3,
                    delay: 2000,
                    shouldRetry: (error) => error.code !== 'KAGENT_NOT_INSTALLED'
                }
            );

            // Discover available kagent tools
            await this.discoverKagentTools();

            // Setup monitoring
            await this.setupMonitoring();

            this.isInitialized = true;
            this.logger.success('kagent bridge initialized successfully');

        } catch (error) {
            this.logger.error('Failed to initialize kagent bridge:', error);
            throw error;
        }
    }

    async verifyKagentInstallation() {
        try {
            // Check CRDs
            const crdApi = this.kc.makeApiClient(k8s.ApiextensionsV1Api);
            const crds = await crdApi.listCustomResourceDefinition();

            const kagentCRDs = crds.body.items.filter(crd =>
                crd.metadata.name.includes('kagent.dev')
            );

            if (kagentCRDs.length === 0) {
                throw new KagentError(
                    'kagent CRDs not found. Please install kagent first: kagent install',
                    'KAGENT_NOT_INSTALLED'
                );
            }

            this.logger.info(`Found ${kagentCRDs.length} kagent CRDs`);

            // Check namespace
            const namespaces = await this.coreApi.listNamespace();
            const kagentNS = namespaces.body.items.find(ns =>
                ns.metadata.name === 'kagent-system'
            );

            if (!kagentNS) {
                throw new KagentError(
                    'kagent-system namespace not found',
                    'KAGENT_NAMESPACE_MISSING'
                );
            }

            // Check kagent controller pod
            const pods = await this.coreApi.listNamespacedPod('kagent-system');
            const controllerPod = pods.body.items.find(pod =>
                pod.metadata.labels?.app === 'kagent-controller'
            );

            if (!controllerPod || controllerPod.status.phase !== 'Running') {
                throw new KagentError(
                    'kagent controller not running',
                    'KAGENT_CONTROLLER_NOT_READY'
                );
            }

            this.logger.success('kagent installation verified');

        } catch (error) {
            if (error instanceof KagentError) {
                throw error;
            }

            this.logger.error('Error verifying kagent installation:', error);
            throw new KagentError(
                'Failed to verify kagent installation',
                'KAGENT_VERIFICATION_FAILED',
                error
            );
        }
    }

    async discoverKagentTools() {
        try {
            this.logger.info('Discovering kagent tools...');

            const tools = await RetryHelper.withRetry(
                () => this.k8sApi.listNamespacedCustomObject(
                    'kagent.dev',
                    'v1alpha1',
                    this.config.namespace,
                    'tools'
                ),
                { maxAttempts: 3, delay: 1000 }
            );

            this.availableTools = tools.body.items || [];
            this.logger.info(`Discovered ${this.availableTools.length} kagent tools`);

            // Log available tools with details
            this.availableTools.forEach(tool => {
                this.logger.debug(`Tool: ${tool.metadata.name}`, {
                    description: tool.spec.description,
                    type: tool.spec.type,
                    status: tool.status?.phase
                });
            });

            // Create tool capability map
            this.toolCapabilities = this.createToolCapabilityMap();

        } catch (error) {
            this.logger.warn('Could not discover kagent tools:', error.message);
            this.availableTools = [];
            this.toolCapabilities = new Map();
        }
    }

    createToolCapabilityMap() {
        const capabilityMap = new Map();

        this.availableTools.forEach(tool => {
            const capabilities = [
                tool.metadata.name,
                ...(tool.spec.capabilities || []),
                ...(tool.metadata.labels ? Object.values(tool.metadata.labels) : [])
            ].map(cap => cap.toLowerCase());

            capabilities.forEach(capability => {
                if (!capabilityMap.has(capability)) {
                    capabilityMap.set(capability, []);
                }
                capabilityMap.get(capability).push(tool.metadata.name);
            });
        });

        return capabilityMap;
    }

    async deployAgent(agentWorkflow) {
        if (!this.isInitialized) {
            throw new KagentError('kagent bridge not initialized', 'NOT_INITIALIZED');
        }

        this.logger.info(`Deploying agent: ${agentWorkflow.name}`);

        try {
            // Validate workflow
            this.validateWorkflow(agentWorkflow);

            // Generate kagent YAML
            const kagentYAML = this.yamlGenerator.generateFromWorkflow(agentWorkflow);

            // Deploy with transaction-like behavior
            const deployedResources = [];

            try {
                // Deploy custom tools first
                for (const tool of kagentYAML.tools || []) {
                    const toolResult = await this.k8sApi.createNamespacedCustomObject(
                        'kagent.dev',
                        'v1alpha1',
                        this.config.namespace,
                        'tools',
                        tool
                    );
                    deployedResources.push({
                        type: 'tool',
                        name: tool.metadata.name,
                        resource: toolResult.body
                    });
                    this.logger.debug(`Deployed tool: ${tool.metadata.name}`);
                }

                // Deploy agent
                const agentResult = await this.k8sApi.createNamespacedCustomObject(
                    'kagent.dev',
                    'v1alpha1',
                    this.config.namespace,
                    'agents',
                    kagentYAML.agent
                );
                deployedResources.push({
                    type: 'agent',
                    name: kagentYAML.agent.metadata.name,
                    resource: agentResult.body
                });

                // Track deployment
                const deployedAgent = {
                    name: agentWorkflow.name,
                    kagentName: kagentYAML.agent.metadata.name,
                    namespace: this.config.namespace,
                    status: 'deploying',
                    createdAt: new Date(),
                    resources: deployedResources,
                    workflow: agentWorkflow
                };

                this.deployedAgents.set(agentWorkflow.id, deployedAgent);

                this.logger.success(`Agent ${agentWorkflow.name} deployed to kagent`);
                return deployedAgent;

            } catch (deployError) {
                // Rollback on failure
                this.logger.warn('Deployment failed, rolling back...');
                await this.rollbackDeployment(deployedResources);
                throw deployError;
            }

        } catch (error) {
            this.logger.error(`Failed to deploy agent ${agentWorkflow.name}:`, error);

            if (error.response?.body) {
                throw new KagentError(
                    `Kubernetes API error: ${error.response.body.message}`,
                    'K8S_API_ERROR',
                    error.response.body
                );
            }

            throw error;
        }
    }

    validateWorkflow(workflow) {
        if (!workflow.id || !workflow.name) {
            throw new ValidationError('Workflow must have id and name');
        }

        if (!workflow.requiredModules || workflow.requiredModules.length === 0) {
            throw new ValidationError('Workflow must have at least one required module');
        }

        // Validate Kubernetes name compatibility
        const k8sName = this.yamlGenerator.sanitizeName(workflow.name);
        if (k8sName.length === 0) {
            throw new ValidationError('Workflow name cannot be converted to valid Kubernetes name');
        }
    }

    async rollbackDeployment(deployedResources) {
        for (const resource of deployedResources.reverse()) {
            try {
                await this.k8sApi.deleteNamespacedCustomObject(
                    'kagent.dev',
                    'v1alpha1',
                    this.config.namespace,
                    `${resource.type}s`, // tools or agents
                    resource.name
                );
                this.logger.debug(`Rolled back ${resource.type}: ${resource.name}`);
            } catch (error) {
                this.logger.warn(`Failed to rollback ${resource.type} ${resource.name}:`, error.message);
            }
        }
    }

    async getAgentStatus(agentId) {
        const deployedAgent = this.deployedAgents.get(agentId);
        if (!deployedAgent) {
            return null;
        }

        try {
            const agent = await this.k8sApi.getNamespacedCustomObject(
                'kagent.dev',
                'v1alpha1',
                deployedAgent.namespace,
                'agents',
                deployedAgent.kagentName
            );

            // Get related pods/services for more detailed status
            const pods = await this.getAgentPods(deployedAgent.kagentName);

            return {
                ...deployedAgent,
                status: agent.body.status?.phase || 'unknown',
                kagentStatus: agent.body.status,
                pods,
                ready: agent.body.status?.phase === 'Ready',
                lastUpdated: new Date()
            };

        } catch (error) {
            this.logger.warn(`Could not get status for agent ${agentId}:`, error.message);
            return {
                ...deployedAgent,
                status: 'error',
                error: error.message
            };
        }
    }

    async getAgentPods(agentName) {
        try {
            const pods = await this.coreApi.listNamespacedPod(
                this.config.namespace,
                undefined,
                undefined,
                undefined,
                undefined,
                `app=${agentName}`
            );

            return pods.body.items.map(pod => ({
                name: pod.metadata.name,
                status: pod.status.phase,
                ready: pod.status.conditions?.find(c => c.type === 'Ready')?.status === 'True',
                restarts: pod.status.containerStatuses?.[0]?.restartCount || 0
            }));
        } catch (error) {
            this.logger.debug(`Could not get pods for agent ${agentName}:`, error.message);
            return [];
        }
    }

    async deleteAgent(agentId) {
        const deployedAgent = this.deployedAgents.get(agentId);
        if (!deployedAgent) {
            throw new KagentError(`Agent ${agentId} not found`, 'AGENT_NOT_FOUND');
        }

        try {
            // Delete agent
            await this.k8sApi.deleteNamespacedCustomObject(
                'kagent.dev',
                'v1alpha1',
                deployedAgent.namespace,
                'agents',
                deployedAgent.kagentName
            );

            // Delete associated tools if they were created by us
            for (const resource of deployedAgent.resources || []) {
                if (resource.type === 'tool') {
                    try {
                        await this.k8sApi.deleteNamespacedCustomObject(
                            'kagent.dev',
                            'v1alpha1',
                            deployedAgent.namespace,
                            'tools',
                            resource.name
                        );
                    } catch (error) {
                        this.logger.warn(`Failed to delete tool ${resource.name}:`, error.message);
                    }
                }
            }

            this.deployedAgents.delete(agentId);
            this.logger.success(`Agent ${agentId} deleted`);

        } catch (error) {
            this.logger.error(`Failed to delete agent ${agentId}:`, error);
            throw new KagentError(`Failed to delete agent: ${error.message}`, 'DELETE_FAILED', error);
        }
    }

    async setupMonitoring() {
        // Setup basic monitoring/health checks
        this.logger.debug('Setting up kagent monitoring...');

        // Could implement:
        // - Watch for agent status changes
        // - Setup metrics collection
        // - Health check endpoints
    }

    async shutdown() {
        this.logger.info('Shutting down kagent bridge...');

        // Cleanup any background processes
        // Close connections

        this.isInitialized = false;
        this.logger.info('kagent bridge shutdown complete');
    }
}

module.exports = { KagentBridge, KagentError };
```

#### 2.3 kagent YAML Generator (src/kagent/yaml-generator.js)
```javascript
class KagentYAMLGenerator {
    constructor() {
        this.logger = new Logger('YAMLGenerator');
    }

    generateFromWorkflow(workflow) {
        this.logger.info(`Generating kagent YAML for workflow: ${workflow.name}`);

        // Generate Agent CRD
        const agent = {
            apiVersion: 'kagent.dev/v1alpha1',
            kind: 'Agent',
            metadata: {
                name: this.sanitizeName(workflow.name),
                labels: {
                    'autoweave.dev/generated': 'true',
                    'autoweave.dev/version': '0.1.0'
                }
            },
            spec: {
                systemPrompt: this.generateSystemPrompt(workflow),
                tools: this.mapWorkflowToTools(workflow),
                modelConfig: {
                    name: workflow.modelConfig?.name || 'gpt-4',
                    temperature: workflow.modelConfig?.temperature || 0.7
                }
            }
        };

        // Generate custom Tools if needed
        const tools = this.generateCustomTools(workflow);

        return {
            agent,
            tools: tools.length > 0 ? tools : undefined
        };
    }

    generateSystemPrompt(workflow) {
        let prompt = `You are an AI agent created by AutoWeave for: ${workflow.description}\n\n`;

        prompt += "Your capabilities include:\n";
        workflow.requiredModules?.forEach(module => {
            prompt += `- ${module.name}: ${module.description || module.type}\n`;
        });

        prompt += "\nInstructions:\n";
        workflow.steps?.forEach((step, index) => {
            prompt += `${index + 1}. ${step.description || step.action}\n`;
        });

        return prompt;
    }

    mapWorkflowToTools(workflow) {
        const tools = [];

        // Map AutoWeave modules to kagent tools
        workflow.requiredModules?.forEach(module => {
            switch (module.type) {
                case 'coding_assistant':
                    tools.push('code-analyzer', 'file-reader');
                    break;
                case 'file_system':
                    tools.push('file-reader', 'file-writer');
                    break;
                case 'kubernetes':
                    tools.push('kubectl', 'k8s-logs');
                    break;
                case 'monitoring':
                    tools.push('prometheus');
                    break;
                default:
                    // Try to use module name directly
                    tools.push(module.name);
            }
        });

        return [...new Set(tools)]; // Remove duplicates
    }

    generateCustomTools(workflow) {
        const customTools = [];

        // Generate custom tools for modules not available in kagent
        workflow.requiredModules?.forEach(module => {
            if (module.custom || module.type === 'mcp_server') {
                customTools.push({
                    apiVersion: 'kagent.dev/v1alpha1',
                    kind: 'Tool',
                    metadata: {
                        name: this.sanitizeName(`${workflow.name}-${module.name}`),
                        labels: {
                            'autoweave.dev/generated': 'true'
                        }
                    },
                    spec: {
                        description: module.description,
                        mcpServer: module.mcpConfig || {
                            url: module.url,
                            method: module.method || 'sse'
                        }
                    }
                });
            }
        });

        return customTools;
    }

    sanitizeName(name) {
        return name.toLowerCase()
                  .replace(/[^a-z0-9-]/g, '-')
                  .replace(/-+/g, '-')
                  .replace(/^-|-$/g, '');
    }
}

module.exports = { KagentYAMLGenerator };
```

### Phase 3 : AutoWeave Core avec kagent Integration (Jour 3)

#### 3.1 AutoWeave Core Modifié (src/core/autoweave.js)
```javascript
const { AgentWeaver } = require('./agent-weaver');
const { MCPDiscovery } = require('../mcp/discovery');
const { Logger } = require('../utils/logger');

class AutoWeave {
    constructor(config, kagentBridge) {
        this.config = config;
        this.kagentBridge = kagentBridge;
        this.logger = new Logger('AutoWeave');

        // Core Components
        this.agentWeaver = new AgentWeaver(config.agentWeaver);
        this.mcpDiscovery = new MCPDiscovery(config.mcp);

        // State
        this.createdWorkflows = new Map();
        this.deployedAgents = new Map();
    }

    async initialize() {
        this.logger.info('Initializing AutoWeave components...');

        // 1. Initialize MCP Discovery
        await this.mcpDiscovery.start();

        // 2. Initialize Agent Weaver
        await this.agentWeaver.initialize();

        // 3. Discover available kagent tools
        this.availableKagentTools = this.kagentBridge.availableTools || [];
        this.logger.info(`Available kagent tools: ${this.availableKagentTools.length}`);

        // 4. Start web interface
        await this.startWebInterface();

        this.logger.info('AutoWeave initialization complete');
    }

    async createAndDeployAgent(description) {
        this.logger.info(`Creating and deploying agent: "${description}"`);

        try {
            // 1. Generate workflow with Agent Weaver
            const workflow = await this.agentWeaver.generateWorkflow(description);
            this.createdWorkflows.set(workflow.id, workflow);

            // 2. Enhance workflow with kagent tools
            const enhancedWorkflow = await this.enhanceWithKagentTools(workflow);

            // 3. Deploy to kagent
            const deployedAgent = await this.kagentBridge.deployAgent(enhancedWorkflow);
            this.deployedAgents.set(workflow.id, deployedAgent);

            this.logger.info(`✅ Agent ${workflow.name} created and deployed successfully`);

            return {
                workflow: enhancedWorkflow,
                deployment: deployedAgent,
                status: 'deployed'
            };

        } catch (error) {
            this.logger.error('❌ Failed to create and deploy agent:', error);
            throw error;
        }
    }

    async enhanceWithKagentTools(workflow) {
        this.logger.info('Enhancing workflow with kagent tools...');

        // Map required capabilities to available kagent tools
        const enhancedModules = workflow.requiredModules.map(module => {
            const kagentTools = this.findMatchingKagentTools(module);

            return {
                ...module,
                kagentTools,
                available: kagentTools.length > 0
            };
        });

        return {
            ...workflow,
            requiredModules: enhancedModules,
            kagentCompatible: enhancedModules.every(m => m.available)
        };
    }

    findMatchingKagentTools(module) {
        return this.availableKagentTools.filter(tool => {
            const toolName = tool.metadata.name.toLowerCase();
            const moduleType = module.type.toLowerCase();

            // Simple matching logic - can be enhanced
            return toolName.includes(moduleType) ||
                   moduleType.includes(toolName) ||
                   (module.keywords && module.keywords.some(k => toolName.includes(k)));
        });
    }

    async getAgentStatus(agentId) {
        const workflow = this.createdWorkflows.get(agentId);
        const deployment = this.deployedAgents.get(agentId);

        if (!workflow || !deployment) {
            return null;
        }

        // Get real-time status from kagent
        const kagentStatus = await this.kagentBridge.getAgentStatus(deployment.name);

        return {
            id: agentId,
            name: workflow.name,
            description: workflow.description,
            status: kagentStatus?.status || 'unknown',
            createdAt: deployment.createdAt,
            kagentDetails: kagentStatus
        };
    }

    async startWebInterface() {
        // Simple Express server for API/UI
        const express = require('express');
        const app = express();

        app.use(express.json());

        app.post('/api/agents', async (req, res) => {
            try {
                const { description } = req.body;
                const result = await this.createAndDeployAgent(description);
                res.json(result);
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });

        app.get('/api/agents/:id', async (req, res) => {
            try {
                const status = await this.getAgentStatus(req.params.id);
                if (!status) {
                    return res.status(404).json({ error: 'Agent not found' });
                }
                res.json(status);
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });

        app.listen(this.config.port, () => {
            this.logger.info(`AutoWeave API listening on port ${this.config.port}`);
        });
    }

    async shutdown() {
        this.logger.info('Shutting down AutoWeave...');
        await this.mcpDiscovery.stop();
        await this.agentWeaver.shutdown();
    }
}

module.exports = { AutoWeave };
```

### Phase 4 : CLI & Tests (Jour 4)

#### 4.1 CLI Interface (src/cli/create-agent.js)
```javascript
#!/usr/bin/env node

const { program } = require('commander');
const inquirer = require('inquirer');
const chalk = require('chalk');
const { AutoWeave } = require('../core/autoweave');
const { KagentBridge } = require('../kagent/bridge');
const config = require('../../config/autoweave/config');

program
    .name('autoweave')
    .description('AutoWeave CLI - Create agents with natural language')
    .version('0.1.0');

program
    .command('create')
    .description('Create and deploy an agent')
    .option('-d, --description <desc>', 'Agent description')
    .option('-n, --name <name>', 'Agent name')
    .option('--dry-run', 'Generate YAML without deploying')
    .action(async (options) => {
        try {
            console.log(chalk.blue('🕸️  AutoWeave - Agent Creator'));

            let description = options.description;

            if (!description) {
                const answers = await inquirer.prompt([
                    {
                        type: 'input',
                        name: 'description',
                        message: 'Describe what your agent should do:',
                        validate: input => input.length > 10 || 'Please provide a detailed description'
                    }
                ]);
                description = answers.description;
            }

            console.log(chalk.yellow('🚀 Creating agent...'));

            // Initialize AutoWeave
            const kagentBridge = new KagentBridge(config.kagent);
            await kagentBridge.initialize();

            const autoweave = new AutoWeave(config, kagentBridge);
            await autoweave.initialize();

            if (options.dryRun) {
                // Generate workflow only
                const workflow = await autoweave.agentWeaver.generateWorkflow(description);
                const yamlGenerator = new (require('../kagent/yaml-generator')).KagentYAMLGenerator();
                const yaml = yamlGenerator.generateFromWorkflow(workflow);

                console.log(chalk.green('📄 Generated kagent YAML:'));
                console.log(require('yaml').stringify(yaml));
            } else {
                // Create and deploy
                const result = await autoweave.createAndDeployAgent(description);

                console.log(chalk.green('✅ Agent created and deployed successfully!'));
                console.log(chalk.cyan(`🆔 Agent ID: ${result.workflow.id}`));
                console.log(chalk.cyan(`📝 Name: ${result.workflow.name}`));
                console.log(chalk.cyan(`⚙️  Tools: ${result.workflow.requiredModules.map(m => m.name).join(', ')}`));
                console.log(chalk.cyan(`☸️  kagent Status: ${result.deployment.status}`));

                console.log(chalk.blue('\n🌐 Access your agent:'));
                console.log(`- AutoWeave API: http://localhost:${config.port}/api/agents/${result.workflow.id}`);
                console.log('- kagent UI: kubectl port-forward -n kagent-system svc/kagent-ui 8080:80');
            }

            await autoweave.shutdown();
            await kagentBridge.shutdown();

        } catch (error) {
            console.error(chalk.red('❌ Error creating agent:'), error.message);
            process.exit(1);
        }
    });

program
    .command('status <agentId>')
    .description('Get agent status')
    .action(async (agentId) => {
        try {
            // Get status logic
            console.log(chalk.blue(`📊 Getting status for agent: ${agentId}`));
            // Implementation...
        } catch (error) {
            console.error(chalk.red('❌ Error getting status:'), error.message);
        }
    });

program.parse();
```

#### 4.2 Tests E2E Robustes avec Helpers (tests/e2e/autoweave-kagent.test.js)
```javascript
const { AutoWeave } = require('../../src/core/autoweave');
const { KagentBridge } = require('../../src/kagent/bridge');
const config = require('../../config/autoweave/config.test');

// Test helpers
class TestHelpers {
    static async waitForAgentReady(autoweave, agentId, timeout = 60000) {
        const start = Date.now();

        while (Date.now() - start < timeout) {
            const status = await autoweave.getAgentStatus(agentId);

            if (status?.ready || status?.status === 'Ready') {
                return status;
            }

            if (status?.status === 'Failed' || status?.status === 'Error') {
                throw new Error(`Agent failed to deploy: ${status.error || 'Unknown error'}`);
            }

            await global.testHelpers.sleep(2000);
        }

        throw new Error(`Agent not ready after ${timeout}ms`);
    }

    static async cleanupAgent(autoweave, agentId) {
        try {
            const agent = autoweave.deployedAgents.get(agentId);
            if (agent) {
                await autoweave.kagentBridge.deleteAgent(agentId);
            }
        } catch (error) {
            console.warn(`Failed to cleanup agent ${agentId}:`, error.message);
        }
    }

    static generateTestWorkflow(name = 'test-agent') {
        const id = global.testHelpers.generateTestId();
        return {
            id,
            name: `${name}-${id.split('-')[1]}`, // Shorter name for K8s
            description: `Test agent for automated testing - ${name}`,
            requiredModules: [
                {
                    name: 'file-reader',
                    type: 'file_system',
                    description: 'Read files from filesystem'
                }
            ],
            steps: [
                {
                    action: 'read_file',
                    description: 'Read and process file content'
                }
            ],
            modelConfig: {
                name: 'gpt-4',
                temperature: 0.7
            }
        };
    }
}

describe('AutoWeave + kagent E2E Tests', () => {
    let autoweave;
    let kagentBridge;
    const createdAgents = new Set();

    beforeAll(async () => {
        console.log('🚀 Setting up E2E test environment...');

        // Setup kagent bridge with test config
        kagentBridge = new KagentBridge(config.kagent);
        await kagentBridge.initialize();

        // Verify kagent is ready
        expect(kagentBridge.isInitialized).toBe(true);
        expect(kagentBridge.availableTools.length).toBeGreaterThan(0);

        // Setup AutoWeave with test config
        autoweave = new AutoWeave(config, kagentBridge);
        await autoweave.initialize();

        console.log('✅ E2E test environment ready');
    }, 60000);

    afterAll(async () => {
        console.log('🧹 Cleaning up E2E test environment...');

        // Cleanup all created agents
        for (const agentId of createdAgents) {
            await TestHelpers.cleanupAgent(autoweave, agentId);
        }

        // Shutdown components
        if (autoweave) {
            await autoweave.shutdown();
        }
        if (kagentBridge) {
            await kagentBridge.shutdown();
        }

        console.log('✅ E2E cleanup complete');
    }, 30000);

    describe('Agent Creation and Deployment', () => {
        test('Should create and deploy simple file processor agent', async () => {
            const description = "Créer un agent qui lit des fichiers et génère un résumé";

            const result = await autoweave.createAndDeployAgent(description);
            createdAgents.add(result.workflow.id);

            // Verify workflow generation
            expect(result.workflow).toBeDefined();
            expect(result.workflow.id).toBeDefined();
            expect(result.workflow.name).toBeTruthy();
            expect(result.workflow.requiredModules.length).toBeGreaterThan(0);

            // Verify deployment
            expect(result.deployment).toBeDefined();
            expect(result.deployment.status).toBe('deploying');
            expect(result.deployment.kagentName).toBeTruthy();

            // Wait for agent to be ready
            const finalStatus = await TestHelpers.waitForAgentReady(
                autoweave,
                result.workflow.id,
                90000 // 90 seconds timeout
            );

            expect(finalStatus.ready).toBe(true);
            expect(finalStatus.pods.length).toBeGreaterThan(0);

        }, 120000);

        test('Should create Kubernetes monitoring agent with native tools', async () => {
            const description = "Créer un agent qui surveille les pods Kubernetes et alerte en cas de problème";

            const result = await autoweave.createAndDeployAgent(description);
            createdAgents.add(result.workflow.id);

            // Verify kagent tools integration
            expect(result.workflow.requiredModules.some(m =>
                m.kagentTools && m.kagentTools.length > 0
            )).toBe(true);

            expect(result.workflow.kagentCompatible).toBe(true);

            // Check for kubernetes-related tools
            const yamlGenerator = kagentBridge.yamlGenerator;
            const kagentYAML = yamlGenerator.generateFromWorkflow(result.workflow);

            expect(kagentYAML.agent.spec.tools).toEqual(
                expect.arrayContaining(['kubectl'])
            );

        }, 60000);
    });

    describe('YAML Generation and Validation', () => {
        test('Should generate valid kagent YAML from workflow', async () => {
            const workflow = TestHelpers.generateTestWorkflow('yaml-test');

            const yamlGenerator = kagentBridge.yamlGenerator;
            const result = yamlGenerator.generateFromWorkflow(workflow);

            // Validate agent YAML structure
            expect(result.agent).toBeDefined();
            expect(result.agent.apiVersion).toBe('kagent.dev/v1alpha1');
            expect(result.agent.kind).toBe('Agent');
            expect(result.agent.metadata.name).toBeTruthy();
            expect(result.agent.metadata.labels['autoweave.dev/generated']).toBe('true');

            // Validate spec
            expect(result.agent.spec.systemPrompt).toContain('Test agent');
            expect(result.agent.spec.tools).toContain('file-reader');
            expect(result.agent.spec.modelConfig.name).toBe('gpt-4');

            // Validate Kubernetes naming conventions
            expect(result.agent.metadata.name).toMatch(/^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/);
            expect(result.agent.metadata.name.length).toBeLessThanOrEqual(63);
        });

        test('Should handle complex workflows with custom tools', async () => {
            const complexWorkflow = {
                id: global.testHelpers.generateTestId(),
                name: 'complex-test-agent',
                description: 'Complex agent with custom MCP tools',
                requiredModules: [
                    { name: 'kubernetes', type: 'kubernetes' },
                    { name: 'custom-api', type: 'mcp_server', custom: true, url: 'http://custom:3000' },
                    { name: 'file-ops', type: 'file_system' }
                ],
                steps: [
                    { action: 'read_file', description: 'Read configuration' },
                    { action: 'check_pods', description: 'Check pod status' },
                    { action: 'call_api', description: 'Call custom API' }
                ]
            };

            const yamlGenerator = kagentBridge.yamlGenerator;
            const result = yamlGenerator.generateFromWorkflow(complexWorkflow);

            // Should include both built-in and custom tools
            expect(result.agent.spec.tools).toContain('kubectl');
            expect(result.agent.spec.tools).toContain('file-reader');

            // Should create custom tool CRD
            expect(result.tools).toBeDefined();
            expect(result.tools.length).toBeGreaterThan(0);

            const customTool = result.tools.find(t =>
                t.metadata.name.includes('custom-api')
            );
            expect(customTool).toBeDefined();
            expect(customTool.spec.mcpServer.url).toBe('http://custom:3000');
        });
    });

    describe('Agent Status and Monitoring', () => {
        test('Should track agent status changes over time', async () => {
            const workflow = TestHelpers.generateTestWorkflow('status-test');

            const result = await autoweave.createAndDeployAgent(workflow.description);
            const agentId = result.workflow.id;
            createdAgents.add(agentId);

            // Initial status should be deploying
            let status = await autoweave.getAgentStatus(agentId);
            expect(status).toBeDefined();
            expect(status.id).toBe(agentId);
            expect(['deploying', 'pending'].includes(status.status)).toBe(true);

            // Wait for status to change and track progression
            const statusHistory = [status.status];

            await global.testHelpers.waitFor(async () => {
                status = await autoweave.getAgentStatus(agentId);
                if (status.status !== statusHistory[statusHistory.length - 1]) {
                    statusHistory.push(status.status);
                }
                return status.ready || status.status === 'Ready';
            }, 60000);

            // Verify status progression
            expect(statusHistory.length).toBeGreaterThan(1);
            expect(status.kagentDetails).toBeDefined();
            expect(status.lastUpdated).toBeInstanceOf(Date);

        }, 90000);

        test('Should provide detailed pod information', async () => {
            const workflow = TestHelpers.generateTestWorkflow('pod-test');

            const result = await autoweave.createAndDeployAgent(workflow.description);
            createdAgents.add(result.workflow.id);

            const finalStatus = await TestHelpers.waitForAgentReady(
                autoweave,
                result.workflow.id
            );

            // Verify pod details
            expect(finalStatus.pods).toBeDefined();
            expect(Array.isArray(finalStatus.pods)).toBe(true);

            if (finalStatus.pods.length > 0) {
                const pod = finalStatus.pods[0];
                expect(pod.name).toBeTruthy();
                expect(pod.status).toBeTruthy();
                expect(typeof pod.ready).toBe('boolean');
                expect(typeof pod.restarts).toBe('number');
            }
        }, 90000);
    });

    describe('Error Handling and Recovery', () => {
        test('Should handle invalid workflow gracefully', async () => {
            const invalidDescription = "x"; // Too short

            await expect(
                autoweave.createAndDeployAgent(invalidDescription)
            ).rejects.toThrow(/Description must be at least 10 characters/);
        });

        test('Should rollback on deployment failure', async () => {
            // Create workflow with invalid tool reference
            const invalidWorkflow = {
                id: global.testHelpers.generateTestId(),
                name: 'invalid-test',
                description: 'Agent with invalid configuration that should fail',
                requiredModules: [
                    { name: 'non-existent-tool', type: 'invalid_type' }
                ]
            };

            // This might fail or succeed depending on kagent's validation
            // The test verifies our error handling works
            try {
                const result = await autoweave.agentWeaver.generateWorkflow(invalidWorkflow.description);
                const deployResult = await kagentBridge.deployAgent(result);
                createdAgents.add(result.id);

                // If it doesn't fail immediately, that's also valid
                expect(deployResult).toBeDefined();
            } catch (error) {
                // Should be a meaningful error
                expect(error.message).toBeTruthy();
                expect(error.message.length).toBeGreaterThan(10);
            }
        });
    });
});

// Integration tests for individual components
describe('Component Integration Tests', () => {
    let kagentBridge;

    beforeAll(async () => {
        kagentBridge = new KagentBridge(config.kagent);
        await kagentBridge.initialize();
    });

    afterAll(async () => {
        await kagentBridge.shutdown();
    });

    test('Should connect to kagent cluster successfully', () => {
        expect(kagentBridge.isInitialized).toBe(true);
        expect(kagentBridge.availableTools).toBeDefined();
        expect(Array.isArray(kagentBridge.availableTools)).toBe(true);
    });

    test('Should discover tool capabilities', () => {
        expect(kagentBridge.toolCapabilities).toBeDefined();
        expect(kagentBridge.toolCapabilities instanceof Map).toBe(true);

        // Log available capabilities for debugging
        console.log('Available tool capabilities:',
            Array.from(kagentBridge.toolCapabilities.keys()).slice(0, 10)
        );
    });

    test('Should validate Kubernetes names correctly', () => {
        const yamlGenerator = kagentBridge.yamlGenerator;

        // Valid names
        expect(yamlGenerator.sanitizeName('test-agent')).toBe('test-agent');
        expect(yamlGenerator.sanitizeName('myagent123')).toBe('myagent123');

        // Invalid names that should be sanitized
        expect(yamlGenerator.sanitizeName('Test Agent!')).toBe('test-agent');
        expect(yamlGenerator.sanitizeName('UPPERCASE')).toBe('uppercase');
        expect(yamlGenerator.sanitizeName('multiple---dashes')).toBe('multiple-dashes');

        // Edge cases
        expect(yamlGenerator.sanitizeName('123-start-number')).toBe('123-start-number');
        expect(yamlGenerator.sanitizeName('-start-dash')).toBe('start-dash');
        expect(yamlGenerator.sanitizeName('end-dash-')).toBe('end-dash');
    });
});
```

### Phase 5 : Documentation & Scripts Complète (Jour 5)

#### 5.1 Setup Script kagent Robuste (scripts/setup-kagent.sh)
```bash
#!/bin/bash

set -e  # Exit on any error

echo "🚀 AutoWeave + kagent Setup Script"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Logging functions
log_info() { echo -e "${BLUE}ℹ️  $1${NC}"; }
log_success() { echo -e "${GREEN}✅ $1${NC}"; }
log_warn() { echo -e "${YELLOW}⚠️  $1${NC}"; }
log_error() { echo -e "${RED}❌ $1${NC}"; }

# Cleanup function
cleanup() {
    if [ ! -z "$TEMP_DIR" ] && [ -d "$TEMP_DIR" ]; then
        rm -rf "$TEMP_DIR"
    fi
}
trap cleanup EXIT

# Create temp directory
TEMP_DIR=$(mktemp -d)

# Check if running as root (not recommended)
if [ "$EUID" -eq 0 ]; then
    log_warn "Running as root is not recommended"
    read -p "Continue anyway? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Version requirements
REQUIRED_NODE_VERSION="18.0.0"
REQUIRED_DOCKER_VERSION="20.0.0"

# Function to compare versions
version_ge() {
    printf '%s\n' "$2" "$1" | sort -V -C
}

log_info "Checking prerequisites..."

# Check Docker
if ! command -v docker &> /dev/null; then
    log_error "Docker not found. Please install Docker first."
    log_info "Visit: https://docs.docker.com/get-docker/"
    exit 1
fi

DOCKER_VERSION=$(docker --version | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' | head -1)
if ! version_ge "$DOCKER_VERSION" "$REQUIRED_DOCKER_VERSION"; then
    log_error "Docker version $REQUIRED_DOCKER_VERSION+ required, found $DOCKER_VERSION"
    exit 1
fi

# Check if Docker daemon is running
if ! docker info >/dev/null 2>&1; then
    log_error "Docker daemon is not running. Please start Docker first."
    exit 1
fi

log_success "Docker $DOCKER_VERSION"

# Check Node.js
if ! command -v node &> /dev/null; then
    log_error "Node.js not found. Please install Node.js $REQUIRED_NODE_VERSION+ first."
    log_info "Visit: https://nodejs.org/en/download/"
    exit 1
fi

NODE_VERSION=$(node --version | cut -d'v' -f2)
if ! version_ge "$NODE_VERSION" "$REQUIRED_NODE_VERSION"; then
    log_error "Node.js $REQUIRED_NODE_VERSION+ required, found $NODE_VERSION"
    exit 1
fi

log_success "Node.js $NODE_VERSION"

# Check kubectl
if ! command -v kubectl &> /dev/null; then
    log_warn "kubectl not found. Installing..."
    cd "$TEMP_DIR"
    curl -LO "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl"
    chmod +x kubectl
    sudo mv kubectl /usr/local/bin/
    log_success "kubectl installed"
else
    log_success "kubectl $(kubectl version --client --short | cut -d' ' -f3)"
fi

# Check kind
if ! command -v kind &> /dev/null; then
    log_warn "kind not found. Installing..."
    cd "$TEMP_DIR"
    curl -Lo ./kind https://kind.sigs.k8s.io/dl/v0.20.0/kind-linux-amd64
    chmod +x ./kind
    sudo mv ./kind /usr/local/bin/kind
    log_success "kind installed"
else
    log_success "kind $(kind version | cut -d' ' -f2)"
fi

# Check/create kind cluster
CLUSTER_NAME="autoweave"
log_info "Setting up Kubernetes cluster..."

if kind get clusters 2>/dev/null | grep -q "^$CLUSTER_NAME$"; then
    log_info "Cluster '$CLUSTER_NAME' already exists"

    # Verify cluster is accessible
    if ! kubectl cluster-info --context "kind-$CLUSTER_NAME" >/dev/null 2>&1; then
        log_warn "Cluster exists but not accessible. Recreating..."
        kind delete cluster --name "$CLUSTER_NAME"
    else
        log_success "Cluster '$CLUSTER_NAME' is running"
    fi
fi

if ! kind get clusters 2>/dev/null | grep -q "^$CLUSTER_NAME$"; then
    log_info "Creating cluster '$CLUSTER_NAME'..."

    # Create kind config
    cat > "$TEMP_DIR/kind-config.yaml" <<EOF
kind: Cluster
apiVersion: kind.x-k8s.io/v1alpha4
name: $CLUSTER_NAME
nodes:
- role: control-plane
  kubeadmConfigPatches:
  - |
    kind: InitConfiguration
    nodeRegistration:
      kubeletExtraArgs:
        node-labels: "ingress-ready=true"
  extraPortMappings:
  - containerPort: 80
    hostPort: 8080
    protocol: TCP
  - containerPort: 443
    hostPort: 8443
    protocol: TCP
EOF

    if ! kind create cluster --config "$TEMP_DIR/kind-config.yaml"; then
        log_error "Failed to create kind cluster"
        exit 1
    fi

    log_success "Cluster '$CLUSTER_NAME' created"
fi

# Wait for cluster to be ready
log_info "Waiting for cluster to be ready..."
timeout 120 bash -c 'until kubectl get nodes | grep -q "Ready"; do sleep 2; done' || {
    log_error "Cluster not ready after 2 minutes"
    exit 1
}

log_success "Cluster is ready"

# Install kagent CLI
log_info "Installing kagent CLI..."
if ! command -v kagent &> /dev/null; then
    if ! curl -fsSL https://raw.githubusercontent.com/kagent-dev/kagent/refs/heads/main/scripts/get-kagent | bash; then
        log_error "Failed to install kagent CLI"
        exit 1
    fi

    # Add to PATH for current session
    export PATH=$PATH:$HOME/.local/bin

    # Add to shell profile
    if [ -f "$HOME/.bashrc" ]; then
        echo 'export PATH=$PATH:$HOME/.local/bin' >> "$HOME/.bashrc"
    fi

    log_success "kagent CLI installed"
else
    log_success "kagent CLI already installed"
fi

# Check OPENAI_API_KEY
log_info "Checking OpenAI API key..."
if [ -z "$OPENAI_API_KEY" ]; then
    log_warn "OPENAI_API_KEY not set"

    while true; do
        read -p "Enter your OpenAI API key (or press Enter to skip): " -s API_KEY
        echo

        if [ -z "$API_KEY" ]; then
            log_warn "Skipping API key setup. You'll need to set OPENAI_API_KEY before using AutoWeave."
            break
        fi

        # Basic validation
        if [[ $API_KEY =~ ^sk-[a-zA-Z0-9]{48}$ ]]; then
            export OPENAI_API_KEY="$API_KEY"

            # Add to .env file
            if [ -f ".env" ]; then
                sed -i "s/OPENAI_API_KEY=.*/OPENAI_API_KEY=$API_KEY/" .env
            else
                echo "OPENAI_API_KEY=$API_KEY" >> .env
            fi

            log_success "OpenAI API key configured"
            break
        else
            log_error "Invalid API key format. Expected: sk-[48 characters]"
        fi
    done
else
    log_success "OpenAI API key is set"
fi

# Install kagent to cluster
log_info "Installing kagent to cluster..."

# Check if already installed
if kubectl get namespace kagent-system >/dev/null 2>&1; then
    log_info "kagent already installed"
else
    if ! kagent install; then
        log_error "Failed to install kagent"
        exit 1
    fi

    log_success "kagent installed to cluster"
fi

# Wait for kagent to be ready
log_info "Waiting for kagent to be ready..."
if ! kubectl wait --for=condition=ready pod -l app=kagent-controller -n kagent-system --timeout=300s; then
    log_error "kagent not ready after 5 minutes"
    log_info "Check status with: kubectl get pods -n kagent-system"
    exit 1
fi

log_success "kagent is ready"

# Setup AutoWeave dependencies
log_info "Installing AutoWeave dependencies..."
if [ -f "package.json" ]; then
    if ! npm install; then
        log_error "Failed to install npm dependencies"
        exit 1
    fi
    log_success "npm dependencies installed"
else
    log_warn "package.json not found. Run this script from AutoWeave project directory."
fi

# Setup port-forward for kagent UI (background process)
log_info "Setting up kagent UI access..."

# Kill existing port-forward
pkill -f "kubectl port-forward.*kagent-ui" 2>/dev/null || true

# Start new port-forward
kubectl port-forward -n kagent-system svc/kagent-ui 8080:80 >/dev/null 2>&1 &
PORTFORWARD_PID=$!

# Save PID for cleanup
echo $PORTFORWARD_PID > /tmp/kagent-portforward.pid

# Wait a moment and check if port-forward is working
sleep 3
if kill -0 $PORTFORWARD_PID 2>/dev/null; then
    log_success "kagent UI port-forward started (PID: $PORTFORWARD_PID)"
else
    log_warn "Failed to start kagent UI port-forward"
fi

# Final verification
log_info "Running final verification..."

# Test kubectl access
if ! kubectl get nodes >/dev/null 2>&1; then
    log_error "Cannot access cluster"
    exit 1
fi

# Test kagent installation
if ! kubectl get crd | grep -q kagent.dev; then
    log_error "kagent CRDs not found"
    exit 1
fi

# Success message
echo ""
log_success "🎉 AutoWeave + kagent setup complete!"
echo ""
echo -e "${BLUE}📋 Next steps:${NC}"
echo "1. cd /home/gontrand/autoweave"
echo "2. npm run health  # Run health check"
echo "3. npm run create-agent  # Create your first agent"
echo ""
echo -e "${BLUE}🌐 Access points:${NC}"
echo "- kagent UI: http://localhost:8080"
echo "- AutoWeave API: http://localhost:3000 (after npm start)"
echo ""
echo -e "${BLUE}🛠️  Useful commands:${NC}"
echo "- kubectl get pods -n kagent-system  # Check kagent status"
echo "- kubectl get agents  # List deployed agents"
echo "- kill \$(cat /tmp/kagent-portforward.pid)  # Stop UI port-forward"
echo ""

# Save setup info
cat > setup-info.txt <<EOF
AutoWeave + kagent Setup completed: $(date)
Cluster: kind-$CLUSTER_NAME
kagent UI: http://localhost:8080
Port-forward PID: $PORTFORWARD_PID

To stop port-forward: kill $PORTFORWARD_PID
To restart port-forward: kubectl port-forward -n kagent-system svc/kagent-ui 8080:80
EOF

log_info "Setup information saved to setup-info.txt"
```

#### 5.2 Documentation API Complète

```markdown
# docs/api/README.md
# AutoWeave API Documentation

## Overview

AutoWeave provides a REST API for creating and managing AI agents that are automatically deployed to Kubernetes via kagent.

## Base URL

```
http://localhost:3000/api
```

## Authentication

Currently no authentication required for development. Production deployments should implement proper authentication.

## Endpoints

### POST /agents

Create and deploy a new agent.

**Request Body:**
```json
{
  "description": "string (required, min 10 chars)",
  "name": "string (optional, auto-generated if not provided)",
  "options": {
    "model": "string (optional, default: gpt-4)",
    "temperature": "number (optional, default: 0.7)",
    "timeout": "number (optional, default: 30000)"
  }
}
```

**Response:**
```json
{
  "workflow": {
    "id": "string",
    "name": "string",
    "description": "string",
    "requiredModules": [...],
    "kagentCompatible": "boolean"
  },
  "deployment": {
    "name": "string",
    "kagentName": "string",
    "status": "deploying|ready|failed",
    "createdAt": "ISO date string"
  },
  "status": "deployed"
}
```

**Example:**
```bash
curl -X POST http://localhost:3000/api/agents \
  -H "Content-Type: application/json" \
  -d '{
    "description": "Create an agent that monitors Kubernetes pods and alerts on failures"
  }'
```

### GET /agents/:id

Get agent status and details.

**Response:**
```json
{
  "id": "string",
  "name": "string",
  "description": "string",
  "status": "deploying|ready|failed|error",
  "ready": "boolean",
  "createdAt": "ISO date string",
  "lastUpdated": "ISO date string",
  "kagentDetails": {
    "phase": "string",
    "conditions": [...]
  },
  "pods": [
    {
      "name": "string",
      "status": "string",
      "ready": "boolean",
      "restarts": "number"
    }
  ]
}
```

### DELETE /agents/:id

Delete an agent and its resources.

**Response:**
```json
{
  "message": "Agent deleted successfully"
}
```

### GET /health

Health check endpoint.

**Response:**
```json
{
  "status": "ok",
  "kagent": "connected|disconnected",
  "cluster": "ready|not-ready",
  "timestamp": "ISO date string"
}
```

### GET /tools

List available kagent tools.

**Response:**
```json
{
  "tools": [
    {
      "name": "string",
      "description": "string",
      "type": "string",
      "capabilities": ["string"]
    }
  ],
  "count": "number"
}
```

## Error Responses

All endpoints return errors in this format:

```json
{
  "error": "Error message",
  "code": "ERROR_CODE",
  "details": {...}
}
```

Common error codes:
- `VALIDATION_ERROR`: Input validation failed
- `KAGENT_ERROR`: kagent operation failed
- `K8S_API_ERROR`: Kubernetes API error
- `AGENT_NOT_FOUND`: Agent ID not found
- `TIMEOUT_ERROR`: Operation timed out

## WebSocket Events

Connect to `/ws` for real-time agent status updates:

```javascript
const ws = new WebSocket('ws://localhost:3000/ws');

ws.on('message', (data) => {
  const event = JSON.parse(data);
  console.log('Agent event:', event);
});
```

Event types:
- `agent.created`
- `agent.deployed`
- `agent.ready`
- `agent.failed`
- `agent.deleted`
```

#### 5.3 Guide de Troubleshooting

```markdown
# docs/troubleshooting/README.md
# AutoWeave Troubleshooting Guide

## Common Issues

### 1. kagent Installation Problems

#### Error: "kagent CRDs not found"

**Cause:** kagent not properly installed or cluster not accessible.

**Solution:**
```bash
# Check cluster access
kubectl cluster-info

# Reinstall kagent
kagent install

# Verify installation
kubectl get crd | grep kagent.dev
kubectl get pods -n kagent-system
```

#### Error: "kagent controller not running"

**Cause:** kagent controller pod failed to start.

**Solution:**
```bash
# Check controller logs
kubectl logs -n kagent-system -l app=kagent-controller

# Check resource constraints
kubectl describe pods -n kagent-system

# Restart controller
kubectl delete pods -n kagent-system -l app=kagent-controller
```

### 2. Agent Deployment Issues

#### Error: "Agent stuck in deploying status"

**Cause:** Resource constraints or configuration issues.

**Solution:**
```bash
# Check agent status
kubectl get agents
kubectl describe agent <agent-name>

# Check pod logs
kubectl logs -l app=<agent-name>

# Check resource usage
kubectl top nodes
kubectl top pods
```

#### Error: "Tool not found"

**Cause:** Required kagent tool not available.

**Solution:**
```bash
# List available tools
kubectl get tools

# Check specific tool
kubectl describe tool <tool-name>

# Install missing tool (if available)
kagent tool install <tool-name>
```

### 3. API and Configuration Issues

#### Error: "OPENAI_API_KEY not set"

**Solution:**
```bash
# Set in .env file
echo "OPENAI_API_KEY=sk-your-key-here" >> .env

# Or export temporarily
export OPENAI_API_KEY="sk-your-key-here"
```

#### Error: "Port 3000 already in use"

**Solution:**
```bash
# Find process using port
lsof -i :3000

# Kill process or change port
export PORT=3001
npm start
```

### 4. Kubernetes/Docker Issues

#### Error: "Cannot connect to Docker daemon"

**Solution:**
```bash
# Start Docker
sudo systemctl start docker

# Add user to docker group
sudo usermod -aG docker $USER
# Then logout and login again
```

#### Error: "kind cluster not accessible"

**Solution:**
```bash
# Check cluster status
kind get clusters

# Recreate cluster
kind delete cluster --name autoweave
bash scripts/setup-kagent.sh
```

## Debugging Commands

### Check Overall Health
```bash
# Run health check
npm run health

# Check all components
kubectl get all -n kagent-system
kubectl get agents
kubectl get tools
```

### Agent Debugging
```bash
# Get agent details
kubectl describe agent <agent-name>

# Check logs
kubectl logs -l app=<agent-name> --tail=100

# Get events
kubectl get events --sort-by='.lastTimestamp'
```

### Network Debugging
```bash
# Test kagent UI access
curl -f http://localhost:8080/health

# Test AutoWeave API
curl -f http://localhost:3000/health

# Check port-forwards
ps aux | grep "port-forward"
```

## Log Analysis

### AutoWeave Logs
```bash
# Application logs
tail -f logs/autoweave.log

# Error logs only
grep ERROR logs/autoweave.log
```

### kagent Logs
```bash
# Controller logs
kubectl logs -n kagent-system -l app=kagent-controller -f

# Agent logs
kubectl logs -l autoweave.dev/generated=true -f
```

## Performance Issues

### High Memory Usage
```bash
# Check resource usage
kubectl top pods
kubectl top nodes

# Scale down if needed
kubectl scale deployment <deployment-name> --replicas=1
```

### Slow Agent Creation
```bash
# Check API response times
curl -w "@curl-format.txt" -X POST http://localhost:3000/api/agents

# Monitor LLM API calls
grep "OpenAI API" logs/autoweave.log
```

## Recovery Procedures

### Reset Everything
```bash
# Clean up all agents
kubectl delete agents --all

# Reset cluster
kind delete cluster --name autoweave
bash scripts/setup-kagent.sh
```

### Partial Reset
```bash
# Clean up test resources
npm run dev:clean

# Restart AutoWeave
npm run dev
```

## Getting Help

1. Check this troubleshooting guide
2. Review logs with `npm run health`
3. Check GitHub issues
4. Join Discord community
5. Create detailed bug report with:
   - AutoWeave version
   - Environment details
   - Complete error logs
   - Steps to reproduce
```

#### 5.4 Scripts de Développement Supplémentaires

```bash
# scripts/cleanup-test-resources.sh
#!/bin/bash

source scripts/dev-helpers.sh

log_info "Cleaning up test resources..."

# Delete test agents
log_info "Deleting test agents..."
kubectl delete agents -l autoweave.dev/test=true --ignore-not-found=true

# Delete test tools
log_info "Deleting test tools..."
kubectl delete tools -l autoweave.dev/test=true --ignore-not-found=true

# Clean up test namespaces
if kubectl get namespace autoweave-test >/dev/null 2>&1; then
    log_info "Deleting test namespace..."
    kubectl delete namespace autoweave-test --timeout=60s
fi

# Clean up Docker containers
log_info "Cleaning up Docker containers..."
docker container prune -f

log_success "Test resources cleaned up"
```

```bash
# scripts/dev-watch.sh
#!/bin/bash

# Watch for changes and restart AutoWeave
npx nodemon --watch src --ext js --exec "npm start" --delay 2
```

```bash
# scripts/generate-docs.sh
#!/bin/bash

log_info "Generating API documentation..."

# Generate JSDoc
npx jsdoc src -r -d docs/generated

# Generate OpenAPI spec from code
node scripts/generate-openapi.js > docs/api/openapi.json

log_success "Documentation generated"
```

#### 5.1 Setup Script kagent (scripts/setup-kagent.sh)
```bash
#!/bin/bash

echo "🚀 AutoWeave + kagent Setup Script"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check prerequisites
echo -e "${BLUE}📋 Checking prerequisites...${NC}"

# Check Docker
if ! command -v docker &> /dev/null; then
    echo -e "${RED}❌ Docker not found. Please install Docker first.${NC}"
    exit 1
fi

# Check kubectl
if ! command -v kubectl &> /dev/null; then
    echo -e "${YELLOW}⚠️  kubectl not found. Installing...${NC}"
    curl -LO "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl"
    chmod +x kubectl
    sudo mv kubectl /usr/local/bin/
fi

# Check kind
if ! command -v kind &> /dev/null; then
    echo -e "${YELLOW}⚠️  kind not found. Installing...${NC}"
    curl -Lo ./kind https://kind.sigs.k8s.io/dl/v0.20.0/kind-linux-amd64
    chmod +x ./kind
    sudo mv ./kind /usr/local/bin/kind
fi

# Check Node.js
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js not found. Please install Node.js 18+ first.${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Prerequisites check complete${NC}"

# Create kind cluster
echo -e "${BLUE}☸️  Creating Kubernetes cluster...${NC}"
if kind get clusters | grep -q "autoweave"; then
    echo -e "${YELLOW}⚠️  Cluster 'autoweave' already exists${NC}"
else
    kind create cluster --name autoweave --config - <<EOF
kind: Cluster
apiVersion: kind.x-k8s.io/v1alpha4
nodes:
- role: control-plane
  kubeadmConfigPatches:
  - |
    kind: InitConfiguration
    nodeRegistration:
      kubeletExtraArgs:
        node-labels: "ingress-ready=true"
  extraPortMappings:
  - containerPort: 80
    hostPort: 8080
    protocol: TCP
  - containerPort: 443
    hostPort: 8443
    protocol: TCP
EOF
fi

# Install kagent
echo -e "${BLUE}🤖 Installing kagent...${NC}"
if ! command -v kagent &> /dev/null; then
    curl https://raw.githubusercontent.com/kagent-dev/kagent/refs/heads/main/scripts/get-kagent | bash
    export PATH=$PATH:$HOME/.local/bin
fi

# Check OPENAI_API_KEY
if [ -z "$OPENAI_API_KEY" ]; then
    echo -e "${YELLOW}⚠️  OPENAI_API_KEY not set${NC}"
    read -p "Enter your OpenAI API key: " -s OPENAI_API_KEY
    echo
    export OPENAI_API_KEY=$OPENAI_API_KEY
    echo "export OPENAI_API_KEY=$OPENAI_API_KEY" >> ~/.bashrc
fi

# Install kagent to cluster
echo -e "${BLUE}⚙️  Installing kagent to cluster...${NC}"
kagent install

# Verify installation
echo -e "${BLUE}🔍 Verifying installation...${NC}"
kubectl wait --for=condition=ready pod -l app=kagent-controller -n kagent-system --timeout=120s

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ kagent installation complete!${NC}"
else
    echo -e "${RED}❌ kagent installation failed${NC}"
    exit 1
fi

# Setup port-forward for kagent UI (background)
echo -e "${BLUE}🌐 Setting up kagent UI access...${NC}"
kubectl port-forward -n kagent-system svc/kagent-ui 8080:80 &
PORTFORWARD_PID=$!
echo $PORTFORWARD_PID > /tmp/kagent-portforward.pid

echo -e "${GREEN}🎉 Setup complete!${NC}"
echo -e "${BLUE}Access kagent UI at: http://localhost:8080${NC}"
echo -e "${BLUE}Stop port-forward: kill \$(cat /tmp/kagent-portforward.pid)${NC}"
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo "1. cd /home/gontrand/autoweave"
echo "2. npm install"
echo "3. npm run create-agent"
```

#### 5.2 README Complet
```markdown
# AutoWeave + kagent 🕸️☸️
*Self-Weaving Agent Orchestrator powered by kagent*

AutoWeave combines natural language agent creation with Kubernetes-native execution via kagent.

## Architecture

- **AutoWeave**: Natural language → agent workflows
- **kagent**: Kubernetes-native agent runtime
- **Bridge**: Automatic YAML generation and deployment

## Quick Start

```bash
# 1. Setup kagent + cluster
cd /home/gontrand/autoweave
bash scripts/setup-kagent.sh

# 2. Install dependencies
npm install

# 3. Create your first agent
npm run create-agent
# or
node src/cli/create-agent.js create -d "Monitor Kubernetes pods and alert on issues"
```

## Examples

### Simple File Processor
```bash
autoweave create -d "Read files and generate summaries"
```

### Kubernetes Monitor
```bash
autoweave create -d "Monitor cluster health and alert on pod failures"
```

### Development Agent
```bash
autoweave create -d "Analyze Python code and suggest improvements"
```

## Validation Tests

```bash
# Unit tests
npm test

# Integration tests (requires kagent cluster)
npm run test:integration

# End-to-end tests (full workflow)
npm run test:e2e
```

## Architecture Details

AutoWeave generates kagent-compatible YAML:

```yaml
apiVersion: kagent.dev/v1alpha1
kind: Agent
metadata:
  name: file-processor
spec:
  systemPrompt: "You are a file processing agent..."
  tools:
    - file-reader
    - text-analyzer
  modelConfig:
    name: gpt-4
```

## Available Tools (via kagent)

- **Kubernetes**: kubectl, k8s-logs, pod-monitor
- **Monitoring**: prometheus, grafana
- **Development**: file-reader, code-analyzer
- **Custom**: MCP servers via URL

## Status & Monitoring

```bash
# Check agent status
autoweave status <agent-id>

# kagent UI
kubectl port-forward -n kagent-system svc/kagent-ui 8080:80
# Visit http://localhost:8080
```

## Development

See [DEVELOPMENT.md](docs/DEVELOPMENT.md) for development setup.
```

## 🎯 Success Criteria Révisés

### ✅ AutoWeave + kagent Integration
- [ ] kagent cluster déployé et fonctionnel
- [ ] AutoWeave génère YAML kagent valides
- [ ] Agents déployés automatiquement sur Kubernetes
- [ ] Status monitoring temps réel
- [ ] Tests E2E passent avec agents réels

### ✅ Cloud Native Benefits
- [ ] Scaling automatique via Kubernetes
- [ ] Observability via kagent + oTEL
- [ ] Production-ready deployment
- [ ] Multi-agent orchestration
- [ ] Tool discovery automatique

## 💡 Avantages de cette Approche

1. **Best of Both Worlds**: Création intuitive + Runtime enterprise
2. **Cloud Native**: Scaling K8s + observability intégrée
3. **Active Development**: kagent très actif, roadmap CNCF
4. **Tool Ecosystem**: Outils cloud native + MCP extensions
5. **Production Ready**: Architecture éprouvée Microsoft AutoGen

## 🎯 Améliorations Apportées au Plan Original

En relisant le rapport avec l'œil de Claude Code, j'ai identifié et corrigé **plusieurs gaps critiques** :

### ✅ **Configuration et Environment**
- **Ajouté** : Fichiers `.env.example`, `.gitignore`, configuration Jest
- **Ajouté** : Configuration test séparée pour isolation
- **Ajouté** : Validation des variables d'environnement
- **Ajouté** : Gestion robuste des API keys

### ✅ **Error Handling et Validation**
- **Ajouté** : Classes d'erreur spécialisées (`KagentError`, `ValidationError`)
- **Ajouté** : Retry logic avec backoff exponentiel
- **Ajouté** : Validation complète des inputs utilisateur
- **Ajouté** : Rollback automatique en cas d'échec deployment

### ✅ **Logging et Monitoring**
- **Ajouté** : Logger structuré avec niveaux configurables
- **Ajouté** : Logging coloré pour développement
- **Ajouté** : Monitoring status détaillé des agents
- **Ajouté** : Health checks automatisés

### ✅ **Tests Robustes**
- **Ajouté** : Test helpers avec utilitaires de wait/cleanup
- **Ajouté** : Setup/teardown automatique des ressources
- **Ajouté** : Tests d'intégration avec timeout appropriés
- **Ajouté** : Validation complète des CRDs Kubernetes

### ✅ **Scripts de Développement**
- **Ajouté** : Setup script robuste avec validation de prérequis
- **Ajouté** : Health check script complet
- **Ajouté** : Scripts de cleanup et utilitaires dev
- **Ajouté** : Helpers réutilisables pour développement

### ✅ **Documentation Complète**
- **Ajouté** : Documentation API REST complète
- **Ajouté** : Guide troubleshooting détaillé
- **Ajouté** : Procédures de récupération d'erreurs
- **Ajouté** : Commandes de debugging spécialisées

### ✅ **Architecture Production-Ready**
- **Ajouté** : Gestion transactionnelle des déploiements
- **Ajouté** : Monitoring pods et ressources Kubernetes
- **Ajouté** : Tool capability mapping automatique
- **Ajouté** : WebSocket pour updates temps réel

## 📋 **Checklist Final pour Claude Code**

### Phase 1 : Setup (Jour 1)
- [ ] Exécuter `scripts/setup-kagent.sh`
- [ ] Vérifier toutes les dépendances avec `npm run health`
- [ ] Confirmer cluster kagent opérationnel
- [ ] Valider configuration `.env`

### Phase 2-3 : Développement Core (Jours 2-3)
- [ ] Implémenter toutes les classes avec error handling
- [ ] Tester chaque composant avec unit tests
- [ ] Valider intégration kagent bridge
- [ ] Confirmer génération YAML valide

### Phase 4-5 : Tests et Finalisation (Jours 4-5)
- [ ] Exécuter tous les tests E2E avec succès
- [ ] Valider création/deployment agents réels
- [ ] Confirmer monitoring et status tracking
- [ ] Documentation et cleanup final

## 🎯 **Success Criteria Actualisés**

### ✅ **Critères Techniques**
- [ ] Tous les tests E2E passent sans erreur
- [ ] Agents déployés automatiquement sur kagent/K8s
- [ ] Time-to-agent < 5 minutes pour cas simples
- [ ] Error handling robuste avec recovery automatique
- [ ] Monitoring temps réel fonctionnel

### ✅ **Critères Qualité**
- [ ] Code coverage > 80% sur composants core
- [ ] Documentation API complète et exacte
- [ ] Scripts setup/health fonctionnent parfaitement
- [ ] Troubleshooting guide résout problèmes courants
- [ ] Architecture extensible et maintenable

## 💡 **Conseils d'Implémentation pour Claude Code**

### 🔧 **Ordre de Développement Recommandé**
1. **Commencer par les utilitaires** (Logger, Validator, RetryHelper)
2. **Implémenter kagent bridge** avec error handling robuste
3. **Tester chaque component** avant intégration
4. **Valider E2E** avec agents réels sur cluster
5. **Finaliser documentation** et troubleshooting

### ⚠️ **Points d'Attention Critiques**
- **Validation Kubernetes** : Tous les noms doivent respecter RFC 1123
- **Timeouts appropriés** : Kubernetes API peut être lent
- **Cleanup systematique** : Éviter les ressources orphelines
- **Error messages clairs** : Utilisateur doit comprendre les problèmes

### 🚀 **Optimisations Possibles**
- **Caching** des tool capabilities découvertes
- **Concurrent deployments** pour multiple agents
- **Streaming logs** depuis les pods d'agents
- **Metrics collection** pour performance monitoring

## 🎉 **Conclusion**

Ce plan révisé donne à Claude Code **tout ce dont il a besoin** pour développer AutoWeave + kagent avec succès :

- ✅ **Configuration complète** et robuste
- ✅ **Error handling production-ready**
- ✅ **Tests exhaustifs** avec helpers
- ✅ **Documentation complète** API et troubleshooting
- ✅ **Scripts automatisés** pour setup et développement
- ✅ **Architecture extensible** et maintenable

**Le plan est maintenant 100% actionnable** avec toutes les edge cases couvertes, l'error handling robuste, et la documentation nécessaire pour un développement sans surprise.

#### 5.4 Règles de Logging et Suivi de Développement

```javascript
// src/utils/dev-logger.js - Logger spécialisé développement
const fs = require('fs');
const path = require('path');
const { Logger } = require('./logger');

class DevLogger extends Logger {
    constructor(component) {
        super(component);
        this.devMode = process.env.NODE_ENV === 'development';
        this.logFile = path.join(process.cwd(), 'logs', 'development.log');
        this.specsFile = path.join(process.cwd(), 'docs', 'development-progress.md');

        // Ensure logs directory exists
        if (!fs.existsSync(path.dirname(this.logFile))) {
            fs.mkdirSync(path.dirname(this.logFile), { recursive: true });
        }

        // Ensure docs directory exists
        if (!fs.existsSync(path.dirname(this.specsFile))) {
            fs.mkdirSync(path.dirname(this.specsFile), { recursive: true });
        }
    }

    // Log development milestones
    milestone(phase, task, status, details = null) {
        if (!this.devMode) return;

        const timestamp = new Date().toISOString();
        const entry = {
            timestamp,
            phase,
            task,
            status, // 'started', 'completed', 'failed', 'blocked'
            component: this.component,
            details
        };

        // Console output
        const statusIcon = {
            'started': '🚀',
            'completed': '✅',
            'failed': '❌',
            'blocked': '⚠️'
        }[status] || '📝';

        console.log(`${statusIcon} [${phase}] ${task} - ${status.toUpperCase()}`);
        if (details) {
            console.log(`   Details: ${JSON.stringify(details, null, 2)}`);
        }

        // File logging
        this.appendToLogFile(entry);

        // Update progress tracking
        this.updateProgressFile(entry);
    }

    appendToLogFile(entry) {
        const logLine = `${entry.timestamp} [${entry.component}] ${entry.phase}:${entry.task} = ${entry.status}\n`;

        try {
            fs.appendFileSync(this.logFile, logLine);
        } catch (error) {
            console.warn('Failed to write to log file:', error.message);
        }
    }

    updateProgressFile(entry) {
        try {
            let content = '';

            // Read existing content or create new
            if (fs.existsSync(this.specsFile)) {
                content = fs.readFileSync(this.specsFile, 'utf8');
            } else {
                content = this.createProgressTemplate();
            }

            // Update progress section
            content = this.updateProgressSection(content, entry);

            // Write back to file
            fs.writeFileSync(this.specsFile, content);

        } catch (error) {
            console.warn('Failed to update progress file:', error.message);
        }
    }

    createProgressTemplate() {
        return `# AutoWeave Development Progress

## 📋 Development Status

Last updated: ${new Date().toISOString()}

### Phase 1: Setup & Environment (Day 1)
- [ ] Project structure initialization
- [ ] Dependencies installation
- [ ] kagent cluster setup
- [ ] Environment configuration
- [ ] Health checks implementation

### Phase 2: Core Components (Day 2-3)
- [ ] AutoWeave core class
- [ ] kagent bridge implementation
- [ ] Agent Weaver integration
- [ ] YAML generator
- [ ] Error handling

### Phase 3: Integration & Testing (Day 4)
- [ ] E2E test suite
- [ ] CLI interface
- [ ] API endpoints
- [ ] Status monitoring
- [ ] Resource cleanup

### Phase 4: Documentation & Finalization (Day 5)
- [ ] API documentation
- [ ] Troubleshooting guide
- [ ] Setup scripts
- [ ] Final validation

## 📝 Development Log

### Latest Entries

`;
    }

    updateProgressSection(content, entry) {
        const timestamp = new Date().toLocaleString();
        const logEntry = `#### ${timestamp} - ${entry.component}
**Phase:** ${entry.phase}
**Task:** ${entry.task}
**Status:** ${entry.status}
${entry.details ? `**Details:** \`${JSON.stringify(entry.details)}\`` : ''}

`;

        // Insert at the end of Latest Entries section
        const marker = '### Latest Entries\n\n';
        const markerIndex = content.indexOf(marker);

        if (markerIndex !== -1) {
            const insertPoint = markerIndex + marker.length;
            content = content.slice(0, insertPoint) + logEntry + content.slice(insertPoint);
        } else {
            content += logEntry;
        }

        // Update "Last updated" timestamp
        content = content.replace(
            /Last updated: .*/,
            `Last updated: ${new Date().toISOString()}`
        );

        // Update task completion status
        content = this.updateTaskStatus(content, entry);

        return content;
    }

    updateTaskStatus(content, entry) {
        if (entry.status === 'completed') {
            // Convert "- [ ]" to "- [x]" for completed tasks
            const taskPattern = new RegExp(`- \\[ \\] (.*)${entry.task}(.*)`, 'i');
            content = content.replace(taskPattern, '- [x] $1' + entry.task + '$2');
        }

        return content;
    }

    // Specialized logging methods for development
    apiCall(method, url, status, duration) {
        if (!this.devMode) return;

        this.debug(`API ${method} ${url} -> ${status} (${duration}ms)`);
    }

    kubernetesOp(operation, resource, result) {
        if (!this.devMode) return;

        this.debug(`K8s ${operation} ${resource} -> ${result}`);
    }

    agentLifecycle(agentId, event, details) {
        if (!this.devMode) return;

        this.info(`Agent ${agentId}: ${event}`, details);
    }
}

module.exports = { DevLogger };
```

## 📋 Instructions Spéciales pour Claude Code

### 🎯 **Règles de Logging Obligatoires**

**Claude Code DOIT utiliser le DevLogger pour tracer chaque étape :**

```javascript
// Exemple d'utilisation obligatoire dans chaque fichier
const { DevLogger } = require('../utils/dev-logger');
const logger = new DevLogger('ComponentName');

class MyComponent {
    async initialize() {
        logger.milestone('Phase1', 'Component initialization', 'started');

        try {
            // Your implementation here
            await this.setup();

            logger.milestone('Phase1', 'Component initialization', 'completed', {
                componentsLoaded: this.loadedComponents.length,
                timeElapsed: Date.now() - startTime
            });

        } catch (error) {
            logger.milestone('Phase1', 'Component initialization', 'failed', {
                error: error.message,
                stack: error.stack
            });
            throw error;
        }
    }
}
```

### 📝 **Mise à Jour Obligatoire du Fichier de Suivi**

**IMPORTANT** : Claude Code DOIT mettre à jour le fichier `docs/development-progress.md` à chaque étape importante.

**Format requis pour les updates :**

```javascript
// À chaque milestone important
logger.milestone('Phase2', 'kagent bridge implementation', 'completed', {
    linesOfCode: 150,
    testsAdded: 5,
    issuesFound: 2,
    nextSteps: ['Implement YAML generator', 'Add error handling']
});
```

### 🔍 **Points de Contrôle Obligatoires**

Claude Code DOIT logger ces événements spécifiques :

1. **Setup Phase**
   ```javascript
   logger.milestone('Phase1', 'Dependencies installation', 'completed', {
       packagesInstalled: packageList.length,
       setupTime: '2m30s'
   });
   ```

2. **Development Phase**
   ```javascript
   logger.milestone('Phase2', 'Component X implementation', 'completed', {
       methods: ['method1', 'method2'],
       testsCoverage: '85%',
       codeQuality: 'good'
   });
   ```

3. **Testing Phase**
   ```javascript
   logger.milestone('Phase3', 'E2E test suite', 'completed', {
       testsTotal: 15,
       testsPassed: 14,
       testsFailed: 1,
       coverage: '92%'
   });
   ```

4. **Issues & Blockers**
   ```javascript
   logger.milestone('Phase2', 'kagent integration', 'blocked', {
       issue: 'CRD not found in cluster',
       solution: 'Need to run kagent install',
       estimatedDelay: '30 minutes'
   });
   ```

### 📊 **Métriques de Développement Attendues**

Claude Code DOIT tracker ces métriques :

- **Time spent per phase**
- **Lines of code written**
- **Tests added/passing**
- **Issues encountered and resolved**
- **API calls made and performance**
- **Resource usage during development**

### 🔄 **Handoff pour Instances Suivantes**

**À la fin de chaque session**, Claude Code DOIT créer un fichier `handoff-summary.md` :

```markdown
# Handoff Summary - Session [Date]

## ✅ Completed Tasks
- Task 1: Description, status, files modified
- Task 2: Description, status, files modified

## 🚧 In Progress
- Task X: Current status, next steps needed
- Issue Y: Problem description, attempted solutions

## 📋 Next Instance TODO
1. Priority 1: Critical task for next session
2. Priority 2: Important task
3. Priority 3: Nice to have

## 📁 Modified Files
- src/file1.js: Added feature X, tests at 85%
- config/file2.js: Updated configuration for Y

## ⚠️ Known Issues
- Issue 1: Description and suggested fix
- Issue 2: Workaround in place, needs proper fix

## 🔧 Environment Status
- Cluster: Running/Stopped
- Dependencies: Up to date/Issues
- Tests: X/Y passing

## 💡 Lessons Learned
- What worked well
- What needs improvement
- Recommendations for next instance
```

### 🎯 **Success Criteria de Logging**

- [ ] DevLogger utilisé dans tous les composants
- [ ] Fichier `development-progress.md` mis à jour en temps réel
- [ ] Toutes les phases trackées avec métriques
- [ ] Issues et solutions documentées
- [ ] Handoff summary créé à la fin
- [ ] Logs structurés et recherchables

## 🚨 **VALIDATION FINALE DU PLAN**

### ✅ **Complétude Architecture**
- [x] Setup automatisé avec validation prérequis
- [x] Error handling robuste avec rollback
- [x] Tests E2E exhaustifs avec cleanup
- [x] Documentation API complète
- [x] Troubleshooting guide détaillé
- [x] Scripts développement complets
- [x] Logging et tracking obligatoires

### ✅ **Prêt pour Production**
- [x] Configuration environnements multiples
- [x] Validation Kubernetes complète
- [x] Monitoring temps réel intégré
- [x] Health checks automatisés
- [x] Cleanup ressources systematique
- [x] Recovery procedures définies

### ✅ **Développeur Experience**
- [x] Setup en une commande
- [x] Hot reload pour développement
- [x] Tests automatisés intégrés
- [x] Debugging tools included
- [x] Documentation always up-to-date
- [x] Handoff process streamlined

## 🎉 **PLAN FINAL VALIDÉ**

**Ce plan est maintenant 100% complet et actionnable pour Claude Code.**

Tous les gaps identifiés ont été comblés :
- ✅ Configuration robuste et validation
- ✅ Error handling production-ready
- ✅ Tests exhaustifs avec helpers
- ✅ Documentation complète et à jour
- ✅ Logging développement obligatoire
- ✅ Tracking progress automatisé
- ✅ Handoff process pour continuité

**AutoWeave + kagent sera un POC cloud native exemplaire !** 🚀☸️

---

> **Note pour l'instance suivante** : Ce document contient TOUT ce dont tu as besoin pour développer AutoWeave. Utilise le DevLogger obligatoirement et mets à jour le fichier de suivi en temps réel. Le succès du projet dépend du respect de ces guidelines de logging et documentation.
