# 🧠 AutoWeave Coding Memory Module

## Overview

The Coding Memory Module is an intelligent extension of AutoWeave's hybrid memory system, specifically designed for remembering, analyzing, and learning from code. It provides contextual and structural memory for code elements, enabling intelligent code assistance, refactoring suggestions, and team analytics.

## Features

### 1. 🔍 Code Context Memory
Store and retrieve rich contextual information about code:
- Function purposes and documentation
- Code patterns and paradigms
- Dependencies and relationships
- Complexity analysis
- Author and review notes

### 2. 🌐 Code Relations Graph
Track relationships between code elements:
- Function calls and dependencies
- Class inheritance hierarchies
- Module imports and exports
- Data flow between components

### 3. 📈 Learning Capabilities
Continuously learn from development activities:
- Git commit patterns
- Code review feedback
- Refactoring patterns
- Team coding styles

### 4. 🔮 Predictive Features
AI-powered predictions based on context:
- Next developer actions
- Code completion suggestions
- Refactoring opportunities
- Quality improvements

## API Reference

### REST API Endpoints

#### Remember Code Context
```http
POST /api/memory/code/context
Content-Type: application/json

{
  "file": "src/services/auth.js",
  "function": "validateToken",
  "purpose": "JWT validation with refresh logic",
  "patterns": ["authentication", "security"],
  "dependencies": ["jsonwebtoken", "crypto"],
  "linkedFiles": ["middleware/auth.js"],
  "complexity": "medium",
  "content": "function code here..."
}
```

#### Search Code Context
```http
POST /api/memory/code/search-similar
Content-Type: application/json

{
  "query": "JWT validation",
  "context": {
    "language": "javascript",
    "includeRelations": true
  }
}
```

#### Create Code Relations
```http
POST /api/memory/code/relations
Content-Type: application/json

{
  "type": "function_calls",
  "source": {
    "file": "src/auth.js",
    "function": "validateToken"
  },
  "target": {
    "file": "middleware/auth.js", 
    "function": "authorize"
  },
  "relationship": "calls",
  "frequency": "high",
  "dataFlow": ["token", "user", "permissions"]
}
```

#### Suggest Refactoring
```http
POST /api/memory/code/suggest-refactor
Content-Type: application/json

{
  "file": "src/services/auth.js",
  "functionName": "validateToken",
  "issues": ["high_complexity", "multiple_responsibilities"]
}
```

#### Learn from Commits
```http
POST /api/memory/code/learn-from-diff
Content-Type: application/json

{
  "commit": "abc123",
  "changes": {
    "added": ["new-feature.js"],
    "modified": ["existing.js"],
    "deleted": []
  },
  "patterns": {
    "security_improvement": "Added rate limiting",
    "test_coverage": "Added unit tests"
  }
}
```

#### Get Team Analytics
```http
GET /api/memory/code/analytics/patterns?period=30days
```

### MCP Tool Interface

The module is also accessible via Model Context Protocol (MCP) for LLM integration:

#### Available MCP Tools

1. **autoweave-coding-memory-remember-code-context**
   - Remember code context with metadata
   
2. **autoweave-coding-memory-create-code-relation**
   - Create relations between code elements
   
3. **autoweave-coding-memory-search-code-context**
   - Search code with enhanced context
   
4. **autoweave-coding-memory-explain-code**
   - Get rich explanations of code context
   
5. **autoweave-coding-memory-suggest-refactoring**
   - Get AI-powered refactoring suggestions
   
6. **autoweave-coding-memory-learn-from-commit**
   - Learn patterns from git commits
   
7. **autoweave-coding-memory-predict-next-action**
   - Predict next developer actions
   
8. **autoweave-coding-memory-get-team-analytics**
   - Get team coding analytics

## Usage Examples

### JavaScript/Node.js

