# Troubleshooting Decision Tree Guide

## Overview

Comprehensive troubleshooting guide with decision trees, automated diagnostics, and step-by-step resolution procedures for common AutoWeave issues.

**🎯 Updated for Production Readiness - All TODOs Resolved**
*Last Updated: 2025-07-10T21:46:00Z*

### Recent System Enhancements
- ✅ **Memory Manager Integration**: Full HybridMemoryManager integration completed
- ✅ **Sentry Monitoring**: Production error tracking enabled
- ✅ **Security Service**: Security event monitoring integrated
- ✅ **Production Ready**: All placeholder TODOs resolved

## Troubleshooting Architecture

### 1. Problem Classification Matrix

| Category | Impact | Urgency | Examples | Resolution Time |
|----------|--------|---------|----------|-----------------|
| **Critical** | System Down | Immediate | API not responding, OpenAI key invalid | 0-15 minutes |
| **High** | Core Features Broken | 1-4 hours | Agent creation failing, Memory system down | 15-60 minutes |
| **Medium** | Degraded Performance | 4-24 hours | Slow responses, Some services unavailable | 1-4 hours |
| **Low** | Minor Issues | 24-72 hours | UI glitches, Non-critical warnings | 4+ hours |

### 2. Automated Diagnostic System

#### Master Diagnostic Function
```javascript
const AutoDiagnostic = {
    async runFullDiagnostic() {
        const diagnostic = {
            timestamp: new Date().toISOString(),
            environment: process.env.NODE_ENV,
            results: {},
            issues: [],
            recommendations: [],
            severity: 'unknown'
        };

        console.log('🔍 Starting AutoWeave full diagnostic...');

        // Run all diagnostic checks in parallel
        const checks = await Promise.allSettled([
            this.checkSystemHealth(),
            this.checkConfiguration(),
            this.checkConnectivity(),
            this.checkPermissions(),
            this.checkResources(),
            this.checkDependencies()
        ]);

        // Process results
        const [health, config, connectivity, permissions, resources, dependencies] = checks;

        diagnostic.results = {
            health: health.status === 'fulfilled' ? health.value : { error: health.reason },
            configuration: config.status === 'fulfilled' ? config.value : { error: config.reason },
            connectivity: connectivity.status === 'fulfilled' ? connectivity.value : { error: connectivity.reason },
            permissions: permissions.status === 'fulfilled' ? permissions.value : { error: permissions.reason },
            resources: resources.status === 'fulfilled' ? resources.value : { error: resources.reason },
            dependencies: dependencies.status === 'fulfilled' ? dependencies.value : { error: dependencies.reason }
        };

        // Analyze results and generate recommendations
        diagnostic.issues = this.analyzeIssues(diagnostic.results);
        diagnostic.recommendations = this.generateRecommendations(diagnostic.issues);
        diagnostic.severity = this.determineSeverity(diagnostic.issues);

        console.log(`🔍 Diagnostic complete: ${diagnostic.issues.length} issues found (${diagnostic.severity})`);
        return diagnostic;
    },

    async checkSystemHealth() {
        const health = {
            services: {},
            overall: 'unknown',
            issues: []
        };

        // Check core services
        const services = [
            { name: 'autoweave-core', url: 'http://localhost:3000/health' },
            { name: 'anp-server', url: 'http://localhost:8083/agent' },
            { name: 'chatui', url: 'http://localhost:5173' },
            { name: 'sillytavern', url: 'http://localhost:8081' },
            { name: 'appsmith', url: 'http://localhost:8080' }
        ];

        for (const service of services) {
            try {
                const response = await fetch(service.url, { timeout: 5000 });
                health.services[service.name] = {
                    status: response.ok ? 'healthy' : 'unhealthy',
                    httpCode: response.status,
                    responseTime: Date.now() // Simplified timing
                };
            } catch (error) {
                health.services[service.name] = {
                    status: 'unreachable',
                    error: error.message
                };
                health.issues.push({
                    type: 'service_unreachable',
                    service: service.name,
                    message: `${service.name} is unreachable: ${error.message}`
                });
            }
        }

        // Determine overall health
        const healthyServices = Object.values(health.services).filter(s => s.status === 'healthy').length;
        const totalServices = Object.keys(health.services).length;
        
        if (healthyServices === totalServices) {
            health.overall = 'excellent';
        } else if (healthyServices >= totalServices * 0.8) {
            health.overall = 'good';
        } else if (healthyServices >= totalServices * 0.5) {
            health.overall = 'degraded';
        } else {
            health.overall = 'critical';
        }

        return health;
    },

    async checkConfiguration() {
        const config = {
            environment: {},
            validation: {},
            issues: []
        };

        // Check environment variables
        const requiredEnvVars = [
            { name: 'OPENAI_API_KEY', critical: true },
            { name: 'NODE_ENV', critical: false },
            { name: 'PORT', critical: false }
        ];

        requiredEnvVars.forEach(envVar => {
            const value = process.env[envVar.name];
            config.environment[envVar.name] = {
                set: !!value,
                valid: this.validateEnvVar(envVar.name, value),
                critical: envVar.critical
            };

            if (envVar.critical && !value) {
                config.issues.push({
                    type: 'missing_critical_config',
                    variable: envVar.name,
                    message: `Critical environment variable ${envVar.name} is not set`
                });
            }
        });

        // Validate configuration files
        const configFiles = [
            { path: '/home/gontrand/AutoWeave/.env', required: false },
            { path: '/home/gontrand/AutoWeave/config/autoweave/config.js', required: true }
        ];

        configFiles.forEach(file => {
            const exists = require('fs').existsSync(file.path);
            config.validation[file.path] = { exists, required: file.required };

            if (file.required && !exists) {
                config.issues.push({
                    type: 'missing_config_file',
                    file: file.path,
                    message: `Required configuration file missing: ${file.path}`
                });
            }
        });

        return config;
    },

    async checkConnectivity() {
        const connectivity = {
            internal: {},
            external: {},
            issues: []
        };

        // Check internal connectivity (between services)
        const internalChecks = [
            { name: 'autoweave-anp', from: 'autoweave', to: 'anp-server', url: 'http://localhost:8083/agent' },
            { name: 'chatui-autoweave', from: 'chatui', to: 'autoweave', url: 'http://localhost:3000/api' }
        ];

        for (const check of internalChecks) {
            try {
                const response = await fetch(check.url, { timeout: 3000 });
                connectivity.internal[check.name] = {
                    status: response.ok ? 'connected' : 'failed',
                    httpCode: response.status
                };
            } catch (error) {
                connectivity.internal[check.name] = {
                    status: 'failed',
                    error: error.message
                };
                connectivity.issues.push({
                    type: 'internal_connectivity',
                    check: check.name,
                    message: `Internal connectivity failed: ${check.from} -> ${check.to}`
                });
            }
        }

        // Check external connectivity
        const externalChecks = [
            { name: 'openai-api', url: 'https://api.openai.com/v1/models', headers: { 'Authorization': `Bearer ${process.env.OPENAI_API_KEY}` } },
            { name: 'github-api', url: 'https://api.github.com', headers: {} }
        ];

        for (const check of externalChecks) {
            try {
                const response = await fetch(check.url, { 
                    timeout: 10000,
                    headers: check.headers
                });
                connectivity.external[check.name] = {
                    status: response.ok ? 'connected' : 'failed',
                    httpCode: response.status
                };
            } catch (error) {
                connectivity.external[check.name] = {
                    status: 'failed',
                    error: error.message
                };
                connectivity.issues.push({
                    type: 'external_connectivity',
                    service: check.name,
                    message: `External connectivity failed: ${check.name}`
                });
            }
        }

        return connectivity;
    },

    async checkPermissions() {
        const permissions = {
            filesystem: {},
            network: {},
            kubernetes: {},
            issues: []
        };

        // Check filesystem permissions
        const fsChecks = [
            { path: '/home/gontrand/AutoWeave', operation: 'read' },
            { path: '/home/gontrand/AutoWeave/logs', operation: 'write' },
            { path: '/tmp', operation: 'write' }
        ];

        fsChecks.forEach(check => {
            try {
                const fs = require('fs');
                if (check.operation === 'read') {
                    fs.accessSync(check.path, fs.constants.R_OK);
                } else if (check.operation === 'write') {
                    fs.accessSync(check.path, fs.constants.W_OK);
                }
                permissions.filesystem[check.path] = { status: 'ok', operation: check.operation };
            } catch (error) {
                permissions.filesystem[check.path] = { status: 'failed', error: error.message };
                permissions.issues.push({
                    type: 'filesystem_permission',
                    path: check.path,
                    operation: check.operation,
                    message: `Filesystem permission denied: ${check.operation} access to ${check.path}`
                });
            }
        });

        // Check network permissions (port binding)
        const portChecks = [3000, 8083, 5173];
        
        for (const port of portChecks) {
            try {
                const net = require('net');
                const server = net.createServer();
                
                await new Promise((resolve, reject) => {
                    server.once('error', reject);
                    server.once('listening', () => {
                        server.close(resolve);
                    });
                    server.listen(port, 'localhost');
                });
                
                permissions.network[port] = { status: 'available' };
            } catch (error) {
                permissions.network[port] = { status: 'occupied', error: error.message };
                if (error.code === 'EADDRINUSE') {
                    // Port occupied - check if it's our service
                    const isOurService = await this.checkIfOurService(port);
                    if (!isOurService) {
                        permissions.issues.push({
                            type: 'port_conflict',
                            port: port,
                            message: `Port ${port} is occupied by another process`
                        });
                    }
                }
            }
        }

        return permissions;
    },

    async checkResources() {
        const resources = {
            memory: {},
            disk: {},
            cpu: {},
            issues: []
        };

        // Check memory usage
        const memUsage = process.memoryUsage();
        resources.memory = {
            rss: memUsage.rss,
            heapTotal: memUsage.heapTotal,
            heapUsed: memUsage.heapUsed,
            external: memUsage.external,
            heapUsagePercentage: (memUsage.heapUsed / memUsage.heapTotal) * 100
        };

        if (resources.memory.heapUsagePercentage > 90) {
            resources.issues.push({
                type: 'high_memory_usage',
                percentage: resources.memory.heapUsagePercentage,
                message: `High memory usage: ${resources.memory.heapUsagePercentage.toFixed(1)}%`
            });
        }

        // Check disk space
        try {
            const fs = require('fs');
            const stats = fs.statSync('/home/gontrand/AutoWeave');
            resources.disk = {
                path: '/home/gontrand/AutoWeave',
                accessible: true,
                // Note: Getting actual disk space requires additional modules
                // This is a simplified check
            };
        } catch (error) {
            resources.disk = { error: error.message };
            resources.issues.push({
                type: 'disk_access',
                message: `Cannot access project directory: ${error.message}`
            });
        }

        return resources;
    },

    async checkDependencies() {
        const dependencies = {
            node: {},
            npm: {},
            external: {},
            issues: []
        };

        // Check Node.js version
        dependencies.node = {
            version: process.version,
            supported: this.checkNodeVersion(process.version)
        };

        if (!dependencies.node.supported) {
            dependencies.issues.push({
                type: 'unsupported_node_version',
                version: process.version,
                message: `Unsupported Node.js version: ${process.version}. Requires >= 18.0.0`
            });
        }

        // Check external tools
        const externalTools = ['kubectl', 'docker', 'curl'];
        
        for (const tool of externalTools) {
            try {
                const { execSync } = require('child_process');
                const version = execSync(`${tool} --version`, { timeout: 5000, encoding: 'utf8' });
                dependencies.external[tool] = {
                    available: true,
                    version: version.trim().split('\n')[0]
                };
            } catch (error) {
                dependencies.external[tool] = {
                    available: false,
                    error: error.message
                };
                // Some tools are optional
                if (tool === 'kubectl') {
                    dependencies.issues.push({
                        type: 'missing_optional_tool',
                        tool: tool,
                        message: `Optional tool ${tool} not available - Kubernetes features will use mock mode`
                    });
                }
            }
        }

        return dependencies;
    }
};
```

