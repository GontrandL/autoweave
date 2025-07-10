# Port Management Guide

## Overview

This guide provides comprehensive information about port management in the AutoWeave ecosystem to prevent conflicts and ensure smooth operation.

## Current Port Allocation

### Active Services

| Service | Port | Protocol | Status | Description |
|---------|------|----------|---------|-------------|
| **AutoWeave Core** | 3000 | HTTP | ✅ Active | Main API server |
| **ChatUI Interface** | 5173 | HTTP | ✅ Active | Vite dev server |
| **SillyTavern** | 8000 | HTTP | ✅ K8s | Internal Kubernetes port |
| **SillyTavern (Forward)** | 8081 | HTTP | ✅ Active | Port-forwarded to localhost |
| **Appsmith** | 80 | HTTP | ✅ K8s | Internal Kubernetes port |
| **Appsmith (Forward)** | 8080 | HTTP | ✅ Active | Port-forwarded to localhost |
| **ANP Server** | 8083 | HTTP | ✅ Active | Agent Network Protocol |
| **WebSocket** | 3000 | WS | ✅ Active | AG-UI WebSocket (same as API) |

### Memory Services (Kubernetes)

| Service | Port | Protocol | Status | Description |
|---------|------|----------|---------|-------------|
| **Qdrant** | 6333 | HTTP | ✅ K8s | Vector database |
| **Memgraph** | 7687 | Bolt | ⚠️ CrashLoop | Graph database |
| **Qdrant (Forward)** | 6333 | HTTP | 🔄 Optional | Port-forward if needed |
| **Memgraph (Forward)** | 7687 | Bolt | 🔄 Optional | Port-forward if needed |

## Port Conflict Resolution

### 1. Detection

#### Check if port is in use:
```bash
# Method 1: Using ss (recommended)
ss -tlnp | grep :3000

# Method 2: Using netstat
netstat -tlnp | grep :3000

# Method 3: Using lsof
lsof -i :3000
```

#### Check all AutoWeave related ports:
```bash
# Check all ports at once
for port in 3000 5173 8080 8081 8083 6333 7687; do
  echo "Port $port:"
  ss -tlnp | grep :$port || echo "  Available"
done
```

### 2. Resolution Strategies

#### Option A: Kill conflicting processes
```bash
# Find process ID
PID=$(ss -tlnp | grep :3000 | awk '{print $7}' | cut -d',' -f2 | cut -d'=' -f2)

# Kill process
kill -9 $PID
```

#### Option B: Use alternative ports
```bash
# AutoWeave Core
export PORT=3001
npm start

# ChatUI Interface
cd interface/autoweave-interface
npm run dev -- --port 5174

# ANP Server
export ANP_PORT=8084
```

#### Option C: Graceful service shutdown
```bash
# Stop AutoWeave gracefully
pkill -f "node src/index.js"

# Stop ChatUI
pkill -f "vite"

# Stop port-forwards
pkill -f "kubectl port-forward"
```

## Port Forward Management

### Current Port Forwards

```bash
# SillyTavern: K8s port 8000 → localhost:8081
kubectl port-forward -n autoweave-system svc/sillytavern-service 8081:8000 &

# Appsmith: K8s port 80 → localhost:8080  
kubectl port-forward -n appsmith-system svc/appsmith 8080:80 &

# Optional: Memory services
kubectl port-forward -n autoweave-system svc/qdrant-service 6333:6333 &
kubectl port-forward -n autoweave-system svc/memgraph-service 7687:7687 &
```

### Port Forward Management Script

```bash
#!/bin/bash
# Port Forward Management Script

# Function to start port forwards
start_port_forwards() {
    echo "Starting port forwards..."
    
    # SillyTavern
    if ! pgrep -f "port-forward.*sillytavern.*8081" > /dev/null; then
        kubectl port-forward -n autoweave-system svc/sillytavern-service 8081:8000 > /tmp/st-pf.log 2>&1 &
        echo "SillyTavern port-forward started (8081)"
    fi
    
    # Appsmith
    if ! pgrep -f "port-forward.*appsmith.*8080" > /dev/null; then
        kubectl port-forward -n appsmith-system svc/appsmith 8080:80 > /tmp/appsmith-pf.log 2>&1 &
        echo "Appsmith port-forward started (8080)"
    fi
}

# Function to stop port forwards
stop_port_forwards() {
    echo "Stopping port forwards..."
    pkill -f "kubectl port-forward"
    echo "All port forwards stopped"
}

# Function to restart port forwards
restart_port_forwards() {
    stop_port_forwards
    sleep 2
    start_port_forwards
}

# Function to check port forward status
check_port_forwards() {
    echo "Port forward status:"
    echo "SillyTavern (8081): $(pgrep -f "port-forward.*sillytavern.*8081" > /dev/null && echo "Active" || echo "Inactive")"
    echo "Appsmith (8080): $(pgrep -f "port-forward.*appsmith.*8080" > /dev/null && echo "Active" || echo "Inactive")"
}

case "$1" in
    start)
        start_port_forwards
        ;;
    stop)
        stop_port_forwards
        ;;
    restart)
        restart_port_forwards
        ;;
    status)
        check_port_forwards
        ;;
    *)
        echo "Usage: $0 {start|stop|restart|status}"
        exit 1
        ;;
esac
```

