// Core exports
export { AutoDebugger } from './core/auto-debugger';

// Playwright MCP exports
export { PlaywrightMCPServer } from './playwright/mcp-server';

// Integration exports
export { AutoWeaveBridge } from './integrations/autoweave-bridge';

// Type exports
export type {
  DebuggerConfig,
  LogEntry,
  ErrorEntry,
  NetworkIssue,
  FixSuggestion,
  DebugReport,
  MCPRequest,
  MCPResponse,
  MCPCapability,
  BrowserConfig,
  AutoDebugSession
} from './types';

// Factory function for easy initialization
export function createAutoDebugger(config?: Partial<DebuggerConfig>) {
  return new AutoDebugger(config);
}

// Factory function for MCP server
export function createMCPServer(config?: BrowserConfig) {
  return new PlaywrightMCPServer(config);
}

// Factory function for AutoWeave integration
export function createAutoWeaveBridge(autoweaveConfig: any) {
  return new AutoWeaveBridge(autoweaveConfig);
}