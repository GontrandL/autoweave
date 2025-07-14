# Environment Configuration Reference

## Overview

Complete reference of all environment variables and configuration options in AutoWeave, including defaults, validation, and fallback behaviors.

## Core Configuration Variables

### 1. Basic Application Settings

| Variable | Required | Default | Description | Validation |
|----------|----------|---------|-------------|------------|
| `NODE_ENV` | No | `development` | Application environment | `development`, `production`, `test` |
| `PORT` | No | `3000` | AutoWeave server port | Integer 1024-65535 |
| `LOG_LEVEL` | No | `info` | Logging verbosity | `debug`, `info`, `warn`, `error` |

#### Validation Rules
```javascript
const basicConfig = {
    nodeEnv: {
        required: false,
        default: 'development',
        validate: (value) => ['development', 'production', 'test'].includes(value),
        fallback: 'development'
    },
    port: {
        required: false,
        default: 3000,
        validate: (value) => Number.isInteger(+value) && +value >= 1024 && +value <= 65535,
        fallback: 3000
    },
    logLevel: {
        required: false,
        default: 'info',
        validate: (value) => ['debug', 'info', 'warn', 'error'].includes(value),
        fallback: 'info'
    }
};
```

### 2. API Configuration

| Variable | Required | Default | Description | Validation |
|----------|----------|---------|-------------|------------|
| `OPENAI_API_KEY` | **Yes** | None | OpenAI API key for agent generation | Starts with `sk-` |
| `ANTHROPIC_API_KEY` | No | None | Anthropic API key (fallback) | Starts with `sk-ant-` |
| `OPENROUTER_API_KEY` | No | None | OpenRouter API key (fallback) | Starts with `sk-or-` |
| `GITHUB_TOKEN` | No | None | GitHub token for repo access | Starts with `ghp_` or `gho_` |

#### API Key Validation
```javascript
const apiConfig = {
    openaiApiKey: {
        required: true,
        envVar: 'OPENAI_API_KEY',
        validate: (value) => value && value.startsWith('sk-'),
        error: 'OpenAI API key is required and must start with sk-',
        fallback: null
    },
    anthropicApiKey: {
        required: false,
        envVar: 'ANTHROPIC_API_KEY',
        validate: (value) => !value || value.startsWith('sk-ant-'),
        error: 'Anthropic API key must start with sk-ant-',
        fallback: null
    },
    openrouterApiKey: {
        required: false,
        envVar: 'OPENROUTER_API_KEY',
        validate: (value) => !value || value.startsWith('sk-or-'),
        error: 'OpenRouter API key must start with sk-or-',
        fallback: null
    },
    githubToken: {
        required: false,
        envVar: 'GITHUB_TOKEN',
        validate: (value) => !value || value.startsWith('ghp_') || value.startsWith('gho_'),
        error: 'GitHub token must start with ghp_ or gho_',
        fallback: null
    }
};
```

### 3. Kubernetes Configuration

| Variable | Required | Default | Description | Validation |
|----------|----------|---------|-------------|------------|
| `KUBECONFIG` | No | `~/.kube/config` | Kubernetes config file path | File exists |
| `KAGENT_NAMESPACE` | No | `default` | Kubernetes namespace for agents | Valid K8s namespace |
| `K8S_CLUSTER_NAME` | No | `autoweave` | Kubernetes cluster name | Alphanumeric + hyphens |
| `K8S_IN_CLUSTER` | No | `false` | Running inside Kubernetes | `true`, `false` |
| `KAGENT_TIMEOUT` | No | `30000` | Timeout for kagent operations (ms) | Integer > 0 |
| `KAGENT_RETRY_ATTEMPTS` | No | `3` | Retry attempts for kagent operations | Integer 1-10 |

