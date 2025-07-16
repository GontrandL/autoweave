import { EventEmitter } from 'eventemitter3';
import type { Browser, BrowserContext } from 'playwright';
import { chromium } from 'playwright';
import { WebSocketServer } from 'ws';

import { AutoDebugger } from '../core/auto-debugger';
// import { getLogger } from '@autoweave/observability';
const getLogger = (_name: string) => ({
  info: console.log,
  warn: console.warn,
  error: console.error,
  debug: console.debug
});
import type { 
  MCPRequest, 
  MCPResponse, 
  MCPCapability,
  BrowserConfig,
  AutoDebugSession,
  DebugReport,
  DebuggerConfig
} from '../types';

/**
 * Playwright MCP Server - Model Context Protocol server for browser automation
 * Exposes Playwright capabilities via JSON-RPC over WebSocket
 */
export class PlaywrightMCPServer extends EventEmitter {
  private logger = getLogger('PlaywrightMCPServer');
  private wss?: WebSocketServer;
  private browser?: Browser;
  private contexts: Map<string, BrowserContext> = new Map();
  private debuggers: Map<string, AutoDebugger> = new Map();
  private sessions: Map<string, AutoDebugSession> = new Map();
  private config: BrowserConfig;

  constructor(config: BrowserConfig = {}) {
    super();
    this.config = {
      headless: true,
      devtools: false,
      slowMo: 0,
      timeout: 30000,
      viewport: { width: 1280, height: 720 },
      ...config
    };
  }

  /**
   * Start the MCP server
   */
  async start(port: number = 8931): Promise<void> {
    // Launch browser
    this.browser = await chromium.launch({
      headless: this.config.headless,
      devtools: this.config.devtools,
      slowMo: this.config.slowMo
    });

    // Create WebSocket server
    this.wss = new WebSocketServer({ port });

    this.wss.on('connection', (ws) => {
      this.logger.info('New MCP client connected');

      ws.on('message', (data) => {
        try {
          const request = JSON.parse(String(data)) as MCPRequest;
          void this.handleRequest(request).then(response => {
            ws.send(JSON.stringify(response));
          }).catch(() => {
            // Error already handled in handleRequest
          });
        } catch (error) {
          this.logger.error('Error handling request', error as Error);
          ws.send(JSON.stringify({
            jsonrpc: '2.0',
            id: null,
            error: {
              code: -32700,
              message: 'Parse error'
            }
          }));
        }
      });

      ws.on('close', () => {
        this.logger.info('MCP client disconnected');
      });

      // Send capabilities on connect
      ws.send(JSON.stringify({
        jsonrpc: '2.0',
        method: 'capabilities',
        params: this.getCapabilities()
      }));
    });

    this.logger.info(`Playwright MCP Server started on port ${port}`);
  }

  /**
   * Stop the MCP server
   */
  async stop(): Promise<void> {
    // Close all contexts
    for (const [, context] of this.contexts) {
      await context.close();
    }
    this.contexts.clear();
    this.debuggers.clear();
    this.sessions.clear();

    // Close browser
    if (this.browser) {
      await this.browser.close();
    }

    // Close WebSocket server
    if (this.wss) {
      this.wss.close();
    }

    this.logger.info('Playwright MCP Server stopped');
  }

  /**
   * Handle incoming MCP requests
   */
  private async handleRequest(request: MCPRequest): Promise<MCPResponse> {
    const { id, method, params } = request;

    try {
      let result: unknown;

      switch (method) {
        // Session management
        case 'createSession':
          result = await this.createSession(params as Record<string, unknown>);
          break;
        case 'closeSession':
          result = await this.closeSession((params as { sessionId: string }).sessionId);
          break;
        case 'listSessions':
          result = this.listSessions();
          break;

        // Navigation
        case 'navigate':
          result = await this.navigate((params as { sessionId: string; url: string }).sessionId, (params as { sessionId: string; url: string }).url);
          break;
        case 'reload':
          result = await this.reload((params as { sessionId: string }).sessionId);
          break;
        case 'goBack':
          result = await this.goBack((params as { sessionId: string }).sessionId);
          break;
        case 'goForward':
          result = await this.goForward((params as { sessionId: string }).sessionId);
          break;

        // Debugging
        case 'startDebugging':
          result = this.startDebugging((params as { sessionId: string }).sessionId);
          break;
        case 'stopDebugging':
          result = this.stopDebugging((params as { sessionId: string }).sessionId);
          break;
        case 'getDebugReport':
          result = this.getDebugReport((params as { sessionId: string }).sessionId);
          break;
        case 'clearDebugData':
          result = this.clearDebugData((params as { sessionId: string }).sessionId);
          break;

        // Page interaction
        case 'screenshot':
          result = await this.screenshot((params as { sessionId: string; options?: Record<string, unknown> }).sessionId, (params as { sessionId: string; options?: Record<string, unknown> }).options);
          break;
        case 'evaluate':
          result = await this.evaluate((params as { sessionId: string; expression: string }).sessionId, (params as { sessionId: string; expression: string }).expression);
          break;
        case 'click':
          result = await this.click((params as { sessionId: string; selector: string }).sessionId, (params as { sessionId: string; selector: string }).selector);
          break;
        case 'type':
          result = await this.type((params as { sessionId: string; selector: string; text: string }).sessionId, (params as { sessionId: string; selector: string; text: string }).selector, (params as { sessionId: string; selector: string; text: string }).text);
          break;
        case 'waitForSelector':
          result = await this.waitForSelector((params as { sessionId: string; selector: string; options?: Record<string, unknown> }).sessionId, (params as { sessionId: string; selector: string; options?: Record<string, unknown> }).selector, (params as { sessionId: string; selector: string; options?: Record<string, unknown> }).options);
          break;

        // Utilities
        case 'getCapabilities':
          result = this.getCapabilities();
          break;
        case 'ping':
          result = 'pong';
          break;

        default:
          throw new Error(`Unknown method: ${method}`);
      }

      return {
        jsonrpc: '2.0',
        id,
        result
      };
    } catch (error) {
      return {
        jsonrpc: '2.0',
        id,
        error: {
          code: -32603,
          message: (error as Error).message,
          data: (error as Error).stack
        }
      };
    }
  }

