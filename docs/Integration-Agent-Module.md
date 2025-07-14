# Integration Agent Module Documentation

## Overview

The Integration Agent Module is a comprehensive system that transforms OpenAPI specifications into fully functional Kubernetes-deployed agents. It provides an AI-powered pipeline that automatically parses OpenAPI specs, generates Pydantic models, creates Kubernetes manifests, and deploys them via GitOps workflows.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    INTEGRATION AGENT MODULE                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  │
│  │   OpenAPI       │  │   Pydantic      │  │   GitOps        │  │
│  │   Parser        │──│   Generator     │──│   Manager       │  │
│  │                 │  │                 │  │                 │  │
│  │ • Validation    │  │ • Model Gen     │  │ • Git Ops       │  │
│  │ • Complexity    │  │ • Type Safety   │  │ • Argo CD       │  │
│  │ • Metadata      │  │ • Integration   │  │ • Deployment    │  │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘  │
│           │                     │                     │         │
│           └─────────────────────┼─────────────────────┘         │
│                                 │                               │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │                 INTEGRATION AGENT CORE                      │  │
│  │                                                             │  │
│  │  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  │
│  │  │   Kubernetes    │  │   LangChain     │  │   Metrics       │  │
│  │  │   Manifests     │  │   Orchestrator  │  │   Collector     │  │
│  │  │                 │  │                 │  │                 │  │
│  │  │ • Deployment    │  │ • AI Planning   │  │ • Prometheus    │  │
│  │  │ • Services      │  │ • Reasoning     │  │ • Analytics     │  │
│  │  │ • Ingress       │  │ • Execution     │  │ • Monitoring    │  │
│  │  └─────────────────┘  └─────────────────┘  └─────────────────┘  │
│  └─────────────────────────────────────────────────────────────┘  │
│                                 │                               │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │                     PYTHON BRIDGE                          │  │
│  │                                                             │  │
│  │  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  │
│  │  │   openapi-core  │  │ datamodel-code  │  │   kubeconform   │  │
│  │  │   Validation    │  │   generator     │  │   Validation    │  │
│  │  │                 │  │                 │  │                 │  │
│  │  │ • Spec Parse    │  │ • Pydantic Code │  │ • K8s Validate  │  │
│  │  │ • Validation    │  │ • Type Safety   │  │ • Policy Check  │  │
│  │  │ • Metadata      │  │ • Model Export  │  │ • Compliance    │  │
│  │  └─────────────────┘  └─────────────────┘  └─────────────────┘  │
│  └─────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

## Components

### 1. OpenAPI Parser (`openapi-parser.js`)
- **Purpose**: Parse and validate OpenAPI 3.x specifications
- **Features**:
  - OpenAPI 3.x parsing with openapi-core
  - Specification validation and error reporting
  - Complexity analysis and metadata extraction
  - Endpoint discovery and categorization
  - Python bridge integration

### 2. Pydantic Generator (`pydantic-generator.js`)
- **Purpose**: Generate Pydantic models from OpenAPI schemas
- **Features**:
  - Automatic model generation from OpenAPI schemas
  - Type safety and validation
  - Code generation with datamodel-code-generator
  - Model organization and structuring
  - Integration code generation

### 3. Integration Agent Core (`integration-agent.js`)
- **Purpose**: Core integration logic and Kubernetes manifest generation
- **Features**:
  - Kubernetes manifest generation (Deployment, Service, Ingress)
  - Manifest validation with kubeconform
  - Policy enforcement with conftest
  - Agent lifecycle management
  - Status monitoring and reporting

### 4. GitOps Manager (`gitops-manager.js`)
- **Purpose**: GitOps workflow management and deployment
- **Features**:
  - Git repository operations
  - Argo CD Application generation
  - Automated deployment workflows
  - Branch management and PR creation
  - Rollback and versioning

### 5. LangChain Orchestrator (`langchain-orchestrator.js`)
- **Purpose**: AI-powered orchestration and planning
- **Features**:
  - Integration planning with AI reasoning
  - Dynamic workflow orchestration
  - Tool calling and execution
  - Error handling and recovery
  - Performance optimization

### 6. Metrics Collector (`metrics-collector.js`)
- **Purpose**: Prometheus metrics collection and observability
- **Features**:
  - Integration metrics tracking
  - Performance monitoring
  - Error reporting and analytics
  - Prometheus format export
  - Dashboard integration

