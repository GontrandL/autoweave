import { createHash } from 'crypto';
import { EventEmitter } from 'events';
import { existsSync, readdirSync, readFile } from 'fs';
import { join } from 'path';
import { performance } from 'perf_hooks';
import { promisify } from 'util';

// Using JSON instead of msgpack-lite for now

import { LRUCache } from '../../shared/src/performance/lru-cache';
import { MetricsCollector } from '../../shared/src/performance/metrics-collector';

import { LazyPluginLoader, PluginPriority } from './loaders/lazy-plugin-loader';
import { FastManifestParser } from './parsers/fast-manifest-parser';
import { PermissionManager } from './security/permission-manager';
import type { PluginManifest, PluginInstance, PluginLoadResult } from './types/plugin';
import { OptimizedPluginWatcher } from './watcher/optimized-plugin-watcher';
import { PluginWorkerPool } from './workers/plugin-worker-pool';

const readFileAsync = promisify(readFile);

export interface OptimizedPluginManagerOptions {
  pluginDirectory: string;
  workerPool?: {
    minWorkers?: number;
    maxWorkers?: number;
    workerIdleTimeout?: number;
    recycleAfterOperations?: number;
  };
  watcher?: {
    debounceMs?: number;
    manifestOnly?: boolean;
    useNativeEvents?: boolean;
  };
  loader?: {
    preloadQueue?: string[];
    priorityMap?: Map<string, PluginPriority>;
    maxConcurrentLoads?: number;
    enableBinaryManifests?: boolean;
  };
  security?: {
    enableSignatureValidation?: boolean;
    maxPluginSize?: number;
  };
  performance?: {
    manifestCacheSize?: number;
    enableMessagePack?: boolean;
    enableCompression?: boolean;
    workerThreadPriority?: number;
  };
}

interface PluginRegistry {
  [pluginName: string]: {
    instance: PluginInstance;
    metadata: {
      loadedAt: Date;
      lastAccessed: Date;
      accessCount: number;
      errors: Array<{ timestamp: Date; error: string }>;
      performanceMetrics: {
        loadTime: number;
        messagePassingTime: number[];
        memoryUsage: number;
      };
    };
  };
}

// Optimized manifest cache with checksum validation
class ManifestCache {
  private cache: LRUCache<string, { manifest: PluginManifest; checksum: string; parsedAt: number }>;
  private checksums = new Map<string, string>();

  constructor(maxSize: number = 100) {
    this.cache = new LRUCache(maxSize);
  }

  async get(manifestPath: string): Promise<PluginManifest | null> {
    const cached = this.cache.get(manifestPath);
    if (!cached) {return null;}

    // Validate checksum
    const currentChecksum = await this.calculateChecksum(manifestPath);
    if (currentChecksum !== cached.checksum) {
      this.cache.delete(manifestPath);
      return null;
    }

    return cached.manifest;
  }

  async set(manifestPath: string, manifest: PluginManifest): Promise<void> {
    const checksum = await this.calculateChecksum(manifestPath);
    this.cache.set(manifestPath, {
      manifest,
      checksum,
      parsedAt: Date.now()
    });
  }

  private async calculateChecksum(filepath: string): Promise<string> {
    const content = await readFileAsync(filepath);
    return createHash('sha256').update(content).digest('hex');
  }

  getStats() {
    return {
      size: this.cache.size,
      hitRate: this.cache.getHitRate(),
      missRate: this.cache.getMissRate()
    };
  }

  clear() {
    this.cache.clear();
  }
}

export class OptimizedPluginManager extends EventEmitter {
  private pluginDirectory: string;
  private workerPool: PluginWorkerPool;
  private watcher: OptimizedPluginWatcher;
  private manifestParser: FastManifestParser;
  private lazyLoader: LazyPluginLoader;
  private registry: PluginRegistry = {};
  private options: OptimizedPluginManagerOptions;
  private isStarted = false;

  // Performance optimizations
  private manifestCache: ManifestCache;
  private metrics: MetricsCollector;
  private messagePackEnabled: boolean;

  // Pre-warmed worker pool
  private workerWarmupPromise?: Promise<void>;

  // Parallel initialization tracking
  private initializationTasks = new Map<string, Promise<void>>();