  /**
   * Create a new browser session
   */
  private async createSession(params: Record<string, unknown> = {}): Promise<string> {
    const sessionId = `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Create browser context
    const context = await this.browser!.newContext({
      viewport: (params.viewport as { width: number; height: number } | undefined) ?? this.config.viewport,
      userAgent: params.userAgent as string | undefined,
      locale: params.locale as string | undefined,
      timezoneId: params.timezone as string | undefined,
      permissions: params.permissions as string[] | undefined
    });

    // Create page
    await context.newPage();
    
    // Create debugger instance
    const debuggerInstance = new AutoDebugger(params.debugConfig as Partial<DebuggerConfig> | undefined);
    
    // Store references
    this.contexts.set(sessionId, context);
    this.debuggers.set(sessionId, debuggerInstance);
    
    // Create session record
    this.sessions.set(sessionId, {
      id: sessionId,
      startTime: Date.now(),
      url: '',
      status: 'active'
    });

    this.logger.info('Created new session', { sessionId });
    return sessionId;
  }

  /**
   * Close a browser session
   */
  private async closeSession(sessionId: string): Promise<void> {
    const context = this.contexts.get(sessionId);
    const debuggerInstance = this.debuggers.get(sessionId);
    const session = this.sessions.get(sessionId);

    if (context) {
      await context.close();
      this.contexts.delete(sessionId);
    }

    if (debuggerInstance) {
      debuggerInstance.detach();
      this.debuggers.delete(sessionId);
    }

    if (session) {
      session.endTime = Date.now();
      session.status = 'completed';
    }

    this.logger.info('Closed session', { sessionId });
  }

  /**
   * List all sessions
   */
  private listSessions(): AutoDebugSession[] {
    return Array.from(this.sessions.values());
  }

  /**
   * Navigate to URL
   */
  private async navigate(sessionId: string, url: string): Promise<void> {
    const context = this.contexts.get(sessionId);
    if (!context) {throw new Error('Session not found');}

    const pages = context.pages();
    if (pages.length === 0) {throw new Error('No pages in context');}

    const page = pages[0];
    await page.goto(url, { waitUntil: 'networkidle' });

    // Update session
    const session = this.sessions.get(sessionId);
    if (session) {
      session.url = url;
    }
  }

  /**
   * Start debugging for a session
   */
  private startDebugging(sessionId: string): void {
    const context = this.contexts.get(sessionId);
    const debuggerInstance = this.debuggers.get(sessionId);
    
    if (!context || !debuggerInstance) {throw new Error('Session not found');}

    const pages = context.pages();
    if (pages.length === 0) {throw new Error('No pages in context');}

    debuggerInstance.attach(pages[0]);
    
    // Setup event forwarding
    debuggerInstance.on('error', (error: unknown) => {
      this.emit('debug-error', { sessionId, error });
    });
    
    debuggerInstance.on('console', (log: unknown) => {
      this.emit('debug-console', { sessionId, log });
    });
    
    debuggerInstance.on('network-error', (issue: unknown) => {
      this.emit('debug-network', { sessionId, issue });
    });
    
    debuggerInstance.on('suggestions-generated', (suggestions: unknown) => {
      this.emit('debug-suggestions', { sessionId, suggestions });
    });
  }

  /**
   * Stop debugging for a session
   */
  private stopDebugging(sessionId: string): void {
    const debuggerInstance = this.debuggers.get(sessionId);
    if (!debuggerInstance) {throw new Error('Debugger not found');}

    debuggerInstance.detach();
    debuggerInstance.removeAllListeners();
  }

  /**
   * Get debug report for a session
   */
  private getDebugReport(sessionId: string): DebugReport {
    const debuggerInstance = this.debuggers.get(sessionId);
    if (!debuggerInstance) {throw new Error('Debugger not found');}

    const report = debuggerInstance.generateReport();
    
    // Store in session
    const session = this.sessions.get(sessionId);
    if (session) {
      session.report = report;
    }
    
    return report;
  }

  /**
   * Clear debug data for a session
   */
  private clearDebugData(sessionId: string): void {
    const debuggerInstance = this.debuggers.get(sessionId);
    if (!debuggerInstance) {throw new Error('Debugger not found');}

    debuggerInstance.clear();
  }

  /**
   * Take screenshot
   */
  private async screenshot(sessionId: string, options: Record<string, unknown> = {}): Promise<string> {
    const context = this.contexts.get(sessionId);
    if (!context) {throw new Error('Session not found');}

    const pages = context.pages();
    if (pages.length === 0) {throw new Error('No pages in context');}

    const buffer = await pages[0].screenshot({
      fullPage: options.fullPage as boolean | undefined,
      clip: options.clip as { x: number; y: number; width: number; height: number } | undefined,
      quality: options.quality as number | undefined,
      type: (options.type as 'png' | 'jpeg' | undefined) ?? 'png'
    });

    return buffer.toString('base64');
  }

  /**
   * Evaluate JavaScript in page
   */
  private async evaluate(sessionId: string, expression: string): Promise<unknown> {
    const context = this.contexts.get(sessionId);
    if (!context) {throw new Error('Session not found');}

    const pages = context.pages();
    if (pages.length === 0) {throw new Error('No pages in context');}

    return pages[0].evaluate(expression);
  }

  /**
   * Click on element
   */
  private async click(sessionId: string, selector: string): Promise<void> {
    const context = this.contexts.get(sessionId);
    if (!context) {throw new Error('Session not found');}

    const pages = context.pages();
    if (pages.length === 0) {throw new Error('No pages in context');}

    await pages[0].click(selector);
  }

  /**
   * Type text into element
   */
  private async type(sessionId: string, selector: string, text: string): Promise<void> {
    const context = this.contexts.get(sessionId);
    if (!context) {throw new Error('Session not found');}

    const pages = context.pages();
    if (pages.length === 0) {throw new Error('No pages in context');}

    await pages[0].type(selector, text);
  }

  /**
   * Wait for selector
   */
  private async waitForSelector(sessionId: string, selector: string, options: Record<string, unknown> = {}): Promise<void> {
    const context = this.contexts.get(sessionId);
    if (!context) {throw new Error('Session not found');}

    const pages = context.pages();
    if (pages.length === 0) {throw new Error('No pages in context');}

    await pages[0].waitForSelector(selector, {
      timeout: (options.timeout as number | undefined) ?? this.config.timeout,
      state: (options.state as 'attached' | 'detached' | 'visible' | 'hidden' | undefined) ?? 'visible'
    });
  }

  /**
   * Reload page
   */
  private async reload(sessionId: string): Promise<void> {
    const context = this.contexts.get(sessionId);
    if (!context) {throw new Error('Session not found');}

    const pages = context.pages();
    if (pages.length === 0) {throw new Error('No pages in context');}

    await pages[0].reload();
  }

  /**
   * Go back in history
   */
  private async goBack(sessionId: string): Promise<void> {
    const context = this.contexts.get(sessionId);
    if (!context) {throw new Error('Session not found');}

    const pages = context.pages();
    if (pages.length === 0) {throw new Error('No pages in context');}

    await pages[0].goBack();
  }

  /**
   * Go forward in history
   */
  private async goForward(sessionId: string): Promise<void> {
    const context = this.contexts.get(sessionId);
    if (!context) {throw new Error('Session not found');}

    const pages = context.pages();
    if (pages.length === 0) {throw new Error('No pages in context');}

    await pages[0].goForward();
  }

  /**
   * Get server capabilities
   */
  private getCapabilities(): MCPCapability {
    return {
      name: 'playwright-mcp',
      version: '1.0.0',
      methods: [
        // Session management
        'createSession',
        'closeSession',
        'listSessions',
        // Navigation
        'navigate',
        'reload',
        'goBack',
        'goForward',
        // Debugging
        'startDebugging',
        'stopDebugging',
        'getDebugReport',
        'clearDebugData',
        // Page interaction
        'screenshot',
        'evaluate',
        'click',
        'type',
        'waitForSelector',
        // Utilities
        'getCapabilities',
        'ping'
      ]
    };
  }
}