#### Kubernetes Validation
```javascript
const kubernetesConfig = {
    kubeconfig: {
        required: false,
        envVar: 'KUBECONFIG',
        default: '~/.kube/config',
        validate: (value) => {
            const fs = require('fs');
            const path = require('path');
            const expandedPath = value.replace('~', process.env.HOME);
            return fs.existsSync(expandedPath);
        },
        error: 'Kubeconfig file does not exist',
        fallback: null
    },
    kagentNamespace: {
        required: false,
        envVar: 'KAGENT_NAMESPACE',
        default: 'default',
        validate: (value) => /^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/.test(value),
        error: 'Invalid Kubernetes namespace format',
        fallback: 'default'
    },
    clusterName: {
        required: false,
        envVar: 'K8S_CLUSTER_NAME',
        default: 'autoweave',
        validate: (value) => /^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/.test(value),
        error: 'Invalid cluster name format',
        fallback: 'autoweave'
    },
    inCluster: {
        required: false,
        envVar: 'K8S_IN_CLUSTER',
        default: false,
        validate: (value) => value === 'true' || value === 'false',
        error: 'K8S_IN_CLUSTER must be true or false',
        fallback: false
    }
};
```

### 4. Memory System Configuration

| Variable | Required | Default | Description | Validation |
|----------|----------|---------|-------------|------------|
| `MEM0_SELF_HOSTED` | No | `true` | Use self-hosted mem0 | `true`, `false` |
| `MEM0_API_KEY` | No | None | mem0 API key (if not self-hosted) | String |
| `QDRANT_HOST` | No | `localhost` | Qdrant server host | Valid hostname/IP |
| `QDRANT_PORT` | No | `6333` | Qdrant server port | Integer 1-65535 |
| `QDRANT_API_KEY` | No | None | Qdrant API key | String |
| `MEMGRAPH_HOST` | No | `localhost` | Memgraph server host | Valid hostname/IP |
| `MEMGRAPH_PORT` | No | `7687` | Memgraph server port | Integer 1-65535 |
| `MEMGRAPH_USER` | No | `autoweave` | Memgraph username | String |
| `MEMGRAPH_PASSWORD` | No | `autoweave-memory-2024` | Memgraph password | String |

#### Memory System Validation
```javascript
const memoryConfig = {
    mem0SelfHosted: {
        required: false,
        envVar: 'MEM0_SELF_HOSTED',
        default: true,
        validate: (value) => value === 'true' || value === 'false',
        fallback: true
    },
    qdrantHost: {
        required: false,
        envVar: 'QDRANT_HOST',
        default: 'localhost',
        validate: (value) => {
            // Basic hostname/IP validation
            const hostRegex = /^[a-zA-Z0-9.-]+$/;
            return hostRegex.test(value);
        },
        error: 'Invalid Qdrant host format',
        fallback: 'localhost'
    },
    qdrantPort: {
        required: false,
        envVar: 'QDRANT_PORT',
        default: 6333,
        validate: (value) => Number.isInteger(+value) && +value >= 1 && +value <= 65535,
        error: 'Qdrant port must be between 1 and 65535',
        fallback: 6333
    },
    memgraphHost: {
        required: false,
        envVar: 'MEMGRAPH_HOST',
        default: 'localhost',
        validate: (value) => {
            const hostRegex = /^[a-zA-Z0-9.-]+$/;
            return hostRegex.test(value);
        },
        error: 'Invalid Memgraph host format',
        fallback: 'localhost'
    }
};
```

### 5. MCP & ANP Configuration

| Variable | Required | Default | Description | Validation |
|----------|----------|---------|-------------|------------|
| `MCP_DISCOVERY_ENABLED` | No | `true` | Enable MCP server discovery | `true`, `false` |
| `MCP_REGISTRY_URL` | No | None | MCP registry URL | Valid URL |
| `ANP_PORT` | No | `8083` | ANP server port | Integer 1024-65535 |
| `EXTERNAL_ANP_REGISTRIES` | No | None | External ANP registries (comma-separated) | Valid URLs |

