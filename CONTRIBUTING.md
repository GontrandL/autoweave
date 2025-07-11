# Contributing to AutoWeave

Thank you for your interest in contributing to AutoWeave! We welcome contributions from the community and are grateful for any help you can provide.

## 📋 Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [How to Contribute](#how-to-contribute)
- [Development Process](#development-process)
- [Style Guidelines](#style-guidelines)
- [Commit Messages](#commit-messages)
- [Pull Request Process](#pull-request-process)

## 📜 Code of Conduct

By participating in this project, you agree to abide by our Code of Conduct:

- Be respectful and inclusive
- Welcome newcomers and help them get started
- Focus on constructive criticism
- Respect differing viewpoints and experiences

## 🚀 Getting Started

1. **Fork the repository** you want to contribute to
2. **Clone your fork** locally
3. **Set up your development environment** following the README
4. **Create a new branch** for your feature or fix
5. **Make your changes** following our guidelines
6. **Submit a pull request**

## 🤝 How to Contribute

### Reporting Bugs

- Check if the bug has already been reported
- Open a new issue with a clear title and description
- Include steps to reproduce the issue
- Add relevant logs, screenshots, or code samples

### Suggesting Features

- Check existing issues and discussions
- Open a feature request with a clear use case
- Explain why this feature would be useful
- Be open to feedback and alternative solutions

### Code Contributions

- Pick an issue labeled `good first issue` or `help wanted`
- Comment on the issue to let others know you're working on it
- Follow the development process below

## 💻 Development Process

### 1. Setup

```bash
# Fork and clone the module you want to work on
git clone https://github.com/YOUR-USERNAME/autoweave-MODULE.git
cd autoweave-MODULE

# Add upstream remote
git remote add upstream https://github.com/GontrandL/autoweave-MODULE.git

# Install dependencies
npm install
```

### 2. Create a Feature Branch

```bash
# Update main branch
git checkout main
git pull upstream main

# Create your feature branch
git checkout -b feature/your-feature-name
```

### 3. Make Changes

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

# Test the specific functionality
npm run dev
```

## 📝 Style Guidelines

### JavaScript

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
  // Implementation
}
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

## 💬 Commit Messages

We follow conventional commits:

```
type(scope): subject

body

footer
```

### Types

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code refactoring
- `perf`: Performance improvements
- `test`: Adding or updating tests
- `chore`: Maintenance tasks

### Examples

```
feat(agent-weaver): add support for multi-step workflows

Implement a new workflow engine that supports:
- Sequential steps
- Parallel execution
- Conditional branching

Closes #123
```

## 🔄 Pull Request Process

1. **Update your branch**
   ```bash
   git pull upstream main
   git rebase upstream/main
   ```

2. **Push your changes**
   ```bash
   git push origin feature/your-feature-name
   ```

3. **Create a Pull Request**
   - Use a clear, descriptive title
   - Reference any related issues
   - Describe what changes you made and why
   - Include screenshots for UI changes

4. **PR Template**
   ```markdown
   ## Description
   Brief description of the changes

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
   - [ ] Code follows style guidelines
   - [ ] Self-review completed
   - [ ] Comments added for complex logic
   - [ ] Documentation updated
   ```

5. **Code Review**
   - Be patient and respectful
   - Address all feedback
   - Make requested changes promptly
   - Ask questions if something is unclear

## 🏗️ Module-Specific Guidelines

Each module may have specific contribution guidelines:

- **autoweave-core**: Focus on maintainability and extensibility
- **autoweave-memory**: Ensure data integrity and performance
- **autoweave-agents**: Follow agent development best practices
- **autoweave-ui**: Maintain accessibility standards

## 🙏 Recognition

We value all contributions! Contributors will be:
- Listed in the project's contributors file
- Mentioned in release notes for significant contributions
- Invited to join our community discussions

## 📞 Getting Help

- Join our [Discord server](https://discord.gg/autoweave)
- Check the [documentation](https://docs.autoweave.dev)
- Ask questions in GitHub Discussions
- Reach out to maintainers

Thank you for contributing to AutoWeave! 🎉