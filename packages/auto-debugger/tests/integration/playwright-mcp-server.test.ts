import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { PlaywrightMCPServer } from '../../src/integrations/playwright-mcp-server';
import { chromium, Browser, Page } from 'playwright';
import { Server } from 'http';
import express from 'express';

// Mock playwright
jest.mock('playwright');

describe('PlaywrightMCPServer Integration', () => {
  let mcpServer: PlaywrightMCPServer;
  let mockBrowser: jest.Mocked<Browser>;
  let mockPage: jest.Mocked<Page>;
  let testServer: Server;
  let testServerUrl: string;

  beforeEach(async () => {
    // Setup test server
    const app = express();
    app.get('/', (_req, res) => {
      res.send('<html><body><div id="test">Test Content</div></body></html>');
    });
    app.get('/error', (_req, res) => {
      res.status(500).send('Server Error');
    });
    
    testServer = app.listen(0);
    const port = (testServer.address() as any).port;
    testServerUrl = `http://localhost:${port}`;

    // Setup mocks
    mockPage = {
      goto: jest.fn(),
      screenshot: jest.fn(),
      evaluate: jest.fn(),
      close: jest.fn(),
      on: jest.fn(),
      waitForSelector: jest.fn(),
      click: jest.fn(),
      fill: jest.fn(),
      locator: jest.fn(),
    } as any;

    mockBrowser = {
      newPage: jest.fn().mockResolvedValue(mockPage),
      close: jest.fn(),
    } as any;

    (chromium.launch as jest.Mock).mockResolvedValue(mockBrowser);

    // Initialize MCP server
    mcpServer = new PlaywrightMCPServer({
      port: 3456,
      enableDebugMode: true,
      maxConcurrentSessions: 5,
    });
  });

  afterEach(async () => {
    await mcpServer.stop();
    testServer.close();
    jest.clearAllMocks();
  });

  describe('server lifecycle', () => {
    it('should start and stop correctly', async () => {
      await mcpServer.start();
      expect(mcpServer.isRunning()).toBe(true);
      
      await mcpServer.stop();
      expect(mcpServer.isRunning()).toBe(false);
    });

    it('should handle multiple start calls gracefully', async () => {
      await mcpServer.start();
      await mcpServer.start(); // Should not throw
      
      expect(mcpServer.isRunning()).toBe(true);
    });
  });

  describe('browser navigation', () => {
    it('should navigate to URL and capture screenshot', async () => {
      await mcpServer.start();
      
      mockPage.screenshot.mockResolvedValue(Buffer.from('fake-screenshot'));
      
      const result = await mcpServer.navigate(testServerUrl);
      
      expect(mockPage.goto).toHaveBeenCalledWith(testServerUrl, {
        waitUntil: 'networkidle',
        timeout: 30000,
      });
      expect(mockPage.screenshot).toHaveBeenCalled();
      expect(result.success).toBe(true);
      expect(result.screenshot).toBeDefined();
    });

    it('should handle navigation errors', async () => {
      await mcpServer.start();
      
      mockPage.goto.mockRejectedValue(new Error('Navigation failed'));
      
      const result = await mcpServer.navigate('http://invalid-url');
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Navigation failed');
    });

    it('should capture console logs during navigation', async () => {
      await mcpServer.start();
      
      const consoleLogs: string[] = [];
      mockPage.on.mockImplementation((event, handler) => {
        if (event === 'console') {
          // Simulate console messages
          handler({ text: () => 'Console log 1', type: () => 'log' });
          handler({ text: () => 'Console error', type: () => 'error' });
        }
      });
      
      const result = await mcpServer.navigate(testServerUrl, {
        captureConsole: true,
      });
      
      expect(result.consoleLogs).toBeDefined();
      expect(result.consoleLogs).toHaveLength(2);
    });
  });

  describe('element interaction', () => {
    it('should click elements', async () => {
      await mcpServer.start();
      await mcpServer.navigate(testServerUrl);
      
      const result = await mcpServer.click('#test');
      
      expect(mockPage.click).toHaveBeenCalledWith('#test');
      expect(result.success).toBe(true);
    });

    it('should fill form fields', async () => {
      await mcpServer.start();
      await mcpServer.navigate(testServerUrl);
      
      const result = await mcpServer.fill('input[name="username"]', 'testuser');
      
      expect(mockPage.fill).toHaveBeenCalledWith('input[name="username"]', 'testuser');
      expect(result.success).toBe(true);
    });

    it('should wait for selectors', async () => {
      await mcpServer.start();
      await mcpServer.navigate(testServerUrl);
      
      mockPage.waitForSelector.mockResolvedValue({} as any);
      
      const result = await mcpServer.waitForElement('#dynamic-content', {
        timeout: 5000,
        state: 'visible',
      });
      
      expect(mockPage.waitForSelector).toHaveBeenCalledWith('#dynamic-content', {
        timeout: 5000,
        state: 'visible',
      });
      expect(result.success).toBe(true);
    });
  });

  describe('JavaScript evaluation', () => {
    it('should evaluate JavaScript in page context', async () => {
      await mcpServer.start();
      await mcpServer.navigate(testServerUrl);
      
      mockPage.evaluate.mockResolvedValue({ result: 42 });
      
      const result = await mcpServer.evaluate(() => {
        return { result: 21 * 2 };
      });
      
      expect(mockPage.evaluate).toHaveBeenCalled();
      expect(result.value).toEqual({ result: 42 });
    });

    it('should handle evaluation errors', async () => {
      await mcpServer.start();
      await mcpServer.navigate(testServerUrl);
      
      mockPage.evaluate.mockRejectedValue(new Error('Evaluation failed'));
      
      const result = await mcpServer.evaluate(() => {
        throw new Error('Test error');
      });
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Evaluation failed');
    });
  });

  describe('network interception', () => {
    it('should intercept and modify requests', async () => {
      await mcpServer.start();
      
      const interceptor = jest.fn().mockImplementation((request) => {
        if (request.url().includes('api')) {
          return { status: 200, body: JSON.stringify({ mocked: true }) };
        }
        return null;
      });
      
      await mcpServer.interceptRequests(interceptor);
      await mcpServer.navigate(testServerUrl);
      
      // Verify interception was set up
      expect(mockPage.on).toHaveBeenCalledWith('request', expect.any(Function));
    });

    it('should record network activity', async () => {
      await mcpServer.start();
      
      const networkLogs: any[] = [];
      mockPage.on.mockImplementation((event, handler) => {
        if (event === 'response') {
          handler({
            url: () => `${testServerUrl}/api/data`,
            status: () => 200,
            headers: () => ({ 'content-type': 'application/json' }),
          });
        }
      });
      
      await mcpServer.startNetworkRecording();
      await mcpServer.navigate(testServerUrl);
      
      const activity = await mcpServer.getNetworkActivity();
      
      expect(activity).toBeDefined();
      expect(activity.length).toBeGreaterThan(0);
    });
  });

  describe('debugging features', () => {
    it('should capture page errors', async () => {
      await mcpServer.start();
      
      const errors: Error[] = [];
      mockPage.on.mockImplementation((event, handler) => {
        if (event === 'pageerror') {
          handler(new Error('Page error occurred'));
        }
      });
      
      await mcpServer.navigate(testServerUrl);
      const debugInfo = await mcpServer.getDebugInfo();
      
      expect(debugInfo.errors).toBeDefined();
      expect(debugInfo.errors.length).toBeGreaterThan(0);
    });

    it('should provide page metrics', async () => {
      await mcpServer.start();
      await mcpServer.navigate(testServerUrl);
      
      mockPage.evaluate.mockResolvedValue({
        jsHeapUsedSize: 1024 * 1024 * 10, // 10MB
        domNodes: 150,
        jsEventListeners: 25,
      });
      
      const metrics = await mcpServer.getPageMetrics();
      
      expect(metrics.memory).toBeDefined();
      expect(metrics.domNodes).toBe(150);
      expect(metrics.jsEventListeners).toBe(25);
    });

    it('should generate HAR files', async () => {
      await mcpServer.start();
      
      await mcpServer.startHARRecording();
      await mcpServer.navigate(testServerUrl);
      
      const har = await mcpServer.stopHARRecording();
      
      expect(har).toBeDefined();
      expect(har.log).toBeDefined();
      expect(har.log.entries).toBeDefined();
    });
  });

  describe('session management', () => {
    it('should create and manage multiple sessions', async () => {
      await mcpServer.start();
      
      const session1 = await mcpServer.createSession('user1');
      const session2 = await mcpServer.createSession('user2');
      
      expect(session1.id).not.toBe(session2.id);
      expect(mcpServer.getActiveSessions()).toHaveLength(2);
      
      await mcpServer.closeSession(session1.id);
      expect(mcpServer.getActiveSessions()).toHaveLength(1);
    });

    it('should enforce max concurrent sessions', async () => {
      await mcpServer.start();
      
      // Create max sessions
      for (let i = 0; i < 5; i++) {
        await mcpServer.createSession(`user${i}`);
      }
      
      // Try to create one more
      await expect(mcpServer.createSession('user6')).rejects.toThrow(
        'Maximum concurrent sessions reached'
      );
    });

    it('should isolate sessions', async () => {
      await mcpServer.start();
      
      const session1 = await mcpServer.createSession('user1');
      const session2 = await mcpServer.createSession('user2');
      
      // Navigate in session 1
      await mcpServer.navigate(testServerUrl, { sessionId: session1.id });
      
      // Verify session 2 is not affected
      const session2State = await mcpServer.getSessionState(session2.id);
      expect(session2State.currentUrl).toBeUndefined();
    });
  });

  describe('AutoWeave integration', () => {
    it('should handle AutoWeave debug requests', async () => {
      await mcpServer.start();
      
      const debugRequest = {
        type: 'ui_error',
        url: testServerUrl,
        selector: '#broken-element',
        expectedBehavior: 'Element should be visible',
        actualBehavior: 'Element not found',
      };
      
      mockPage.evaluate.mockResolvedValue({
        elementExists: false,
        parentExists: true,
        possibleCauses: ['Element ID changed', 'Element not rendered'],
      });
      
      const result = await mcpServer.debugAutoWeaveIssue(debugRequest);
      
      expect(result.analysis).toBeDefined();
      expect(result.suggestions).toBeDefined();
      expect(result.suggestions).toContain('Check if element ID has changed');
    });

    it('should replay user interactions for debugging', async () => {
      await mcpServer.start();
      
      const interactions = [
        { type: 'navigate', url: testServerUrl },
        { type: 'click', selector: '#button1' },
        { type: 'fill', selector: '#input1', value: 'test' },
        { type: 'click', selector: '#submit' },
      ];
      
      const replayResult = await mcpServer.replayInteractions(interactions);
      
      expect(mockPage.goto).toHaveBeenCalled();
      expect(mockPage.click).toHaveBeenCalledTimes(2);
      expect(mockPage.fill).toHaveBeenCalled();
      expect(replayResult.success).toBe(true);
    });
  });

  describe('error recovery', () => {
    it('should recover from browser crashes', async () => {
      await mcpServer.start();
      
      // Simulate browser crash
      mockBrowser.close.mockResolvedValue();
      mockBrowser.newPage.mockRejectedValueOnce(new Error('Browser disconnected'));
      
      // Should recover and create new browser
      (chromium.launch as jest.Mock).mockResolvedValueOnce(mockBrowser);
      mockBrowser.newPage.mockResolvedValueOnce(mockPage);
      
      const result = await mcpServer.navigate(testServerUrl);
      
      expect(chromium.launch).toHaveBeenCalledTimes(2); // Initial + recovery
      expect(result.success).toBe(true);
    });

    it('should handle timeout gracefully', async () => {
      await mcpServer.start();
      
      mockPage.goto.mockImplementation(() => 
        new Promise((resolve) => setTimeout(resolve, 60000))
      );
      
      const result = await mcpServer.navigate(testServerUrl, { timeout: 100 });
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('timeout');
    });
  });
});