### 7. Module Entry Point (`index.js`)
- **Purpose**: Main orchestration and API interface
- **Features**:
  - Component initialization and coordination
  - Main API endpoints
  - Error handling and logging
  - Configuration management
  - Status reporting

## Installation and Setup

### 1. Automated Setup
```bash
# Run the automated setup script
npm run setup-integration-agent
```

### 2. Manual Setup
```bash
# Create Python virtual environment
python3 -m venv integration-agent-env
source integration-agent-env/bin/activate

# Install Python dependencies
pip install openapi-core==0.18.* pydantic==2.* datamodel-code-generator==0.25.*
pip install gitpython==3.1.* langchain==0.2.* prometheus-client==0.20.*

# Install CLI tools
# kubeconform
curl -L https://github.com/yannh/kubeconform/releases/latest/download/kubeconform-linux-amd64.tar.gz | tar xz
sudo mv kubeconform /usr/local/bin/

# conftest
curl -L https://github.com/open-policy-agent/conftest/releases/latest/download/conftest_*_Linux_x86_64.tar.gz | tar xz
sudo mv conftest /usr/local/bin/

# Install Node.js dependencies
npm install simple-git
```

### 3. Configuration
```javascript
// config/integration-agent.js
module.exports = {
  python: {
    executable: 'python3',
    virtualEnv: './integration-agent-env',
    timeout: 30000
  },
  kubernetes: {
    namespace: 'default',
    timeout: 60000
  },
  gitops: {
    enabled: true,
    defaultBranch: 'main',
    commitMessage: 'feat: Add integration agent deployment'
  },
  metrics: {
    enabled: true,
    port: 9090,
    path: '/metrics'
  }
};
```

## Usage

### 1. API Endpoints

#### Create Integration Agent
```bash
curl -X POST http://localhost:3000/api/agents/integration \
  -H "Content-Type: application/json" \
  -d '{
    "openapi_url": "https://petstore.swagger.io/v2/swagger.json",
    "target_namespace": "petstore",
    "git_repo": "https://github.com/myorg/k8s-deployments",
    "deploy_config": {
      "replicas": 3,
      "resources": {
        "requests": { "memory": "128Mi", "cpu": "100m" },
        "limits": { "memory": "512Mi", "cpu": "500m" }
      }
    }
  }'
```

#### List Integration Agents
```bash
curl http://localhost:3000/api/agents/integration
```

#### Get Integration Agent Status
```bash
curl http://localhost:3000/api/agents/integration/agent-123
```

#### Get Integration Metrics
```bash
curl http://localhost:3000/api/agents/integration/metrics
```

### 2. Programmatic Usage

```javascript
const { IntegrationAgentModule } = require('./src/agents/integration-agent');

// Initialize module
const config = {
  openaiApiKey: process.env.OPENAI_API_KEY,
  port: 3000
};

const integrationAgent = new IntegrationAgentModule(config);
await integrationAgent.initialize();

// Create integration agent
const result = await integrationAgent.createIntegrationAgent({
  openapi_url: 'https://api.example.com/openapi.json',
  target_namespace: 'my-namespace',
  git_repo: 'https://github.com/myorg/k8s-deployments',
  deploy_config: {
    replicas: 2,
    ingress: {
      enabled: true,
      host: 'api.mycompany.com',
      tls: true
    }
  }
});

console.log('Integration created:', result);
```

### 3. Natural Language Interface

#### Via ChatUI
```
Access: http://localhost:5173

Command: "Create an integration agent for the GitHub API at https://api.github.com/openapi.json and deploy it to the github namespace"
```

#### Via SillyTavern
```
Access: http://localhost:8081

Message: "I need to integrate the Stripe API. Can you create an agent for https://api.stripe.com/openapi.json?"
```

## Features

### 1. OpenAPI 3.x Support
- **Full OpenAPI 3.x compatibility**
- **Automatic validation and error reporting**
- **Complexity analysis and optimization recommendations**
- **Metadata extraction for intelligent deployment**

### 2. AI-Powered Orchestration
- **LangChain-based reasoning for optimal deployment strategies**
- **Dynamic workflow adaptation based on API complexity**
- **Intelligent error handling and recovery**
- **Performance optimization recommendations**

### 3. GitOps Integration
- **Automated Git workflows with branch management**
- **Argo CD Application generation**
- **Pull request automation**
- **Rollback and versioning support**

