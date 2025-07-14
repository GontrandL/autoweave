import { Worker } from 'worker_threads';
import { EventEmitter } from 'events';
import { join } from 'path';
import { PluginManifest } from '../types/plugin';
import { PermissionManager } from '../security/permission-manager';

export interface SecureWorkerOptions {
  manifest: PluginManifest;
  pluginPath: string;
  timeout?: number;
  rateLimit?: {
    maxMessages: number;
    windowMs: number;
  };
}

export interface WorkerMessage {
  id: string;
  type: string;
  data?: any;
  error?: string;
}

export class SecurePluginWorker extends EventEmitter {
  private worker: Worker | null = null;
  private manifest: PluginManifest;
  private pluginPath: string;
  private timeout: number;
  private isTerminated = false;
  private messageCount = 0;
  private messageWindow: number[] = [];
  private rateLimit: { maxMessages: number; windowMs: number };
  private pendingRequests = new Map<string, { resolve: Function; reject: Function; timer: NodeJS.Timeout }>();
  private messageId = 0;

  constructor(options: SecureWorkerOptions) {
    super();
    this.manifest = options.manifest;
    this.pluginPath = options.pluginPath;
    this.timeout = options.timeout || 30000; // 30 seconds default
    this.rateLimit = options.rateLimit || { maxMessages: 100, windowMs: 60000 };

    // Validate permissions before creating worker
    const permissionErrors = PermissionManager.validatePermissions(this.manifest.permissions);
    if (permissionErrors.length > 0) {
      throw new Error(`Invalid permissions: ${permissionErrors.join(', ')}`);
    }
  }

  async initialize(): Promise<void> {
    if (this.worker) {
      throw new Error('Worker already initialized');
    }

    // Enhanced resource limits based on permissions
    const resourceLimits = {
      maxOldGenerationSizeMb: this.manifest.permissions.memory?.max_heap_mb || 128,
      maxYoungGenerationSizeMb: Math.min(32, Math.floor((this.manifest.permissions.memory?.max_heap_mb || 128) / 4)),
      codeRangeSizeMb: 16,
      stackSizeMb: 4
    };

    // Create worker with enhanced security
    this.worker = new Worker(join(__dirname, './secure-worker-runner.js'), {
      workerData: {
        manifest: this.manifest,
        pluginPath: this.pluginPath,
        permissions: PermissionManager.createSandboxPermissions(this.manifest.permissions)
      },
      resourceLimits,
      // Additional security options
      env: {
        ...process.env,
        NODE_ENV: 'sandbox',
        PLUGIN_NAME: this.manifest.name
      },
      // Ensure worker runs in a restricted context
      execArgv: ['--no-expose-wasm', '--disallow-code-generation-from-strings']
    });

    this.setupEventHandlers();
    
    // Wait for worker to be ready
    await this.waitForReady();
  }

  private setupEventHandlers(): void {
    if (!this.worker) return;

    this.worker.on('message', this.handleWorkerMessage.bind(this));
    this.worker.on('error', this.handleWorkerError.bind(this));
    this.worker.on('exit', this.handleWorkerExit.bind(this));
    this.worker.on('messageerror', this.handleMessageError.bind(this));
  }

