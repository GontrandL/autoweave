// @ts-ignore
import * as usb from 'usb';
import { EventEmitter } from 'events';
import { USBDeviceInfo, USBDaemonConfig } from './types';
import { USBEventDebouncer } from './core/event-debouncer';
import { OptimizedDeviceExtractor } from './core/device-extractor';
import { BatchRedisPublisher } from './events/batch-publisher';
import { USBDaemonMemoryManager } from './core/memory-manager';
import { EnhancedPlatformDetector } from './platform/enhanced-platform';
import { HealthCheckServer } from './monitoring/health-check';
import { ConfigValidator } from './config/validator';
import { ObjectPool } from '../../shared/src/performance/object-pool';
import { MetricsCollector } from '../../shared/src/performance/metrics-collector';
import { Worker } from 'worker_threads';
import { performance } from 'perf_hooks';

interface OptimizedDaemonStats {
  isRunning: boolean;
  startTime: number;
  platform: any;
  devices: {
    connected: number;
    totalAttached: number;
    totalDetached: number;
  };
  events: {
    queueSize: number;
    eventsPerSecond: number;
    totalProcessed: number;
    latencyP50: number;
    latencyP95: number;
    latencyP99: number;
  };
  memory: any;
  redis: {
    connected: boolean;
    queueSize: number;
    totalPublished: number;
    pipelineSize: number;
  };
  performance: {
    eventProcessingTime: number;
    deviceExtractionTime: number;
    redisPublishTime: number;
  };
}

// Ring buffer for zero-allocation event queuing
class RingBuffer<T> {
  private buffer: (T | null)[];
  private writeIndex = 0;
  private readIndex = 0;
  private size = 0;

  constructor(private capacity: number) {
    this.buffer = new Array(capacity).fill(null);
  }

  push(item: T): boolean {
    if (this.size >= this.capacity) return false;
    
    this.buffer[this.writeIndex] = item;
    this.writeIndex = (this.writeIndex + 1) % this.capacity;
    this.size++;
    return true;
  }

  pop(): T | null {
    if (this.size === 0) return null;
    
    const item = this.buffer[this.readIndex];
    this.buffer[this.readIndex] = null;
    this.readIndex = (this.readIndex + 1) % this.capacity;
    this.size--;
    return item;
  }

  getSize(): number {
    return this.size;
  }

  clear(): void {
    this.buffer.fill(null);
    this.writeIndex = 0;
    this.readIndex = 0;
    this.size = 0;
  }
}

export class OptimizedUSBDaemon extends EventEmitter {
  private isRunning = false;
  private startTime = 0;
  private connectedDevices = new Map<string, USBDeviceInfo>();
  
  // Core components
  private eventDebouncer: USBEventDebouncer;
  private deviceExtractor: OptimizedDeviceExtractor;
  private batchPublisher: BatchRedisPublisher;
  private memoryManager: USBDaemonMemoryManager;
  private healthServer?: HealthCheckServer;
  private metrics: MetricsCollector;
  
  // Platform info
  private platformInfo = EnhancedPlatformDetector.detect();
  private platformConfig: any;
  
  // Object pools
  private deviceInfoPool: ObjectPool<USBDeviceInfo>;
  private eventPool: ObjectPool<any>;
  
  // Ring buffers for events
  private attachEventBuffer: RingBuffer<USBDeviceInfo>;
  private detachEventBuffer: RingBuffer<USBDeviceInfo>;
  
  // Worker for background processing
  private extractionWorker?: Worker;
  private workerMessageId = 0;
  private workerCallbacks = new Map<number, (result: any) => void>();
  
  // Performance tracking
  private eventLatencies: number[] = [];
  private maxLatencySamples = 1000;
  
  // Stats tracking
  private stats = {
    totalAttached: 0,
    totalDetached: 0,
    totalEvents: 0
  };

  // Graceful shutdown
  private shutdownHandlers: Array<() => Promise<void>> = [];
  private isShuttingDown = false;
  private shutdownTimeout = 5000; // 5 second max shutdown time

