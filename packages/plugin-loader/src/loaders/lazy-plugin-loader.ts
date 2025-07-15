import { EventEmitter } from 'events';

import { getLogger } from '@autoweave/observability';

// Type-safe logger wrapper to work around observability package type issues
interface Logger {
  info(message: string, meta?: unknown): void;
  error(message: string, error?: Error, meta?: unknown): void;
  warn(message: string, meta?: unknown): void;
}

import type { PluginManifest, PluginInstance } from '../types/plugin';
// import { SecurePluginWorker } from '../workers/secure-plugin-worker';
import type { PluginWorkerPool } from '../workers/plugin-worker-pool';
// import { FastManifestParser } from '../parsers/fast-manifest-parser';

export enum PluginPriority {
  CRITICAL = 0,
  HIGH = 1,
  NORMAL = 2,
  LOW = 3,
  BACKGROUND = 4
}

export interface LazyLoadOptions {
  preloadQueue?: string[];
  priorityMap?: Map<string, PluginPriority>;
  maxConcurrentLoads?: number;
  loadTimeout?: number;
  enableMetrics?: boolean;
}

interface PluginLoadTask {
  manifest: PluginManifest;
  pluginPath: string;
  priority: PluginPriority;
  addedAt: number;
  attempts: number;
}

interface LoadMetrics {
  totalLoads: number;
  successfulLoads: number;
  failedLoads: number;
  averageLoadTime: number;
  loadTimes: number[];
}

export class LazyPluginLoader extends EventEmitter {
  private loadQueue: PluginLoadTask[] = [];
  private loadingPlugins = new Set<string>();
  private loadedPlugins = new Map<string, PluginInstance>();
  private pluginProxies = new Map<string, PluginInstance>();
  private workerPool: PluginWorkerPool;
  // private manifestParser: FastManifestParser;
  private options: Required<LazyLoadOptions>;
  private loadMetrics: LoadMetrics;
  private isProcessing = false;
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  private readonly logger = getLogger() as unknown as Logger;

  constructor(workerPool: PluginWorkerPool, options: LazyLoadOptions = {}) {
    super();
    this.workerPool = workerPool;
    // this.manifestParser = FastManifestParser.getInstance();

    this.options = {
      preloadQueue: options.preloadQueue ?? [],
      priorityMap: options.priorityMap ?? new Map<string, PluginPriority>(),
      maxConcurrentLoads: options.maxConcurrentLoads ?? 3,
      loadTimeout: options.loadTimeout ?? 30000,
      enableMetrics: options.enableMetrics !== false
    };

    this.loadMetrics = {
      totalLoads: 0,
      successfulLoads: 0,
      failedLoads: 0,
      averageLoadTime: 0,
      loadTimes: []
    };
  }

  async initialize(): Promise<void> {
    // Preload high-priority plugins
    if (this.options.preloadQueue.length > 0) {
      this.logger.info(`Preloading ${this.options.preloadQueue.length} plugins...`);

      for (const pluginName of this.options.preloadQueue) {
        const priority = this.options.priorityMap.get(pluginName) ?? PluginPriority.HIGH;
        // Note: We need the manifest and path, which would typically come from scanning
        // This is a placeholder - in real usage, you'd have this information
        this.logger.info(`Queued ${pluginName} for preloading with priority ${priority}`);
      }

      await this.processLoadQueue();
    }
  }

  createLazyProxy(manifest: PluginManifest, pluginPath: string): PluginInstance {
    // Check if we already have a proxy
    const existing = this.pluginProxies.get(manifest.name);
    if (existing) {
      return existing;
    }

    // Create a proxy that loads the plugin on first access
    const handler: ProxyHandler<PluginInstance> = {
      get: (target, prop) => {
        // If accessing core properties, return from manifest
        if (prop === 'manifest') {return manifest;}
        if (prop === 'path') {return pluginPath;}
        if (prop === 'loaded') {return this.loadedPlugins.has(manifest.name);}
        if (prop === 'signature') {return target.signature;}

        // For worker access, trigger lazy load
        if (prop === 'worker') {
          if (!this.loadedPlugins.has(manifest.name)) {
            // Queue for loading with normal priority
            this.queuePluginLoad(manifest, pluginPath, PluginPriority.NORMAL);

            // Return a promise that resolves when loaded
            return new Promise((resolve) => {
              const checkLoaded = setInterval(() => {
                const loaded = this.loadedPlugins.get(manifest.name);
                if (loaded) {
                  clearInterval(checkLoaded);
                  resolve(loaded.worker);
                }
              }, 100);
            });
          }

          // eslint-disable-next-line @typescript-eslint/no-unsafe-return
          return this.loadedPlugins.get(manifest.name)?.worker;
        }

        // eslint-disable-next-line @typescript-eslint/no-unsafe-return
        return target[prop as keyof PluginInstance];
      }
    };

    const proxyInstance: PluginInstance = {
      manifest,
      path: pluginPath,
      loaded: false,
      signature: '' // Will be set when actually loaded
    };

    const proxy = new Proxy(proxyInstance, handler);
    this.pluginProxies.set(manifest.name, proxy);

    return proxy;
  }

