import { JobType, ProcessFunction } from '../types';

// Import all processors
import {
  usbDeviceAttachedProcessor,
  usbDeviceDetachedProcessor,
  usbScanCompleteProcessor
} from './usb-processors';

import {
  pluginLoadProcessor,
  pluginUnloadProcessor,
  pluginExecuteProcessor,
  pluginValidateProcessor,
  pluginReloadProcessor
} from './plugin-processors';

// Registry for mapping job types to processors
export class ProcessorRegistry {
  private processors = new Map<JobType, ProcessFunction>();

  constructor() {
    this.registerDefaultProcessors();
  }

  private registerDefaultProcessors(): void {
    // USB processors
    this.processors.set('usb.device.attached', usbDeviceAttachedProcessor);
    this.processors.set('usb.device.detached', usbDeviceDetachedProcessor);
    this.processors.set('usb.scan.complete', usbScanCompleteProcessor);

    // Plugin processors
    this.processors.set('plugin.load', pluginLoadProcessor);
    this.processors.set('plugin.unload', pluginUnloadProcessor);
    this.processors.set('plugin.execute', pluginExecuteProcessor);
    this.processors.set('plugin.validate', pluginValidateProcessor);
    this.processors.set('plugin.reload', pluginReloadProcessor);

    // System processors (placeholder implementations)
    this.processors.set('system.maintenance', this.createPlaceholderProcessor('system.maintenance'));
    this.processors.set('system.cleanup', this.createPlaceholderProcessor('system.cleanup'));
    this.processors.set('system.health.check', this.createPlaceholderProcessor('system.health.check'));
    this.processors.set('system.backup', this.createPlaceholderProcessor('system.backup'));

    // LLM processors (placeholder implementations)
    this.processors.set('llm.batch.process', this.createPlaceholderProcessor('llm.batch.process'));
    this.processors.set('llm.embeddings.generate', this.createPlaceholderProcessor('llm.embeddings.generate'));
    this.processors.set('llm.completion.create', this.createPlaceholderProcessor('llm.completion.create'));

    // Memory processors (placeholder implementations)
    this.processors.set('memory.vectorize', this.createPlaceholderProcessor('memory.vectorize'));
    this.processors.set('memory.index', this.createPlaceholderProcessor('memory.index'));
    this.processors.set('memory.search', this.createPlaceholderProcessor('memory.search'));
    this.processors.set('memory.cleanup', this.createPlaceholderProcessor('memory.cleanup'));
  }

  private createPlaceholderProcessor(jobType: JobType): ProcessFunction {
    return async (context) => {
      const { log } = context;
      
      log(`Processing ${jobType} job`);
      context.progress(25);
      
      // Simulate some work
      await new Promise(resolve => setTimeout(resolve, 100));
      context.progress(50);
      
      await new Promise(resolve => setTimeout(resolve, 100));
      context.progress(75);
      
      await new Promise(resolve => setTimeout(resolve, 100));
      context.progress(100);
      
      log(`${jobType} job completed`);
      
      return {
        success: true,
        data: {
          jobType,
          message: `${jobType} completed successfully`,
          timestamp: Date.now()
        }
      };
    };
  }

  register(jobType: JobType, processor: ProcessFunction): void {
    this.processors.set(jobType, processor);
  }

  unregister(jobType: JobType): void {
    this.processors.delete(jobType);
  }

  get(jobType: JobType): ProcessFunction | undefined {
    return this.processors.get(jobType);
  }

  getAll(): Map<JobType, ProcessFunction> {
    return new Map(this.processors);
  }

  has(jobType: JobType): boolean {
    return this.processors.has(jobType);
  }

  getSupportedJobTypes(): JobType[] {
    return Array.from(this.processors.keys());
  }

