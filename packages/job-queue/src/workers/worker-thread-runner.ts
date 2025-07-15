import { Worker, isMainThread, parentPort, workerData } from 'worker_threads';
import { Logger } from 'pino';
import { EventEmitter } from 'events';
import { performance } from 'perf_hooks';
import * as path from 'path';
import * as fs from 'fs';

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
  cpuStart?: NodeJS.CpuUsage;
  timeoutHandle?: NodeJS.Timeout;
  worker?: Worker;
  abortController?: AbortController;
}

interface ResourceUsage {
  memoryUsed: number;
  cpuTime: number;
  executionTime: number;
}

export class WorkerThreadRunner extends EventEmitter {
  private config: SecurityConfig;
  private logger: Logger;
  private activeExecutions = new Map<string, ExecutionContext>();
  private resourceMonitor?: NodeJS.Timeout;
  private workerScript: string;

  constructor(config: SecurityConfig, logger: Logger) {
    super();
    this.config = config;
    this.logger = logger.child({ component: 'worker-thread-runner' });

    try {
      // Create worker script path
      this.workerScript = path.join(__dirname, 'worker-script.js');
      this.createWorkerScript();
      
      this.setupResourceMonitoring();
    } catch (error) {
      // Clean up if initialization fails
      this.cleanup();
      throw error;
    }
  }

  private cleanup(): void {
    if (this.workerScript && fs.existsSync(this.workerScript)) {
      try {
        fs.unlinkSync(this.workerScript);
      } catch (err) {
        this.logger.warn({ error: err }, 'Failed to clean up worker script');
      }
    }
  }

  private createWorkerScript(): void {
    const workerCode = `
const { parentPort, workerData } = require('worker_threads');

// Set up a controlled environment
const safeGlobals = {
  console: {
    log: (message) => parentPort.postMessage({ type: 'log', level: 'info', message }),
    warn: (message) => parentPort.postMessage({ type: 'log', level: 'warn', message }),
    error: (message) => parentPort.postMessage({ type: 'log', level: 'error', message })
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
  clearInterval
};

// Create job context proxy
const jobContext = {
  ...workerData.jobContext,
  progress: (value) => parentPort.postMessage({ type: 'progress', value }),
  updateProgress: (data) => parentPort.postMessage({ type: 'updateProgress', data }),
  log: (message, level = 'info') => parentPort.postMessage({ type: 'log', level, message })
};

// Validate function code before execution
const validateFunctionCode = (code) => {
  const dangerousPatterns = [
    /require\\s*\\(/,
    /import\\s+/,
    /eval\\s*\\(/,
    /Function\\s*\\(/,
    /process\\.\\w+/,
    /__dirname/,
    /__filename/,
    /child_process/,
    /fs\\s*\\./,
    /\\bexec\\s*\\(/
  ];
  
  for (const pattern of dangerousPatterns) {
    if (pattern.test(code)) {
      throw new Error('Dangerous code pattern detected: ' + pattern);
    }
  }
  return true;
};

// Execute the processing function
(async () => {
  try {
    // Validate code before execution
    validateFunctionCode(workerData.functionCode);
    
    const processingFunction = new Function('return ' + workerData.functionCode)();
    const result = await processingFunction(jobContext);
    parentPort.postMessage({ type: 'result', data: result });
  } catch (error) {
    parentPort.postMessage({ 
      type: 'error', 
      error: {
        message: error.message,
        stack: error.stack,
        name: error.name
      }
    });
  }
})();
`;

    fs.writeFileSync(this.workerScript, workerCode);
  }

