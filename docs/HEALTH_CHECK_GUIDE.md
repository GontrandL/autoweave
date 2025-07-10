# Service Health Check Guide

## Overview

Comprehensive guide for understanding and implementing health checks in AutoWeave, including hierarchy, recovery procedures, and monitoring strategies.

## Health Check Architecture

### 1. Health Check Hierarchy

```
┌─────────────────────────────────────────────────────────┐
│                 SYSTEM HEALTH                           │
│                                                         │
│  ┌─────────────────┐  ┌─────────────────┐              │
│  │   CRITICAL      │  │   OPTIONAL      │              │
│  │   SERVICES      │  │   SERVICES      │              │
│  │                 │  │                 │              │
│  │ • AutoWeave     │  │ • ChatUI        │              │
│  │ • OpenAI API    │  │ • SillyTavern   │              │
│  │ • ANP Server    │  │ • Appsmith      │              │
│  └─────────────────┘  └─────────────────┘              │
│                                                         │
│  ┌─────────────────┐  ┌─────────────────┐              │
│  │   INFRASTRUCTURE│  │   EXTERNAL      │              │
│  │   SERVICES      │  │   DEPENDENCIES  │              │
│  │                 │  │                 │              │
│  │ • Kubernetes    │  │ • OpenAI API    │              │
│  │ • Qdrant        │  │ • GitHub API    │              │
│  │ • Memgraph      │  │ • External ANP  │              │
│  └─────────────────┘  └─────────────────┘              │
└─────────────────────────────────────────────────────────┘
```

### 2. Health Check Types

#### Critical Health Checks
- **System Impact**: Failure prevents core functionality
- **Response**: Immediate attention required
- **Recovery**: Automatic retry → Manual intervention
- **Status Codes**: 500 (Service Unavailable)

#### Warning Health Checks
- **System Impact**: Degraded functionality
- **Response**: Monitoring and planned maintenance
- **Recovery**: Graceful degradation → Scheduled fix
- **Status Codes**: 206 (Partial Content)

#### Informational Health Checks
- **System Impact**: Enhanced features unavailable
- **Response**: Log and continue
- **Recovery**: Best effort → Optional enhancement
- **Status Codes**: 200 (OK with notes)

## Health Check Implementation

### 1. Service Health Check Matrix

| Service | Type | Port | Endpoint | Timeout | Retry | Recovery |
|---------|------|------|----------|---------|-------|----------|
| **AutoWeave Core** | Critical | 3000 | `/health` | 5s | 3x | Restart |
| **ANP Server** | Critical | 8083 | `/agent` | 5s | 3x | Restart |
| **OpenAI API** | Critical | 443 | `/v1/models` | 10s | 5x | Fallback |
| **ChatUI** | Optional | 5173 | `/` | 3s | 2x | None |
| **SillyTavern** | Optional | 8081 | `/` | 3s | 2x | Port-forward |
| **Appsmith** | Optional | 8080 | `/` | 3s | 2x | Port-forward |
| **Qdrant** | Infrastructure | 6333 | `/health` | 5s | 3x | Mock mode |
| **Memgraph** | Infrastructure | 7687 | `/` | 5s | 3x | Mock mode |
| **Kubernetes** | Infrastructure | API | `/api/v1` | 10s | 3x | Mock mode |

### 2. Health Check Implementation