  createDefaultProcessor(queueName: string): ProcessFunction {
    return async (context) => {
      const { data, log } = context;
      
      log(`Processing job ${data.type} in queue ${queueName}`);
      context.progress(25);
      
      // Get the specific processor for this job type
      const processor = this.get(data.type);
      
      if (!processor) {
        throw new Error(`No processor found for job type: ${data.type}`);
      }
      
      context.progress(50);
      
      // Execute the processor
      const result = await processor(context);
      
      context.progress(100);
      
      return result;
    };
  }

  // Helper method to create a processor that can handle multiple job types
  createMultiProcessor(jobTypes: JobType[]): ProcessFunction {
    return async (context) => {
      const { data, log } = context;
      
      if (!jobTypes.includes(data.type)) {
        throw new Error(`Job type ${data.type} is not supported by this processor`);
      }
      
      log(`Processing multi-type job: ${data.type}`);
      
      const processor = this.get(data.type);
      if (!processor) {
        throw new Error(`No processor found for job type: ${data.type}`);
      }
      
      return processor(context);
    };
  }

  // Method to validate that all required processors are registered
  validateProcessors(requiredJobTypes: JobType[]): { valid: boolean; missing: JobType[] } {
    const missing = requiredJobTypes.filter(jobType => !this.has(jobType));
    
    return {
      valid: missing.length === 0,
      missing
    };
  }
}

// Global instance
export const processorRegistry = new ProcessorRegistry();

// Helper function to get processor for a job type
export function getProcessor(jobType: JobType): ProcessFunction | undefined {
  return processorRegistry.get(jobType);
}

// Helper function to register a custom processor
export function registerProcessor(jobType: JobType, processor: ProcessFunction): void {
  processorRegistry.register(jobType, processor);
}

// Helper function to create a processor that logs job execution
export function createLoggingProcessor(baseProcessor: ProcessFunction): ProcessFunction {
  return async (context) => {
    const { data, log } = context;
    const startTime = Date.now();
    
    log(`Starting job execution: ${data.type}`);
    
    try {
      const result = await baseProcessor(context);
      const executionTime = Date.now() - startTime;
      
      log(`Job completed successfully: ${data.type} (${executionTime}ms)`);
      
      return result;
    } catch (error) {
      const executionTime = Date.now() - startTime;
      log(`Job failed: ${data.type} (${executionTime}ms) - ${error}`, 'error');
      
      throw error;
    }
  };
}

// Helper function to create a processor with retry logic
export function createRetryProcessor(baseProcessor: ProcessFunction, maxRetries: number = 3): ProcessFunction {
  return async (context) => {
    const { data, log } = context;
    let lastError: Error | null = null;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        log(`Job attempt ${attempt}/${maxRetries}: ${data.type}`);
        
        const result = await baseProcessor(context);
        
        if (attempt > 1) {
          log(`Job succeeded on attempt ${attempt}: ${data.type}`);
        }
        
        return result;
      } catch (error) {
        lastError = error as Error;
        
        if (attempt === maxRetries) {
          log(`Job failed after ${maxRetries} attempts: ${data.type} - ${lastError.message}`, 'error');
          throw lastError;
        }
        
        log(`Job attempt ${attempt} failed: ${data.type} - ${lastError.message}. Retrying...`, 'warn');
        
        // Wait before retry (exponential backoff)
        const delay = Math.pow(2, attempt - 1) * 1000;
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    throw lastError;
  };
}

// Helper function to create a processor with timeout
export function createTimeoutProcessor(baseProcessor: ProcessFunction, timeoutMs: number): ProcessFunction {
  return async (context) => {
    const { data, log } = context;
    
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Job timeout after ${timeoutMs}ms: ${data.type}`));
      }, timeoutMs);
    });
    
    try {
      const result = await Promise.race([
        baseProcessor(context),
        timeoutPromise
      ]);
      
      return result;
    } catch (error) {
      log(`Job timed out or failed: ${data.type} - ${error}`, 'error');
      throw error;
    }
  };
}