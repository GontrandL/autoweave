// @ts-ignore
import { usb } from 'usb';
import { EventEmitter } from 'events';
import { USBDeviceInfo, USBDaemonConfig } from './types';
import { USBEventDebouncer } from './core/event-debouncer';
import { OptimizedDeviceExtractor } from './core/device-extractor';
import { BatchRedisPublisher } from './events/batch-publisher';
import { USBDaemonMemoryManager } from './core/memory-manager';
import { EnhancedPlatformDetector } from './platform/enhanced-platform';
import { HealthCheckServer } from './monitoring/health-check';
import { ConfigValidator } from './config/validator';

interface EnhancedDaemonStats {
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
  };
  memory: any;
  redis: {
    connected: boolean;
    queueSize: number;
    totalPublished: number;
  };
}

export class EnhancedUSBDaemon extends EventEmitter {
  private isRunning = false;
  private startTime = 0;
  private connectedDevices = new Map<string, USBDeviceInfo>();
  
  // Core components
  private eventDebouncer!: USBEventDebouncer;
  private deviceExtractor!: OptimizedDeviceExtractor;
  private batchPublisher!: BatchRedisPublisher;
  private memoryManager!: USBDaemonMemoryManager;
  private healthServer?: HealthCheckServer;
  
  // Platform info
  private platformInfo = EnhancedPlatformDetector.detect();
  private platformConfig: any;
  
  // Stats tracking
  private stats = {
    totalAttached: 0,
    totalDetached: 0,
    totalEvents: 0
  };

  // Graceful shutdown
  private shutdownHandlers: Array<() => Promise<void>> = [];
  private isShuttingDown = false;

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
    // Initialize memory manager
    this.memoryManager = new USBDaemonMemoryManager();
    this.memoryManager.registerCache('devices');
    this.memoryManager.registerCache('extraction');
    
    // Initialize device extractor
    this.deviceExtractor = new OptimizedDeviceExtractor();
    
    // Initialize event debouncer with platform-optimized settings
    this.eventDebouncer = new USBEventDebouncer(
      this.config.performance?.debounce_ms || this.platformConfig.performance.debounce_ms,
      this.config.performance?.max_events_per_second || this.platformConfig.performance.max_events_per_second,
      this.config.performance?.batch_size || this.platformConfig.performance.batch_size
    );
    
    // Initialize batch publisher
    this.batchPublisher = new BatchRedisPublisher(
      this.config.redis,
      this.config.performance?.batch_size || this.platformConfig.performance.batch_size
    );
    
