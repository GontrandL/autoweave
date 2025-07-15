import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { AutoDebugger } from '../../src/core/auto-debugger';
import type { Page, ConsoleMessage, Response } from 'playwright';

// Mock playwright
jest.mock('playwright');

describe('AutoDebugger', () => {
  let autoDebugger: AutoDebugger;
  let mockPage: jest.Mocked<Page>;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    
    // Create mock page
    mockPage = {
      on: jest.fn(),
      removeAllListeners: jest.fn(),
      url: jest.fn().mockReturnValue('https://example.com'),
    } as any;
    
    // Initialize AutoDebugger
    autoDebugger = new AutoDebugger({
      captureConsole: true,
      captureErrors: true,
      captureNetwork: true,
      networkErrorThreshold: 400,
      maxLogSize: 1000,
      autoAnalyze: true
    });
  });

  afterEach(() => {
    autoDebugger.detach();
    jest.restoreAllMocks();
  });

  describe('initialization', () => {
    it('should initialize with default configuration', () => {
      const debugInstance = new AutoDebugger();
      expect(debugInstance).toBeDefined();
      const stats = debugInstance.getStats();
      expect(stats.isActive).toBe(false);
    });

    it('should initialize with custom configuration', () => {
      const customConfig = {
        captureConsole: false,
        captureErrors: true,
        maxLogSize: 500
      };
      
      const debugInstance = new AutoDebugger(customConfig);
      expect(debugInstance).toBeDefined();
      // Config is private, so we can't directly test it
    });
  });

  describe('page attachment', () => {
    it('should attach to a page and setup listeners', () => {
      autoDebugger.attach(mockPage);
      
      expect(mockPage.on).toHaveBeenCalledWith('console', expect.any(Function));
      expect(mockPage.on).toHaveBeenCalledWith('pageerror', expect.any(Function));
      expect(mockPage.on).toHaveBeenCalledWith('response', expect.any(Function));
      expect(mockPage.on).toHaveBeenCalledWith('requestfailed', expect.any(Function));
      
      const stats = autoDebugger.getStats();
      expect(stats.isActive).toBe(true);
      expect(stats.url).toBe('https://example.com');
    });

    it('should detach from page', () => {
      autoDebugger.attach(mockPage);
      autoDebugger.detach();
      
      expect(mockPage.removeAllListeners).toHaveBeenCalled();
      const stats = autoDebugger.getStats();
      expect(stats.isActive).toBe(false);
    });

    it('should handle re-attachment', () => {
      autoDebugger.attach(mockPage);
      autoDebugger.attach(mockPage); // Re-attach
      
      expect(mockPage.removeAllListeners).toHaveBeenCalledTimes(1);
    });
  });

  describe('console capture', () => {
    it('should capture console logs', () => {
      autoDebugger.attach(mockPage);
      
      // Get the console handler
      const consoleHandler = (mockPage.on as jest.Mock).mock.calls.find((call: any) => call[0] === 'console')?.[1] as any;
      expect(consoleHandler).toBeDefined();
      
      // Simulate console message
      const mockMessage: Partial<ConsoleMessage> = {
        type: () => 'log',
        text: () => 'Test log message',
        location: () => ({ url: 'test.js', lineNumber: 10, columnNumber: 5 })
      };
      
      consoleHandler(mockMessage);
      
      const stats = autoDebugger.getStats();
      expect(stats.logs).toBe(1);
    });

    it('should analyze console errors', () => {
      autoDebugger.attach(mockPage);
      
      const consoleHandler = (mockPage.on as jest.Mock).mock.calls.find((call: any) => call[0] === 'console')?.[1] as any;
      
      const errorMessage: Partial<ConsoleMessage> = {
        type: () => 'error',
        text: () => 'ReferenceError: foo is not defined',
        location: () => ({ url: 'test.js', lineNumber: 20, columnNumber: 10 })
      };
      
      // Spy on emit to check pattern detection
      const emitSpy = jest.spyOn(autoDebugger, 'emit');
      
      consoleHandler(errorMessage);
      
      expect(emitSpy).toHaveBeenCalledWith('pattern-detected', expect.objectContaining({
        type: 'undefined_variable',
        data: 'foo'
      }));
    });
  });

  describe('error capture', () => {
    it('should capture page errors', () => {
      autoDebugger.attach(mockPage);
      
      const errorHandler = (mockPage.on as jest.Mock).mock.calls.find((call: any) => call[0] === 'pageerror')?.[1] as any;
      expect(errorHandler).toBeDefined();
      
      const testError = new Error('Test page error');
      testError.stack = 'Error: Test page error\n    at test.js:10:5';
      
      errorHandler(testError);
      
      const stats = autoDebugger.getStats();
      expect(stats.errors).toBe(1);
    });

    it('should generate fix suggestions for errors', () => {
      autoDebugger.attach(mockPage);
      
      const errorHandler = (mockPage.on as jest.Mock).mock.calls.find((call: any) => call[0] === 'pageerror')?.[1] as any;
      
      // Test undefined variable error
      const undefinedError = new Error('foo is not defined');
      undefinedError.stack = 'ReferenceError: foo is not defined\n    at test.js:15:10';
      
      const emitSpy = jest.spyOn(autoDebugger, 'emit');
      
      errorHandler(undefinedError);
      
      expect(emitSpy).toHaveBeenCalledWith('suggestions-generated', 
        expect.arrayContaining([
          expect.objectContaining({
            type: 'variable_declaration',
            message: "Variable 'foo' is not defined"
          })
        ])
      );
    });
  });

  describe('network monitoring', () => {
    it('should capture network errors', () => {
      autoDebugger.attach(mockPage);
      
      const responseHandler = (mockPage.on as jest.Mock).mock.calls.find((call: any) => call[0] === 'response')?.[1] as any;
      expect(responseHandler).toBeDefined();
      
      const mockResponse: Partial<Response> = {
        url: () => 'https://api.example.com/data',
        status: () => 500,
        statusText: () => 'Internal Server Error',
        request: () => ({ method: () => 'GET' } as any),
        headers: () => ({ 'content-type': 'application/json' })
      };
      
      responseHandler(mockResponse);
      
      const stats = autoDebugger.getStats();
      expect(stats.networkIssues).toBe(1);
    });

    it('should handle failed requests', () => {
      autoDebugger.attach(mockPage);
      
      const failHandler = (mockPage.on as jest.Mock).mock.calls.find((call: any) => call[0] === 'requestfailed')?.[1] as any;
      expect(failHandler).toBeDefined();
      
      const mockRequest = {
        url: () => 'https://api.example.com/timeout',
        method: () => 'POST',
        failure: () => ({ errorText: 'Request timeout' }),
        headers: () => ({ 'content-type': 'application/json' })
      };
      
      failHandler(mockRequest);
      
      const stats = autoDebugger.getStats();
      expect(stats.networkIssues).toBe(1);
    });
  });

  describe('report generation', () => {
    it('should generate comprehensive debug report', () => {
      autoDebugger.attach(mockPage);
      
      // Add some test data
      const consoleHandler = (mockPage.on as jest.Mock).mock.calls.find((call: any) => call[0] === 'console')?.[1] as any;
      const errorHandler = (mockPage.on as jest.Mock).mock.calls.find((call: any) => call[0] === 'pageerror')?.[1] as any;
      const responseHandler = (mockPage.on as jest.Mock).mock.calls.find((call: any) => call[0] === 'response')?.[1] as any;
      
      // Add console log
      consoleHandler({
        type: () => 'log',
        text: () => 'Test log',
        location: () => null
      });
      
      // Add error
      errorHandler(new Error('Test error'));
      
      // Add network issue
      responseHandler({
        url: () => 'https://api.example.com/fail',
        status: () => 404,
        statusText: () => 'Not Found',
        request: () => ({ method: () => 'GET' } as any),
        headers: () => ({})
      });
      
      const report = autoDebugger.generateReport();
      
      expect(report.timestamp).toBeDefined();
      expect(report.url).toBe('https://example.com');
      expect(report.summary.totalLogs).toBe(1);
      expect(report.summary.totalErrors).toBe(1);
      expect(report.summary.totalNetworkIssues).toBe(1);
      expect(report.suggestions.length).toBeGreaterThanOrEqual(1); // At least one suggestion
    });

    it('should identify critical issues', () => {
      autoDebugger.attach(mockPage);
      
      const errorHandler = (mockPage.on as jest.Mock).mock.calls.find((call: any) => call[0] === 'pageerror')?.[1] as any;
      
      // Add many repeated errors
      const repeatedError = new Error('Repeated error');
      for (let i = 0; i < 10; i++) {
        errorHandler(repeatedError);
      }
      
      const report = autoDebugger.generateReport();
      
      expect(report.summary.criticalIssues.some(issue => 
        issue.includes('Repeated error')
      )).toBe(true);
    });
  });

  describe('data management', () => {
    it('should clear all captured data', () => {
      autoDebugger.attach(mockPage);
      
      // Add some data
      const consoleHandler = (mockPage.on as jest.Mock).mock.calls.find((call: any) => call[0] === 'console')?.[1] as any;
      consoleHandler({
        type: () => 'log',
        text: () => 'Test',
        location: () => null
      });
      
      expect(autoDebugger.getStats().logs).toBe(1);
      
      autoDebugger.clear();
      
      expect(autoDebugger.getStats().logs).toBe(0);
      expect(autoDebugger.getStats().errors).toBe(0);
      expect(autoDebugger.getStats().networkIssues).toBe(0);
    });

    it('should trim logs when exceeding max size', () => {
      const debugInstance = new AutoDebugger({ maxLogSize: 3 });
      debugInstance.attach(mockPage);
      
      const consoleHandler = (mockPage.on as jest.Mock).mock.calls.find((call: any) => call[0] === 'console')?.[1] as any;
      
      // Add 5 logs
      for (let i = 0; i < 5; i++) {
        consoleHandler({
          type: () => 'log',
          text: () => `Log ${i}`,
          location: () => null
        });
      }
      
      expect(debugInstance.getStats().logs).toBe(3); // Should keep only last 3
    });
  });
});