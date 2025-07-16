import { EventEmitter } from 'events';

import type { PluginManifest } from '../types/plugin';

import type { SecureWorkerOptions } from './secure-plugin-worker';
import { SecurePluginWorker } from './secure-plugin-worker';


export interface PoolOptions {
  minWorkers?: number;
  maxWorkers?: number;
  workerIdleTimeout?: number;
  healthCheckInterval?: number;
}

export interface WorkerInfo {
  worker: SecurePluginWorker;
  manifest: PluginManifest;
  busy: boolean;
  lastUsed: number;
  health: {
    healthy: boolean;
    lastCheck: number;
    errorCount: number;
  };
}

export class PluginWorkerPool extends EventEmitter {
  private workers = new Map<string, WorkerInfo>();
  private options: Required<PoolOptions>;
  private healthCheckTimer?: NodeJS.Timeout;
  private cleanupTimer?: NodeJS.Timeout;

  constructor(options: PoolOptions = {}) {
    super();
    this.options = {
      minWorkers: options.minWorkers || 0,
      maxWorkers: options.maxWorkers || 10,
      workerIdleTimeout: options.workerIdleTimeout || 300000, // 5 minutes
      healthCheckInterval: options.healthCheckInterval || 60000, // 1 minute
    };
  }

  async start(): Promise<void> {
    // Start health check timer
    this.healthCheckTimer = setInterval(
      () => { void this.performHealthCheck(); },
      this.options.healthCheckInterval
    );

    // Start cleanup timer
    this.cleanupTimer = setInterval(
      () => { void this.cleanupIdleWorkers(); },
      this.options.workerIdleTimeout / 2
    );

    console.log('Plugin worker pool started');
  }

