# ANP & AG-UI Implementation Guide

## Overview

This document provides a comprehensive guide to the Agent Network Protocol (ANP) and Agent-GUI (AG-UI) implementation in AutoWeave. These systems transform AutoWeave from a simple agent orchestrator into a hub for agent interoperability with dynamic user interfaces.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                                  AutoWeave                                      │
│  ┌─────────────────────────────────────────────────────────────────────────────┐ │
│  │                            Core AutoWeave                                   │ │
│  │  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐           │ │
│  │  │  Agent Weaver   │  │  Memory System  │  │  Agent Service  │           │ │
│  │  │  + OpenAPI 3.1  │  │   (mem0 + RAG)  │  │   (kagent)     │           │ │
│  │  └─────────────────┘  └─────────────────┘  └─────────────────┘           │ │
│  └─────────────────────────────────────────────────────────────────────────────┘ │
│                                                                                 │
│  ┌─────────────────────────────────────────────────────────────────────────────┐ │
│  │                         ANP Server (Port 8083)                             │ │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐      │ │
│  │  │ Agent Card  │  │    Tasks    │  │ OpenAPI Val │  │ External    │      │ │
│  │  │ Generation  │  │ Management  │  │ idation     │  │ Discovery   │      │ │
│  │  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘      │ │
│  └─────────────────────────────────────────────────────────────────────────────┘ │
│                                                                                 │
│  ┌─────────────────────────────────────────────────────────────────────────────┐ │
│  │                      AG-UI System (WebSocket)                              │ │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐      │ │
│  │  │ UI Agent    │  │  Template   │  │  Session    │  │ Event       │      │ │
│  │  │ (Events)    │  │  Engine     │  │  Manager    │  │ Dispatcher  │      │ │
│  │  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘      │ │
│  └─────────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────────┘
```

## Agent Network Protocol (ANP)

### Core Concepts

ANP is a RESTful protocol that enables agents to communicate with each other in a standardized way. It provides:

- **Agent Discovery**: Find and connect to other agents
- **Task Management**: Create, execute, and track tasks across agents
- **OpenAPI Integration**: Full API specification generation and validation
- **Capability Negotiation**: Understand what other agents can do

### ANP Server Implementation

The ANP server runs on port 8083 and provides the following endpoints:

#### 1. Agent Card (`GET /agent`)

Returns the AutoWeave agent card with metadata and capabilities:

```json
{
  "protocol_version": "v1",
  "agent_id": "autoweave-orchestrator",
  "name": "AutoWeave",
  "description": "AutoWeave: The Self-Weaving Agent Orchestrator",
  "version": "0.1.0",
  "capabilities": {
    "tools": [
      {
        "name": "create-agent",
        "description": "Create and deploy new agents",
        "openapi": { /* OpenAPI 3.1 specification */ }
      }
    ],
    "supported_formats": ["json", "yaml"],
    "supported_protocols": ["anp", "mcp"],
    "deployment_targets": ["kubernetes", "kagent"]
  }
}
```

#### 2. Task Management (`POST /agent/tasks`)

Create and manage tasks:

```json
{
  "input": "Create a file processing agent",
  "tools": ["file-system", "coding-assistant"],
  "agent_id": "autoweave-orchestrator"
}
```

#### 3. OpenAPI Validation (`GET /agent/openapi/validate`)

Validates all tool OpenAPI specifications:

```json
{
  "validated_at": "2024-01-01T00:00:00Z",
  "tools_total": 5,
  "tools_valid": 4,
  "tools_invalid": 1,
  "validation_results": [
    {
      "tool": "create-agent",
      "valid": true,
      "spec": { /* validated OpenAPI spec */ }
    }
  ]
}
```

### OpenAPI 3.1 Generation

The system automatically generates OpenAPI 3.1 specifications for all agent tools:

```javascript
// Example: Agent workflow to OpenAPI conversion
const workflow = {
  id: "file-processor",
  name: "File Processor",
  description: "Process files with AI",
  requiredModules: [
    { name: "file-system", type: "file_system" },
    { name: "ai-analyzer", type: "coding_assistant" }
  ]
};

const openApiSpec = await agentWeaver.generateOpenAPISpec(workflow);
```

Generated specifications include:
- **Security schemes** (API key, Bearer token)
- **Path definitions** for all agent operations
- **Schema definitions** for request/response models
- **ANP compliance metadata**

## Agent-GUI (AG-UI) System

### Core Concepts

AG-UI is a WebSocket-based system that enables dynamic user interface generation. It provides:

- **Real-time Communication**: Bidirectional WebSocket communication
- **Dynamic UI Generation**: Template-based event generation
- **Session Management**: Client state tracking
- **Event Types**: Chat, display, input, status, and command events

### Event Types

#### 1. Chat Events

```javascript
// Send chat message
{
  "type": "chat",
  "content": {
    "text": "Hello AutoWeave",
    "timestamp": "2024-01-01T00:00:00Z"
  }
}