  constructor(private config: USBDaemonConfig) {
    super();
    
    // Validate configuration
    ConfigValidator.validateAndThrow(config);
    
    // Get platform-optimized config
    this.platformConfig = EnhancedPlatformDetector.getOptimizedConfig(this.platformInfo);
    
    // Initialize components
    this.initializeComponents();
    
    // Setup event handlers
    this.setupEventHandlers();
    
    // Setup graceful shutdown
    this.setupGracefulShutdown();
  }

  private initializeComponents(): void {
    // Initialize metrics collector
    this.metrics = new MetricsCollector('usb-daemon');
    
    // Initialize memory manager with optimized settings
    this.memoryManager = new USBDaemonMemoryManager();
    this.memoryManager.registerCache('devices');
    this.memoryManager.registerCache('extraction');
    
    // Initialize object pools
    this.deviceInfoPool = new ObjectPool<USBDeviceInfo>(
      () => this.createEmptyDeviceInfo(),
      (obj) => this.resetDeviceInfo(obj),
      100 // max pool size
    );
    
    this.eventPool = new ObjectPool<any>(
      () => ({}),
      (obj) => { for (const key in obj) delete obj[key]; },
      200
    );
    
    // Initialize ring buffers
    const bufferSize = this.config.performance?.event_buffer_size || 1000;
    this.attachEventBuffer = new RingBuffer(bufferSize);
    this.detachEventBuffer = new RingBuffer(bufferSize);
    
    // Initialize device extractor with caching
    this.deviceExtractor = new OptimizedDeviceExtractor();
    
    // Initialize optimized event debouncer
    this.eventDebouncer = new USBEventDebouncer(
      this.config.performance?.debounce_ms || this.platformConfig.performance.debounce_ms,
      this.config.performance?.max_events_per_second || this.platformConfig.performance.max_events_per_second,
      this.config.performance?.batch_size || this.platformConfig.performance.batch_size
    );
    
    // Initialize batch publisher with pipelining
    this.batchPublisher = new BatchRedisPublisher(
      this.config.redis,
      this.config.performance?.batch_size || this.platformConfig.performance.batch_size
    );
    
    // Initialize health check server if monitoring enabled
    if (this.config.monitoring?.enabled) {
      this.healthServer = new HealthCheckServer(
        this as any,
        this.config.monitoring.healthcheck_port
      );
    }
    
    // Initialize extraction worker for background processing
    this.initializeExtractionWorker();
  }

  private initializeExtractionWorker(): void {
    // Create worker for CPU-intensive device extraction
    this.extractionWorker = new Worker(`
      const { parentPort } = require('worker_threads');
      
      parentPort.on('message', async ({ id, type, data }) => {
        try {
          let result;
          switch (type) {
            case 'extract':
              // Simulate extraction (in real implementation, use actual extraction logic)
              result = {
                vendorId: data.vendorId,
                productId: data.productId,
                signature: \`\${data.vendorId}:\${data.productId}\`,
                // ... other fields
              };
              break;
          }
          parentPort.postMessage({ id, success: true, result });
        } catch (error) {
          parentPort.postMessage({ id, success: false, error: error.message });
        }
      });
    `, { eval: true });
    
    this.extractionWorker.on('message', ({ id, success, result, error }) => {
      const callback = this.workerCallbacks.get(id);
      if (callback) {
        this.workerCallbacks.delete(id);
        callback(success ? result : new Error(error));
      }
    });
  }

  private async extractDeviceInfoAsync(device: usb.Device): Promise<USBDeviceInfo> {
    return new Promise((resolve, reject) => {
      const id = this.workerMessageId++;
      this.workerCallbacks.set(id, (result) => {
        if (result instanceof Error) reject(result);
        else resolve(result);
      });
      
      this.extractionWorker?.postMessage({
        id,
        type: 'extract',
        data: {
          vendorId: device.deviceDescriptor.idVendor,
          productId: device.deviceDescriptor.idProduct,
          busNumber: device.busNumber,
          deviceAddress: device.deviceAddress
        }
      });
    });
  }

