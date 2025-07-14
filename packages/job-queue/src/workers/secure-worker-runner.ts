import { VM } from 'vm2';
import { Logger } from 'pino';
import { EventEmitter } from 'events';
import { performance } from 'perf_hooks';

import {
  SecurityConfig,
  ProcessFunction,
  JobContext,
  JobResult,
  WorkerError
} from '../types';

interface ExecutionContext {
  startTime: number;
  memoryStart: number;
  timeoutHandle?: NodeJS.Timeout;
  vm?: VM;
}

interface ResourceUsage {
  memoryUsed: number;
  cpuTime: number;
  executionTime: number;
}

export class SecureWorkerRunner extends EventEmitter {
  private config: SecurityConfig;
  private logger: Logger;
  private activeExecutions = new Map<string, ExecutionContext>();
  private resourceMonitor?: NodeJS.Timeout;

  constructor(config: SecurityConfig, logger: Logger) {
    super();
    this.config = config;
    this.logger = logger.child({ component: 'secure-worker-runner' });

    this.setupResourceMonitoring();
  }

  async execute(processingFunction: ProcessFunction, jobContext: JobContext): Promise<JobResult> {
    const executionId = jobContext.id;
    const startTime = performance.now();
    const memoryStart = process.memoryUsage().heapUsed;

    this.logger.info({
      executionId,
      jobType: jobContext.data.type,
      sandboxEnabled: this.config.sandboxEnabled
    }, 'Starting secure job execution');

    const executionContext: ExecutionContext = {
      startTime,
      memoryStart
    };

    this.activeExecutions.set(executionId, executionContext);

    try {
      let result: JobResult;

      if (this.config.sandboxEnabled) {
        result = await this.executeInSandbox(processingFunction, jobContext, executionContext);
      } else {
        result = await this.executeUnsandboxed(processingFunction, jobContext, executionContext);
      }

      const resourceUsage = this.calculateResourceUsage(executionContext);
      
      this.logger.info({
        executionId,
        resourceUsage,
        success: result.success
      }, 'Job execution completed');

      // Add resource usage to result metadata
      result.metadata = {
        ...result.metadata,
        memoryUsed: resourceUsage.memoryUsed,
        cpuTime: resourceUsage.cpuTime,
        executionTime: resourceUsage.executionTime
      };

      return result;

    } catch (error) {
      this.logger.error({
        executionId,
        error,
        jobType: jobContext.data.type
      }, 'Job execution failed');

      const resourceUsage = this.calculateResourceUsage(executionContext);

      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        metadata: {
          processingTime: performance.now() - startTime,
          memoryUsed: resourceUsage.memoryUsed,
          cpuTime: resourceUsage.cpuTime,
          retryCount: jobContext.attemptsMade,
          timestamp: Date.now()
        }
      };

    } finally {
      this.cleanupExecution(executionId);
    }
  }

  private async executeInSandbox(
    processingFunction: ProcessFunction,
    jobContext: JobContext,
    executionContext: ExecutionContext
  ): Promise<JobResult> {
    const vm = new VM({
      timeout: this.config.timeoutMs,
      sandbox: {
        // Provide safe context for job execution
        console: {
          log: (message: string) => jobContext.log(message, 'info'),
          warn: (message: string) => jobContext.log(message, 'warn'),
          error: (message: string) => jobContext.log(message, 'error')
        },
        Buffer,
        JSON,
        Date,
        Math,
        RegExp,
        String,
        Number,
        Boolean,
        Array,
        Object,
        Promise,
        setTimeout,
        clearTimeout,
        setInterval,
        clearInterval,
        // Add job context
        jobContext: {
          ...jobContext,
          // Wrap progress function to ensure it's callable in VM
          progress: (value: number) => jobContext.progress(value),
          updateProgress: (data: any) => jobContext.updateProgress(data),
          log: (message: string, level?: 'info' | 'warn' | 'error') => jobContext.log(message, level)
        }
      },
      require: {
        external: {
          modules: this.config.allowedModules,
          transitive: false
        },
        builtin: this.config.allowedModules.filter(mod => 
          ['fs', 'path', 'util', 'crypto', 'events', 'stream'].includes(mod)
        )
      }
    });

    executionContext.vm = vm;

    // Set up timeout
    if (this.config.timeoutMs > 0) {
      executionContext.timeoutHandle = setTimeout(() => {
        this.logger.warn({
          executionId: jobContext.id,
          timeout: this.config.timeoutMs
        }, 'Job execution timeout');
        
        this.emit('execution:timeout', {
          executionId: jobContext.id,
          timeout: this.config.timeoutMs
        });
        
        // VM will handle the timeout internally
      }, this.config.timeoutMs);
    }

    // Execute the processing function in the sandbox
    const code = `
      (async function() {
        const processingFunction = ${processingFunction.toString()};
        return await processingFunction(jobContext);
      })();
    `;

    const result = await vm.run(code);
    return result;
  }

  private async executeUnsandboxed(
    processingFunction: ProcessFunction,
    jobContext: JobContext,
    executionContext: ExecutionContext
  ): Promise<JobResult> {
    // Set up timeout manually for unsandboxed execution
    if (this.config.timeoutMs > 0) {
      executionContext.timeoutHandle = setTimeout(() => {
        this.logger.warn({
          executionId: jobContext.id,
          timeout: this.config.timeoutMs
        }, 'Job execution timeout (unsandboxed)');
        
        this.emit('execution:timeout', {
          executionId: jobContext.id,
          timeout: this.config.timeoutMs
        });
        
        throw new WorkerError(
          `Job execution timeout after ${this.config.timeoutMs}ms`,
          jobContext.id,
          'unsandboxed'
        );
      }, this.config.timeoutMs);
    }

    // Execute directly
    const result = await processingFunction(jobContext);
    return result;
  }

  private calculateResourceUsage(executionContext: ExecutionContext): ResourceUsage {
    const currentMemory = process.memoryUsage().heapUsed;
    const memoryUsed = Math.max(0, currentMemory - executionContext.memoryStart);
    const executionTime = performance.now() - executionContext.startTime;
    
    // CPU time is approximated (in a real implementation, you'd use more sophisticated monitoring)
    const cpuTime = executionTime * 0.8; // Rough estimation

    return {
      memoryUsed: memoryUsed / 1024 / 1024, // Convert to MB
      cpuTime,
      executionTime
    };
  }

  private cleanupExecution(executionId: string): void {
    const executionContext = this.activeExecutions.get(executionId);
    if (!executionContext) {
      return;
    }

    // Clear timeout
    if (executionContext.timeoutHandle) {
      clearTimeout(executionContext.timeoutHandle);
    }

    // Clean up VM if it exists
    if (executionContext.vm) {
      try {
        // VM2 doesn't have an explicit cleanup method, but we can null the reference
        executionContext.vm = undefined;
      } catch (error) {
        this.logger.error({ error, executionId }, 'Failed to cleanup VM');
      }
    }

    this.activeExecutions.delete(executionId);
  }

  private setupResourceMonitoring(): void {
    // Monitor resource usage every 5 seconds
    this.resourceMonitor = setInterval(() => {
      this.checkResourceLimits();
    }, 5000);
  }

  private checkResourceLimits(): void {
    const memoryUsage = process.memoryUsage();
    const memoryUsedMB = memoryUsage.heapUsed / 1024 / 1024;

    // Check memory limit
    if (memoryUsedMB > this.config.memoryLimitMB) {
      this.logger.warn({
        memoryUsedMB,
        memoryLimitMB: this.config.memoryLimitMB,
        activeExecutions: this.activeExecutions.size
      }, 'Memory limit exceeded');

      this.emit('resource:memory_limit_exceeded', {
        memoryUsedMB,
        memoryLimitMB: this.config.memoryLimitMB,
        activeExecutions: this.activeExecutions.size
      });

      // Optionally, terminate some executions or trigger garbage collection
      if (global.gc) {
        global.gc();
      }
    }

    // Check for long-running executions
    const now = performance.now();
    const longRunningThreshold = this.config.timeoutMs * 1.5;

    for (const [executionId, context] of this.activeExecutions) {
      const executionTime = now - context.startTime;
      
      if (executionTime > longRunningThreshold) {
        this.logger.warn({
          executionId,
          executionTime,
          threshold: longRunningThreshold
        }, 'Long-running execution detected');

        this.emit('execution:long_running', {
          executionId,
          executionTime,
          threshold: longRunningThreshold
        });
      }
    }
  }

  async cleanup(): Promise<void> {
    this.logger.info('Cleaning up secure worker runner...');

    // Stop resource monitoring
    if (this.resourceMonitor) {
      clearInterval(this.resourceMonitor);
    }

    // Clean up all active executions
    const executionIds = Array.from(this.activeExecutions.keys());
    for (const executionId of executionIds) {
      this.cleanupExecution(executionId);
    }

    // Force garbage collection if available
    if (global.gc) {
      global.gc();
    }

    this.logger.info('Secure worker runner cleanup completed');
  }

  getActiveExecutions(): number {
    return this.activeExecutions.size;
  }

  getResourceUsage(): {
    memoryUsedMB: number;
    activeExecutions: number;
    memoryLimitMB: number;
  } {
    const memoryUsage = process.memoryUsage();
    return {
      memoryUsedMB: memoryUsage.heapUsed / 1024 / 1024,
      activeExecutions: this.activeExecutions.size,
      memoryLimitMB: this.config.memoryLimitMB
    };
  }

  updateConfig(newConfig: Partial<SecurityConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.logger.info({ config: this.config }, 'Security configuration updated');
  }
}