  async execute(processingFunction: ProcessFunction, jobContext: JobContext): Promise<JobResult> {
    const executionId = jobContext.id;
    const startTime = performance.now();
    const memoryStart = process.memoryUsage().heapUsed;
    const cpuStart = process.cpuUsage();

    this.logger.info({
      executionId,
      jobType: jobContext.data.type,
      sandboxEnabled: this.config.sandboxEnabled
    }, 'Starting secure job execution with Worker Threads');

    const executionContext: ExecutionContext = {
      startTime,
      memoryStart,
      cpuStart,
      abortController: new AbortController()
    };

    this.activeExecutions.set(executionId, executionContext);

    try {
      const result = this.config.sandboxEnabled
        ? await this.executeInWorker(processingFunction, jobContext, executionContext)
        : await this.executeUnsandboxed(processingFunction, jobContext, executionContext);

      const resourceUsage = this.calculateResourceUsage(executionContext);

      this.logger.info({
        executionId,
        resourceUsage,
        success: true
      }, 'Job execution completed');

      this.emit('execution:success', {
        executionId,
        resourceUsage
      });

      return {
        ...result,
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

  private async executeInWorker(
    processingFunction: ProcessFunction,
    jobContext: JobContext,
    executionContext: ExecutionContext
  ): Promise<JobResult> {
    return new Promise((resolve, reject) => {
      // Validate function size
      const MAX_FUNCTION_SIZE = 1024 * 1024; // 1MB
      const functionCode = processingFunction.toString();
      
      if (functionCode.length > MAX_FUNCTION_SIZE) {
        reject(new WorkerError(`Function code exceeds maximum allowed size of ${MAX_FUNCTION_SIZE} bytes`, 'FUNCTION_TOO_LARGE'));
        return;
      }

      // Serialize job context (remove functions)
      const serializedContext = {
        id: jobContext.id,
        name: jobContext.name,
        data: jobContext.data,
        attemptsMade: jobContext.attemptsMade,
        timestamp: jobContext.timestamp
      };

      const worker = new Worker(this.workerScript, {
        workerData: {
          functionCode,
          jobContext: serializedContext
        },
        resourceLimits: {
          maxOldGenerationSizeMb: this.config.maxMemoryMB || 512,
          maxYoungGenerationSizeMb: this.config.maxMemoryMB ? this.config.maxMemoryMB / 4 : 128
        }
      });

      executionContext.worker = worker;

      // Set up timeout
      if (this.config.timeoutMs > 0) {
        executionContext.timeoutHandle = setTimeout(() => {
          this.logger.warn({
            executionId: jobContext.id,
            timeout: this.config.timeoutMs
          }, 'Job execution timeout - terminating worker');
          
          worker.terminate();
          reject(new WorkerError('Execution timeout', 'TIMEOUT'));
        }, this.config.timeoutMs);
      }

      // Handle worker messages
      worker.on('message', (message) => {
        switch (message.type) {
          case 'log':
            jobContext.log(message.message, message.level);
            break;
          case 'progress':
            jobContext.progress(message.value);
            break;
          case 'updateProgress':
            jobContext.updateProgress(message.data);
            break;
          case 'result':
            if (executionContext.timeoutHandle) {
              clearTimeout(executionContext.timeoutHandle);
            }
            resolve(message.data);
            break;
          case 'error':
            if (executionContext.timeoutHandle) {
              clearTimeout(executionContext.timeoutHandle);
            }
            reject(new WorkerError(message.error.message, 'EXECUTION_ERROR'));
            break;
        }
      });

      // Handle worker errors
      worker.on('error', (error) => {
        this.logger.error({
          executionId: jobContext.id,
          error: error.message
        }, 'Worker thread error');
        
        if (executionContext.timeoutHandle) {
          clearTimeout(executionContext.timeoutHandle);
        }
        reject(new WorkerError(error.message, 'WORKER_ERROR'));
      });

      // Handle worker exit
      worker.on('exit', (code) => {
        if (code !== 0) {
          this.logger.error({
            executionId: jobContext.id,
            exitCode: code
          }, 'Worker thread exited with error');
          
          if (executionContext.timeoutHandle) {
            clearTimeout(executionContext.timeoutHandle);
          }
          reject(new WorkerError(`Worker exited with code ${code}`, 'WORKER_EXIT'));
        }
      });
    });
  }

  private async executeUnsandboxed(
    processingFunction: ProcessFunction,
    jobContext: JobContext,
    executionContext: ExecutionContext
  ): Promise<JobResult> {
    // Create a promise that can be cancelled
    const executionPromise = new Promise<JobResult>((resolve, reject) => {
      // Set up timeout with AbortController
      if (this.config.timeoutMs > 0) {
        executionContext.timeoutHandle = setTimeout(() => {
          this.logger.warn({
            executionId: jobContext.id,
            timeout: this.config.timeoutMs
          }, 'Job execution timeout');
          
          executionContext.abortController?.abort();
          reject(new WorkerError('Execution timeout', 'TIMEOUT'));
        }, this.config.timeoutMs);
      }

      // Execute with abort signal
      const executeWithSignal = async () => {
        try {
          // Check abort signal periodically
          const checkAbort = () => {
            if (executionContext.abortController?.signal.aborted) {
              throw new Error('Execution aborted');
            }
          };

          // Wrap the job context with abort checking
          const wrappedContext = {
            ...jobContext,
            progress: (value: number) => {
              checkAbort();
              return jobContext.progress(value);
            },
            updateProgress: (data: any) => {
              checkAbort();
              return jobContext.updateProgress(data);
            },
            log: (message: string, level?: 'info' | 'warn' | 'error') => {
              checkAbort();
              return jobContext.log(message, level);
            }
          };

          const result = await processingFunction(wrappedContext);
          
          if (executionContext.timeoutHandle) {
            clearTimeout(executionContext.timeoutHandle);
          }
          
          resolve(result);
        } catch (error) {
          if (executionContext.timeoutHandle) {
            clearTimeout(executionContext.timeoutHandle);
          }
          reject(error);
        }
      };

      executeWithSignal();
    });

    return executionPromise;
  }

  private setupResourceMonitoring(): void {
    this.resourceMonitor = setInterval(() => {
      for (const [executionId, context] of this.activeExecutions) {
        const memoryUsed = process.memoryUsage().heapUsed - context.memoryStart;
        
        if (this.config.maxMemoryMB && memoryUsed > this.config.maxMemoryMB * 1024 * 1024) {
          this.logger.error({
            executionId,
            memoryUsed,
            limit: this.config.maxMemoryMB
          }, 'Memory limit exceeded');

          // Terminate the worker if it exists
          if (context.worker) {
            context.worker.terminate();
          }

          this.emit('execution:memoryExceeded', {
            executionId,
            memoryUsed,
            limit: this.config.maxMemoryMB
          });
        }
      }
    }, 1000);
  }

  private calculateResourceUsage(context: ExecutionContext): ResourceUsage {
    const executionTime = performance.now() - context.startTime;
    const memoryUsed = process.memoryUsage().heapUsed - context.memoryStart;
    
    // Calculate CPU time used by this specific job
    let cpuTime = 0;
    if (context.cpuStart) {
      const cpuEnd = process.cpuUsage(context.cpuStart);
      // cpuEnd now contains the delta CPU usage since cpuStart
      cpuTime = (cpuEnd.user + cpuEnd.system) / 1000; // Convert microseconds to milliseconds
    }

    return {
      memoryUsed,
      cpuTime,
      executionTime
    };
  }

  private cleanupExecution(executionId: string): void {
    const context = this.activeExecutions.get(executionId);
    
    if (context) {
      if (context.timeoutHandle) {
        clearTimeout(context.timeoutHandle);
      }
      
      if (context.worker) {
        context.worker.terminate();
      }

      if (context.abortController) {
        context.abortController.abort();
      }
      
      this.activeExecutions.delete(executionId);
    }
  }

  shutdown(): void {
    this.logger.info('Shutting down secure worker runner');

    // Clear resource monitor
    if (this.resourceMonitor) {
      clearInterval(this.resourceMonitor);
    }

    // Cleanup all active executions
    for (const [executionId] of this.activeExecutions) {
      this.cleanupExecution(executionId);
    }

    // Clean up worker script
    this.cleanup();

    this.removeAllListeners();
  }
}