#### MCP/ANP Validation
```javascript
const mcpConfig = {
    mcpDiscoveryEnabled: {
        required: false,
        envVar: 'MCP_DISCOVERY_ENABLED',
        default: true,
        validate: (value) => value === 'true' || value === 'false',
        fallback: true
    },
    anpPort: {
        required: false,
        envVar: 'ANP_PORT',
        default: 8083,
        validate: (value) => Number.isInteger(+value) && +value >= 1024 && +value <= 65535,
        error: 'ANP port must be between 1024 and 65535',
        fallback: 8083
    },
    externalAnpRegistries: {
        required: false,
        envVar: 'EXTERNAL_ANP_REGISTRIES',
        default: [],
        validate: (value) => {
            if (!value) return true;
            const urls = value.split(',');
            return urls.every(url => {
                try {
                    new URL(url.trim());
                    return true;
                } catch {
                    return false;
                }
            });
        },
        error: 'Invalid URL in EXTERNAL_ANP_REGISTRIES',
        fallback: []
    }
};
```

## Environment-Specific Configurations

### Development Environment
```bash
# .env.development
NODE_ENV=development
PORT=3000
LOG_LEVEL=debug

# API Keys (required)
OPENAI_API_KEY=sk-...

# Development settings
MEM0_SELF_HOSTED=true
QDRANT_HOST=localhost
MEMGRAPH_HOST=localhost

# Kubernetes (optional in dev)
KUBECONFIG=~/.kube/config
KAGENT_NAMESPACE=default
```

### Production Environment
```bash
# .env.production
NODE_ENV=production
PORT=3000
LOG_LEVEL=info

# API Keys (required)
OPENAI_API_KEY=sk-...

# Production settings
MEM0_SELF_HOSTED=true
QDRANT_HOST=qdrant-service.autoweave-system.svc.cluster.local
MEMGRAPH_HOST=memgraph-service.autoweave-system.svc.cluster.local

# Kubernetes (required in prod)
K8S_IN_CLUSTER=true
KAGENT_NAMESPACE=production
```

### Test Environment
```bash
# .env.test
NODE_ENV=test
PORT=3001
LOG_LEVEL=error

# Mock everything in tests
MEM0_MOCK=true
QDRANT_MOCK=true
MEMGRAPH_MOCK=true
KAGENT_MOCK=true
```

## Configuration Validation

### Validation Function
```javascript
const ConfigValidator = {
    validateConfiguration() {
        const errors = [];
        const warnings = [];
        const config = {};

        // Validate all configuration sections
        const sections = [basicConfig, apiConfig, kubernetesConfig, memoryConfig, mcpConfig];
        
        sections.forEach(section => {
            Object.entries(section).forEach(([key, spec]) => {
                const value = process.env[spec.envVar] || spec.default;
                
                if (spec.required && !value) {
                    errors.push(`${spec.envVar} is required but not set`);
                    return;
                }
                
                if (value && spec.validate && !spec.validate(value)) {
                    if (spec.required) {
                        errors.push(`${spec.envVar}: ${spec.error}`);
                    } else {
                        warnings.push(`${spec.envVar}: ${spec.error}, using fallback`);
                        config[key] = spec.fallback;
                    }
                } else {
                    config[key] = value;
                }
            });
        });

        return { config, errors, warnings };
    },

    validateEnvironment() {
        const { config, errors, warnings } = this.validateConfiguration();
        
        if (errors.length > 0) {
            console.error('Configuration validation failed:');
            errors.forEach(error => console.error(`  ❌ ${error}`));
            process.exit(1);
        }
        
        if (warnings.length > 0) {
            console.warn('Configuration warnings:');
            warnings.forEach(warning => console.warn(`  ⚠️  ${warning}`));
        }
        
        return config;
    }
};
```

## Runtime Configuration Detection