## Decision Trees

### 1. Service Not Responding Decision Tree

```
Service Not Responding
├── Is AutoWeave Core (port 3000) responding?
│   ├── NO
│   │   ├── Check if process is running
│   │   │   ├── NO → Start AutoWeave: npm start
│   │   │   └── YES
│   │   │       ├── Check port conflict
│   │   │       │   ├── CONFLICT → Kill conflicting process or change port
│   │   │       │   └── NO CONFLICT → Check logs for errors
│   │   │       └── Check environment variables
│   │   │           ├── OPENAI_API_KEY missing → Set API key
│   │   │           └── Other config issues → Fix configuration
│   │   └── YES → Service-specific troubleshooting
│   └── YES
│       ├── ANP Server (port 8083) not responding?
│       │   ├── Check if ANP is enabled in config
│       │   ├── Check port availability
│       │   └── Restart AutoWeave Core
│       ├── ChatUI (port 5173) not responding?
│       │   ├── Check if Vite dev server is running
│       │   ├── Start ChatUI: cd interface/autoweave-interface && npm run dev
│       │   └── Check for build errors
│       ├── SillyTavern (port 8081) not responding?
│       │   ├── Check if port-forward is active
│       │   ├── Restart port-forward: kubectl port-forward ...
│       │   └── Check if Kubernetes pod is running
│       └── Appsmith (port 8080) not responding?
│           ├── Check if port-forward is active
│           ├── Restart port-forward: kubectl port-forward ...
│           └── Check if Kubernetes deployment is ready
```