// Receive response
{
  "type": "chat",
  "content": {
    "text": "Hello! How can I help you?",
    "sender": "autoweave",
    "timestamp": "2024-01-01T00:00:00Z"
  }
}
```

#### 2. Display Events

```javascript
// System metrics display
{
  "type": "display",
  "content": {
    "type": "metrics",
    "title": "System Metrics",
    "data": {
      "agents": { "total": 5, "active": 3 },
      "memory": { "usage": "85%" },
      "anp": { "tasks": 12, "completed": 8 }
    }
  }
}

// Agent list table
{
  "type": "display",
  "content": {
    "type": "table",
    "title": "Active Agents",
    "columns": ["id", "name", "status"],
    "data": [
      {"id": "agent-1", "name": "File Processor", "status": "running"}
    ]
  }
}
```

#### 3. Input Events

```javascript
// Form generation
{
  "type": "display",
  "content": {
    "type": "form",
    "title": "Create New Agent",
    "schema": {
      "type": "object",
      "properties": {
        "description": {
          "type": "string",
          "title": "Agent Description"
        }
      }
    },
    "action": "create-agent"
  }
}

// Form response
{
  "type": "input",
  "content": {
    "action": "create-agent",
    "values": {
      "description": "Create a file processing agent"
    }
  }
}
```

#### 4. Status Events

```javascript
{
  "type": "status",
  "content": {
    "status": "in_progress",
    "message": "Creating agent...",
    "progress": 65,
    "operation_id": "op-123"
  }
}
```

### UI Agent Template Engine

The UI Agent uses a template-based system for generating consistent UI events:

```javascript
// Template definition
const template = {
  type: 'chat',
  template: {
    text: 'Welcome to {{agent_name}}! Ready to {{capabilities}}.',
    sender: '{{agent_name}}',
    timestamp: '{{timestamp}}'
  }
};

// Variable substitution
const variables = {
  agent_name: 'AutoWeave',
  capabilities: 'weave agents together',
  timestamp: new Date().toISOString()
};

// Generated event
const event = uiAgent.generateEvent('chat-welcome', variables, clientId);
```

### WebSocket Connection Management

```javascript
// Client connection
const ws = new WebSocket('ws://localhost:3000/ws');

// Send message
ws.send(JSON.stringify({
  type: 'chat',
  content: { text: 'Hello AutoWeave' }
}));

// Receive events
ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log('Received:', data);
};
```

## Implementation Details

### File Structure

```
src/
├── mcp/discovery.js          # ANP Server implementation
├── agui/ui-agent.js          # AG-UI event generation
├── core/agent-weaver.js      # OpenAPI 3.1 generation
├── core/autoweave.js         # Main integration
└── index.js                  # WebSocket server setup
```

### Key Components

#### 1. MCPDiscovery (ANP Server)

```javascript
class MCPDiscovery {
  // ANP endpoints
  setupANPRoutes() {
    this.anpApp.get('/agent', this.handleAgentCard);
    this.anpApp.post('/agent/tasks', this.handleTaskCreation);
    this.anpApp.get('/agent/openapi/validate', this.handleOpenAPIValidation);
  }
  
  // OpenAPI validation
  async validateOpenAPISpec(spec, source) {
    const api = await SwaggerParser.validate(spec);
    this.validateANPCompliance(spec);
    return { valid: true, spec: api };
  }
}
```

#### 2. UIAgent (AG-UI System)

```javascript
class UIAgent {
  // Event generation
  generateEvent(templateId, variables, clientId) {
    const template = this.eventTemplates.get(templateId);
    const event = this.processTemplate(template, variables);
    event.agui_metadata = {
      generated_by: 'ui-agent',
      client_id: clientId
    };
    return event;
  }
  
  // Specialized generators
  async generateAgentCreationFlow(clientId, description) {
    // Multi-step UI flow for agent creation
  }
}
```

#### 3. AgentWeaver (OpenAPI Generation)

```javascript
class AgentWeaver {
  // OpenAPI 3.1 generation
  async generateOpenAPISpec(workflow, options = {}) {
    const spec = await this.processWorkflowToOpenAPI(workflow);
    await this.validateOpenAPISpec(spec);
    return this.enhanceOpenAPISpec(spec, workflow);
  }
  