### Configuration State Detection
```javascript
const ConfigurationStateDetector = {
    detectConfigurationState() {
        const state = {
            timestamp: new Date().toISOString(),
            environment: process.env.NODE_ENV || 'development',
            configurations: {},
            missing: [],
            invalid: [],
            fallbacks: [],
            recommendations: []
        };

        // Check API keys
        state.configurations.apiKeys = {
            openai: !!process.env.OPENAI_API_KEY,
            anthropic: !!process.env.ANTHROPIC_API_KEY,
            openrouter: !!process.env.OPENROUTER_API_KEY,
            github: !!process.env.GITHUB_TOKEN
        };

        // Check Kubernetes configuration
        state.configurations.kubernetes = {
            kubeconfig: this.checkKubeconfig(),
            namespace: process.env.KAGENT_NAMESPACE || 'default',
            inCluster: process.env.K8S_IN_CLUSTER === 'true'
        };

        // Check memory system configuration
        state.configurations.memory = {
            mem0SelfHosted: process.env.MEM0_SELF_HOSTED !== 'false',
            qdrantConfigured: !!process.env.QDRANT_HOST,
            memgraphConfigured: !!process.env.MEMGRAPH_HOST
        };

        // Generate recommendations
        state.recommendations = this.generateRecommendations(state);

        return state;
    },

    checkKubeconfig() {
        const kubeconfigPath = process.env.KUBECONFIG || '~/.kube/config';
        const fs = require('fs');
        const path = require('path');
        
        try {
            const expandedPath = kubeconfigPath.replace('~', process.env.HOME);
            return fs.existsSync(expandedPath);
        } catch {
            return false;
        }
    },

    generateRecommendations(state) {
        const recommendations = [];

        // API key recommendations
        if (!state.configurations.apiKeys.openai) {
            recommendations.push({
                type: 'error',
                component: 'api',
                message: 'OpenAI API key is required',
                action: 'Set OPENAI_API_KEY environment variable'
            });
        }

        if (!state.configurations.apiKeys.anthropic && !state.configurations.apiKeys.openrouter) {
            recommendations.push({
                type: 'warning',
                component: 'api',
                message: 'No fallback API providers configured',
                action: 'Consider setting ANTHROPIC_API_KEY or OPENROUTER_API_KEY'
            });
        }

        // Kubernetes recommendations
        if (!state.configurations.kubernetes.kubeconfig && !state.configurations.kubernetes.inCluster) {
            recommendations.push({
                type: 'warning',
                component: 'kubernetes',
                message: 'No Kubernetes configuration found',
                action: 'Agents will run in mock mode'
            });
        }

        // Memory system recommendations
        if (!state.configurations.memory.qdrantConfigured) {
            recommendations.push({
                type: 'info',
                component: 'memory',
                message: 'Qdrant not configured',
                action: 'Memory system will use mock mode'
            });
        }

        return recommendations;
    }
};
```

## Environment Template Files

