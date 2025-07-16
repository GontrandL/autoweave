import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { AutoWeaveBridge } from '../../src/integrations/autoweave-bridge';
import { AutoDebugger } from '../../src/core/auto-debugger';
import { EventEmitter } from 'events';
import axios from 'axios';

// Mock dependencies
jest.mock('axios');
jest.mock('../../src/core/auto-debugger');

describe('AutoWeaveBridge Integration', () => {
  let bridge: AutoWeaveBridge;
  let mockAutoDebugger: jest.Mocked<AutoDebugger>;
  let mockEventBus: EventEmitter;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Create mock instances
    mockAutoDebugger = new AutoDebugger() as jest.Mocked<AutoDebugger>;
    mockEventBus = new EventEmitter();
    
    // Initialize bridge
    bridge = new AutoWeaveBridge({
      autoDebugger: mockAutoDebugger,
      eventBus: mockEventBus,
      apiEndpoint: 'http://localhost:3000',
      enableAutoSync: true,
    });
  });

  afterEach(async () => {
    await bridge.disconnect();
    mockEventBus.removeAllListeners();
  });

  describe('connection management', () => {
    it('should connect to AutoWeave API', async () => {
      (axios.get as jest.Mock).mockResolvedValue({
        data: { status: 'healthy', version: '1.0.0' },
      });
      
      await bridge.connect();
      
      expect(axios.get).toHaveBeenCalledWith('http://localhost:3000/health');
      expect(bridge.isConnected()).toBe(true);
    });

    it('should handle connection failures', async () => {
      (axios.get as jest.Mock).mockRejectedValue(new Error('Connection refused'));
      
      await expect(bridge.connect()).rejects.toThrow('Failed to connect');
      expect(bridge.isConnected()).toBe(false);
    });

    it('should reconnect on connection loss', async () => {
      await bridge.connect();
      
      // Simulate connection loss
      mockEventBus.emit('connection:lost');
      
      // Wait for reconnection attempt
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(axios.get).toHaveBeenCalledTimes(2); // Initial + reconnect
    });
  });

  describe('error event handling', () => {
    it('should forward agent errors to auto-debugger', async () => {
      await bridge.connect();
      
      const agentError = {
        agentId: 'agent-123',
        error: {
          message: 'Agent execution failed',
          stack: 'Error stack trace',
          context: {
            lastAction: 'processData',
            input: { data: 'test' },
          },
        },
        timestamp: new Date().toISOString(),
      };
      
      mockAutoDebugger.analyzeError.mockResolvedValue({
        errorType: 'AgentError',
        pattern: 'execution_failure',
        severity: 'high',
        suggestions: ['Check agent configuration', 'Verify input data'],
      });
      
      mockEventBus.emit('agent:error', agentError);
      
      // Wait for async processing
      await new Promise(resolve => setTimeout(resolve, 10));
      
      expect(mockAutoDebugger.analyzeError).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Agent execution failed',
        }),
        expect.objectContaining({
          agentId: 'agent-123',
        })
      );
    });

    it('should handle build errors from AutoWeave', async () => {
      await bridge.connect();
      
      const buildError = {
        type: 'BUILD_FAILED',
        package: '@autoweave/core',
        error: 'TypeScript compilation failed',
        details: {
          file: 'src/index.ts',
          line: 42,
          message: "Property 'foo' does not exist",
        },
      };
      
      mockAutoDebugger.analyzeBuildError.mockResolvedValue({
        suggestions: ['Add missing property to type definition'],
        codeExample: 'interface MyType { foo: string; }',
        confidence: 0.9,
      });
      
      mockEventBus.emit('build:error', buildError);
      
      await new Promise(resolve => setTimeout(resolve, 10));
      
      expect(mockAutoDebugger.analyzeBuildError).toHaveBeenCalledWith(buildError);
    });

    it('should batch multiple errors', async () => {
      await bridge.connect();
      bridge.enableBatching({ batchSize: 3, batchTimeout: 50 });
      
      // Emit multiple errors quickly
      for (let i = 0; i < 5; i++) {
        mockEventBus.emit('agent:error', {
          agentId: `agent-${i}`,
          error: new Error(`Error ${i}`),
        });
      }
      
      // Wait for batch processing
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Should process in batches
      expect(mockAutoDebugger.analyzeBatch).toHaveBeenCalled();
    });
  });

  describe('auto-fix integration', () => {
    it('should apply auto-fixes to AutoWeave', async () => {
      await bridge.connect();
      
      const error = {
        type: 'MISSING_DEPENDENCY',
        package: 'express',
        context: { file: 'package.json' },
      };
      
      mockAutoDebugger.attemptAutoFix.mockResolvedValue({
        command: 'npm install express',
        description: 'Install missing dependency',
        confidence: 0.95,
      });
      
      (axios.post as jest.Mock).mockResolvedValue({
        data: { success: true, output: 'Dependency installed' },
      });
      
      const result = await bridge.requestAutoFix(error);
      
      expect(axios.post).toHaveBeenCalledWith(
        'http://localhost:3000/api/debug/apply-fix',
        expect.objectContaining({
          fix: { command: 'npm install express' },
        })
      );
      expect(result.applied).toBe(true);
    });

    it('should validate fixes before applying', async () => {
      await bridge.connect();
      
      const dangerousFix = {
        command: 'rm -rf /',
        description: 'Dangerous command',
        confidence: 0.5,
      };
      
      mockAutoDebugger.attemptAutoFix.mockResolvedValue(dangerousFix);
      mockAutoDebugger.validateFix.mockReturnValue(false);
      
      const result = await bridge.requestAutoFix({ type: 'ERROR' });
      
      expect(axios.post).not.toHaveBeenCalled();
      expect(result.applied).toBe(false);
      expect(result.reason).toContain('validation failed');
    });
  });

  describe('memory system integration', () => {
    it('should sync debug history with AutoWeave memory', async () => {
      await bridge.connect();
      
      const debugHistory = [
        {
          timestamp: new Date().toISOString(),
          error: 'Test error 1',
          solution: 'Fix 1',
          success: true,
        },
        {
          timestamp: new Date().toISOString(),
          error: 'Test error 2',
          solution: 'Fix 2',
          success: false,
        },
      ];
      
      mockAutoDebugger.getDebugHistory.mockResolvedValue(debugHistory);
      
      (axios.post as jest.Mock).mockResolvedValue({
        data: { stored: true, count: 2 },
      });
      
      await bridge.syncDebugHistory();
      
      expect(axios.post).toHaveBeenCalledWith(
        'http://localhost:3000/api/memory/debug-history',
        expect.objectContaining({
          history: debugHistory,
        })
      );
    });

    it('should retrieve similar errors from memory', async () => {
      await bridge.connect();
      
      const currentError = new Error('Module not found: lodash');
      
      (axios.post as jest.Mock).mockResolvedValue({
        data: {
          similar: [
            {
              error: 'Module not found: axios',
              solution: 'npm install axios',
              confidence: 0.8,
            },
            {
              error: 'Module not found: express',
              solution: 'npm install express',
              confidence: 0.7,
            },
          ],
        },
      });
      
      const similarErrors = await bridge.findSimilarErrors(currentError);
      
      expect(axios.post).toHaveBeenCalledWith(
        'http://localhost:3000/api/memory/search',
        expect.objectContaining({
          query: currentError.message,
          type: 'debug_history',
        })
      );
      expect(similarErrors).toHaveLength(2);
    });
  });

  describe('real-time monitoring', () => {
    it('should stream agent logs for debugging', async () => {
      await bridge.connect();
      
      const logHandler = jest.fn();
      bridge.onAgentLog('agent-123', logHandler);
      
      // Simulate log events
      mockEventBus.emit('agent:log', {
        agentId: 'agent-123',
        level: 'error',
        message: 'Agent error occurred',
        timestamp: new Date().toISOString(),
      });
      
      expect(logHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          level: 'error',
          message: 'Agent error occurred',
        })
      );
    });

    it('should monitor agent metrics', async () => {
      await bridge.connect();
      
      const metricsHandler = jest.fn();
      bridge.onAgentMetrics('agent-123', metricsHandler);
      
      mockEventBus.emit('agent:metrics', {
        agentId: 'agent-123',
        cpu: 45.2,
        memory: 128,
        errors: 2,
        timestamp: new Date().toISOString(),
      });
      
      expect(metricsHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          cpu: 45.2,
          memory: 128,
          errors: 2,
        })
      );
    });
  });

  describe('debugging workflows', () => {
    it('should create debugging session for agent', async () => {
      await bridge.connect();
      
      (axios.post as jest.Mock).mockResolvedValue({
        data: {
          sessionId: 'debug-session-123',
          agentId: 'agent-123',
          status: 'active',
        },
      });
      
      const session = await bridge.createDebugSession('agent-123', {
        captureNetwork: true,
        captureLogs: true,
        timeout: 300000,
      });
      
      expect(session.sessionId).toBe('debug-session-123');
      expect(axios.post).toHaveBeenCalledWith(
        'http://localhost:3000/api/debug/sessions',
        expect.objectContaining({
          agentId: 'agent-123',
          options: expect.objectContaining({
            captureNetwork: true,
          }),
        })
      );
    });

    it('should analyze debugging session results', async () => {
      await bridge.connect();
      
      const sessionData = {
        sessionId: 'debug-session-123',
        errors: [
          { type: 'network', count: 3 },
          { type: 'logic', count: 1 },
        ],
        performance: {
          avgResponseTime: 250,
          errorRate: 0.05,
        },
      };
      
      (axios.get as jest.Mock).mockResolvedValue({
        data: sessionData,
      });
      
      mockAutoDebugger.analyzeSession.mockResolvedValue({
        issues: ['High network error rate', 'Slow response times'],
        recommendations: ['Check network connectivity', 'Optimize API calls'],
      });
      
      const analysis = await bridge.analyzeDebugSession('debug-session-123');
      
      expect(analysis.issues).toHaveLength(2);
      expect(analysis.recommendations).toHaveLength(2);
    });
  });

  describe('collaborative debugging', () => {
    it('should share debugging insights with other agents', async () => {
      await bridge.connect();
      
      const insight = {
        pattern: 'timeout_error',
        solution: 'Increase timeout to 30s',
        confidence: 0.85,
        context: {
          service: 'external-api',
          averageResponseTime: 25000,
        },
      };
      
      (axios.post as jest.Mock).mockResolvedValue({
        data: { broadcast: true, recipients: 5 },
      });
      
      await bridge.shareDebugInsight(insight);
      
      expect(axios.post).toHaveBeenCalledWith(
        'http://localhost:3000/api/agents/broadcast',
        expect.objectContaining({
          type: 'debug_insight',
          data: insight,
        })
      );
    });

    it('should learn from other agents debugging experiences', async () => {
      await bridge.connect();
      
      bridge.onSharedInsight((insight) => {
        mockAutoDebugger.learnFromInsight(insight);
      });
      
      // Simulate shared insight from another agent
      mockEventBus.emit('agents:shared_insight', {
        from: 'agent-456',
        insight: {
          pattern: 'memory_leak',
          solution: 'Clear unused references',
          confidence: 0.9,
        },
      });
      
      expect(mockAutoDebugger.learnFromInsight).toHaveBeenCalledWith(
        expect.objectContaining({
          pattern: 'memory_leak',
        })
      );
    });
  });

  describe('error recovery', () => {
    it('should handle API failures gracefully', async () => {
      await bridge.connect();
      
      (axios.post as jest.Mock).mockRejectedValue(
        new Error('API unavailable')
      );
      
      const result = await bridge.requestAutoFix({ type: 'ERROR' });
      
      expect(result.applied).toBe(false);
      expect(result.error).toContain('API unavailable');
    });

    it('should queue operations during disconnection', async () => {
      await bridge.connect();
      
      // Simulate disconnection
      bridge.disconnect();
      
      // Try to sync while disconnected
      const syncPromise = bridge.syncDebugHistory();
      
      // Reconnect
      await bridge.connect();
      
      // Operation should complete after reconnection
      await expect(syncPromise).resolves.toBeDefined();
    });
  });
});