  private createEmptyDeviceInfo(): USBDeviceInfo {
    return {
      vendorId: 0,
      productId: 0,
      vendorName: '',
      productName: '',
      manufacturer: '',
      serialNumber: '',
      deviceDescriptor: {} as any,
      signature: '',
      busNumber: 0,
      deviceAddress: 0,
      deviceClass: 0,
      deviceSubclass: 0,
      deviceProtocol: 0
    };
  }

  private resetDeviceInfo(info: USBDeviceInfo): void {
    info.vendorId = 0;
    info.productId = 0;
    info.vendorName = '';
    info.productName = '';
    info.manufacturer = '';
    info.serialNumber = '';
    info.signature = '';
    info.busNumber = 0;
    info.deviceAddress = 0;
    info.deviceClass = 0;
    info.deviceSubclass = 0;
    info.deviceProtocol = 0;
  }

  private setupEventHandlers(): void {
    // USB event handlers with performance tracking
    usb.on('attach', (device) => {
      const startTime = performance.now();
      this.handleDeviceAttach(device).then(() => {
        this.trackEventLatency(performance.now() - startTime);
      });
    });
    
    usb.on('detach', (device) => {
      const startTime = performance.now();
      this.handleDeviceDetach(device).then(() => {
        this.trackEventLatency(performance.now() - startTime);
      });
    });
    
    usb.on('error', this.handleUSBError.bind(this));
    
    // Optimized batch processing
    this.eventDebouncer.on('batch', async (batch) => {
      const startTime = performance.now();
      await this.processBatchOptimized(batch);
      this.metrics.recordHistogram('batch_processing_time', performance.now() - startTime);
    });
    
    // Memory manager handlers
    this.memoryManager.on('memory-warning', (stats) => {
      console.warn('Memory warning:', stats);
      this.emit('memory-warning', stats);
      // Trigger aggressive GC
      if (global.gc) global.gc();
    });
    
    this.memoryManager.on('memory-critical', (stats) => {
      console.error('Memory critical:', stats);
      this.emit('memory-critical', stats);
      // Force cleanup and reduce caches
      this.memoryManager.forceCleanup();
      this.deviceExtractor.reduceCacheSize();
    });
    
    // Publisher handlers with backpressure management
    this.batchPublisher.on('error', (error) => {
      console.error('Publisher error:', error);
      this.metrics.incrementCounter('publisher_errors');
      this.emit('publisher-error', error);
    });
    
    this.batchPublisher.on('backpressure', (length) => {
      console.warn(`Redis backpressure: ${length} messages`);
      this.metrics.recordGauge('redis_backpressure', length);
      // Slow down event processing
      this.eventDebouncer.increaseDebounce();
    });
  }

  private async handleDeviceAttach(device: usb.Device): Promise<void> {
    try {
      // Get device info from pool
      const deviceInfo = this.deviceInfoPool.acquire();
      
      // Quick signature check first
      const quickSignature = `${device.deviceDescriptor.idVendor}:${device.deviceDescriptor.idProduct}`;
      
      // Check if already connected
      if (this.connectedDevices.has(quickSignature)) {
        this.deviceInfoPool.release(deviceInfo);
        return;
      }
      
      // Extract device info asynchronously
      const extractedInfo = await this.extractDeviceInfoAsync(device);
      Object.assign(deviceInfo, extractedInfo);
      
      // Apply device filters
      if (!this.passesFilters(deviceInfo)) {
        console.log(`Device filtered out: ${deviceInfo.vendorId}:${deviceInfo.productId}`);
        this.deviceInfoPool.release(deviceInfo);
        return;
      }
      
      // Store device with memory management
      this.connectedDevices.set(deviceInfo.signature, deviceInfo);
      this.memoryManager.cacheObject('devices', deviceInfo.signature, deviceInfo, 1024);
      
      // Update stats
      this.stats.totalAttached++;
      this.stats.totalEvents++;
      this.metrics.incrementCounter('devices_attached');
      
      // Add to ring buffer for batch processing
      if (!this.attachEventBuffer.push(deviceInfo)) {
        console.warn('Attach event buffer full, processing immediately');
        this.eventDebouncer.forceFlush();
      }
      
      // Send to debouncer
      this.eventDebouncer.debounceEvent('attach', deviceInfo);
      
      // Emit local event
      this.emit('device:attach', deviceInfo);
      
    } catch (error) {
      this.handleUSBError(error as Error, 'attach');
    }
  }