### 2. Agent Creation Failing Decision Tree

```
Agent Creation Failing
├── Is OpenAI API key configured?
│   ├── NO → Set OPENAI_API_KEY environment variable
│   └── YES
│       ├── Is API key valid?
│       │   ├── NO → Check API key format (starts with sk-)
│       │   │   └── Verify key with OpenAI dashboard
│       │   └── YES
│       │       ├── Check OpenAI API connectivity
│       │       │   ├── FAIL → Check internet connection
│       │       │   │   └── Check firewall/proxy settings
│       │       │   └── SUCCESS
│       │       │       ├── Is kagent available?
│       │       │       │   ├── NO → Agents will run in mock mode
│       │       │       │   │   └── Install kubectl and kagent
│       │       │       │   └── YES
│       │       │       │       ├── Check Kubernetes connectivity
│       │       │       │       │   ├── FAIL → Check kubeconfig
│       │       │       │       │   │   └── Verify cluster access
│       │       │       │       │   └── SUCCESS
│       │       │       │       │       ├── Check namespace permissions
│       │       │       │       │       └── Verify kagent installation
│       │       │       └── Check memory system
│       │       │           ├── Qdrant available?
│       │       │           │   ├── NO → Memory will use mock mode
│       │       │           │   └── YES → Check collection creation
│       │       │           └── Memgraph available?
│       │       │               ├── NO → Graph features unavailable
│       │       │               └── YES → Check graph connectivity
```