### 4. Kubernetes Native
- **Automatic Deployment, Service, and Ingress generation**
- **Resource optimization based on API complexity**
- **Policy enforcement with conftest**
- **Manifest validation with kubeconform**

### 5. Observability
- **Prometheus metrics collection**
- **Integration performance tracking**
- **Error analytics and reporting**
- **Dashboard integration**

## Example Workflows

### 1. Simple API Integration
```javascript
// Input: Simple REST API
const options = {
  openapi_url: 'https://jsonplaceholder.typicode.com/openapi.json',
  target_namespace: 'demo'
};

// Output: Basic Kubernetes deployment
const result = await integrationAgent.createIntegrationAgent(options);
// Creates: Deployment + Service + basic configuration
```

### 2. Complex API with GitOps
```javascript
// Input: Complex API with GitOps workflow
const options = {
  openapi_url: 'https://api.shopify.com/admin/api/2023-10/openapi.json',
  target_namespace: 'ecommerce',
  git_repo: 'https://github.com/myorg/shopify-k8s',
  deploy_config: {
    replicas: 3,
    ingress: {
      enabled: true,
      host: 'shopify.mycompany.com',
      tls: true
    },
    secrets: {
      api_key: 'shopify-api-key',
      webhook_secret: 'shopify-webhook-secret'
    }
  }
};

// Output: Full GitOps deployment
const result = await integrationAgent.createIntegrationAgent(options);
// Creates: Deployment + Service + Ingress + Secrets + Argo CD Application
```

### 3. AI-Optimized Deployment
```javascript
// The AI orchestrator analyzes the API and optimizes deployment
const result = await integrationAgent.createIntegrationAgent({
  openapi_url: 'https://api.complex-service.com/openapi.json',
  target_namespace: 'production'
});

// AI recommendations might include:
// - Resource sizing based on endpoint complexity
// - Caching strategies for read-heavy APIs
// - Rate limiting for high-traffic endpoints
// - Security configurations for sensitive data
```

## Testing

### 1. Unit Tests
```bash
# Run unit tests
npm test tests/unit/integration-agent.test.js

# Run with coverage
npm run test:coverage -- tests/unit/integration-agent.test.js
```

### 2. Integration Tests
```bash
# Run integration tests
npm test tests/integration/integration-agent-api.test.js

# Run end-to-end tests
npm test tests/e2e/integration-agent-e2e.test.js
```

### 3. Manual Testing
```bash
# Test OpenAPI parsing
curl -X POST http://localhost:3000/api/agents/integration \
  -H "Content-Type: application/json" \
  -d '{"openapi_url": "https://petstore.swagger.io/v2/swagger.json", "target_namespace": "test"}'

# Test GitOps workflow
curl -X POST http://localhost:3000/api/agents/integration \
  -H "Content-Type: application/json" \
  -d '{"openapi_url": "https://api.github.com/openapi.json", "target_namespace": "github", "git_repo": "https://github.com/test/repo"}'
```

## Performance Metrics

### 1. Key Performance Indicators
- **Integration Duration**: Average time to create an integration agent
- **Success Rate**: Percentage of successful integrations
- **API Complexity**: Distribution of API complexity levels
- **Resource Usage**: CPU and memory utilization during processing

### 2. Metrics Collection
```javascript
// Metrics are automatically collected and exposed at:
// http://localhost:3000/api/agents/integration/metrics

const metrics = await integrationAgent.getMetrics();
console.log('Metrics:', metrics);
// Output:
// {
//   totalIntegrations: 10,
//   successfulIntegrations: 8,
//   failedIntegrations: 2,
//   averageDuration: 42000,
//   apiComplexityDistribution: {
//     simple: 3,
//     moderate: 5,
//     complex: 2
//   }
// }
```

### 3. Performance Optimization
- **Caching**: OpenAPI specifications are cached for repeated use
- **Parallel Processing**: Multiple steps executed in parallel where possible
- **Resource Pooling**: Python processes are reused for efficiency
- **Intelligent Scheduling**: AI orchestrator optimizes execution order

## Error Handling

### 1. Common Error Types
- **OpenAPI Validation Errors**: Invalid or malformed OpenAPI specifications
- **Kubernetes Validation Errors**: Invalid manifest generation
- **GitOps Errors**: Git repository access or commit issues
- **Network Errors**: API endpoint accessibility issues