  private async handleDeviceDetach(device: usb.Device): Promise<void> {
    try {
      // Try to get from cache first using optimized key
      const cacheKey = `${device.deviceDescriptor.idVendor}:${device.deviceDescriptor.idProduct}:${device.busNumber}:${device.deviceAddress}`;
      let deviceInfo = this.memoryManager.getCachedObject<USBDeviceInfo>('extraction', cacheKey);
      
      if (!deviceInfo) {
        // Extract minimal info for detach
        deviceInfo = await this.extractDeviceInfoAsync(device);
      }
      
      // Find and remove device
      const signature = deviceInfo.signature;
      const storedDevice = this.connectedDevices.get(signature);
      
      if (!storedDevice) {
        return; // Device was not tracked
      }
      
      this.connectedDevices.delete(signature);
      this.memoryManager.removeCachedObject('devices', signature);
      
      // Update stats
      this.stats.totalDetached++;
      this.stats.totalEvents++;
      this.metrics.incrementCounter('devices_detached');
      
      // Add to ring buffer
      if (!this.detachEventBuffer.push(storedDevice)) {
        console.warn('Detach event buffer full, processing immediately');
        this.eventDebouncer.forceFlush();
      }
      
      // Send to debouncer
      this.eventDebouncer.debounceEvent('detach', storedDevice);
      
      // Emit local event
      this.emit('device:detach', storedDevice);
      
      // Return device info to pool
      if (deviceInfo !== storedDevice) {
        this.deviceInfoPool.release(deviceInfo);
      }
      
    } catch (error) {
      this.handleUSBError(error as Error, 'detach');
    }
  }

  private async processBatchOptimized(batch: any[]): Promise<void> {
    try {
      // Use Redis pipeline for batch publishing
      const pipeline = this.batchPublisher.createPipeline();
      
      for (const event of batch) {
        pipeline.publish(event.action, event.deviceInfo);
      }
      
      // Execute pipeline
      const startTime = performance.now();
      await pipeline.exec();
      const publishTime = performance.now() - startTime;
      
      this.metrics.recordHistogram('redis_publish_time', publishTime);
      this.metrics.incrementCounter('events_published', batch.length);
      
      console.log(`Processed batch of ${batch.length} events in ${publishTime.toFixed(2)}ms`);
    } catch (error) {
      console.error('Failed to process event batch:', error);
      this.metrics.incrementCounter('batch_errors');
      this.emit('batch-error', error);
    }
  }

  private trackEventLatency(latency: number): void {
    this.eventLatencies.push(latency);
    if (this.eventLatencies.length > this.maxLatencySamples) {
      this.eventLatencies.shift();
    }
    this.metrics.recordHistogram('event_latency', latency);
  }

  private calculateLatencyPercentiles(): { p50: number; p95: number; p99: number } {
    if (this.eventLatencies.length === 0) {
      return { p50: 0, p95: 0, p99: 0 };
    }
    
    const sorted = [...this.eventLatencies].sort((a, b) => a - b);
    const p50Index = Math.floor(sorted.length * 0.5);
    const p95Index = Math.floor(sorted.length * 0.95);
    const p99Index = Math.floor(sorted.length * 0.99);
    
    return {
      p50: sorted[p50Index] || 0,
      p95: sorted[p95Index] || 0,
      p99: sorted[p99Index] || 0
    };
  }