  constructor(options: OptimizedPluginManagerOptions) {
    super();
    this.options = options;
    this.pluginDirectory = options.pluginDirectory;

    // Initialize metrics
    this.metrics = new MetricsCollector('plugin-manager');

    // Initialize manifest cache
    this.manifestCache = new ManifestCache(options.performance?.manifestCacheSize);

    // Enable MessagePack if specified
    this.messagePackEnabled = options.performance?.enableMessagePack !== false;

    // Initialize components with optimized settings
    this.initializeComponents();

    // Pre-warm worker pool in background
    this.workerWarmupPromise = this.preWarmWorkerPool();
  }

  private initializeComponents(): void {
    // Initialize worker pool with optimized settings
    const workerPoolOptions = {
      ...this.options.workerPool,
      minWorkers: this.options.workerPool?.minWorkers || 2,
      maxWorkers: this.options.workerPool?.maxWorkers || 8,
      workerIdleTimeout: this.options.workerPool?.workerIdleTimeout || 30000,
      recycleAfterOperations: this.options.workerPool?.recycleAfterOperations || 100,
      workerThreadPriority: this.options.performance?.workerThreadPriority
    };

    this.workerPool = new PluginWorkerPool(workerPoolOptions);

    // Initialize watcher with native events
    const watcherOptions = {
      ...this.options.watcher,
      useNativeEvents: this.options.watcher?.useNativeEvents !== false,
      debounceMs: this.options.watcher?.debounceMs || 100
    };

    this.watcher = new OptimizedPluginWatcher(watcherOptions);

    // Initialize manifest parser
    this.manifestParser = FastManifestParser.getInstance();

    // Initialize lazy loader with optimizations
    this.lazyLoader = new LazyPluginLoader(this.workerPool, {
      ...this.options.loader,
      maxConcurrentLoads: this.options.loader?.maxConcurrentLoads || 5
    });

    this.setupEventHandlers();
  }

  private async preWarmWorkerPool(): Promise<void> {
    console.log('Pre-warming worker pool...');
    const startTime = performance.now();

    try {
      // Start minimum workers
      const minWorkers = this.options.workerPool?.minWorkers || 2;
      const warmupPromises = [];

      for (let i = 0; i < minWorkers; i++) {
        warmupPromises.push(this.workerPool.createWorker());
      }

      await Promise.all(warmupPromises);

      const warmupTime = performance.now() - startTime;
      console.log(`Worker pool warmed up in ${warmupTime.toFixed(2)}ms`);
      this.metrics.recordHistogram('worker_warmup_time', warmupTime);
    } catch (error) {
      console.error('Failed to pre-warm worker pool:', error);
    }
  }

  private setupEventHandlers(): void {
    // Worker pool events
    this.workerPool.on('worker:created', (data) => {
      this.metrics.incrementCounter('workers_created');
      this.emit('worker:created', data);
    });

    this.workerPool.on('worker:terminated', (data) => {
      this.metrics.incrementCounter('workers_terminated');
      this.emit('worker:terminated', data);
    });

    this.workerPool.on('worker:error', (data) => {
      this.metrics.incrementCounter('worker_errors');
      this.handleWorkerError(data);
    });

    // Watcher events with performance tracking
    this.watcher.on('plugin:added', async (data) => {
      const startTime = performance.now();
      await this.handlePluginAdded(data);
      this.metrics.recordHistogram('plugin_add_time', performance.now() - startTime);
    });

    this.watcher.on('plugin:changed', async (data) => {
      const startTime = performance.now();
      await this.handlePluginChanged(data);
      this.metrics.recordHistogram('plugin_change_time', performance.now() - startTime);
    });

    this.watcher.on('plugin:removed', async (data) => {
      const startTime = performance.now();
      await this.handlePluginRemoved(data);
      this.metrics.recordHistogram('plugin_remove_time', performance.now() - startTime);
    });

    // Loader events
    this.lazyLoader.on('plugin:loaded', (data) => {
      this.metrics.recordHistogram('plugin_load_time', data.loadTime);
      this.emit('plugin:loaded', data);
    });

    this.lazyLoader.on('plugin:load-failed', (data) => {
      this.metrics.incrementCounter('plugin_load_failures');
      this.handlePluginLoadFailed(data);
    });
  }