### 2. Error Recovery
- **Automatic Retry**: Transient errors are automatically retried
- **Graceful Degradation**: Fallback to simplified deployments if complex features fail
- **Detailed Logging**: Comprehensive error reporting for debugging
- **Metrics Collection**: Error patterns are tracked for improvement

### 3. Error Response Format
```json
{
  "error": "Failed to create integration agent",
  "message": "OpenAPI specification validation failed",
  "details": {
    "validationErrors": [
      "Missing required field: info.title",
      "Invalid path parameter: {user_id}"
    ],
    "errorCode": "OPENAPI_VALIDATION_ERROR",
    "timestamp": "2023-12-01T10:00:00Z"
  }
}
```

## Security Considerations

### 1. API Security
- **Authentication**: Support for API key and OAuth authentication
- **Rate Limiting**: Built-in rate limiting for external API calls
- **Input Validation**: Comprehensive validation of all inputs
- **Secure Defaults**: Security-first configuration defaults

### 2. Kubernetes Security
- **RBAC**: Role-based access control for Kubernetes resources
- **Network Policies**: Automatic network policy generation
- **Secrets Management**: Secure handling of API keys and credentials
- **Pod Security**: Security contexts and policies

### 3. GitOps Security
- **SSH Key Management**: Secure SSH key handling for Git operations
- **Signed Commits**: Optional GPG signing for Git commits
- **Access Control**: Repository access validation
- **Audit Logging**: Comprehensive audit trail for all operations

## Troubleshooting

### 1. Common Issues

#### Python Environment Issues
```bash
# Check Python environment
source integration-agent-env/bin/activate
python -c "import openapi_core; print('OpenAPI Core:', openapi_core.__version__)"

# Reinstall dependencies
pip install --upgrade openapi-core pydantic datamodel-code-generator
```

#### Kubernetes Validation Issues
```bash
# Check kubeconform installation
kubeconform --version

# Validate manifests manually
kubeconform -summary /path/to/manifest.yaml
```

#### GitOps Issues
```bash
# Check Git configuration
git config --global user.name
git config --global user.email

# Test repository access
git clone https://github.com/your-org/your-repo.git
```

### 2. Debug Mode
```bash
# Enable debug logging
export LOG_LEVEL=debug
npm start

# Check logs
tail -f logs/integration-agent.log
```

### 3. Health Checks
```bash
# Check module health
curl http://localhost:3000/health

# Check specific component health
curl http://localhost:3000/api/agents/integration/health
```

## Contributing

### 1. Development Setup
```bash
# Clone repository
git clone https://github.com/autoweave/autoweave.git
cd autoweave

# Install dependencies
npm install

# Setup Integration Agent
npm run setup-integration-agent

# Run tests
npm test
```

### 2. Code Structure
- **Follow existing patterns**: Maintain consistency with existing codebase
- **Add comprehensive tests**: Unit, integration, and E2E tests
- **Update documentation**: Keep documentation current with changes
- **Use TypeScript**: Prefer TypeScript for new components

### 3. Contribution Guidelines
- **Feature Requests**: Open an issue before implementing new features
- **Bug Reports**: Include detailed reproduction steps
- **Pull Requests**: Follow the existing code review process
- **Testing**: Ensure all tests pass before submitting

## Roadmap

### Version 1.1 (Current)
- ✅ OpenAPI 3.x parsing and validation
- ✅ Pydantic model generation
- ✅ Kubernetes manifest generation
- ✅ GitOps workflow integration
- ✅ AI-powered orchestration
- ✅ Prometheus metrics collection

### Version 1.2 (Planned)
- 🔄 GraphQL API support
- 🔄 Advanced security scanning
- 🔄 Multi-cluster deployment
- 🔄 Custom resource definitions
- 🔄 Helm chart generation

### Version 1.3 (Future)
- 📋 OpenAPI 3.1 support
- 📋 AsyncAPI integration
- 📋 Service mesh integration
- 📋 Advanced monitoring
- 📋 Custom validation rules

## License

MIT License - see [LICENSE](../LICENSE) file for details.

## Support

- **Issues**: [GitHub Issues](https://github.com/autoweave/autoweave/issues)
- **Discussions**: [GitHub Discussions](https://github.com/autoweave/autoweave/discussions)
- **Email**: support@autoweave.dev
- **Documentation**: [AutoWeave Docs](https://docs.autoweave.dev)

---

**Integration Agent Module** - Transform OpenAPI specifications into Kubernetes agents with AI-powered orchestration 🚀