```javascript
const fetch = require('node-fetch');

// Remember code context
async function rememberCode() {
  const response = await fetch('http://localhost:3000/api/memory/code/context', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      file: 'src/utils/validator.js',
      function: 'validateEmail',
      purpose: 'Email validation with RFC compliance',
      patterns: ['validation', 'regex'],
      dependencies: ['validator'],
      complexity: 'low'
    })
  });
  
  const result = await response.json();
  console.log('Code context saved:', result);
}

// Search for similar code
async function searchSimilarCode() {
  const response = await fetch('http://localhost:3000/api/memory/code/search-similar', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query: 'email validation',
      context: { language: 'javascript' }
    })
  });
  
  const results = await response.json();
  console.log('Similar code found:', results);
}

// Get refactoring suggestions
async function getRefactoringSuggestions() {
  const response = await fetch('http://localhost:3000/api/memory/code/suggest-refactor', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      file: 'src/services/user.js',
      functionName: 'processUserData',
      issues: ['high_complexity']
    })
  });
  
  const suggestions = await response.json();
  console.log('Refactoring suggestions:', suggestions);
}
```

### Python

```python
import requests
import json

BASE_URL = 'http://localhost:3000/api/memory/code'

def remember_code_context():
    """Remember code context in AutoWeave"""
    context = {
        'file': 'auth/validator.py',
        'function': 'validate_token',
        'purpose': 'JWT token validation',
        'patterns': ['authentication', 'security'],
        'dependencies': ['jwt', 'datetime'],
        'complexity': 'medium'
    }
    
    response = requests.post(f'{BASE_URL}/context', json=context)
    return response.json()

def search_code(query):
    """Search for code with specific patterns"""
    search_params = {
        'query': query,
        'context': {
            'language': 'python',
            'includeRelations': True
        }
    }
    
    response = requests.post(f'{BASE_URL}/search-similar', json=search_params)
    return response.json()

def learn_from_commit(commit_hash, changes):
    """Teach AutoWeave about commit patterns"""
    commit_data = {
        'commit': commit_hash,
        'changes': changes,
        'patterns': {
            'refactoring': 'Simplified authentication flow',
            'performance': 'Optimized database queries'
        }
    }
    
    response = requests.post(f'{BASE_URL}/learn-from-diff', json=commit_data)
    return response.json()
```

## Architecture

The Coding Memory Module extends AutoWeave's hybrid memory system:

```
CodingMemoryManager
├── Contextual Memory (mem0)
│   ├── Code contexts
│   ├── Patterns
│   └── Learning data
├── Structural Memory (GraphRAG)
│   ├── Code relations
│   ├── Dependency graphs
│   └── Call hierarchies
└── ML Cache (Redis)
    ├── Frequent searches
    ├── Analysis results
    └── Predictions
```

## Configuration

The module uses the same configuration as AutoWeave's memory system:

```javascript
{
  agentWeaver: {
    // AI provider configuration
  },
  memory: {
    mem0: {
      // Contextual memory config
    },
    graph: {
      // Graph database config
    },
    redis: {
      // Cache configuration
    }
  }
}
```

## Best Practices

1. **Always provide context**: Include as much metadata as possible when remembering code
2. **Use relations**: Link related code elements to build a comprehensive knowledge graph
3. **Learn continuously**: Feed commit and review data to improve suggestions
4. **Leverage predictions**: Use predictive features to enhance developer productivity
5. **Monitor analytics**: Review team analytics to identify improvement opportunities

## Limitations

- Requires initialization of memory systems (mem0, GraphRAG, Redis)
- Code analysis is language-agnostic but optimized for JavaScript/TypeScript
- Predictions improve with more data over time
- Some features require OpenAI API or compatible LLM provider

## Future Enhancements

- [ ] Language-specific analyzers (AST-based)
- [ ] IDE integrations (VS Code, IntelliJ)
- [ ] Git hooks for automatic learning
- [ ] CI/CD pipeline integration
- [ ] Advanced code metrics and visualizations
- [ ] Multi-repository knowledge sharing

## Support

For issues or questions about the Coding Memory Module:
- Create an issue on GitHub
- Check the AutoWeave documentation
- Review the test cases in `/tests/unit/coding-memory.test.js`