  private passesFilters(deviceInfo: USBDeviceInfo): boolean {
    const filters = this.config.filters;
    if (!filters) return true;
    
    // Check vendor whitelist
    if (filters.vendor_whitelist && filters.vendor_whitelist.length > 0) {
      if (!filters.vendor_whitelist.includes(deviceInfo.vendorId)) {
        return false;
      }
    }
    
    // Check vendor blacklist
    if (filters.vendor_blacklist && filters.vendor_blacklist.length > 0) {
      if (filters.vendor_blacklist.includes(deviceInfo.vendorId)) {
        return false;
      }
    }
    
    // Check device class filter
    if (filters.device_class_filter && filters.device_class_filter.length > 0) {
      const deviceClass = deviceInfo.deviceDescriptor.bDeviceClass;
      if (!filters.device_class_filter.includes(deviceClass)) {
        return false;
      }
    }
    
    return true;
  }

  private handleUSBError(error: Error, context?: string): void {
    console.error(`USB Daemon error${context ? ` (${context})` : ''}:`, error);
    this.metrics.incrementCounter('usb_errors');
    this.emit('error', error, context);
  }

  async start(): Promise<void> {
    if (this.isRunning) return;
    
    const startBegin = performance.now();
    
    console.log('Starting Optimized USB Daemon...');
    console.log('Platform:', this.platformInfo);
    console.log('Recommended strategy:', this.platformInfo.capabilities.recommendedStrategy);
    
    try {
      // Platform-specific initialization
      if (this.platformInfo.isWindows) {
        usb.useUsbDkBackend();
      }
      
      // Start components in parallel
      const startPromises = [];
      
      // Start health server
      if (this.healthServer) {
        startPromises.push(this.healthServer.start());
      }
      
      // Pre-warm Redis connection
      startPromises.push(this.batchPublisher.connect());
      
      // Wait for parallel starts
      await Promise.all(startPromises);
      
      // Scan existing devices in background
      this.scanExistingDevices().catch(console.error);
      
      this.isRunning = true;
      this.startTime = Date.now();
      
      const startupTime = performance.now() - startBegin;
      console.log(`Optimized USB Daemon started successfully in ${startupTime.toFixed(2)}ms`);
      this.metrics.recordHistogram('startup_time', startupTime);
      this.emit('started');
      
    } catch (error) {
      console.error('Failed to start USB daemon:', error);
      throw error;
    }
  }