  async stop(): Promise<void> {
    // Clear timers
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
    }
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }

    // Terminate all workers
    const terminatePromises = Array.from(this.workers.values()).map(
      info => info.worker.terminate()
    );

    await Promise.all(terminatePromises);
    this.workers.clear();

    console.log('Plugin worker pool stopped');
  }

  async getWorker(manifest: PluginManifest, pluginPath: string): Promise<SecurePluginWorker> {
    const pluginId = `${manifest.name}@${manifest.version}`;

    // Check if we have an existing healthy worker
    const existingInfo = this.workers.get(pluginId);
    if (existingInfo && existingInfo.health.healthy && !existingInfo.busy) {
      existingInfo.busy = true;
      existingInfo.lastUsed = Date.now();
      return existingInfo.worker;
    }

    // Check if we can create a new worker
    if (this.workers.size >= this.options.maxWorkers) {
      // Try to find a worker to recycle
      const recyclableWorker = await this.findRecyclableWorker();
      if (recyclableWorker) {
        await recyclableWorker.terminate();
        this.workers.delete(recyclableWorker.getManifest().name);
      } else {
        throw new Error('Worker pool at maximum capacity');
      }
    }

    // Create new worker
    const worker = await this.createWorker(manifest, pluginPath);
    const info: WorkerInfo = {
      worker,
      manifest,
      busy: true,
      lastUsed: Date.now(),
      health: {
        healthy: true,
        lastCheck: Date.now(),
        errorCount: 0
      }
    };

    this.workers.set(pluginId, info);
    this.emit('worker:created', { pluginId, manifest });

    return worker;
  }

  releaseWorker(manifest: PluginManifest): void {
    const pluginId = `${manifest.name}@${manifest.version}`;
    const info = this.workers.get(pluginId);

    if (info) {
      info.busy = false;
      info.lastUsed = Date.now();
    }
  }

  private async createWorker(
    manifest: PluginManifest,
    pluginPath: string
  ): Promise<SecurePluginWorker> {
    const workerOptions: SecureWorkerOptions = {
      manifest,
      pluginPath,
      timeout: 30000,
      rateLimit: {
        maxMessages: 100,
        windowMs: 60000
      }
    };

    const worker = new SecurePluginWorker(workerOptions);

    // Set up error handling
    worker.on('error', (error) => {
      this.handleWorkerError(manifest, error);
    });

    worker.on('exit', (code) => {
      this.handleWorkerExit(manifest, code);
    });

    // Initialize and load
    await worker.initialize();
    await worker.load();

    return worker;
  }

  private async findRecyclableWorker(): Promise<SecurePluginWorker | null> {
    let oldestWorker: WorkerInfo | null = null;
    let oldestTime = Date.now();

    for (const info of this.workers.values()) {
      if (!info.busy && info.lastUsed < oldestTime) {
        oldestWorker = info;
        oldestTime = info.lastUsed;
      }
    }

    return oldestWorker ? oldestWorker.worker : null;
  }

  private async performHealthCheck(): Promise<void> {
    const checks: Promise<void>[] = [];

    for (const [pluginId, info] of this.workers) {
      checks.push(this.checkWorkerHealth(pluginId, info));
    }

    await Promise.all(checks);
  }

  private async checkWorkerHealth(pluginId: string, info: WorkerInfo): Promise<void> {
    try {
      // Simple health check - send a ping message
      const timeout = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Health check timeout')), 5000)
      );

      await Promise.race([
        info.worker.sendMessage('PING'),
        timeout
      ]);

      // Worker is healthy
      info.health.healthy = true;
      info.health.errorCount = 0;
      info.health.lastCheck = Date.now();
    } catch (error) {
      // Worker is unhealthy
      info.health.healthy = false;
      info.health.errorCount++;
      info.health.lastCheck = Date.now();

      console.warn(`Worker ${pluginId} failed health check:`, error);

      // If too many errors, terminate the worker
      if (info.health.errorCount >= 3) {
        await this.terminateUnhealthyWorker(pluginId, info);
      }
    }
  }

  private async terminateUnhealthyWorker(pluginId: string, info: WorkerInfo): Promise<void> {
    console.log(`Terminating unhealthy worker ${pluginId}`);

    try {
      await info.worker.terminate();
    } catch (error) {
      console.error(`Error terminating worker ${pluginId}:`, error);
    }

    this.workers.delete(pluginId);
    this.emit('worker:terminated', { pluginId, reason: 'unhealthy' });
  }

  private async cleanupIdleWorkers(): Promise<void> {
    const now = Date.now();
    const workersToRemove: string[] = [];

    for (const [pluginId, info] of this.workers) {
      // Skip if worker is busy or minimum workers not met
      if (info.busy || this.workers.size <= this.options.minWorkers) {
        continue;
      }

      // Check if worker has been idle too long
      if (now - info.lastUsed > this.options.workerIdleTimeout) {
        workersToRemove.push(pluginId);
      }
    }

    // Remove idle workers
    for (const pluginId of workersToRemove) {
      const info = this.workers.get(pluginId);
      if (info && !info.busy) {
        console.log(`Removing idle worker ${pluginId}`);
        await info.worker.terminate();
        this.workers.delete(pluginId);
        this.emit('worker:terminated', { pluginId, reason: 'idle' });
      }
    }
  }

  private handleWorkerError(manifest: PluginManifest, error: Error): void {
    const pluginId = `${manifest.name}@${manifest.version}`;
    const info = this.workers.get(pluginId);

    if (info) {
      info.health.errorCount++;
      console.error(`Worker error for ${pluginId}:`, error);
      this.emit('worker:error', { pluginId, error });
    }
  }

  private handleWorkerExit(manifest: PluginManifest, code: number): void {
    const pluginId = `${manifest.name}@${manifest.version}`;

    // Remove worker from pool
    this.workers.delete(pluginId);

    console.log(`Worker ${pluginId} exited with code ${code}`);
    this.emit('worker:exit', { pluginId, code });
  }

  getPoolStats(): {
    totalWorkers: number;
    busyWorkers: number;
    idleWorkers: number;
    healthyWorkers: number;
    unhealthyWorkers: number;
  } {
    let busyWorkers = 0;
    let healthyWorkers = 0;

    for (const info of this.workers.values()) {
      if (info.busy) {busyWorkers++;}
      if (info.health.healthy) {healthyWorkers++;}
    }

    const totalWorkers = this.workers.size;
    const idleWorkers = totalWorkers - busyWorkers;
    const unhealthyWorkers = totalWorkers - healthyWorkers;

    return {
      totalWorkers,
      busyWorkers,
      idleWorkers,
      healthyWorkers,
      unhealthyWorkers
    };
  }

  getWorkerMetrics(manifest: PluginManifest): any {
    const pluginId = `${manifest.name}@${manifest.version}`;
    const info = this.workers.get(pluginId);

    if (!info) {
      return null;
    }

    return {
      ...info.worker.getMetrics(),
      busy: info.busy,
      lastUsed: info.lastUsed,
      health: info.health
    };
  }
}