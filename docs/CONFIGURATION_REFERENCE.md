# Configuration Reference

## AutoWeave Services & Ports

### Active Services (Current State)

| Service | Port | URL | Status | Description |
|---------|------|-----|---------|-------------|
| **AutoWeave Core API** | 3000 | http://localhost:3000 | ✅ ACTIVE | Main orchestration API |
| **ChatUI Interface** | 5173 | http://localhost:5173 | ✅ ACTIVE | HuggingFace Chat-UI (Vite dev server) |
| **SillyTavern** | 8000 | http://localhost:8081 | ✅ ACTIVE | Port-forwarded from K8s (8000→8081) |
| **Appsmith** | 80 | http://localhost:8080 | ✅ ACTIVE | Port-forwarded from K8s (80→8080) |
| **ANP Server** | 8083 | http://localhost:8083 | ✅ ACTIVE | Agent Network Protocol server |

### Environment Configuration

#### AutoWeave Core (.env)
```bash
# Core Configuration
NODE_ENV=development
PORT=3000
LOG_LEVEL=debug

# OpenAI API
OPENAI_API_KEY=your_key_here

# Memory System
MEM0_SELF_HOSTED=true
QDRANT_HOST=qdrant-service
MEMGRAPH_HOST=memgraph-service
QDRANT_PORT=6333
MEMGRAPH_PORT=7687

# Kubernetes
KAGENT_NAMESPACE=default
KUBECONFIG=~/.kube/config

# ANP Configuration
ANP_PORT=8083
EXTERNAL_ANP_REGISTRIES=

# WebSocket
WS_PORT=3000
```

#### ChatUI Interface (.env)
```bash
# API Configuration
OPENAI_API_KEY=your_key_here
OPENAI_API_BASE=http://localhost:3000/api/chat

# Model Configuration
MODELS=[{
  "name": "gpt-3.5-turbo",
  "displayName": "AutoWeave Agent",
  "description": "AutoWeave intelligent agent orchestrator",
  "promptExamples": [
    "Create a file processing agent",
    "Build a data analysis workflow",
    "Setup a monitoring system"
  ],
  "parameters": {
    "temperature": 0.7,
    "top_p": 1,
    "max_tokens": 1000,
    "stop": []
  }
}]

# Chat-UI Configuration
PUBLIC_ORIGIN=http://localhost:5173
PUBLIC_SHARE_PREFIX=http://localhost:5173/r/
PUBLIC_ANNOUNCEMENT_BANNERS=[]
PUBLIC_DISABLE_ALTERNATIVE_MODELS=false
PUBLIC_DISABLE_STREAMING=false

# Search Configuration
USE_LOCAL_WEBSEARCH=false
WEBSEARCH_ALLOWLIST=[]
WEBSEARCH_BLOCKLIST=[]

# MongoDB (in-memory)
MONGODB_URL=

# Optional Features
TOOLS=[]
OLD_MODELS=[]
USAGE_LIMITS={}
```

### Kubernetes Port Forwards

#### Current Port Forwards
```bash
# SillyTavern
kubectl port-forward -n autoweave-system svc/sillytavern-service 8081:8000

# Appsmith
kubectl port-forward -n appsmith-system svc/appsmith 8080:80

# Memory Services (if needed)
kubectl port-forward -n autoweave-system svc/qdrant-service 6333:6333
kubectl port-forward -n autoweave-system svc/memgraph-service 7687:7687
```

## API Endpoints Reference

### AutoWeave Core API (Port 3000)

#### Health & Status
```bash
GET /health                     # Simple health check
GET /status                     # Detailed system status
GET /api                        # API information
```

#### Agent Operations
```bash
POST /api/agents                # Create agent from natural language
GET /api/agents                 # List all agents
GET /api/agents/:id             # Get agent details
DELETE /api/agents/:id          # Delete agent
```

#### Chat Operations (OpenAI Compatible)
```bash
POST /api/chat                  # Legacy endpoint
POST /api/chat/completions      # OpenAI-compatible completions
GET /api/chat/models            # Available models
```

#### Memory Operations
```bash
POST /api/memory/search         # Hybrid memory search
GET /api/memory/health          # Memory system health
GET /api/memory/metrics         # Memory system metrics
GET /api/memory/system/topology # System topology
```

