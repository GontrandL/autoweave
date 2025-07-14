# Fresh Sources & Configuration Intelligence

## Overview

AutoWeave's Configuration Intelligence transforms the platform into a universal configuration tool that understands the entire ecosystem and can configure it with the latest package versions. This feature enables:

- **Real-time package version discovery** across multiple registries
- **Intelligent configuration generation** with best practices
- **GitOps-ready outputs** with proper versioning
- **Multi-registry support** for comprehensive coverage

## Architecture

### Components

```
┌─────────────────────────────────────────────────────────┐
│                  Configuration Intelligence              │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌─────────────────┐     ┌──────────────────────────┐ │
│  │ Fresh Sources   │     │ Configuration Generator  │ │
│  │    Service      │────▶│    (AI-Powered)         │ │
│  └────────┬────────┘     └──────────┬───────────────┘ │
│           │                         │                   │
│  ┌────────▼────────┐     ┌─────────▼──────────┐      │
│  │ Registry APIs   │     │ GitOps Templates   │      │
│  ├─────────────────┤     ├────────────────────┤      │
│  │ • Docker Hub    │     │ • Kustomization    │      │
│  │ • NPM Registry  │     │ • ArgoCD Apps      │      │
│  │ • Artifact Hub  │     │ • Helm Values      │      │
│  │ • GitHub GHCR   │     │ • Observability    │      │
│  └─────────────────┘     └────────────────────┘      │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### Data Flow

1. **Intent Analysis**: Natural language intent is analyzed to identify required components
2. **Component Discovery**: Components are mapped to packages across registries
3. **Version Fetching**: Latest stable versions are fetched from registry APIs
4. **Configuration Generation**: AI generates optimal configuration with fresh versions
5. **GitOps Formatting**: Configuration is formatted for GitOps deployment

## API Reference

### Configuration Generation

#### `POST /api/config/generate-with-fresh`

Generate intelligent configuration with fresh package versions.

**Request:**
```json
{
  "intent": "Deploy a scalable PostgreSQL cluster with monitoring",
  "options": {
    "platform": "kubernetes",
    "namespace": "database",
    "includeObservability": true,
    "useFreshVersions": true
  }
}
```

**Response:**
```json
{
  "success": true,
  "configuration": {
    "name": "postgresql-cluster",
    "description": "Scalable PostgreSQL cluster with monitoring",
    "metadata": {
      "versions": {
        "docker": {
          "postgres": {
            "latest": "17.0",
            "tags": [...]
          }
        },
        "helm": {
          "postgresql": {
            "latestVersion": "16.7.16",
            "appVersion": "17.5.0"
          }
        }
      }
    },
    "gitopsLabels": {
      "autoweave.io/generated": "true",
      "autoweave.io/version": "1.0.0",
      "autoweave.io/pattern": "database"
    },
    "observability": {
      "metrics": {
        "enabled": true,
        "port": 9090,
        "path": "/metrics"
      },
      "tracing": {
        "enabled": true,
        "exporter": "otlp"
      }
    }
  }
}
```

### Fresh Sources Discovery

#### `GET /api/config/sources/latest/:type/:name`

Get the latest version information for a specific package.

**Parameters:**
- `type`: Registry type (`docker`, `npm`, `helm`, `github`)
- `name`: Package name

**Example:**
```bash
curl http://localhost:3000/api/config/sources/latest/helm/redis
```

#### `POST /api/config/sources/search`

Search for packages across multiple registries.

**Request:**
```json
{
  "query": "kafka",
  "options": {
    "includeDocker": true,
    "includeNpm": true,
    "includeHelm": true
  }
}
```

#### `POST /api/config/sources/check-outdated`

Check if your current versions are outdated.

**Request:**
```json
{
  "packages": [
    {
      "type": "docker",
      "name": "nginx",
      "currentVersion": "1.19.0"
    },
    {
      "type": "helm",
      "name": "postgresql",
      "currentVersion": "15.0.0"
    }
  ]
}
```

## MCP Tools

AutoWeave exposes its capabilities via Model Context Protocol (MCP) on port 3002.

### Available Tools

#### `create-config`
Generate intelligent configuration from natural language intent.

```bash
curl -X POST http://localhost:3002/mcp/v1/tools/create-config \
  -H "Content-Type: application/json" \
  -d '{
    "intent": "Setup Elasticsearch with Kibana",
    "options": {
      "platform": "kubernetes",
      "includeObservability": true
    }
  }'
