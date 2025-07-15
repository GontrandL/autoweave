// Import types first
import type { DebuggerConfig, BrowserConfig } from './types';

// Import classes
import { AutoDebugger } from './core/auto-debugger';
import { PlaywrightMCPServer } from './playwright/mcp-server';
import { AutoWeaveBridge } from './integrations/autoweave-bridge';

// Core exports
export { AutoDebugger };

// Playwright MCP exports
export { PlaywrightMCPServer };

// Integration exports
export { AutoWeaveBridge };

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