## Environment-Specific Port Configuration

### Development Environment (.env)
```bash
# AutoWeave Core
PORT=3000
ANP_PORT=8083

# Memory Services
QDRANT_PORT=6333
MEMGRAPH_PORT=7687

# WebSocket
WS_PORT=3000
```

### ChatUI Interface (.env)
```bash
# Vite dev server
VITE_PORT=5173

# API Configuration
VITE_API_BASE=http://localhost:3000/api
```

### SillyTavern (config.yaml)
```yaml
# Server port
port: 8000

# Browser launch
browserLaunch:
  enabled: true
  port: -1  # Use server port
```

## Startup Sequence

### Recommended Order
1. **AutoWeave Core** (Port 3000)
2. **ANP Server** (Port 8083) 
3. **Port Forwards** (8081, 8080)
4. **ChatUI Interface** (Port 5173)

### Startup Script
```bash
#!/bin/bash
# AutoWeave Startup Sequence

echo "🚀 Starting AutoWeave services..."

# 1. Start AutoWeave Core
echo "Starting AutoWeave Core (port 3000)..."
npm start > /tmp/autoweave.log 2>&1 &
sleep 3

# 2. Start ANP Server (if not already running)
if ! pgrep -f "anp-server" > /dev/null; then
    echo "ANP Server starting with AutoWeave Core..."
fi

# 3. Start Port Forwards
echo "Starting port forwards..."
./scripts/port-forward-manager.sh start

# 4. Start ChatUI Interface
echo "Starting ChatUI Interface (port 5173)..."
cd interface/autoweave-interface
npm run dev > /tmp/chatui.log 2>&1 &
cd ../..

# 5. Wait for services to be ready
sleep 5

# 6. Health check
echo "Checking service health..."
curl -s http://localhost:3000/health || echo "AutoWeave Core not ready"
curl -s http://localhost:5173 || echo "ChatUI Interface not ready"
curl -s http://localhost:8081 || echo "SillyTavern not ready"
curl -s http://localhost:8080 || echo "Appsmith not ready"
curl -s http://localhost:8083/agent || echo "ANP Server not ready"

echo "✅ AutoWeave startup complete!"
```

## Troubleshooting

### Common Issues

#### 1. Port Already in Use
```bash
# Error: EADDRINUSE :::3000
# Solution: Find and kill process
ss -tlnp | grep :3000
kill -9 <PID>
```

#### 2. Permission Denied
```bash
# Error: EACCES :::80
# Solution: Use non-privileged ports (>1024)
export PORT=8080
```

#### 3. Port Forward Fails
```bash
# Error: unable to forward port
# Solution: Check if service exists
kubectl get svc -n autoweave-system
kubectl get pods -n autoweave-system
```

#### 4. Service Not Responding
```bash
# Check if port is bound but service not responding
curl -v http://localhost:3000/health
telnet localhost 3000
```

### Health Check Script
```bash
#!/bin/bash
# Health Check Script

check_service() {
    local name=$1
    local url=$2
    
    if curl -s -f "$url" > /dev/null; then
        echo "✅ $name: OK"
    else
        echo "❌ $name: FAIL"
    fi
}

echo "AutoWeave Health Check:"
check_service "AutoWeave Core" "http://localhost:3000/health"
check_service "ChatUI Interface" "http://localhost:5173"
check_service "SillyTavern" "http://localhost:8081"
check_service "Appsmith" "http://localhost:8080"
check_service "ANP Server" "http://localhost:8083/agent"
```

## Best Practices

### 1. Documentation
- Always document port assignments
- Update this guide when ports change
- Include ports in service descriptions

### 2. Environment Variables
- Use environment variables for port configuration
- Provide sensible defaults
- Allow override for conflicts

### 3. Service Discovery
- Implement health checks for all services
- Use consistent endpoint patterns
- Provide service status endpoints

### 4. Monitoring
- Monitor port usage
- Set up alerts for port conflicts
- Log port binding events

### 5. Development
- Use different port ranges for dev/prod
- Implement graceful shutdown
- Handle port conflicts gracefully

## Port Ranges

### AutoWeave Reserved Ports
- **3000-3099**: Core services
- **5000-5199**: Development servers
- **8000-8099**: External services
- **6000-6999**: Database services
- **7000-7999**: Internal services

### Available Port Pool
```bash
# Check available ports in range
for port in $(seq 3000 3010); do
    if ! ss -tln | grep -q ":$port "; then
        echo "Port $port available"
    fi
done
```

---

*This port management guide should be consulted whenever adding new services or troubleshooting port conflicts.*