#### Core Health Check Framework
```javascript
const HealthChecker = {
    // Health check registry
    checks: new Map(),
    
    // Register health check
    register(name, checkConfig) {
        this.checks.set(name, {
            name,
            type: checkConfig.type || 'optional',
            check: checkConfig.check,
            timeout: checkConfig.timeout || 5000,
            retries: checkConfig.retries || 3,
            recovery: checkConfig.recovery || null,
            lastCheck: null,
            lastResult: null,
            consecutiveFailures: 0
        });
    },
    
    // Execute single health check
    async executeCheck(name) {
        const checkConfig = this.checks.get(name);
        if (!checkConfig) {
            throw new Error(`Health check '${name}' not found`);
        }
        
        const startTime = Date.now();
        let result = {
            name,
            status: 'unknown',
            duration: 0,
            error: null,
            timestamp: new Date().toISOString()
        };
        
        try {
            // Execute the check with timeout
            const checkPromise = checkConfig.check();
            const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => reject(new Error('Health check timeout')), checkConfig.timeout);
            });
            
            const checkResult = await Promise.race([checkPromise, timeoutPromise]);
            
            result.status = checkResult.status || 'healthy';
            result.data = checkResult.data || null;
            result.duration = Date.now() - startTime;
            
            // Reset failure count on success
            checkConfig.consecutiveFailures = 0;
            
        } catch (error) {
            result.status = 'unhealthy';
            result.error = error.message;
            result.duration = Date.now() - startTime;
            
            // Increment failure count
            checkConfig.consecutiveFailures++;
            
            // Attempt recovery if configured
            if (checkConfig.recovery && checkConfig.consecutiveFailures >= checkConfig.retries) {
                await this.attemptRecovery(name, checkConfig);
            }
        }
        
        // Update check config
        checkConfig.lastCheck = Date.now();
        checkConfig.lastResult = result;
        
        return result;
    },
    
    // Execute all health checks
    async executeAllChecks() {
        const results = {};
        const promises = [];
        
        for (const [name, checkConfig] of this.checks) {
            promises.push(
                this.executeCheck(name)
                    .then(result => ({ name, result }))
                    .catch(error => ({ name, result: { status: 'error', error: error.message } }))
            );
        }
        
        const checkResults = await Promise.all(promises);
        
        // Organize results by type
        const critical = [];
        const optional = [];
        const infrastructure = [];
        
        checkResults.forEach(({ name, result }) => {
            results[name] = result;
            
            const checkConfig = this.checks.get(name);
            switch (checkConfig.type) {
                case 'critical':
                    critical.push(result);
                    break;
                case 'infrastructure':
                    infrastructure.push(result);
                    break;
                default:
                    optional.push(result);
            }
        });
        
        return {
            timestamp: new Date().toISOString(),
            overall: this.determineOverallHealth(critical, optional, infrastructure),
            critical,
            optional,
            infrastructure,
            details: results
        };
    },
    
    // Determine overall system health
    determineOverallHealth(critical, optional, infrastructure) {
        const criticalHealthy = critical.filter(c => c.status === 'healthy').length;
        const criticalTotal = critical.length;
        
        const infraHealthy = infrastructure.filter(i => i.status === 'healthy').length;
        const infraTotal = infrastructure.length;
        
        const optionalHealthy = optional.filter(o => o.status === 'healthy').length;
        const optionalTotal = optional.length;
        
        // Critical services must be healthy
        if (criticalHealthy < criticalTotal) {
            return {
                status: 'critical',
                message: `${criticalTotal - criticalHealthy} critical services unhealthy`,
                score: (criticalHealthy / criticalTotal) * 100
            };
        }
        
        // Infrastructure services affect capabilities
        if (infraHealthy < infraTotal * 0.5) {
            return {
                status: 'degraded',
                message: `${infraTotal - infraHealthy} infrastructure services unhealthy`,
                score: 70 + (infraHealthy / infraTotal) * 20
            };
        }
        
        // Optional services affect user experience
        const totalHealthy = criticalHealthy + infraHealthy + optionalHealthy;
        const totalServices = criticalTotal + infraTotal + optionalTotal;
        const overallScore = (totalHealthy / totalServices) * 100;
        
        if (overallScore >= 95) {
            return {
                status: 'excellent',
                message: 'All systems operational',
                score: overallScore
            };
        } else if (overallScore >= 80) {
            return {
                status: 'good',
                message: 'Systems mostly operational',
                score: overallScore
            };
        } else {
            return {
                status: 'degraded',
                message: `${totalServices - totalHealthy} services need attention`,
                score: overallScore
            };
        }
    },
    
    // Attempt service recovery
    async attemptRecovery(name, checkConfig) {
        if (!checkConfig.recovery) return;
        
        try {
            console.log(`Attempting recovery for ${name}...`);
            await checkConfig.recovery();
            console.log(`Recovery attempt completed for ${name}`);
        } catch (error) {
            console.error(`Recovery failed for ${name}:`, error.message);
        }
    }
};
```

### 3. Service-Specific Health Checks

#### AutoWeave Core Health Check
```javascript
HealthChecker.register('autoweave-core', {
    type: 'critical',
    timeout: 5000,
    retries: 3,
    check: async () => {
        const response = await fetch('http://localhost:3000/health');
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        
        return {
            status: 'healthy',
            data: {
                uptime: data.uptime,
                version: data.version,
                memory: data.memory
            }
        };
    },
    recovery: async () => {
        // Restart the service (in production, this would trigger a restart)
        console.log('AutoWeave Core requires manual restart');
    }
});
```