  async start(): Promise<void> {
    if (this.isStarted) {
      throw new Error('Plugin manager already started');
    }

    const startTime = performance.now();
    console.log('Starting Optimized Plugin Manager...');

    // Wait for worker pool warmup
    if (this.workerWarmupPromise) {
      await this.workerWarmupPromise;
    }

    // Start components in parallel
    const startPromises = [
      this.workerPool.start(),
      this.lazyLoader.initialize()
    ];

    await Promise.all(startPromises);

    // Scan for existing plugins in parallel with watching
    const scanPromise = this.scanPluginsOptimized();
    const watchPromise = this.watcher.watch(this.pluginDirectory);

    await Promise.all([scanPromise, watchPromise]);

    this.isStarted = true;

    const totalStartTime = performance.now() - startTime;
    console.log(`Optimized Plugin Manager started in ${totalStartTime.toFixed(2)}ms`);
    this.metrics.recordHistogram('manager_start_time', totalStartTime);
    this.emit('manager:started');
  }

  async stop(): Promise<void> {
    if (!this.isStarted) {
      return;
    }

    const stopTime = performance.now();
    console.log('Stopping Optimized Plugin Manager...');

    // Stop watching first to prevent new events
    await this.watcher.stop();

    // Unload all plugins in parallel batches
    const pluginNames = Object.keys(this.registry);
    const batchSize = 10;

    for (let i = 0; i < pluginNames.length; i += batchSize) {
      const batch = pluginNames.slice(i, i + batchSize);
      await Promise.all(batch.map(name => this.unloadPlugin(name).catch(console.error)));
    }

    // Stop worker pool
    await this.workerPool.stop();

    // Clear caches
    this.manifestCache.clear();

    this.isStarted = false;

    const totalStopTime = performance.now() - stopTime;
    console.log(`Optimized Plugin Manager stopped in ${totalStopTime.toFixed(2)}ms`);
    this.metrics.recordHistogram('manager_stop_time', totalStopTime);
    this.emit('manager:stopped');
  }

  private async scanPluginsOptimized(): Promise<void> {
    if (!existsSync(this.pluginDirectory)) {
      console.warn(`Plugin directory ${this.pluginDirectory} does not exist`);
      return;
    }

    const scanStart = performance.now();
    const entries = readdirSync(this.pluginDirectory, { withFileTypes: true });
    const _scanPromises: Promise<void>[] = [];

    // Group plugins by priority for optimized loading
    const priorityGroups = new Map<PluginPriority, Array<{ path: string; manifestPath: string }>>();

    for (const entry of entries) {
      if (entry.isDirectory()) {
        const pluginPath = join(this.pluginDirectory, entry.name);
        const manifestPath = join(pluginPath, 'autoweave.plugin.json');

        if (existsSync(manifestPath)) {
          // Quick priority check from options
          const priority = this.options.loader?.priorityMap?.get(entry.name) ||
                          (this.options.loader?.preloadQueue?.includes(entry.name)
                            ? PluginPriority.HIGH
                            : PluginPriority.NORMAL);

          if (!priorityGroups.has(priority)) {
            priorityGroups.set(priority, []);
          }

          priorityGroups.get(priority)!.push({ path: pluginPath, manifestPath });
        }
      }
    }

    // Load plugins by priority groups
    const sortedPriorities = Array.from(priorityGroups.keys()).sort((a, b) => a - b);

    for (const priority of sortedPriorities) {
      const plugins = priorityGroups.get(priority)!;
      const groupPromises = plugins.map(({ path, manifestPath }) =>
        this.loadPluginFromPathOptimized(path, manifestPath)
      );

      // Load priority group in parallel
      await Promise.all(groupPromises);
    }

    const scanTime = performance.now() - scanStart;
    console.log(`Plugin scan completed in ${scanTime.toFixed(2)}ms`);
    this.metrics.recordHistogram('plugin_scan_time', scanTime);
  }