```

#### `find-fresh-sources`
Find latest versions across multiple packages.

```bash
curl -X POST http://localhost:3002/mcp/v1/tools/find-fresh-sources \
  -H "Content-Type: application/json" \
  -d '{
    "packages": {
      "docker": ["redis", "nginx", "postgres"],
      "helm": ["redis", "nginx", "postgresql"]
    }
  }'
```

#### `generate-gitops`
Generate complete GitOps structure with manifests.

```bash
curl -X POST http://localhost:3002/mcp/v1/tools/generate-gitops \
  -H "Content-Type: application/json" \
  -d '{
    "application": {
      "name": "my-microservice",
      "type": "api",
      "components": ["api", "database", "cache"]
    },
    "gitops": {
      "repository": "github.com/myorg/gitops",
      "branch": "main"
    }
  }'
```

## Registry Support

### Docker Hub
- **API**: `https://hub.docker.com/v2`
- **Features**: Tag discovery, digest tracking, size information
- **Rate Limits**: Anonymous: 100 req/6h, Authenticated: 200 req/6h

### NPM Registry
- **API**: `https://registry.npmjs.org`
- **Features**: Version history, dist-tags, package metadata
- **Rate Limits**: Generally unlimited for public packages

### Artifact Hub (Helm)
- **API**: `https://artifacthub.io/api/v1`
- **Features**: Helm chart search, version history, app versions
- **Rate Limits**: Reasonable use expected

### GitHub Container Registry
- **API**: `https://api.github.com`
- **Features**: Container versions, tags, metadata
- **Authentication**: Requires GitHub token for private packages

## Best Practices Applied

When generating configurations, AutoWeave automatically applies:

### GitOps Patterns
- Separate configuration repository
- Declarative manifests
- Version tracking
- Automated synchronization

### Security
- Least privilege principles
- Network policies
- Secret management
- Security contexts

### Observability
- Prometheus metrics endpoints
- OpenTelemetry tracing
- Structured JSON logging
- Health check endpoints

### Reliability
- Resource limits and requests
- Liveness and readiness probes
- Pod disruption budgets
- Anti-affinity rules

## Configuration Patterns

AutoWeave recognizes and optimizes for common patterns:

### Database Pattern
```yaml
components:
  - postgres/mysql/mongodb/redis
features:
  - Persistence volumes
  - Backup strategies
  - Replication setup
  - Connection pooling
```

### Web Server Pattern
```yaml
components:
  - nginx/apache/traefik
features:
  - Ingress configuration
  - TLS termination
  - Load balancing
  - Rate limiting
```

### Monitoring Pattern
```yaml
components:
  - prometheus/grafana/loki
features:
  - Metric collection
  - Dashboard provisioning
  - Alert rules
  - Log aggregation
```

### Microservices Pattern
```yaml
components:
  - api/frontend/backend
features:
  - Service mesh ready
  - Circuit breakers
  - Distributed tracing
  - API gateway
```

## Testing

Run the comprehensive test suite:

```bash
node tests/test-fresh-sources.js
```

The test suite covers:
- MCP tool discovery and execution
- Fresh sources API endpoints
- Package search functionality
- Version comparison
- Configuration generation
- GitOps manifest creation

## Troubleshooting

### Common Issues

1. **Registry API Rate Limits**
   - Solution: Add authentication tokens
   - Docker Hub: Use Docker Hub access token
   - GitHub: Set GITHUB_TOKEN environment variable

2. **Outdated Version Detection**
   - Issue: Shows very old versions
   - Solution: Registry APIs may cache; wait and retry

3. **Package Not Found**
   - Issue: 404 errors from registry
   - Solution: Verify package name and registry type

### Debug Mode

Enable debug logging:
```bash
LOG_LEVEL=debug npm start
```

## Future Enhancements

1. **Additional Registries**
   - PyPI for Python packages
   - Maven Central for Java
   - Cargo for Rust
   - Go modules

2. **Advanced Features**
   - Dependency resolution
   - Security vulnerability scanning
   - License compliance checking
   - Cost estimation

3. **Integration Improvements**
   - Webhook notifications for new versions
   - Automated PR creation for updates
   - Slack/Teams notifications
   - CI/CD pipeline integration

## Conclusion

AutoWeave's Configuration Intelligence transforms infrastructure configuration from a manual, error-prone process into an intelligent, automated workflow. By combining real-time package discovery with AI-powered configuration generation, teams can deploy modern, secure, and observable infrastructure with confidence.