#### ANP Server Health Check
```javascript
HealthChecker.register('anp-server', {
    type: 'critical',
    timeout: 5000,
    retries: 3,
    check: async () => {
        const response = await fetch('http://localhost:8083/agent');
        
        if (!response.ok) {
            throw new Error(`ANP Server not responding: ${response.status}`);
        }
        
        const agentCard = await response.json();
        
        return {
            status: 'healthy',
            data: {
                version: agentCard.version,
                capabilities: agentCard.capabilities?.length || 0
            }
        };
    },
    recovery: async () => {
        // ANP server is part of AutoWeave Core, so restart core
        console.log('ANP Server requires AutoWeave Core restart');
    }
});
```

#### OpenAI API Health Check
```javascript
HealthChecker.register('openai-api', {
    type: 'critical',
    timeout: 10000,
    retries: 5,
    check: async () => {
        if (!process.env.OPENAI_API_KEY) {
            throw new Error('OpenAI API key not configured');
        }
        
        const response = await fetch('https://api.openai.com/v1/models', {
            headers: {
                'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
            }
        });
        
        if (!response.ok) {
            throw new Error(`OpenAI API error: ${response.status}`);
        }
        
        const data = await response.json();
        
        return {
            status: 'healthy',
            data: {
                models: data.data?.length || 0,
                rateLimit: {
                    remaining: response.headers.get('x-ratelimit-remaining-requests'),
                    resetTime: response.headers.get('x-ratelimit-reset-requests')
                }
            }
        };
    },
    recovery: async () => {
        // Check for alternative API keys
        if (process.env.ANTHROPIC_API_KEY) {
            console.log('Falling back to Anthropic API');
        } else if (process.env.OPENROUTER_API_KEY) {
            console.log('Falling back to OpenRouter API');
        } else {
            console.log('No fallback API providers available');
        }
    }
});
```

#### Memory System Health Check
```javascript
HealthChecker.register('memory-system', {
    type: 'infrastructure',
    timeout: 5000,
    retries: 3,
    check: async () => {
        const checks = [];
        
        // Check Qdrant
        try {
            const qdrantResponse = await fetch('http://localhost:6333/health');
            checks.push({
                service: 'qdrant',
                status: qdrantResponse.ok ? 'healthy' : 'unhealthy',
                error: qdrantResponse.ok ? null : `HTTP ${qdrantResponse.status}`
            });
        } catch (error) {
            checks.push({
                service: 'qdrant',
                status: 'unhealthy',
                error: error.message
            });
        }
        
        // Check Memgraph (TCP connection to Bolt port)
        try {
            const net = require('net');
            const isMemgraphReachable = await new Promise((resolve) => {
                const socket = new net.Socket();
                socket.setTimeout(3000);
                
                socket.connect(7687, 'localhost', () => {
                    socket.destroy();
                    resolve(true);
                });
                
                socket.on('error', () => {
                    socket.destroy();
                    resolve(false);
                });
                
                socket.on('timeout', () => {
                    socket.destroy();
                    resolve(false);
                });
            });
            
            checks.push({
                service: 'memgraph',
                status: isMemgraphReachable ? 'healthy' : 'unhealthy',
                error: isMemgraphReachable ? null : 'Connection refused'
            });
        } catch (error) {
            checks.push({
                service: 'memgraph',
                status: 'unhealthy',
                error: error.message
            });
        }
        
        const healthyCount = checks.filter(c => c.status === 'healthy').length;
        const totalCount = checks.length;
        
        return {
            status: healthyCount > 0 ? 'healthy' : 'unhealthy',
            data: {
                services: checks,
                healthyCount,
                totalCount,
                capability: healthyCount === totalCount ? 'full' : 
                          healthyCount > 0 ? 'partial' : 'mock'
            }
        };
    },
    recovery: async () => {
        console.log('Memory system degraded - switching to mock mode');
        // In real implementation, this would update configuration
    }
});
```

## Health Check Endpoints