    // Initialize health check server if monitoring enabled
    if (this.config.monitoring?.enabled) {
      this.healthServer = new HealthCheckServer(
        this as any, // Type compatibility
        this.config.monitoring.healthcheck_port
      );
    }
  }

  private setupEventHandlers(): void {
    // USB event handlers
    usb.on('attach', this.handleDeviceAttach.bind(this));
    usb.on('detach', this.handleDeviceDetach.bind(this));
    
    // Debouncer event handler
    this.eventDebouncer.on('batch', this.processBatch.bind(this));
    
    // Memory manager handlers
    this.memoryManager.on('memory-warning', (stats) => {
      console.warn('Memory warning:', stats);
      this.emit('memory-warning', stats);
    });
    
    this.memoryManager.on('memory-critical', (stats) => {
      console.error('Memory critical:', stats);
      this.emit('memory-critical', stats);
      // Force cleanup
      this.memoryManager.forceCleanup();
    });
    
    // Publisher handlers
    this.batchPublisher.on('error', (error) => {
      console.error('Publisher error:', error);
      this.emit('publisher-error', error);
    });
    
    this.batchPublisher.on('backpressure', (length) => {
      console.warn(`Redis backpressure: ${length} messages`);
      this.emit('backpressure', length);
    });
  }

  private async handleDeviceAttach(device: usb.Device): Promise<void> {
    try {
      const deviceInfo = await this.deviceExtractor.extractDeviceInfo(device);
      
      // Check if already connected
      if (this.connectedDevices.has(deviceInfo.signature)) {
        return;
      }
      
      // Apply device filters
      if (!this.passesFilters(deviceInfo)) {
        console.log(`Device filtered out: ${deviceInfo.vendorId}:${deviceInfo.productId}`);
        return;
      }
      
      // Store device with memory management
      this.connectedDevices.set(deviceInfo.signature, deviceInfo);
      this.memoryManager.cacheObject('devices', deviceInfo.signature, deviceInfo, 1024);
      
      // Update stats
      this.stats.totalAttached++;
      this.stats.totalEvents++;
      
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
      // Try to get from cache first
      const cacheKey = `${device.deviceDescriptor.idVendor}:${device.deviceDescriptor.idProduct}:${device.busNumber}:${device.deviceAddress}`;
      let deviceInfo = this.memoryManager.getCachedObject<USBDeviceInfo>('extraction', cacheKey);
      
      if (!deviceInfo) {
        // Extract minimal info for detach
        deviceInfo = await this.deviceExtractor.extractDeviceInfo(device);
      }
      
      // Find and remove device
      const signature = deviceInfo.signature;
      const storedDevice = this.connectedDevices.get(signature);
      
      if (!storedDevice) {
        return; // Device was not tracked
      }
      
      this.connectedDevices.delete(signature);
      
      // Update stats
      this.stats.totalDetached++;
      this.stats.totalEvents++;
      
      // Send to debouncer
      this.eventDebouncer.debounceEvent('detach', storedDevice);
      
      // Emit local event
      this.emit('device:detach', storedDevice);
      
    } catch (error) {
      this.handleUSBError(error as Error, 'detach');
    }
  }

  private async processBatch(batch: any[]): Promise<void> {
    try {
      // Publish batch to Redis
      for (const event of batch) {
        await this.batchPublisher.publishEvent(event.action, event.deviceInfo);
      }
      
      console.log(`Processed batch of ${batch.length} events`);
    } catch (error) {
      console.error('Failed to process event batch:', error);
      this.emit('batch-error', error);
    }
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
    this.emit('error', error, context);
  }

  async start(): Promise<void> {
    if (this.isRunning) return;
    
    console.log('Starting Enhanced USB Daemon...');
    console.log('Platform:', this.platformInfo);
    console.log('Recommended strategy:', this.platformInfo.capabilities.recommendedStrategy);
    
    try {
      // Platform-specific initialization
      if (this.platformInfo.isWindows) {
        usb.useUsbDkBackend();
      }
      
      // Start health server
      if (this.healthServer) {
        await this.healthServer.start();
      }
      
      // Scan existing devices
      await this.scanExistingDevices();
      
      this.isRunning = true;
      this.startTime = Date.now();
      
      console.log('Enhanced USB Daemon started successfully');
      this.emit('started');
      
    } catch (error) {
      console.error('Failed to start USB daemon:', error);
      throw error;
    }
  }

  async stop(): Promise<void> {
    if (!this.isRunning || this.isShuttingDown) return;
    
    console.log('Stopping Enhanced USB Daemon...');
    this.isShuttingDown = true;
    this.isRunning = false;
    
    // Run shutdown handlers
    for (const handler of this.shutdownHandlers) {
      try {
        await handler();
      } catch (error) {
        console.error('Shutdown handler error:', error);
      }
    }
    
    // Force flush any pending events
    this.eventDebouncer.forceFlush();
    await this.batchPublisher.forceFlush();
    
    // Cleanup components
    this.eventDebouncer.destroy();
    this.deviceExtractor.destroy();
    await this.batchPublisher.close();
    this.memoryManager.destroy();
    
    // Stop health server
    if (this.healthServer) {
      await this.healthServer.stop();
    }
    
    // Clear devices
    this.connectedDevices.clear();
    
    // Remove USB listeners
    usb.removeAllListeners();
    
    console.log('Enhanced USB Daemon stopped');
    this.emit('stopped');
  }

  private async scanExistingDevices(): Promise<void> {
    console.log('Scanning existing USB devices...');
    const devices = usb.getDeviceList();
    
    let processed = 0;
    const errors = [];
    
    for (const device of devices) {
      try {
        await this.handleDeviceAttach(device);
        processed++;
      } catch (error) {
        errors.push({ device, error });
      }
    }
    
    console.log(`Scanned ${processed} devices, ${errors.length} errors`);
    
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
      console.log('Running custom shutdown tasks...');
      // Any custom cleanup
    });
  }

  public addShutdownHandler(handler: () => Promise<void>): void {
    this.shutdownHandlers.push(handler);
  }

  public getStats(): EnhancedDaemonStats {
    const memStats = this.memoryManager.getMemoryStats();
    const extractorStats = this.deviceExtractor.getStats();
    const debouncerStats = this.eventDebouncer.getStats();
    const publisherStats = this.batchPublisher.getStats();
    
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
        totalProcessed: this.stats.totalEvents
      },
      memory: {
        ...memStats,
        extractorCache: extractorStats.cacheSize
      },
      redis: {
        connected: this.batchPublisher.isHealthy(),
        queueSize: this.batchPublisher.getQueueSize(),
        totalPublished: publisherStats.totalPublished
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
  }
}