### `.env.template`
```bash
# AutoWeave Environment Configuration Template
# Copy this file to .env and fill in the values

# =============================================================================
# REQUIRED CONFIGURATION
# =============================================================================

# OpenAI API Key (REQUIRED)
OPENAI_API_KEY=sk-...

# =============================================================================
# BASIC CONFIGURATION
# =============================================================================

# Application environment (development, production, test)
NODE_ENV=development

# Server port
PORT=3000

# Log level (debug, info, warn, error)
LOG_LEVEL=info

# =============================================================================
# OPTIONAL API PROVIDERS
# =============================================================================

# Anthropic API Key (fallback for OpenAI)
# ANTHROPIC_API_KEY=sk-ant-...

# OpenRouter API Key (fallback for OpenAI)
# OPENROUTER_API_KEY=sk-or-...

# GitHub Token (for repository access)
# GITHUB_TOKEN=ghp_...

# =============================================================================
# KUBERNETES CONFIGURATION
# =============================================================================

# Kubernetes configuration file path
KUBECONFIG=~/.kube/config

# Kubernetes namespace for agents
KAGENT_NAMESPACE=default

# Kubernetes cluster name
K8S_CLUSTER_NAME=autoweave

# Running inside Kubernetes cluster
K8S_IN_CLUSTER=false

# =============================================================================
# MEMORY SYSTEM CONFIGURATION
# =============================================================================

# Use self-hosted mem0
MEM0_SELF_HOSTED=true

# Qdrant configuration
QDRANT_HOST=localhost
QDRANT_PORT=6333
# QDRANT_API_KEY=3f08b95a-035e-41f3-a8b4-48d97e62e96a

# Memgraph configuration
MEMGRAPH_HOST=localhost
MEMGRAPH_PORT=7687
MEMGRAPH_USER=autoweave
MEMGRAPH_PASSWORD=autoweave-memory-2024

# =============================================================================
# MCP & ANP CONFIGURATION
# =============================================================================

# Enable MCP discovery
MCP_DISCOVERY_ENABLED=true

# ANP server port
ANP_PORT=8083

# External ANP registries (comma-separated URLs)
# EXTERNAL_ANP_REGISTRIES=https://registry1.example.com,https://registry2.example.com
```

## Configuration Validation Scripts

### Validation Script
```bash
#!/bin/bash
# validate-config.sh - Validate AutoWeave configuration

echo "🔍 Validating AutoWeave configuration..."

# Check required environment variables
check_required_env() {
    local var_name=$1
    local var_value=$(eval echo \$$var_name)
    
    if [ -z "$var_value" ]; then
        echo "❌ $var_name is required but not set"
        return 1
    else
        echo "✅ $var_name is set"
        return 0
    fi
}

# Check optional environment variables
check_optional_env() {
    local var_name=$1
    local var_value=$(eval echo \$$var_name)
    
    if [ -z "$var_value" ]; then
        echo "⚠️  $var_name is not set (using default)"
    else
        echo "✅ $var_name is set"
    fi
}

# Check file exists
check_file_exists() {
    local file_path=$1
    local description=$2
    
    if [ -f "$file_path" ]; then
        echo "✅ $description exists: $file_path"
        return 0
    else
        echo "❌ $description not found: $file_path"
        return 1
    fi
}

# Load environment variables
if [ -f ".env" ]; then
    echo "📁 Loading .env file..."
    source .env
fi

echo ""
echo "=== Required Configuration ==="
check_required_env "OPENAI_API_KEY"
required_ok=$?

echo ""
echo "=== Optional Configuration ==="
check_optional_env "NODE_ENV"
check_optional_env "PORT"
check_optional_env "LOG_LEVEL"
check_optional_env "ANTHROPIC_API_KEY"
check_optional_env "OPENROUTER_API_KEY"

echo ""
echo "=== File Dependencies ==="
kubeconfig_path=${KUBECONFIG:-~/.kube/config}
kubeconfig_path=${kubeconfig_path/#\~/$HOME}
check_file_exists "$kubeconfig_path" "Kubernetes config"

echo ""
echo "=== Service Connectivity ==="
if command -v curl &> /dev/null; then
    # Check if services are reachable (if configured)
    if [ -n "$QDRANT_HOST" ] && [ "$QDRANT_HOST" != "localhost" ]; then
        if curl -s --connect-timeout 5 "http://$QDRANT_HOST:${QDRANT_PORT:-6333}/health" > /dev/null; then
            echo "✅ Qdrant is reachable"
        else
            echo "⚠️  Qdrant is not reachable (will use mock mode)"
        fi
    fi
fi

echo ""
if [ $required_ok -eq 0 ]; then
    echo "✅ Configuration validation passed"
    exit 0
else
    echo "❌ Configuration validation failed - check required variables"
    exit 1
fi
```

This comprehensive environment reference provides complete visibility into AutoWeave's configuration system, enabling intelligent configuration management and validation.