  private async loadPluginFromPathOptimized(
    pluginPath: string,
    manifestPath: string
  ): Promise<void> {
    // Check if already loading
    const loadingKey = `${pluginPath}:loading`;
    if (this.initializationTasks.has(loadingKey)) {
      return this.initializationTasks.get(loadingKey)!;
    }

    const loadPromise = this._loadPluginFromPathOptimized(pluginPath, manifestPath);
    this.initializationTasks.set(loadingKey, loadPromise);

    try {
      await loadPromise;
    } finally {
      this.initializationTasks.delete(loadingKey);
    }
  }

  private async _loadPluginFromPathOptimized(
    pluginPath: string,
    manifestPath: string
  ): Promise<void> {
    try {
      const loadStart = performance.now();

      // Try cache first
      let manifest = await this.manifestCache.get(manifestPath);

      if (!manifest) {
        // Parse manifest with optimizations
        const parseResult = await this.parseManifestOptimized(manifestPath);

        if (!parseResult.valid || !parseResult.manifest) {
          console.error(`Invalid manifest at ${manifestPath}:`, parseResult.errors);
          return;
        }

        manifest = parseResult.manifest;

        // Cache the parsed manifest
        await this.manifestCache.set(manifestPath, manifest);
      }

      // Validate permissions in parallel with priority check
      const [permissionErrors, priority] = await Promise.all([
        Promise.resolve(PermissionManager.validatePermissions(manifest.permissions)),
        Promise.resolve(
          this.options.loader?.priorityMap?.get(manifest.name) ||
          (this.options.loader?.preloadQueue?.includes(manifest.name)
            ? PluginPriority.HIGH
            : PluginPriority.NORMAL)
        )
      ]);

      if (permissionErrors.length > 0) {
        console.error(`Permission errors for ${manifest.name}:`, permissionErrors);
        return;
      }

      // Create lazy proxy or load immediately based on priority
      if (priority <= PluginPriority.HIGH) {
        // Load immediately for high priority plugins
        const instance = await this.lazyLoader.loadPlugin(manifest, pluginPath, priority);
        this.registerPlugin(instance);
      } else {
        // Create lazy proxy for lower priority plugins
        const proxy = this.lazyLoader.createLazyProxy(manifest, pluginPath);
        this.registerPlugin(proxy);
      }

      const loadTime = performance.now() - loadStart;
      this.metrics.recordHistogram('individual_plugin_load_time', loadTime);

    } catch (error) {
      console.error(`Failed to load plugin from ${pluginPath}:`, error);
      this.metrics.incrementCounter('plugin_load_errors');
      this.emit('plugin:error', { pluginPath, error });
    }
  }

  private async parseManifestOptimized(manifestPath: string): Promise<any> {
    const parseStart = performance.now();

    try {
      // Check for binary manifest first
      const binaryPath = manifestPath.replace('.json', '.msgpack');
      if (this.options.loader?.enableBinaryManifests && existsSync(binaryPath)) {
        const buffer = await readFileAsync(binaryPath);
        const manifest = JSON.parse(buffer.toString());

        this.metrics.recordHistogram('binary_manifest_parse_time', performance.now() - parseStart);
        return { valid: true, manifest };
      }

      // Fall back to JSON parsing
      const result = await this.manifestParser.parseManifest(manifestPath);

      this.metrics.recordHistogram('json_manifest_parse_time', performance.now() - parseStart);
      return result;

    } catch (error) {
      return { valid: false, errors: [error.message] };
    }
  }

  private registerPlugin(instance: PluginInstance): void {
    this.registry[instance.manifest.name] = {
      instance,
      metadata: {
        loadedAt: new Date(),
        lastAccessed: new Date(),
        accessCount: 0,
        errors: [],
        performanceMetrics: {
          loadTime: 0,
          messagePassingTime: [],
          memoryUsage: 0
        }
      }
    };
  }

  private async handlePluginAdded(data: any): Promise<void> {
    console.log(`New plugin detected: ${data.manifest.name}`);
    await this.loadPluginFromPathOptimized(data.pluginPath, data.manifestPath);
  }

  private async handlePluginChanged(data: any): Promise<void> {
    console.log(`Plugin changed: ${data.manifest.name}`);

    // Unload existing version
    if (this.registry[data.manifest.name]) {
      await this.unloadPlugin(data.manifest.name);
    }

    // Clear from cache
    this.manifestCache.clear();

    // Reload plugin
    await this.loadPluginFromPathOptimized(data.pluginPath, data.manifestPath);
  }