#### ANP Operations (Port 8083)
```bash
GET /agent                      # Get AutoWeave agent card
GET /agent?validate=true        # Get validated agent card
POST /agent/tasks               # Create ANP task
GET /agent/tasks/:id            # Get task status
GET /agent/capabilities         # Get agent capabilities
GET /agent/openapi/validate     # Validate OpenAPI specs
```

### ChatUI Interface (Port 5173)

#### Main Interface
```bash
GET /                           # Main chat interface
GET /conversation/:id           # Specific conversation
GET /settings                   # Settings page
```

#### API Endpoints
```bash
POST /api/chat/completions      # Proxied to AutoWeave Core
GET /api/models                 # Available models
GET /api/user/settings          # User settings
```

### SillyTavern (Port 8081)

#### Main Interface
```bash
GET /                           # Main SillyTavern interface
GET /characters                 # Character management
GET /chat                       # Chat interface
GET /settings                   # Settings
```

### Appsmith (Port 8080)

#### Dashboard
```bash
GET /                           # Main dashboard
GET /applications               # Application list
GET /datasources                # Data sources
```

## Service Discovery

### Health Check URLs
```bash
# AutoWeave Core
curl http://localhost:3000/health

# ChatUI (via proxy)
curl http://localhost:5173/api/health

# SillyTavern
curl http://localhost:8081/health

# Appsmith
curl http://localhost:8080/health

# ANP Server
curl http://localhost:8083/agent
```

### WebSocket Endpoints
```bash
# AutoWeave AG-UI WebSocket
ws://localhost:3000/ws

# ChatUI WebSocket (if supported)
ws://localhost:5173/ws
```

## Common Port Conflicts

### Resolution Steps
1. **Check occupied ports**: `ss -tlnp | grep :PORT`
2. **Kill conflicting processes**: `kill -9 PID`
3. **Use alternative ports**: Update configuration files
4. **Restart services**: Follow startup sequence

### Startup Sequence
1. **AutoWeave Core** (Port 3000)
2. **ANP Server** (Port 8083)
3. **ChatUI Interface** (Port 5173)
4. **Kubernetes Port Forwards** (8081, 8080)

## Configuration Files

### Main Configuration Files
- `/home/gontrand/AutoWeave/.env` - AutoWeave Core environment
- `/home/gontrand/AutoWeave/interface/autoweave-interface/.env` - ChatUI environment
- `/home/gontrand/AutoWeave/config/autoweave/config.js` - AutoWeave main config
- `/home/gontrand/AutoWeave/SillyTavern/default/config.yaml` - SillyTavern config

### Development Files
- `/home/gontrand/AutoWeave/start-autoweave.sh` - Main startup script
- `/home/gontrand/AutoWeave/interface/autoweave-interface/vite.config.ts` - Vite configuration
- `/home/gontrand/AutoWeave/interface/autoweave-interface/package.json` - ChatUI dependencies

## Troubleshooting

### Common Issues

#### Port Already in Use
```bash
# Find process using port
ss -tlnp | grep :3000

# Kill process
kill -9 PID

# Or use alternative port
export PORT=3001
```

#### Service Not Responding
```bash
# Check service status
curl http://localhost:PORT/health

# Check logs
tail -f /tmp/autoweave-server.log
journalctl -u autoweave-service
```

#### Kubernetes Port Forward Issues
```bash
# Check if port forward is running
ps aux | grep "port-forward"

# Restart port forward
killall kubectl
kubectl port-forward -n autoweave-system svc/sillytavern-service 8081:8000 &
```

#### Environment Variables Not Loading
```bash
# Check if .env file exists
ls -la /home/gontrand/AutoWeave/.env

# Source environment manually
source /home/gontrand/AutoWeave/.env
```

### Performance Optimization

#### Memory Usage
- Monitor memory usage with `top` or `htop`
- Restart services if memory consumption is high
- Use production builds for better performance

#### Port Allocation
- Use sequential port allocation to avoid conflicts
- Document all port assignments
- Use environment variables for port configuration

## Integration Points

### AutoWeave ↔ ChatUI
- API Base URL: `http://localhost:3000/api/chat`
- OpenAI-compatible endpoints
- Model configuration synchronization

### AutoWeave ↔ SillyTavern
- Extension integration
- API endpoint sharing
- Character and conversation management

### AutoWeave ↔ Appsmith
- Dashboard data feeds
- Real-time monitoring
- System metrics visualization

### AutoWeave ↔ Kubernetes
- Service discovery
- Pod management
- Resource monitoring

---

*This configuration reference is automatically maintained and should be updated whenever service ports or configurations change.*