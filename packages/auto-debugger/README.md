# @autoweave/auto-debugger

Automatic debugging system with Playwright MCP integration for AutoWeave. This package provides intelligent error detection, root cause analysis, and automatic fix generation for web applications and agent workflows.

## Features

- 🎭 **Playwright MCP Server**: Browser automation via Model Context Protocol
- 🐛 **Automatic Error Detection**: Captures JavaScript errors, console logs, and network issues
- 🔍 **Root Cause Analysis**: Intelligent analysis of error patterns
- 🔧 **Fix Generation**: Context-aware code fixes with confidence scores
- 🤖 **AutoWeave Integration**: Seamless integration with AutoWeave's agent system
- 📊 **Comprehensive Reporting**: Detailed debug reports with actionable insights
- 🐳 **Docker Support**: Production-ready containerized deployment

## Installation

### Prerequisites

- Node.js 18+
- Docker and Docker Compose (for containerized deployment)
- Linux (Debian/Ubuntu recommended)

### Quick Install

```bash
# Clone the repository
git clone https://github.com/autoweave/autoweave.git
cd autoweave/packages/auto-debugger

# Run installation script (Debian/Ubuntu)
./scripts/install-debian.sh

# Or install manually
npm install
npm run build
```

## Usage

### Starting the MCP Server

```bash
# Using Node.js
npm start

# Using Docker
docker-compose up -d

# As a systemd service
sudo systemctl start autoweave-debugger
```

### Basic Example

```javascript
import { createAutoDebugger, createMCPServer } from '@autoweave/auto-debugger';

// Create and start MCP server
const mcpServer = createMCPServer({
  headless: true,
  devtools: false
});

await mcpServer.start(8931);

// Create debugger instance
const debugger = createAutoDebugger({
  captureConsole: true,
  captureErrors: true,
  captureNetwork: true,
  autoAnalyze: true
});

// Attach to a page
const page = await browser.newPage();
await debugger.attach(page);

// Navigate and monitor
await page.goto('https://example.com');

// Generate debug report
const report = await debugger.generateReport();
console.log('Errors found:', report.summary.totalErrors);
console.log('Suggestions:', report.suggestions);
```

### AutoWeave Integration

```javascript
import { createAutoWeaveBridge } from '@autoweave/auto-debugger';

// Create bridge to AutoWeave
const bridge = createAutoWeaveBridge({
  mcpPort: 8931,
  apiUrl: 'http://localhost:3000',
  headless: true
});

// Initialize bridge
await bridge.initialize();

// Create debug session for a workflow
const sessionId = await bridge.createDebugSession(
  'workflow-123',
  'https://app.example.com'
);

// Analyze workflow
const report = await bridge.analyzeWorkflow(sessionId);

// Apply fixes if needed
if (report.suggestions.length > 0) {
  await bridge.applyFixes(sessionId, report.suggestions);
}
```

## API Reference

### AutoDebugger

Main debugging class that captures and analyzes browser events.

```typescript
class AutoDebugger {
  constructor(config?: Partial<DebuggerConfig>)
  attach(page: Page): Promise<void>
  detach(): Promise<void>
  generateReport(): Promise<DebugReport>
  clear(): void
  getStats(): DebugStats
}
```

### PlaywrightMCPServer

MCP server that exposes Playwright capabilities via JSON-RPC.

```typescript
class PlaywrightMCPServer {
  constructor(config?: BrowserConfig)
  start(port?: number): Promise<void>
  stop(): Promise<void>
}
```

### AutoWeaveBridge

Integration bridge between AutoDebugger and AutoWeave ecosystem.

```typescript
class AutoWeaveBridge {
  constructor(autoweaveConfig: any)
  initialize(): Promise<void>
  createDebugSession(workflowId: string, url: string): Promise<string>
  analyzeWorkflow(sessionId: string): Promise<DebugReport>
  applyFixes(sessionId: string, fixes: FixSuggestion[]): Promise<void>
  cleanup(): Promise<void>
}
```

## Configuration

### Default Configuration

```json
{
  "mcp": {
    "port": 8931,
    "host": "0.0.0.0"
  },
  "browser": {
    "headless": true,
    "devtools": false,
    "timeout": 30000
  },
  "debugger": {
    "captureConsole": true,
    "captureErrors": true,
    "captureNetwork": true,
    "autoAnalyze": true,
    "maxLogSize": 1000
  }
}
```

### Environment Variables

```bash
# MCP Server
MCP_PORT=8931
MCP_HOST=0.0.0.0

# Browser Configuration
HEADLESS=true
BROWSER_TIMEOUT=30000

# AutoWeave Integration
AUTOWEAVE_API_URL=http://localhost:3000
AUTOWEAVE_MEMORY_URL=http://localhost:8000

# Logging
LOG_LEVEL=info
```

## Docker Deployment

### Build and Run

```bash
# Build image
docker build -f docker/Dockerfile -t autoweave-debugger .

# Run with docker-compose
docker-compose up -d

# View logs
docker-compose logs -f playwright-mcp
```

### Docker Compose Services

- `playwright-mcp`: Main MCP server with Playwright
- `xvfb`: Virtual display for headless operation
- `claude-code-mcp`: Optional Claude Code integration

## MCP Protocol

The server implements the Model Context Protocol with the following methods:

### Session Management
- `createSession`: Create new browser session
- `closeSession`: Close existing session
- `listSessions`: List all active sessions

### Navigation
- `navigate`: Navigate to URL
- `reload`: Reload current page
- `goBack`: Navigate back in history
- `goForward`: Navigate forward in history

### Debugging
- `startDebugging`: Start error capture
- `stopDebugging`: Stop error capture
- `getDebugReport`: Generate comprehensive report
- `clearDebugData`: Clear captured data

### Page Interaction
- `screenshot`: Capture page screenshot
- `evaluate`: Execute JavaScript in page
- `click`: Click on element
- `type`: Type text into element
- `waitForSelector`: Wait for element to appear

## Error Patterns

The debugger recognizes and provides fixes for:

1. **Variable Declaration Errors**
   - Undefined variables
   - Missing imports

2. **Null Reference Errors**
   - Property access on null/undefined
   - Missing null checks

3. **Type Errors**
   - Type mismatches
   - Invalid operations

4. **Network Errors**
   - 404 Not Found
   - 5xx Server errors
   - CORS issues
   - Timeouts

5. **Async Errors**
   - Unhandled promise rejections
   - Missing await keywords

## Development

### Running Tests

```bash
# Unit tests
npm test

# Integration tests
npm run test:integration

# Watch mode
npm run test:watch
```

### Building

```bash
# Build for production
npm run build

# Development build with watch
npm run dev
```

### Linting

```bash
# Run ESLint
npm run lint

# Fix lint issues
npm run lint:fix
```

## Troubleshooting

### Common Issues

1. **Browser Launch Failures**
   ```bash
   # Install missing dependencies
   npx playwright install-deps
   ```

2. **Permission Errors**
   ```bash
   # Fix Docker permissions
   sudo usermod -aG docker $USER
   ```

3. **Port Already in Use**
   ```bash
   # Find and kill process using port
   lsof -ti:8931 | xargs kill -9
   ```

### Debug Mode

Enable debug logging:

```bash
export LOG_LEVEL=debug
export PWDEBUG=1
npm start
```

## Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

## License

MIT License - see LICENSE file for details

## Support

- Documentation: https://docs.autoweave.dev/auto-debugger
- Issues: https://github.com/autoweave/autoweave/issues
- Discord: https://discord.gg/autoweave