  private async handlePluginRemoved(data: any): Promise<void> {
    // Find plugin by path
    for (const [name, entry] of Object.entries(this.registry)) {
      if (entry.instance.path === data.pluginPath) {
        console.log(`Plugin removed: ${name}`);
        await this.unloadPlugin(name);
        break;
      }
    }
  }

  private handleWorkerError(data: any): void {
    const { pluginId, error } = data;
    console.error(`Worker error for plugin ${pluginId}:`, error);

    // Record error in registry
    const [name] = pluginId.split('@');
    if (this.registry[name]) {
      this.registry[name].metadata.errors.push({
        timestamp: new Date(),
        error: error.message || String(error)
      });

      // Keep only last 10 errors
      if (this.registry[name].metadata.errors.length > 10) {
        this.registry[name].metadata.errors.shift();
      }
    }
  }

  private handlePluginLoadFailed(data: any): void {
    console.error(`Failed to load plugin ${data.manifest.name} after ${data.attempts} attempts`);
    this.emit('plugin:error', {
      pluginName: data.manifest.name,
      error: data.error,
      attempts: data.attempts
    });
  }

  async loadPlugin(
    manifest: PluginManifest,
    pluginPath: string,
    priority?: PluginPriority
  ): Promise<PluginLoadResult> {
    const loadStart = performance.now();

    try {
      const instance = await this.lazyLoader.loadPlugin(
        manifest,
        pluginPath,
        priority || PluginPriority.NORMAL
      );

      this.registerPlugin(instance);

      const loadTime = performance.now() - loadStart;
      if (this.registry[manifest.name]) {
        this.registry[manifest.name].metadata.performanceMetrics.loadTime = loadTime;
      }

      return { success: true, plugin: instance };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  async unloadPlugin(name: string): Promise<void> {
    const entry = this.registry[name];
    if (!entry) {
      throw new Error(`Plugin ${name} not found`);
    }

    try {
      await this.lazyLoader.unloadPlugin(name);
      delete this.registry[name];

      console.log(`Plugin ${name} unloaded successfully`);
      this.emit('plugin:unloaded', { pluginName: name });
    } catch (error) {
      console.error(`Failed to unload plugin ${name}:`, error);
      throw error;
    }
  }

  getPlugin(name: string): PluginInstance | undefined {
    const entry = this.registry[name];
    if (entry) {
      // Update access metadata
      entry.metadata.lastAccessed = new Date();
      entry.metadata.accessCount++;

      return entry.instance;
    }
    return undefined;
  }

  getLoadedPlugins(): PluginInstance[] {
    return Object.values(this.registry).map(entry => entry.instance);
  }

  sendUSBEventToPlugins(eventType: 'attach' | 'detach', deviceInfo: any): void {
    const sendStart = performance.now();
    const eligiblePlugins = [];

    // Pre-filter eligible plugins
    for (const entry of Object.values(this.registry)) {
      const { instance } = entry;

      // Check permissions and hooks
      const hasUSBPermission = instance.manifest.permissions.usb;
      const hasHook = eventType === 'attach'
        ? instance.manifest.hooks.onUSBAttach
        : instance.manifest.hooks.onUSBDetach;

      if (hasUSBPermission && hasHook && instance.worker) {
        // Validate device access
        const { allowed, reason } = PermissionManager.checkUSBAccess(
          deviceInfo.vendorId,
          deviceInfo.productId,
          instance.manifest.permissions
        );

        if (allowed) {
          eligiblePlugins.push({ instance, entry });
        } else {
          console.warn(`USB access denied for ${instance.manifest.name}: ${reason}`);
        }
      }
    }

    // Send events in parallel with MessagePack optimization
    const eventData = this.messagePackEnabled
      ? Buffer.from(JSON.stringify({ type: eventType, device: deviceInfo }))
      : { type: eventType, device: deviceInfo };

    const sendPromises = eligiblePlugins.map(({ instance, entry }) =>
      instance.worker.sendUSBEvent(eventType, eventData)
        .then(() => {
          // Track message passing time
          const messageTime = performance.now() - sendStart;
          entry.metadata.performanceMetrics.messagePassingTime.push(messageTime);

          // Keep only last 100 samples
          if (entry.metadata.performanceMetrics.messagePassingTime.length > 100) {
            entry.metadata.performanceMetrics.messagePassingTime.shift();
          }
        })
        .catch(error => {
          console.error(`Error sending USB event to ${instance.manifest.name}:`, error);
          this.metrics.incrementCounter('usb_event_send_errors');
        })
    );

    Promise.all(sendPromises).then(() => {
      const totalTime = performance.now() - sendStart;
      this.metrics.recordHistogram('usb_event_broadcast_time', totalTime);
    });
  }

  sendJobToPlugin(pluginName: string, jobData: any): void {
    const entry = this.registry[pluginName];
    if (entry?.instance.worker) {
      const sendStart = performance.now();

      // Optimize job data with MessagePack
      const optimizedData = this.messagePackEnabled
        ? Buffer.from(JSON.stringify(jobData))
        : jobData;

      entry.instance.worker.sendJob(optimizedData)
        .then(() => {
          const sendTime = performance.now() - sendStart;
          entry.metadata.performanceMetrics.messagePassingTime.push(sendTime);
          this.metrics.recordHistogram('job_send_time', sendTime);
        })
        .catch(error => {
          console.error(`Error sending job to ${pluginName}:`, error);
          this.metrics.incrementCounter('job_send_errors');
        });
    }
  }

  getManagerStats(): {
    plugins: {
      total: number;
      loaded: number;
      errors: number;
    };
    workers: ReturnType<PluginWorkerPool['getPoolStats']>;
    watcher: ReturnType<OptimizedPluginWatcher['getStats']>;
    loader: ReturnType<LazyPluginLoader['getMetrics']>;
    cache: ReturnType<ManifestCache['getStats']>;
    performance: {
      averageLoadTime: number;
      averageMessageTime: number;
      cacheHitRate: number;
    };
    metrics: any;
  } {
    const pluginsWithErrors = Object.values(this.registry)
      .filter(entry => entry.metadata.errors.length > 0).length;

    // Calculate performance averages
    let totalLoadTime = 0;
    let loadCount = 0;
    let totalMessageTime = 0;
    let messageCount = 0;

    for (const entry of Object.values(this.registry)) {
      const metrics = entry.metadata.performanceMetrics;
      if (metrics.loadTime > 0) {
        totalLoadTime += metrics.loadTime;
        loadCount++;
      }
      if (metrics.messagePassingTime.length > 0) {
        const avgMessage = metrics.messagePassingTime.reduce((a, b) => a + b, 0) / metrics.messagePassingTime.length;
        totalMessageTime += avgMessage;
        messageCount++;
      }
    }

    return {
      plugins: {
        total: Object.keys(this.registry).length,
        loaded: this.lazyLoader.getAllLoadedPlugins().length,
        errors: pluginsWithErrors
      },
      workers: this.workerPool.getPoolStats(),
      watcher: this.watcher.getStats(),
      loader: this.lazyLoader.getMetrics(),
      cache: this.manifestCache.getStats(),
      performance: {
        averageLoadTime: loadCount > 0 ? totalLoadTime / loadCount : 0,
        averageMessageTime: messageCount > 0 ? totalMessageTime / messageCount : 0,
        cacheHitRate: this.manifestCache.getStats().hitRate
      },
      metrics: this.metrics.getAll()
    };
  }

  getPluginMetadata(name: string): any {
    const entry = this.registry[name];
    if (!entry) {
      return null;
    }

    return {
      ...entry.metadata,
      workerMetrics: entry.instance.worker
        ? this.workerPool.getWorkerMetrics(entry.instance.manifest)
        : null
    };
  }

  setPriority(pluginName: string, priority: PluginPriority): void {
    this.lazyLoader.setPriority(pluginName, priority);
  }

  clearCaches(): void {
    this.manifestCache.clear();
    this.manifestParser.clearCache();
    console.log('Caches cleared');
  }

  getMetrics() {
    return this.metrics.getAll();
  }
}