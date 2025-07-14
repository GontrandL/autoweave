import { WebSocketServer } from 'ws';
import { EventEmitter } from 'eventemitter3';
import { chromium, Browser, BrowserContext } from 'playwright';
import { AutoDebugger } from '../core/auto-debugger';
import { getLogger } from '@autoweave/observability';
import type { 
  MCPRequest, 
  MCPResponse, 
  MCPCapability,
  BrowserConfig,
  AutoDebugSession 
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

      ws.on('message', async (data) => {
        try {
          const request: MCPRequest = JSON.parse(data.toString());
          const response = await this.handleRequest(request);
          ws.send(JSON.stringify(response));
        } catch (error) {
          this.logger.error('Error handling request', error);
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
    for (const [id, context] of this.contexts) {
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
      let result: any;

      switch (method) {
        // Session management
        case 'createSession':
          result = await this.createSession(params);
          break;
        case 'closeSession':
          result = await this.closeSession(params.sessionId);
          break;
        case 'listSessions':
          result = await this.listSessions();
          break;

        // Navigation
        case 'navigate':
          result = await this.navigate(params.sessionId, params.url);
          break;
        case 'reload':
          result = await this.reload(params.sessionId);
          break;
        case 'goBack':
          result = await this.goBack(params.sessionId);
          break;
        case 'goForward':
          result = await this.goForward(params.sessionId);
          break;

        // Debugging
        case 'startDebugging':
          result = await this.startDebugging(params.sessionId);
          break;
        case 'stopDebugging':
          result = await this.stopDebugging(params.sessionId);
          break;
        case 'getDebugReport':
          result = await this.getDebugReport(params.sessionId);
          break;
        case 'clearDebugData':
          result = await this.clearDebugData(params.sessionId);
          break;

        // Page interaction
        case 'screenshot':
          result = await this.screenshot(params.sessionId, params.options);
          break;
        case 'evaluate':
          result = await this.evaluate(params.sessionId, params.expression);
          break;
        case 'click':
          result = await this.click(params.sessionId, params.selector);
          break;
        case 'type':
          result = await this.type(params.sessionId, params.selector, params.text);
          break;
        case 'waitForSelector':
          result = await this.waitForSelector(params.sessionId, params.selector, params.options);
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
    } catch (error: any) {
      return {
        jsonrpc: '2.0',
        id,
        error: {
          code: -32603,
          message: error.message,
          data: error.stack
        }
      };
    }
  }

  /**
   * Create a new browser session
   */
  private async createSession(params: any = {}): Promise<string> {
    const sessionId = `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Create browser context
    const context = await this.browser!.newContext({
      viewport: params.viewport || this.config.viewport,
      userAgent: params.userAgent,
      locale: params.locale,
      timezone: params.timezone,
      permissions: params.permissions
    });

    // Create page
    const page = await context.newPage();
    
    // Create debugger
    const debugger = new AutoDebugger(params.debugConfig);
    
    // Store references
    this.contexts.set(sessionId, context);
    this.debuggers.set(sessionId, debugger);
    
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
    const debugger = this.debuggers.get(sessionId);
    const session = this.sessions.get(sessionId);

    if (context) {
      await context.close();
      this.contexts.delete(sessionId);
    }

    if (debugger) {
      await debugger.detach();
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
  private async listSessions(): Promise<AutoDebugSession[]> {
    return Array.from(this.sessions.values());
  }

  /**
   * Navigate to URL
   */
  private async navigate(sessionId: string, url: string): Promise<void> {
    const context = this.contexts.get(sessionId);
    if (!context) throw new Error('Session not found');

    const pages = context.pages();
    if (pages.length === 0) throw new Error('No pages in context');

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
  private async startDebugging(sessionId: string): Promise<void> {
    const context = this.contexts.get(sessionId);
    const debugger = this.debuggers.get(sessionId);
    
    if (!context || !debugger) throw new Error('Session not found');

    const pages = context.pages();
    if (pages.length === 0) throw new Error('No pages in context');

    await debugger.attach(pages[0]);
    
    // Setup event forwarding
    debugger.on('error', (error) => {
      this.emit('debug-error', { sessionId, error });
    });
    
    debugger.on('console', (log) => {
      this.emit('debug-console', { sessionId, log });
    });
    
    debugger.on('network-error', (issue) => {
      this.emit('debug-network', { sessionId, issue });
    });
    
    debugger.on('suggestions-generated', (suggestions) => {
      this.emit('debug-suggestions', { sessionId, suggestions });
    });
  }

  /**
   * Stop debugging for a session
   */
  private async stopDebugging(sessionId: string): Promise<void> {
    const debugger = this.debuggers.get(sessionId);
    if (!debugger) throw new Error('Debugger not found');

    await debugger.detach();
    debugger.removeAllListeners();
  }

  /**
   * Get debug report for a session
   */
  private async getDebugReport(sessionId: string): Promise<any> {
    const debugger = this.debuggers.get(sessionId);
    if (!debugger) throw new Error('Debugger not found');

    const report = await debugger.generateReport();
    
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
  private async clearDebugData(sessionId: string): Promise<void> {
    const debugger = this.debuggers.get(sessionId);
    if (!debugger) throw new Error('Debugger not found');

    debugger.clear();
  }

  /**
   * Take screenshot
   */
  private async screenshot(sessionId: string, options: any = {}): Promise<string> {
    const context = this.contexts.get(sessionId);
    if (!context) throw new Error('Session not found');

    const pages = context.pages();
    if (pages.length === 0) throw new Error('No pages in context');

    const buffer = await pages[0].screenshot({
      fullPage: options.fullPage,
      clip: options.clip,
      quality: options.quality,
      type: options.type || 'png'
    });

    return buffer.toString('base64');
  }

  /**
   * Evaluate JavaScript in page
   */
  private async evaluate(sessionId: string, expression: string): Promise<any> {
    const context = this.contexts.get(sessionId);
    if (!context) throw new Error('Session not found');

    const pages = context.pages();
    if (pages.length === 0) throw new Error('No pages in context');

    return await pages[0].evaluate(expression);
  }

  /**
   * Click on element
   */
  private async click(sessionId: string, selector: string): Promise<void> {
    const context = this.contexts.get(sessionId);
    if (!context) throw new Error('Session not found');

    const pages = context.pages();
    if (pages.length === 0) throw new Error('No pages in context');

    await pages[0].click(selector);
  }

  /**
   * Type text into element
   */
  private async type(sessionId: string, selector: string, text: string): Promise<void> {
    const context = this.contexts.get(sessionId);
    if (!context) throw new Error('Session not found');

    const pages = context.pages();
    if (pages.length === 0) throw new Error('No pages in context');

    await pages[0].type(selector, text);
  }

  /**
   * Wait for selector
   */
  private async waitForSelector(sessionId: string, selector: string, options: any = {}): Promise<void> {
    const context = this.contexts.get(sessionId);
    if (!context) throw new Error('Session not found');

    const pages = context.pages();
    if (pages.length === 0) throw new Error('No pages in context');

    await pages[0].waitForSelector(selector, {
      timeout: options.timeout || this.config.timeout,
      state: options.state || 'visible'
    });
  }

  /**
   * Reload page
   */
  private async reload(sessionId: string): Promise<void> {
    const context = this.contexts.get(sessionId);
    if (!context) throw new Error('Session not found');

    const pages = context.pages();
    if (pages.length === 0) throw new Error('No pages in context');

    await pages[0].reload();
  }

  /**
   * Go back in history
   */
  private async goBack(sessionId: string): Promise<void> {
    const context = this.contexts.get(sessionId);
    if (!context) throw new Error('Session not found');

    const pages = context.pages();
    if (pages.length === 0) throw new Error('No pages in context');

    await pages[0].goBack();
  }

  /**
   * Go forward in history
   */
  private async goForward(sessionId: string): Promise<void> {
    const context = this.contexts.get(sessionId);
    if (!context) throw new Error('Session not found');

    const pages = context.pages();
    if (pages.length === 0) throw new Error('No pages in context');

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