### 3. Performance Issues Decision Tree

```
Performance Issues
├── High Response Times (>5 seconds)
│   ├── Check memory usage
│   │   ├── HIGH (>80%) → Restart AutoWeave
│   │   │   └── Consider increasing memory limits
│   │   └── NORMAL
│   │       ├── Check OpenAI API response times
│   │       │   ├── SLOW → Check rate limits
│   │       │   │   └── Consider using different model
│   │       │   └── NORMAL
│   │       │       ├── Check memory system performance
│   │       │       │   ├── Qdrant slow → Check vector database size
│   │       │       │   └── Memgraph slow → Check graph complexity
│   │       │       └── Check network connectivity
│   │       │           ├── Internal services slow
│   │       │           └── External API calls slow
│   └── High Resource Usage
│       ├── Memory leaks detected
│       │   ├── Restart services
│       │   └── Check for unclosed connections
│       ├── High CPU usage
│       │   ├── Check for infinite loops
│       │   └── Optimize processing algorithms
│       └── High disk I/O
│           ├── Check log file sizes
│           └── Optimize memory system storage
```

## Automated Troubleshooting Scripts

### 1. Self-Healing Script
```javascript
const SelfHealing = {
    async attemptSelfHealing() {
        console.log('🔧 Starting self-healing procedures...');
        
        const diagnostic = await AutoDiagnostic.runFullDiagnostic();
        const healed = [];
        const failed = [];

        for (const issue of diagnostic.issues) {
            try {
                const result = await this.healIssue(issue);
                if (result.success) {
                    healed.push({ issue, action: result.action });
                } else {
                    failed.push({ issue, reason: result.reason });
                }
            } catch (error) {
                failed.push({ issue, reason: error.message });
            }
        }

        console.log(`🔧 Self-healing complete: ${healed.length} issues healed, ${failed.length} require manual intervention`);
        
        return { healed, failed, diagnostic };
    },

    async healIssue(issue) {
        switch (issue.type) {
            case 'service_unreachable':
                return await this.healUnreachableService(issue);
            case 'port_conflict':
                return await this.healPortConflict(issue);
            case 'missing_critical_config':
                return await this.healMissingConfig(issue);
            case 'high_memory_usage':
                return await this.healHighMemoryUsage(issue);
            default:
                return { success: false, reason: 'No healing procedure available' };
        }
    },

    async healUnreachableService(issue) {
        const serviceName = issue.service;
        
        switch (serviceName) {
            case 'autoweave-core':
                // Try to restart AutoWeave
                try {
                    const { exec } = require('child_process');
                    await new Promise((resolve, reject) => {
                        exec('npm start', { cwd: '/home/gontrand/AutoWeave' }, (error) => {
                            if (error) reject(error);
                            else resolve();
                        });
                    });
                    return { success: true, action: 'Restarted AutoWeave Core' };
                } catch (error) {
                    return { success: false, reason: `Failed to restart: ${error.message}` };
                }
                
            case 'sillytavern':
            case 'appsmith':
                // Try to restart port-forward
                return await this.restartPortForward(serviceName);
                
            default:
                return { success: false, reason: 'No healing procedure for this service' };
        }
    },

    async healPortConflict(issue) {
        const port = issue.port;
        
        try {
            // Try to find and kill the conflicting process
            const { exec } = require('child_process');
            const pid = await new Promise((resolve, reject) => {
                exec(`lsof -ti:${port}`, (error, stdout) => {
                    if (error) reject(error);
                    else resolve(stdout.trim());
                });
            });
            
            if (pid) {
                await new Promise((resolve, reject) => {
                    exec(`kill -9 ${pid}`, (error) => {
                        if (error) reject(error);
                        else resolve();
                    });
                });
                return { success: true, action: `Killed process ${pid} on port ${port}` };
            } else {
                return { success: false, reason: 'No process found on port' };
            }
        } catch (error) {
            return { success: false, reason: `Failed to resolve port conflict: ${error.message}` };
        }
    },

    async restartPortForward(serviceName) {
        try {
            const { exec } = require('child_process');
            
            // Kill existing port-forwards
            await new Promise((resolve) => {
                exec('pkill -f "kubectl port-forward"', () => resolve());
            });
            
            // Wait a moment
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            // Restart appropriate port-forward
            const portForwardCommands = {
                sillytavern: 'kubectl port-forward -n autoweave-system svc/sillytavern-service 8081:8000',
                appsmith: 'kubectl port-forward -n appsmith-system svc/appsmith 8080:80'
            };
            
            const command = portForwardCommands[serviceName];
            if (command) {
                exec(`${command} > /tmp/${serviceName}-pf.log 2>&1 &`);
                return { success: true, action: `Restarted port-forward for ${serviceName}` };
            } else {
                return { success: false, reason: 'Unknown service for port-forward' };
            }
        } catch (error) {
            return { success: false, reason: `Failed to restart port-forward: ${error.message}` };
        }
    }
};
```