  async loadPlugin(
    manifest: PluginManifest,
    pluginPath: string,
    priority: PluginPriority = PluginPriority.NORMAL
  ): Promise<PluginInstance> {
    // Check if already loaded
    const loaded = this.loadedPlugins.get(manifest.name);
    if (loaded) {
      return loaded;
    }

    // Check if currently loading
    if (this.loadingPlugins.has(manifest.name)) {
      // Wait for current load to complete
      return new Promise((resolve, reject) => {
        const checkInterval = setInterval(() => {
          if (!this.loadingPlugins.has(manifest.name)) {
            clearInterval(checkInterval);
            const plugin = this.loadedPlugins.get(manifest.name);
            if (plugin) {
              resolve(plugin);
            } else {
              reject(new Error(`Plugin ${manifest.name} failed to load`));
            }
          }
        }, 100);
      });
    }

    // Queue for loading
    this.queuePluginLoad(manifest, pluginPath, priority);

    // Process queue
    void this.processLoadQueue();

    // Wait for load to complete
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Plugin ${manifest.name} load timeout`));
      }, this.options.loadTimeout);

      const checkInterval = setInterval(() => {
        const plugin = this.loadedPlugins.get(manifest.name);
        if (plugin) {
          clearInterval(checkInterval);
          clearTimeout(timeout);
          resolve(plugin);
        }
      }, 100);
    });
  }

  private queuePluginLoad(
    manifest: PluginManifest,
    pluginPath: string,
    priority: PluginPriority
  ): void {
    // Check if already queued
    const existingIndex = this.loadQueue.findIndex(
      task => task.manifest.name === manifest.name
    );

    if (existingIndex >= 0) {
      // Update priority if higher
      const existing = this.loadQueue[existingIndex];
      if (existing && priority < existing.priority) {
        existing.priority = priority;
        this.sortLoadQueue();
      }
      return;
    }

    // Add to queue
    const task: PluginLoadTask = {
      manifest,
      pluginPath,
      priority,
      addedAt: Date.now(),
      attempts: 0
    };

    this.loadQueue.push(task);
    this.sortLoadQueue();
  }

  private sortLoadQueue(): void {
    this.loadQueue.sort((a, b) => {
      // Sort by priority first
      if (a.priority !== b.priority) {
        return a.priority - b.priority;
      }
      // Then by age (FIFO within same priority)
      return a.addedAt - b.addedAt;
    });
  }

  private async processLoadQueue(): Promise<void> {
    if (this.isProcessing) {return;}
    this.isProcessing = true;

    try {
      while (this.loadQueue.length > 0) {
        // Get number of available load slots
        const availableSlots = this.options.maxConcurrentLoads - this.loadingPlugins.size;
        if (availableSlots <= 0) {
          // Wait for a slot to become available
          await new Promise(resolve => setTimeout(resolve, 100));
          continue;
        }

        // Take tasks up to available slots
        const tasks = this.loadQueue.splice(0, availableSlots);

        // Load plugins in parallel
        await Promise.all(tasks.map(task => this.loadPluginTask(task)));
      }
    } finally {
      this.isProcessing = false;
    }
  }

  private async loadPluginTask(task: PluginLoadTask): Promise<void> {
    const startTime = Date.now();
    const { manifest, pluginPath } = task;

    this.loadingPlugins.add(manifest.name);
    task.attempts++;

    try {
      // Get worker from pool
      const worker = await this.workerPool.getWorker(manifest, pluginPath);

      // Create plugin instance
      const pluginInstance: PluginInstance = {
        manifest,
        worker,
        path: pluginPath,
        loaded: true,
        loadedAt: new Date(),
        signature: this.generateSignature(manifest, pluginPath)
      };

      // Store loaded plugin
      this.loadedPlugins.set(manifest.name, pluginInstance);

      // Update metrics
      if (this.options.enableMetrics) {
        this.updateLoadMetrics(true, Date.now() - startTime);
      }

      // Emit event
      this.emit('plugin:loaded', {
        plugin: pluginInstance,
        priority: task.priority,
        loadTime: Date.now() - startTime
      });

      this.logger.info(`Loaded plugin ${manifest.name} (priority: ${task.priority}) in ${Date.now() - startTime}ms`);
    } catch (error) {
      this.logger.error(`Failed to load plugin ${manifest.name}:`, error instanceof Error ? error : new Error(String(error)));

      // Update metrics
      if (this.options.enableMetrics) {
        this.updateLoadMetrics(false, Date.now() - startTime);
      }

      // Retry logic
      if (task.attempts < 3) {
        // Re-queue with lower priority
        task.priority = Math.min(task.priority + 1, PluginPriority.BACKGROUND);
        this.loadQueue.push(task);
        this.sortLoadQueue();
      } else {
        // Emit failure event
        this.emit('plugin:load-failed', {
          manifest,
          error,
          attempts: task.attempts
        });
      }
    } finally {
      this.loadingPlugins.delete(manifest.name);
    }
  }

  private generateSignature(manifest: PluginManifest, pluginPath: string): string {
    // Simple signature generation - in production, use proper crypto
    // eslint-disable-next-line @typescript-eslint/no-var-requires, @typescript-eslint/no-unsafe-assignment
    const crypto = require('crypto');
    const data = JSON.stringify(manifest) + pluginPath;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  private updateLoadMetrics(success: boolean, loadTime: number): void {
    this.loadMetrics.totalLoads++;

    if (success) {
      this.loadMetrics.successfulLoads++;
    } else {
      this.loadMetrics.failedLoads++;
    }

    this.loadMetrics.loadTimes.push(loadTime);

    // Keep only last 100 load times
    if (this.loadMetrics.loadTimes.length > 100) {
      this.loadMetrics.loadTimes.shift();
    }

    // Calculate average
    this.loadMetrics.averageLoadTime =
      this.loadMetrics.loadTimes.reduce((a, b) => a + b, 0) /
      this.loadMetrics.loadTimes.length;
  }

  unloadPlugin(name: string): void {
    const plugin = this.loadedPlugins.get(name);
    if (!plugin) {
      throw new Error(`Plugin ${name} not loaded`);
    }

    // Release from worker pool
    this.workerPool.releaseWorker(plugin.manifest);

    // Remove from loaded plugins
    this.loadedPlugins.delete(name);
    this.pluginProxies.delete(name);

    // Emit event
    this.emit('plugin:unloaded', { pluginName: name });
  }

  getLoadedPlugin(name: string): PluginInstance | undefined {
    return this.loadedPlugins.get(name);
  }

  getAllLoadedPlugins(): PluginInstance[] {
    return Array.from(this.loadedPlugins.values());
  }

  getLoadQueueStatus(): {
    queueLength: number;
    loadingCount: number;
    queuedPlugins: Array<{ name: string; priority: PluginPriority }>;
  } {
    return {
      queueLength: this.loadQueue.length,
      loadingCount: this.loadingPlugins.size,
      queuedPlugins: this.loadQueue.map(task => ({
        name: task.manifest.name,
        priority: task.priority
      }))
    };
  }

  getMetrics(): LoadMetrics & {
    loadedCount: number;
    queuedCount: number;
    loadingCount: number;
  } {
    return {
      ...this.loadMetrics,
      loadedCount: this.loadedPlugins.size,
      queuedCount: this.loadQueue.length,
      loadingCount: this.loadingPlugins.size
    };
  }

  setPriority(pluginName: string, priority: PluginPriority): void {
    // Update priority map
    this.options.priorityMap.set(pluginName, priority);

    // Update queue if plugin is queued
    const queuedTask = this.loadQueue.find(
      task => task.manifest.name === pluginName
    );

    if (queuedTask) {
      queuedTask.priority = priority;
      this.sortLoadQueue();
    }
  }

  preloadPlugins(pluginNames: string[]): void {
    // This would typically be called with actual manifest data
    // For now, just update the preload queue
    for (const name of pluginNames) {
      if (!this.options.preloadQueue.includes(name)) {
        this.options.preloadQueue.push(name);
      }
    }
  }
}