### 1. Enhanced Health Endpoint
```javascript
// Enhanced /health endpoint
app.get('/health', async (req, res) => {
    const healthResults = await HealthChecker.executeAllChecks();
    
    // Set appropriate status code
    switch (healthResults.overall.status) {
        case 'excellent':
        case 'good':
            res.status(200);
            break;
        case 'degraded':
            res.status(206); // Partial Content
            break;
        case 'critical':
            res.status(503); // Service Unavailable
            break;
        default:
            res.status(500); // Internal Server Error
    }
    
    res.json(healthResults);
});

// Quick health check endpoint
app.get('/health/quick', async (req, res) => {
    const startTime = Date.now();
    
    try {
        // Only check critical services
        const criticalChecks = ['autoweave-core', 'anp-server', 'openai-api'];
        const results = await Promise.all(
            criticalChecks.map(name => HealthChecker.executeCheck(name))
        );
        
        const healthy = results.every(r => r.status === 'healthy');
        
        res.status(healthy ? 200 : 503).json({
            status: healthy ? 'healthy' : 'unhealthy',
            duration: Date.now() - startTime,
            checks: results.length
        });
    } catch (error) {
        res.status(500).json({
            status: 'error',
            error: error.message,
            duration: Date.now() - startTime
        });
    }
});

// Service-specific health check
app.get('/health/:service', async (req, res) => {
    const serviceName = req.params.service;
    
    try {
        const result = await HealthChecker.executeCheck(serviceName);
        
        res.status(result.status === 'healthy' ? 200 : 503).json(result);
    } catch (error) {
        res.status(404).json({
            status: 'error',
            error: `Health check '${serviceName}' not found`
        });
    }
});
```

### 2. Health Check Monitoring

#### Continuous Health Monitoring
```javascript
class HealthMonitor {
    constructor() {
        this.interval = null;
        this.checkInterval = 30000; // 30 seconds
        this.alerts = [];
    }
    
    start() {
        this.interval = setInterval(async () => {
            await this.performHealthCheck();
        }, this.checkInterval);
        
        console.log('Health monitoring started');
    }
    
    stop() {
        if (this.interval) {
            clearInterval(this.interval);
            this.interval = null;
        }
        
        console.log('Health monitoring stopped');
    }
    
    async performHealthCheck() {
        try {
            const results = await HealthChecker.executeAllChecks();
            
            // Log health status
            console.log(`Health check: ${results.overall.status} (${results.overall.score}%)`);
            
            // Check for alerts
            this.checkAlerts(results);
            
        } catch (error) {
            console.error('Health check failed:', error);
        }
    }
    
    checkAlerts(results) {
        const now = Date.now();
        
        // Check for critical service failures
        results.critical.forEach(check => {
            if (check.status !== 'healthy') {
                this.raiseAlert({
                    type: 'critical',
                    service: check.name,
                    message: `Critical service ${check.name} is ${check.status}`,
                    timestamp: now
                });
            }
        });
        
        // Check for infrastructure degradation
        const infraUnhealthy = results.infrastructure.filter(i => i.status !== 'healthy');
        if (infraUnhealthy.length > 0) {
            this.raiseAlert({
                type: 'warning',
                service: 'infrastructure',
                message: `${infraUnhealthy.length} infrastructure services degraded`,
                timestamp: now
            });
        }
    }
    
    raiseAlert(alert) {
        // Avoid duplicate alerts
        const existingAlert = this.alerts.find(a => 
            a.type === alert.type && 
            a.service === alert.service &&
            now - a.timestamp < 300000 // 5 minutes
        );
        
        if (!existingAlert) {
            this.alerts.push(alert);
            console.warn(`🚨 ALERT: ${alert.message}`);
            
            // In production, this would trigger notifications
            // this.sendNotification(alert);
        }
    }
}
```

## Health Check Scripts