### 2. Diagnostic CLI Tool
```bash
#!/bin/bash
# autoweave-diagnostic.sh - Comprehensive diagnostic tool

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
AUTOWEAVE_URL="http://localhost:3000"
VERBOSE=false
AUTO_HEAL=false
OUTPUT_FILE=""

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -v|--verbose)
            VERBOSE=true
            shift
            ;;
        -h|--heal)
            AUTO_HEAL=true
            shift
            ;;
        -o|--output)
            OUTPUT_FILE="$2"
            shift 2
            ;;
        --help)
            echo "AutoWeave Diagnostic Tool"
            echo "Usage: $0 [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  -v, --verbose    Verbose output"
            echo "  -h, --heal       Attempt automatic healing"
            echo "  -o, --output     Save results to file"
            echo "  --help           Show this help"
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            exit 1
            ;;
    esac
done

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Diagnostic functions
check_service() {
    local name=$1
    local url=$2
    local timeout=${3:-5}
    
    if curl -s --max-time $timeout "$url" > /dev/null 2>&1; then
        log_success "$name is responding"
        return 0
    else
        log_error "$name is not responding"
        return 1
    fi
}

check_environment() {
    log_info "Checking environment configuration..."
    
    local issues=0
    
    # Check critical environment variables
    if [ -z "$OPENAI_API_KEY" ]; then
        log_error "OPENAI_API_KEY is not set"
        ((issues++))
    else
        log_success "OPENAI_API_KEY is configured"
    fi
    
    # Check optional environment variables
    local optional_vars=("NODE_ENV" "PORT" "LOG_LEVEL")
    for var in "${optional_vars[@]}"; do
        if [ -z "${!var}" ]; then
            log_warning "$var is not set (using default)"
        else
            log_success "$var is set to ${!var}"
        fi
    done
    
    return $issues
}

check_ports() {
    log_info "Checking port availability..."
    
    local ports=(3000 8083 5173 8081 8080)
    local issues=0
    
    for port in "${ports[@]}"; do
        if ss -tlnp | grep -q ":$port "; then
            log_success "Port $port is in use"
        else
            log_warning "Port $port is not in use"
            ((issues++))
        fi
    done
    
    return $issues
}

check_files() {
    log_info "Checking required files..."
    
    local files=(
        "/home/gontrand/AutoWeave/.env"
        "/home/gontrand/AutoWeave/config/autoweave/config.js"
        "/home/gontrand/AutoWeave/package.json"
    )
    local issues=0
    
    for file in "${files[@]}"; do
        if [ -f "$file" ]; then
            log_success "$file exists"
        else
            log_error "$file is missing"
            ((issues++))
        fi
    done
    
    return $issues
}

run_api_diagnostic() {
    log_info "Running API diagnostic..."
    
    if curl -s "$AUTOWEAVE_URL/diagnostic" > /tmp/autoweave-diagnostic.json; then
        local severity=$(jq -r '.severity' /tmp/autoweave-diagnostic.json 2>/dev/null || echo "unknown")
        local issues_count=$(jq -r '.issues | length' /tmp/autoweave-diagnostic.json 2>/dev/null || echo "0")
        
        case $severity in
            "low")
                log_success "API diagnostic passed ($issues_count minor issues)"
                ;;
            "medium")
                log_warning "API diagnostic found medium severity issues ($issues_count issues)"
                ;;
            "high"|"critical")
                log_error "API diagnostic found $severity issues ($issues_count issues)"
                ;;
            *)
                log_warning "API diagnostic completed with unknown severity"
                ;;
        esac
        
        if [ "$VERBOSE" = true ]; then
            echo ""
            echo "=== API Diagnostic Details ==="
            jq '.' /tmp/autoweave-diagnostic.json 2>/dev/null || cat /tmp/autoweave-diagnostic.json
        fi
    else
        log_error "Failed to run API diagnostic"
        return 1
    fi
}

attempt_healing() {
    if [ "$AUTO_HEAL" = true ]; then
        log_info "Attempting automatic healing..."
        
        if curl -s -X POST "$AUTOWEAVE_URL/self-heal" > /tmp/autoweave-healing.json; then
            local healed=$(jq -r '.healed | length' /tmp/autoweave-healing.json 2>/dev/null || echo "0")
            local failed=$(jq -r '.failed | length' /tmp/autoweave-healing.json 2>/dev/null || echo "0")
            
            log_success "Healing completed: $healed issues resolved, $failed require manual intervention"
            
            if [ "$VERBOSE" = true ]; then
                echo ""
                echo "=== Healing Results ==="
                jq '.' /tmp/autoweave-healing.json 2>/dev/null || cat /tmp/autoweave-healing.json
            fi
        else
            log_error "Failed to run self-healing"
        fi
    fi
}

# Main diagnostic routine
main() {
    echo ""
    echo "🔍 AutoWeave Diagnostic Tool"
    echo "================================"
    echo ""
    
    local total_issues=0
    
    # Run all checks
    check_environment || ((total_issues+=$?))
    echo ""
    
    check_files || ((total_issues+=$?))
    echo ""
    
    check_ports || ((total_issues+=$?))
    echo ""
    
    # Check services
    log_info "Checking service health..."
    check_service "AutoWeave Core" "$AUTOWEAVE_URL/health" || ((total_issues++))
    check_service "ANP Server" "http://localhost:8083/agent" || ((total_issues++))
    check_service "ChatUI" "http://localhost:5173" || ((total_issues++))
    check_service "SillyTavern" "http://localhost:8081" || ((total_issues++))
    check_service "Appsmith" "http://localhost:8080" || ((total_issues++))
    echo ""
    
    # Run API diagnostic if AutoWeave is responding
    if curl -s --max-time 5 "$AUTOWEAVE_URL/health" > /dev/null 2>&1; then
        run_api_diagnostic
        echo ""
    fi
    
    # Attempt healing if requested
    attempt_healing
    echo ""
    
    # Summary
    echo "=== Diagnostic Summary ==="
    if [ $total_issues -eq 0 ]; then
        log_success "No critical issues found"
        exit 0
    elif [ $total_issues -le 2 ]; then
        log_warning "$total_issues minor issues found"
        exit 1
    else
        log_error "$total_issues issues found - system may not function properly"
        exit 2
    fi
}

# Run main function
main "$@"
```

Cette guide de dépannage complet fournit à AutoWeave une capacité d'auto-diagnostic et de résolution automatique des problèmes courants, réduisant significativement les erreurs dues au manque de connaissance de l'environnement.