  // ANP compliance validation
  validateANPCompliance(spec) {
    // Check required ANP metadata
    // Validate endpoint structure
    // Ensure security schemes
  }
}
```

### Integration Points

#### 1. AutoWeave Core Integration

```javascript
class AutoWeave {
  constructor(config, kagentBridge) {
    // Initialize UI Agent
    this.uiAgent = new UIAgent(config, this);
    
    // Initialize MCP Discovery with ANP
    this.mcpDiscovery = new MCPDiscovery(config, kagentBridge, this);
  }
  
  // Enhanced AG-UI methods
  async sendEnhancedWelcome(clientId) {
    await this.uiAgent.generateWelcomeSequence(clientId);
  }
}
```

#### 2. WebSocket Server Setup

```javascript
function setupAGUIWebSocketServer(server, autoweave, logger) {
  const wss = new WebSocket.Server({ server, path: '/ws' });
  
  wss.on('connection', (ws, req) => {
    const clientId = generateClientId(req);
    autoweave.addAGUIClient(clientId, ws);
    
    ws.on('message', (message) => {
      const event = JSON.parse(message.toString());
      autoweave.handleAGUIInput(clientId, event);
    });
  });
}
```

## Configuration

### Environment Variables

```bash
# ANP Configuration
ANP_PORT=8083
EXTERNAL_ANP_REGISTRIES=http://agent1:8083,http://agent2:8083

# AG-UI Configuration
AGUI_SESSION_TIMEOUT=3600000
AGUI_MAX_CLIENTS=100
```

### Dependencies

```json
{
  "dependencies": {
    "ws": "^8.14.0",
    "swagger-parser": "^10.0.3",
    "ajv": "^8.12.0",
    "node-fetch": "^2.7.0"
  }
}
```

## Usage Examples

### ANP Client Usage

```javascript
// Discover agent
const response = await fetch('http://localhost:8083/agent');
const agentCard = await response.json();

// Create task
const task = await fetch('http://localhost:8083/agent/tasks', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    input: 'Process this file',
    tools: ['file-system']
  })
});
```

### AG-UI Client Usage

```javascript
// Connect to AG-UI
const ws = new WebSocket('ws://localhost:3000/ws');

// Send commands
ws.send(JSON.stringify({
  type: 'command',
  content: { command: 'system-health' }
}));

// Handle responses
ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  if (data.type === 'display') {
    renderDisplay(data.content);
  }
};
```

## Testing

### ANP Testing

```bash
# Test agent card
curl http://localhost:8083/agent

# Test OpenAPI validation
curl http://localhost:8083/agent/openapi/validate

# Test task creation
curl -X POST http://localhost:8083/agent/tasks \
  -H "Content-Type: application/json" \
  -d '{"input": "test task"}'
```

### AG-UI Testing

```bash
# Test WebSocket connection
wscat -c ws://localhost:3000/ws

# Send test message
echo '{"type": "chat", "content": {"text": "hello"}}' | wscat -c ws://localhost:3000/ws
```

## Error Handling

### ANP Error Responses

```json
{
  "error": "Invalid OpenAPI specification",
  "details": "Missing required field: info.title",
  "code": 400,
  "timestamp": "2024-01-01T00:00:00Z"
}
```

### AG-UI Error Events

```json
{
  "type": "error",
  "content": {
    "message": "Command processing failed",
    "details": "Unknown command: invalid-command",
    "timestamp": "2024-01-01T00:00:00Z"
  }
}
```

## Performance Considerations

### ANP Server

- **Concurrent Connections**: Handles multiple agent connections simultaneously
- **Task Queue**: Asynchronous task processing with status tracking
- **Validation Caching**: OpenAPI validation results cached for performance

### AG-UI System

- **Session Management**: Efficient client session tracking
- **Event Batching**: Multiple events batched for better performance
- **Template Caching**: UI templates cached for faster generation

## Security

### ANP Security

- **API Key Authentication**: All ANP endpoints support API key authentication
- **Bearer Token Support**: JWT token authentication for secure communication
- **Input Validation**: All inputs validated against JSON schemas

### AG-UI Security

- **WebSocket Authentication**: Client authentication via headers
- **Input Sanitization**: All user inputs sanitized before processing
- **Session Isolation**: Each client session isolated from others

## Future Enhancements

### ANP Roadmap

- **Agent Mesh**: Full mesh networking between agents
- **Service Discovery**: Kubernetes service discovery integration
- **Load Balancing**: Automatic load balancing across agent instances

### AG-UI Roadmap

- **React Components**: Pre-built React components for common UI patterns
- **Mobile Support**: Native mobile app support
- **Voice Interface**: Voice command integration

## Conclusion

The ANP and AG-UI systems provide AutoWeave with advanced capabilities for agent interoperability and dynamic user interface generation. Together, they transform AutoWeave from a simple orchestrator into a comprehensive agent ecosystem platform.

For more information, see the main project documentation in `CLAUDE.md` and the API reference documentation.