### 1. Health Check CLI Tool
```bash
#!/bin/bash
# health-check.sh - AutoWeave Health Check Tool

AUTOWEAVE_URL="http://localhost:3000"
VERBOSE=false
CHECK_TYPE="all"

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -v|--verbose)
            VERBOSE=true
            shift
            ;;
        -q|--quick)
            CHECK_TYPE="quick"
            shift
            ;;
        -s|--service)
            CHECK_TYPE="service"
            SERVICE_NAME="$2"
            shift 2
            ;;
        -u|--url)
            AUTOWEAVE_URL="$2"
            shift 2
            ;;
        -h|--help)
            echo "Usage: $0 [OPTIONS]"
            echo "Options:"
            echo "  -v, --verbose    Verbose output"
            echo "  -q, --quick      Quick health check (critical services only)"
            echo "  -s, --service    Check specific service"
            echo "  -u, --url        AutoWeave URL (default: http://localhost:3000)"
            echo "  -h, --help       Show this help"
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            exit 1
            ;;
    esac
done

# Perform health check
case $CHECK_TYPE in
    "quick")
        ENDPOINT="$AUTOWEAVE_URL/health/quick"
        ;;
    "service")
        ENDPOINT="$AUTOWEAVE_URL/health/$SERVICE_NAME"
        ;;
    *)
        ENDPOINT="$AUTOWEAVE_URL/health"
        ;;
esac

echo "🔍 Checking AutoWeave health..."
echo "Endpoint: $ENDPOINT"
echo ""

# Make the request
RESPONSE=$(curl -s -w "HTTPSTATUS:%{http_code}" "$ENDPOINT")
HTTP_CODE=$(echo "$RESPONSE" | sed -n 's/.*HTTPSTATUS:\([0-9]*\)$/\1/p')
BODY=$(echo "$RESPONSE" | sed 's/HTTPSTATUS:[0-9]*$//')

# Check if curl succeeded
if [ $? -ne 0 ]; then
    echo "❌ Failed to connect to AutoWeave"
    exit 1
fi

# Parse HTTP status
case $HTTP_CODE in
    200)
        echo "✅ Health check passed"
        STATUS="healthy"
        ;;
    206)
        echo "⚠️  System partially healthy"
        STATUS="degraded"
        ;;
    503)
        echo "❌ System unhealthy"
        STATUS="unhealthy"
        ;;
    *)
        echo "❌ Unexpected response: HTTP $HTTP_CODE"
        STATUS="error"
        ;;
esac

# Display results
if [ "$VERBOSE" = true ] || [ "$STATUS" != "healthy" ]; then
    echo ""
    echo "=== Health Check Results ==="
    echo "$BODY" | jq '.' 2>/dev/null || echo "$BODY"
fi

# Exit with appropriate code
case $STATUS in
    "healthy")
        exit 0
        ;;
    "degraded")
        exit 1
        ;;
    *)
        exit 2
        ;;
esac
```

### 2. Health Dashboard Script
```bash
#!/bin/bash
# health-dashboard.sh - Real-time health dashboard

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Clear screen and show header
clear
echo -e "${BLUE}╔══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║                 AutoWeave Health Dashboard                   ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Function to display service status
show_service_status() {
    local service=$1
    local status=$2
    local icon=""
    local color=""
    
    case $status in
        "healthy")
            icon="✅"
            color="${GREEN}"
            ;;
        "degraded")
            icon="⚠️ "
            color="${YELLOW}"
            ;;
        "unhealthy")
            icon="❌"
            color="${RED}"
            ;;
        *)
            icon="❓"
            color="${NC}"
            ;;
    esac
    
    printf "${color}%s %-20s %s${NC}\n" "$icon" "$service" "$status"
}

# Main loop
while true; do
    # Move cursor to top
    tput cup 4 0
    
    echo "Last update: $(date)"
    echo ""
    
    # Get health status
    HEALTH_DATA=$(curl -s http://localhost:3000/health 2>/dev/null)
    
    if [ $? -eq 0 ]; then
        # Parse overall health
        OVERALL_STATUS=$(echo "$HEALTH_DATA" | jq -r '.overall.status' 2>/dev/null)
        OVERALL_SCORE=$(echo "$HEALTH_DATA" | jq -r '.overall.score' 2>/dev/null)
        
        echo "=== Overall System Health ==="
        show_service_status "System" "$OVERALL_STATUS"
        echo "Score: $OVERALL_SCORE%"
        echo ""
        
        # Critical services
        echo "=== Critical Services ==="
        echo "$HEALTH_DATA" | jq -r '.critical[] | "\(.name) \(.status)"' 2>/dev/null | while read -r name status; do
            show_service_status "$name" "$status"
        done
        echo ""
        
        # Infrastructure services
        echo "=== Infrastructure Services ==="
        echo "$HEALTH_DATA" | jq -r '.infrastructure[] | "\(.name) \(.status)"' 2>/dev/null | while read -r name status; do
            show_service_status "$name" "$status"
        done
        echo ""
        
        # Optional services
        echo "=== Optional Services ==="
        echo "$HEALTH_DATA" | jq -r '.optional[] | "\(.name) \(.status)"' 2>/dev/null | while read -r name status; do
            show_service_status "$name" "$status"
        done
        
    else
        echo -e "${RED}❌ Unable to connect to AutoWeave${NC}"
    fi
    
    echo ""
    echo "Press Ctrl+C to exit"
    
    # Wait 5 seconds before next update
    sleep 5
done
```

This comprehensive health check system provides AutoWeave with robust monitoring capabilities, enabling proactive issue detection and automated recovery procedures.