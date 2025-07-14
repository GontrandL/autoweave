# Contributing to AutoWeave

First off, thank you for considering contributing to AutoWeave! It's people like you that make AutoWeave such a great tool for democratizing AI agent creation. 🎉

## 📋 Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Ways to Contribute](#ways-to-contribute)
- [Development Process](#development-process)
- [Style Guidelines](#style-guidelines)
- [Architecture Guidelines](#architecture-guidelines)
- [Testing](#testing)
- [Pull Request Process](#pull-request-process)
- [Priority Areas](#priority-areas)
- [Getting Help](#getting-help)

## 📜 Code of Conduct

By participating in this project, you agree to abide by our Code of Conduct:

- Be respectful and inclusive
- Welcome newcomers and help them get started
- Focus on constructive criticism
- Respect differing viewpoints and experiences

Please read our full [Code of Conduct](CODE_OF_CONDUCT.md) before contributing.

## 🚀 Getting Started

### Development Setup

1. **Fork and Clone**
   ```bash
   git clone https://github.com/YOUR-USERNAME/autoweave.git
   cd autoweave
   ```

2. **Install Dependencies**
   ```bash
   npm install
   python3 -m venv venv
   source venv/bin/activate
   pip install -r requirements.txt
   ```

3. **Setup Development Environment**
   ```bash
   npm run setup:dev
   ```

4. **Run Tests**
   ```bash
   npm test
   npm run test:integration
   ```

## 🌟 Ways to Contribute

### 1. Code Contributions

#### Agent Modules
Create new agent capabilities:
```javascript
// packages/agents/src/my-custom-agent.js
class MyCustomAgent extends BaseAgent {
  async execute(context) {
    // Your agent logic here
  }
}
```

#### Integration Adapters
Add support for new services:
```javascript
// packages/integrations/src/adapters/my-service-adapter.js
class MyServiceAdapter extends IntegrationAdapter {
  async parseSpec(url) {
    // Parse service specification
  }
  
  async generateAgent(spec) {
    // Generate agent from spec
  }
}
```

#### Protocol Implementations
Extend communication protocols:
```javascript
// packages/integrations/src/protocols/my-protocol.js
class MyProtocol extends BaseProtocol {
  async negotiate(capabilities) {
    // Protocol negotiation logic
  }
}
```

### 2. Agent Templates

Create reusable agent templates in `examples/`:
```yaml
# examples/my-use-case-agent.yaml
apiVersion: kagent.dev/v1alpha1
kind: Agent
metadata:
  name: my-use-case-agent
  labels:
    autoweave.dev/template: "true"
spec:
  systemPrompt: |
    You are an agent that...
  tools:
    - tool1
    - tool2
```

### 3. Documentation

- Improve existing documentation
- Add examples and tutorials
- Translate documentation
- Create video tutorials

### 4. Testing

- Write unit tests
- Create integration tests
- Report bugs
- Verify fixes

## 💻 Development Process

### 1. Find or Create an Issue

- Check existing issues
- Create a new issue if needed
- Get confirmation before starting major work
- Comment on issues you're working on

### 2. Create a Feature Branch

```bash
# Update main branch
git checkout main
git pull origin main

# Create your feature branch
git checkout -b feature/your-feature-name
# or
git checkout -b fix/your-bug-fix
```

### 3. Make Your Changes

- Write clean, readable code
- Add tests for new functionality
- Update documentation as needed
- Ensure all tests pass

### 4. Test Your Changes

```bash
# Run tests
npm test

# Run linting
npm run lint

# Format code
npm run format

# Test specific functionality
npm run dev
```

## 📝 Style Guidelines

### JavaScript/Node.js

- Use ES6+ features
- Follow the existing code style
- Use meaningful variable names
- Add JSDoc comments for functions

```javascript
/**
 * Creates a new agent from a natural language description
 * @param {string} description - Natural language description of the agent
 * @param {Object} options - Additional options for agent creation
 * @returns {Promise<Agent>} The created agent
 */
async function createAgent(description, options = {}) {
  try {
    const workflow = await generateWorkflow(description);
    return await deployAgent(workflow);
  } catch (error) {
    logger.error('Failed to create agent:', error);
    throw error;
  }
}

// Use descriptive names
const agentWorkflow = generateWorkflow(userDescription);
// NOT: const w = genWF(desc);
```

### Python

- Follow PEP 8
- Use type hints where appropriate
- Document functions with docstrings

```python
def process_memory(data: dict, user_id: str) -> dict:
    """
    Process memory data for a specific user.
    
    Args:
        data: The memory data to process
        user_id: The ID of the user
        
    Returns:
        Processed memory data
    """
    # Implementation
```

### Code Style Tools

We use ESLint and Prettier for JavaScript:
```bash
npm run lint
npm run format
```

For Python code, we use Black and pylint:
```bash
black scripts/
pylint scripts/
```

## 🏗️ Architecture Guidelines

### Project Structure

Follow the monorepo pattern:
```
packages/
├── core/           # Core orchestration logic
├── agents/         # Agent implementations
├── backend/        # API server
├── memory/         # Memory systems
├── integrations/   # External integrations
├── cli/            # Command-line interface
├── deployment/     # K8s configurations
└── shared/         # Shared utilities
```

### Adding New Components

1. **Use Dependency Injection**
   ```javascript
   class MyComponent {
     constructor(dependencies) {
       this.logger = dependencies.logger;
       this.config = dependencies.config;
     }
   }
   ```

2. **Emit Events**
   ```javascript
   this.emit('agent:created', { agentId, workflow });
   ```

3. **Follow Module Patterns**
   - Each package should be independently testable
   - Use workspace references for internal dependencies
   - Export clear interfaces

### Memory System Extensions

When adding memory backends:
```javascript
class CustomMemoryBackend extends BaseMemoryBackend {
  async initialize() {
    // Setup connection
  }
  
  async store(key, value, metadata) {
    // Store implementation
  }
  
  async retrieve(key) {
    // Retrieve implementation
  }
  
  async search(query, options) {
    // Search implementation
  }
}
```

## 🧪 Testing

### Unit Tests
```javascript
// tests/unit/agent-weaver.test.js
describe('AgentWeaver', () => {
  it('should generate workflow from description', async () => {
    const description = 'Create a file processing agent';
    const workflow = await agentWeaver.generateWorkflow(description);
    
    expect(workflow).toHaveProperty('name');
    expect(workflow).toHaveProperty('steps');
    expect(workflow.steps).toBeInstanceOf(Array);
  });
});
```

### Integration Tests
```javascript
// tests/integration/full-flow.test.js
describe('Full Agent Creation Flow', () => {
  it('should create and deploy agent end-to-end', async () => {
    const agent = await autoweave.createAgent('Monitor kubernetes pods');
    
    expect(agent.status).toBe('deployed');
    expect(agent.deployment).toHaveProperty('podName');
  });
});
```

## 🔄 Pull Request Process

### 1. Update Your Branch
```bash
git pull origin main
git rebase origin/main
```

### 2. Push Your Changes
```bash
git push origin feature/your-feature-name
```

### 3. Create a Pull Request

#### PR Title Format
```
feat: Add support for GraphQL integration
fix: Resolve memory leak in agent service
docs: Update installation guide
test: Add integration tests for ANP server
refactor: Simplify workflow generation logic
chore: Update dependencies
```

#### PR Description Template
```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing
- [ ] Unit tests pass
- [ ] Integration tests pass
- [ ] Manual testing completed

## Checklist
- [ ] Code follows project style
- [ ] Self-review completed
- [ ] Documentation updated
- [ ] Tests added/updated
- [ ] Comments added for complex logic
```

### 4. Code Review

- Be patient and respectful
- Address all feedback
- Make requested changes promptly
- Ask questions if something is unclear

## 🎯 Priority Areas

### High Priority
1. **Multi-cloud support** - AWS, GCP, Azure integration
2. **Performance optimization** - Faster agent creation
3. **Security enhancements** - Better secret management
4. **Language support** - Python, Go, Java SDKs

### Medium Priority
1. **UI improvements** - Better visualization
2. **Monitoring** - Enhanced observability
3. **Testing** - Increase coverage
4. **Documentation** - More examples

### Community Wishlist
1. **Mobile app** - Monitor agents on the go
2. **Voice interface** - Create agents by speaking
3. **AR visualization** - See agents in AR
4. **Blockchain integration** - Decentralized agents

## 🐛 Reporting Issues

### Bug Reports

Include:
- AutoWeave version
- Node.js version
- Operating system
- Steps to reproduce
- Expected vs actual behavior
- Error messages/logs

### Feature Requests

Include:
- Use case description
- Proposed solution
- Alternative solutions considered
- Impact on existing features

## 🏆 Recognition

### Contributors
- All contributors are added to [CONTRIBUTORS.md](CONTRIBUTORS.md)
- Regular contributors get maintainer status
- Outstanding contributions featured in release notes

## 📞 Getting Help

- **Discord**: [AutoWeave Community](https://discord.gg/autoweave)
- **GitHub Discussions**: Ask questions
- **Issue Tracker**: Report bugs
- **Documentation**: [https://docs.autoweave.dev](https://docs.autoweave.dev)
- **Email**: contrib@autoweave.dev

## 🔄 Release Process

1. **Development** - Main branch
2. **Testing** - Release candidate
3. **Release** - Tagged version
4. **Announcement** - Blog post & social media

## 🏗️ Module-Specific Guidelines

Each module may have specific contribution guidelines:

- **@autoweave/core**: Focus on maintainability and extensibility
- **@autoweave/memory**: Ensure data integrity and performance
- **@autoweave/agents**: Follow agent development best practices
- **@autoweave/backend**: Maintain API compatibility
- **@autoweave/cli**: Ensure cross-platform compatibility
- **@autoweave/deployment**: Test on multiple K8s versions

---

Thank you for contributing to the future of autonomous AI agents! 🚀

*"Every contribution, no matter how small, weaves a stronger fabric of intelligence."*