  async stop(): Promise<void> {
    if (!this.isRunning || this.isShuttingDown) return;
    
    const shutdownStart = performance.now();
    
    console.log('Stopping Optimized USB Daemon...');
    this.isShuttingDown = true;
    this.isRunning = false;
    
    // Set shutdown timeout
    const shutdownTimer = setTimeout(() => {
      console.error('Shutdown timeout exceeded, forcing exit');
      process.exit(1);
    }, this.shutdownTimeout);
    
    try {
      // Run shutdown handlers in parallel with timeout
      const shutdownPromises = this.shutdownHandlers.map(handler => 
        Promise.race([
          handler(),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Handler timeout')), 1000)
          )
        ]).catch(console.error)
      );
      
      await Promise.all(shutdownPromises);
      
      // Force flush any pending events
      this.eventDebouncer.forceFlush();
      await this.batchPublisher.forceFlush();
      
      // Cleanup components in parallel
      await Promise.all([
        this.extractionWorker?.terminate(),
        this.batchPublisher.close(),
        this.healthServer?.stop()
      ]);
      
      // Cleanup remaining resources
      this.eventDebouncer.destroy();
      this.deviceExtractor.destroy();
      this.memoryManager.destroy();
      
      // Clear devices and pools
      this.connectedDevices.clear();
      this.attachEventBuffer.clear();
      this.detachEventBuffer.clear();
      
      // Remove USB listeners
      usb.removeAllListeners();
      
      clearTimeout(shutdownTimer);
      
      const shutdownTime = performance.now() - shutdownStart;
      console.log(`Optimized USB Daemon stopped in ${shutdownTime.toFixed(2)}ms`);
      this.metrics.recordHistogram('shutdown_time', shutdownTime);
      this.emit('stopped');
      
    } catch (error) {
      console.error('Error during shutdown:', error);
      clearTimeout(shutdownTimer);
      process.exit(1);
    }
  }

  private async scanExistingDevices(): Promise<void> {
    console.log('Scanning existing USB devices...');
    const scanStart = performance.now();
    const devices = usb.getDeviceList();
    
    // Process in parallel batches
    const batchSize = 10;
    let processed = 0;
    const errors = [];
    
    for (let i = 0; i < devices.length; i += batchSize) {
      const batch = devices.slice(i, i + batchSize);
      const batchPromises = batch.map(device => 
        this.handleDeviceAttach(device)
          .then(() => processed++)
          .catch(error => errors.push({ device, error }))
      );
      
      await Promise.all(batchPromises);
    }
    
    const scanTime = performance.now() - scanStart;
    console.log(`Scanned ${processed} devices in ${scanTime.toFixed(2)}ms, ${errors.length} errors`);
    this.metrics.recordHistogram('device_scan_time', scanTime);
    
    if (errors.length > 0) {
      console.warn('Errors during device scan:', errors);
    }
  }

  private setupGracefulShutdown(): void {
    const shutdownHandler = async () => {
      console.log('Received shutdown signal');
      await this.stop();
      process.exit(0);
    };
    
    process.on('SIGINT', shutdownHandler);
    process.on('SIGTERM', shutdownHandler);
    
    // Add custom shutdown handlers
    this.addShutdownHandler(async () => {
      console.log('Flushing metrics...');
      await this.metrics.flush();
    });
  }

  public addShutdownHandler(handler: () => Promise<void>): void {
    this.shutdownHandlers.push(handler);
  }

  public getStats(): OptimizedDaemonStats {
    const memStats = this.memoryManager.getMemoryStats();
    const extractorStats = this.deviceExtractor.getStats();
    const debouncerStats = this.eventDebouncer.getStats();
    const publisherStats = this.batchPublisher.getStats();
    const latencyStats = this.calculateLatencyPercentiles();
    
    return {
      isRunning: this.isRunning,
      startTime: this.startTime,
      platform: this.platformInfo,
      devices: {
        connected: this.connectedDevices.size,
        totalAttached: this.stats.totalAttached,
        totalDetached: this.stats.totalDetached
      },
      events: {
        queueSize: debouncerStats.queueSize,
        eventsPerSecond: debouncerStats.eventsPerSecond,
        totalProcessed: this.stats.totalEvents,
        latencyP50: latencyStats.p50,
        latencyP95: latencyStats.p95,
        latencyP99: latencyStats.p99
      },
      memory: {
        ...memStats,
        extractorCache: extractorStats.cacheSize,
        poolStats: {
          deviceInfoPool: this.deviceInfoPool.getStats(),
          eventPool: this.eventPool.getStats()
        }
      },
      redis: {
        connected: this.batchPublisher.isHealthy(),
        queueSize: this.batchPublisher.getQueueSize(),
        totalPublished: publisherStats.totalPublished,
        pipelineSize: publisherStats.pipelineSize || 0
      },
      performance: {
        eventProcessingTime: this.metrics.getHistogram('event_latency')?.mean || 0,
        deviceExtractionTime: extractorStats.averageExtractionTime || 0,
        redisPublishTime: this.metrics.getHistogram('redis_publish_time')?.mean || 0
      }
    };
  }

  public getConnectedDevices(): USBDeviceInfo[] {
    return Array.from(this.connectedDevices.values());
  }

  public getDeviceBySignature(signature: string): USBDeviceInfo | undefined {
    return this.connectedDevices.get(signature);
  }

  public isDeviceConnected(signature: string): boolean {
    return this.connectedDevices.has(signature);
  }

  public getPlatformInfo() {
    return this.platformInfo;
  }

  public forceGarbageCollection(): void {
    this.memoryManager.forceCleanup();
    if (global.gc) global.gc();
  }

  public getMetrics() {
    return this.metrics.getAll();
  }
}