  private async waitForReady(): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Worker initialization timeout'));
      }, 10000);

      const messageHandler = (message: WorkerMessage) => {
        if (message.type === 'READY') {
          clearTimeout(timeout);
          if (this.worker) {
            this.worker.off('message', messageHandler);
          }
          resolve();
        }
      };

      if (this.worker) {
        this.worker.on('message', messageHandler);
      }
    });
  }

  private handleWorkerMessage(message: WorkerMessage): void {
    // Rate limiting check
    if (!this.checkRateLimit()) {
      console.warn(`Rate limit exceeded for plugin ${this.manifest.name}`);
      return;
    }

    // Handle response messages
    if (message.id && this.pendingRequests.has(message.id)) {
      const { resolve, reject, timer } = this.pendingRequests.get(message.id)!;
      clearTimeout(timer);
      this.pendingRequests.delete(message.id);

      if (message.error) {
        reject(new Error(message.error));
      } else {
        resolve(message.data);
      }
      return;
    }

    // Validate message format
    if (!this.validateMessage(message)) {
      console.error(`Invalid message from plugin ${this.manifest.name}:`, message);
      return;
    }

    // Emit validated message
    this.emit('message', message);
  }

  private handleWorkerError(error: Error): void {
    console.error(`Worker error in plugin ${this.manifest.name}:`, error);
    this.emit('error', error);
    
    // Terminate worker on critical errors
    if (this.shouldTerminateOnError(error)) {
      this.terminate();
    }
  }

  private handleWorkerExit(code: number): void {
    if (!this.isTerminated) {
      console.warn(`Worker exited unexpectedly for plugin ${this.manifest.name} with code ${code}`);
      this.emit('exit', code);
    }
    
    // Clean up pending requests
    for (const [id, { reject }] of this.pendingRequests) {
      reject(new Error('Worker exited'));
    }
    this.pendingRequests.clear();
  }

  private handleMessageError(error: Error): void {
    console.error(`Message error in plugin ${this.manifest.name}:`, error);
    this.emit('messageerror', error);
  }

  private checkRateLimit(): boolean {
    const now = Date.now();
    
    // Remove old entries outside the window
    this.messageWindow = this.messageWindow.filter(
      timestamp => now - timestamp < this.rateLimit.windowMs
    );
    
    // Check if we're under the limit
    if (this.messageWindow.length >= this.rateLimit.maxMessages) {
      return false;
    }
    
    // Add current message
    this.messageWindow.push(now);
    return true;
  }

  private validateMessage(message: any): boolean {
    if (!message || typeof message !== 'object') {
      return false;
    }
    
    if (!message.type || typeof message.type !== 'string') {
      return false;
    }
    
    // Additional validation based on message type
    const allowedTypes = [
      'LOG', 'ERROR', 'METRIC', 'EVENT', 
      'READY', 'LOAD_SUCCESS', 'LOAD_ERROR',
      'USB_EVENT_HANDLED', 'JOB_RESULT'
    ];
    
    if (!allowedTypes.includes(message.type)) {
      return false;
    }
    
    return true;
  }

  private shouldTerminateOnError(error: Error): boolean {
    // Terminate on memory errors, segfaults, or other critical issues
    const criticalErrors = [
      'ERR_WORKER_OUT_OF_MEMORY',
      'ERR_WORKER_INIT_FAILED',
      'SIGSEGV',
      'SIGABRT'
    ];
    
    return criticalErrors.some(err => error.message.includes(err));
  }

  async sendMessage(type: string, data?: any): Promise<any> {
    if (!this.worker || this.isTerminated) {
      throw new Error('Worker not available');
    }

    const id = `msg-${++this.messageId}`;
    const message: WorkerMessage = { id, type, data };

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new Error(`Message timeout for type: ${type}`));
      }, this.timeout);

      this.pendingRequests.set(id, { resolve, reject, timer });
      this.worker!.postMessage(message);
    });
  }

  async load(): Promise<void> {
    return this.sendMessage('LOAD');
  }

  async unload(): Promise<void> {
    return this.sendMessage('UNLOAD');
  }

  async sendUSBEvent(eventType: 'attach' | 'detach', deviceInfo: any): Promise<void> {
    // Validate USB permissions
    const { allowed, reason } = PermissionManager.checkUSBAccess(
      deviceInfo.vendorId,
      deviceInfo.productId,
      this.manifest.permissions
    );

    if (!allowed) {
      throw new Error(`USB access denied: ${reason}`);
    }

    return this.sendMessage('USB_EVENT', { eventType, deviceInfo });
  }

  async sendJob(jobData: any): Promise<any> {
    return this.sendMessage('JOB_RECEIVED', jobData);
  }

  async terminate(): Promise<void> {
    if (this.isTerminated) return;
    
    this.isTerminated = true;
    
    // Try graceful shutdown first
    if (this.worker) {
      try {
        await this.sendMessage('SHUTDOWN');
        // Give worker 5 seconds to clean up
        await new Promise(resolve => setTimeout(resolve, 5000));
      } catch {
        // Worker might already be terminated
      }
      
      await this.worker.terminate();
      this.worker = null;
    }
    
    // Clean up pending requests
    for (const [id, { reject }] of this.pendingRequests) {
      reject(new Error('Worker terminated'));
    }
    this.pendingRequests.clear();
  }

  getManifest(): PluginManifest {
    return this.manifest;
  }

  isHealthy(): boolean {
    return !this.isTerminated && this.worker !== null;
  }

  getMetrics(): {
    messageCount: number;
    messageRate: number;
    pendingRequests: number;
    uptime: number;
  } {
    const now = Date.now();
    const recentMessages = this.messageWindow.filter(
      timestamp => now - timestamp < 60000
    ).length;

    return {
      messageCount: this.messageCount,
      messageRate: recentMessages,
      pendingRequests: this.pendingRequests.size,
      uptime: this.worker ? now - (this.worker as any).threadId : 0
    };
  }
}