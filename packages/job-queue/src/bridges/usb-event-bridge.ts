import { EventEmitter } from 'events';
import { Logger } from 'pino';
import pino from 'pino';
import Redis from 'ioredis';

import { AutoWeaveJobManager } from '../managers/autoweave-job-manager';
import {
  AutoWeaveJobData,
  USBEventData,
  JobType,
  JobOptions,
  QueueManagerError
} from '../types';

interface USBEventBridgeConfig {
  queueName: string;
  streamName: string;
  consumerGroup: string;
  consumerName: string;
  redis: {
    host: string;
    port: number;
    password?: string;
    db: number;
  };
  batchSize: number;
  pollInterval: number;
  maxRetries: number;
  processingTimeout: number;
  pluginFiltering: {
    enabled: boolean;
    allowedPlugins: string[];
    requirePermission: boolean;
  };
}

interface USBStreamEvent {
  messageId: string;
  source: 'node-usb' | 'udev';
  action: 'attach' | 'detach';
  vendorId: string;
  productId: string;
  deviceSignature: string;
  manufacturer: string;
  product: string;
  serialNumber: string;
  timestamp: string;
  deviceDescriptor: string;
  busNumber: string;
  deviceAddress: string;
  portPath: string;
}

export class USBEventBridge extends EventEmitter {
  private config: USBEventBridgeConfig;
  private jobManager: AutoWeaveJobManager;
  private redis: Redis;
  private logger: Logger;
  private isRunning = false;
  private processingLoop?: Promise<void>;
  private shutdownPromise?: Promise<void>;
  private eventStats = {
    totalProcessed: 0,
    totalErrors: 0,
    lastProcessedTime: 0,
    averageProcessingTime: 0,
    eventsPerSecond: 0
  };

  constructor(config: USBEventBridgeConfig, jobManager: AutoWeaveJobManager) {
    super();
    this.config = config;
    this.jobManager = jobManager;

    this.logger = pino({
      name: 'usb-event-bridge',
      level: process.env.LOG_LEVEL || 'info'
    });

    this.redis = new Redis({
      ...config.redis,
      maxRetriesPerRequest: 3,
      retryDelayOnFailover: 100,
      lazyConnect: true
    });

    this.setupErrorHandlers();
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      this.logger.warn('USB Event Bridge is already running');
      return;
    }

    try {
      this.logger.info('Starting USB Event Bridge...');

      // Connect to Redis
      await this.redis.connect();
      this.logger.info('Connected to Redis stream');

      // Ensure consumer group exists
      await this.createConsumerGroup();

      // Start processing loop
      this.isRunning = true;
      this.processingLoop = this.runProcessingLoop();

      this.logger.info({
        streamName: this.config.streamName,
        consumerGroup: this.config.consumerGroup,
        consumerName: this.config.consumerName,
        queueName: this.config.queueName
      }, 'USB Event Bridge started successfully');

      this.emit('bridge:started');

    } catch (error) {
      this.logger.error({ error }, 'Failed to start USB Event Bridge');
      throw new QueueManagerError('Failed to start USB Event Bridge', 'start', error as Error);
    }
  }

  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    if (this.shutdownPromise) {
      return this.shutdownPromise;
    }

    this.shutdownPromise = this.performShutdown();
    return this.shutdownPromise;
  }

  private async performShutdown(): Promise<void> {
    this.logger.info('Stopping USB Event Bridge...');

    this.isRunning = false;

    // Wait for processing loop to finish
    if (this.processingLoop) {
      await this.processingLoop;
    }

    // Close Redis connection
    await this.redis.quit();

    this.logger.info('USB Event Bridge stopped');
    this.emit('bridge:stopped');
  }

  private async createConsumerGroup(): Promise<void> {
    try {
      await this.redis.xgroup(
        'CREATE',
        this.config.streamName,
        this.config.consumerGroup,
        '$',
        'MKSTREAM'
      );
      this.logger.info('Consumer group created');
    } catch (error: any) {
      // Group might already exist
      if (!error.message.includes('BUSYGROUP')) {
        throw error;
      }
      this.logger.info('Consumer group already exists');
    }
  }

  private async runProcessingLoop(): Promise<void> {
    while (this.isRunning) {
      try {
        await this.processEvents();
        
        // Brief pause to prevent CPU spinning
        await new Promise(resolve => setTimeout(resolve, this.config.pollInterval));
        
      } catch (error) {
        this.logger.error({ error }, 'Error in processing loop');
        this.eventStats.totalErrors++;
        
        // Longer pause on error to prevent error loops
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    }
  }

  private async processEvents(): Promise<void> {
    const results = await this.redis.xreadgroup(
      'GROUP',
      this.config.consumerGroup,
      this.config.consumerName,
      'COUNT',
      this.config.batchSize,
      'BLOCK',
      1000,
      'STREAMS',
      this.config.streamName,
      '>'
    );

    if (!results || results.length === 0) {
      return;
    }

    const [_streamName, messages] = results[0] as [string, Array<[string, string[]]>];
    
    for (const [messageId, fields] of messages) {
      await this.processUSBEvent(messageId, fields);
    }
  }

  private async processUSBEvent(messageId: string, fields: string[]): Promise<void> {
    const startTime = Date.now();
    
    try {
      // Parse USB event from Redis stream
      const usbEvent = this.parseUSBEvent(messageId, fields);
      
      this.logger.info({
        messageId,
        action: usbEvent.action,
        deviceSignature: usbEvent.deviceSignature,
        product: usbEvent.product
      }, 'Processing USB event');

      // Filter events if plugin filtering is enabled
      if (this.config.pluginFiltering.enabled && !this.shouldProcessEvent(usbEvent)) {
        this.logger.debug({
          messageId,
          deviceSignature: usbEvent.deviceSignature
        }, 'USB event filtered out');
        
        await this.acknowledgeMessage(messageId);
        return;
      }

      // Convert to job data
      const jobData = this.createJobData(usbEvent);
      
      // Add job to queue with appropriate priority
      const jobOptions: JobOptions = {
        priority: this.calculateEventPriority(usbEvent),
        attempts: this.config.maxRetries,
        timeout: this.config.processingTimeout,
        removeOnComplete: 100,
        removeOnFail: 50,
        backoff: {
          type: 'exponential',
          delay: 1000,
          settings: {
            jitter: true,
            maxDelay: 10000
          }
        }
      };

      const jobId = await this.jobManager.addJob(
        this.config.queueName,
        jobData,
        jobOptions
      );

      // Acknowledge the message
      await this.acknowledgeMessage(messageId);

      // Update statistics
      this.updateEventStats(startTime);

      this.logger.info({
        messageId,
        jobId,
        action: usbEvent.action,
        deviceSignature: usbEvent.deviceSignature,
        processingTime: Date.now() - startTime
      }, 'USB event processed successfully');

      this.emit('event:processed', {
        messageId,
        jobId,
        action: usbEvent.action,
        deviceSignature: usbEvent.deviceSignature
      });

    } catch (error) {
      this.logger.error({
        messageId,
        error,
        processingTime: Date.now() - startTime
      }, 'Failed to process USB event');

      this.eventStats.totalErrors++;
      this.emit('event:error', { messageId, error });

      // Don't acknowledge failed messages - they'll be retried
      throw error;
    }
  }

  private parseUSBEvent(messageId: string, fields: string[]): USBStreamEvent {
    const fieldObj: Record<string, string> = {};
    
    for (let i = 0; i < fields.length; i += 2) {
      const key = fields[i];
      const value = fields[i + 1];
      if (key !== undefined && value !== undefined) {
        fieldObj[key] = value;
      }
    }

    return {
      messageId,
      source: (fieldObj.source || 'node-usb') as 'node-usb' | 'udev',
      action: (fieldObj.action || 'attach') as 'attach' | 'detach',
      vendorId: fieldObj.vendor_id || '0',
      productId: fieldObj.product_id || '0',
      deviceSignature: fieldObj.device_signature || '',
      manufacturer: fieldObj.manufacturer || '',
      product: fieldObj.product || '',
      serialNumber: fieldObj.serial_number || '',
      timestamp: fieldObj.timestamp || '0',
      deviceDescriptor: fieldObj.device_descriptor || '{}',
      busNumber: fieldObj.bus_number || '0',
      deviceAddress: fieldObj.device_address || '0',
      portPath: fieldObj.port_path || ''
    };
  }

  private shouldProcessEvent(usbEvent: USBStreamEvent): boolean {
    if (!this.config.pluginFiltering.enabled) {
      return true;
    }

    // Check if device is in allowed list
    if (this.config.pluginFiltering.allowedPlugins.length > 0) {
      const deviceId = `${usbEvent.vendorId}:${usbEvent.productId}`;
      return this.config.pluginFiltering.allowedPlugins.includes(deviceId);
    }

    return true;
  }

  private createJobData(usbEvent: USBStreamEvent): AutoWeaveJobData {
    const jobType: JobType = usbEvent.action === 'attach' 
      ? 'usb.device.attached' 
      : 'usb.device.detached';

    const usbEventData: USBEventData = {
      action: usbEvent.action,
      deviceInfo: {
        vendorId: parseInt(usbEvent.vendorId, 16),
        productId: parseInt(usbEvent.productId, 16),
        manufacturer: usbEvent.manufacturer,
        product: usbEvent.product,
        serialNumber: usbEvent.serialNumber,
        signature: usbEvent.deviceSignature
      },
      timestamp: parseInt(usbEvent.timestamp)
    };

    return {
      type: jobType,
      payload: usbEventData,
      metadata: {
        source: 'usb-daemon',
        correlationId: usbEvent.messageId,
        timestamp: Date.now(),
        version: '1.0.0'
      },
      priority: this.calculateEventPriority(usbEvent)
    };
  }

  private calculateEventPriority(usbEvent: USBStreamEvent): number {
    // Higher priority for attach events
    if (usbEvent.action === 'attach') {
      return 10;
    }

    // Lower priority for detach events
    return 5;
  }

  private async acknowledgeMessage(messageId: string): Promise<void> {
    try {
      await this.redis.xack(
        this.config.streamName,
        this.config.consumerGroup,
        messageId
      );
    } catch (error) {
      this.logger.error({ messageId, error }, 'Failed to acknowledge message');
      throw error;
    }
  }

  private updateEventStats(startTime: number): void {
    const processingTime = Date.now() - startTime;
    this.eventStats.totalProcessed++;
    this.eventStats.lastProcessedTime = processingTime;
    
    // Update moving average
    const alpha = 0.1;
    this.eventStats.averageProcessingTime = 
      alpha * processingTime + (1 - alpha) * this.eventStats.averageProcessingTime;
    
    // Update events per second (simple calculation)
    const now = Date.now();
    const timeDiff = now - (this.eventStats.lastProcessedTime || now);
    if (timeDiff > 0) {
      this.eventStats.eventsPerSecond = 1000 / timeDiff;
    }
  }

  private setupErrorHandlers(): void {
    this.redis.on('error', (error) => {
      this.logger.error({ error }, 'Redis connection error');
      this.emit('redis:error', error);
    });

    this.redis.on('connect', () => {
      this.logger.info('Redis connected');
      this.emit('redis:connected');
    });

    this.redis.on('close', () => {
      this.logger.info('Redis connection closed');
      this.emit('redis:closed');
    });
  }

  // Public methods for monitoring and management
  getEventStats(): typeof this.eventStats {
    return { ...this.eventStats };
  }

  async getConsumerInfo(): Promise<any> {
    try {
      const info = await this.redis.xinfo('CONSUMERS', this.config.streamName, this.config.consumerGroup);
      return info;
    } catch (error) {
      this.logger.error({ error }, 'Failed to get consumer info');
      return null;
    }
  }

  async getStreamInfo(): Promise<any> {
    try {
      const info = await this.redis.xinfo('STREAM', this.config.streamName);
      return info;
    } catch (error) {
      this.logger.error({ error }, 'Failed to get stream info');
      return null;
    }
  }

  async getPendingMessages(): Promise<any> {
    try {
      const pending = await this.redis.xpending(
        this.config.streamName,
        this.config.consumerGroup,
        '-',
        '+',
        10
      );
      return pending;
    } catch (error) {
      this.logger.error({ error }, 'Failed to get pending messages');
      return null;
    }
  }

  updateConfig(newConfig: Partial<USBEventBridgeConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.logger.info({ config: this.config }, 'USB Event Bridge configuration updated');
  }

  isActive(): boolean {
    return this.isRunning;
  }

  getPerformanceMetrics(): {
    totalProcessed: number;
    totalErrors: number;
    averageProcessingTime: number;
    eventsPerSecond: number;
    errorRate: number;
  } {
    const errorRate = this.eventStats.totalProcessed > 0 
      ? this.eventStats.totalErrors / this.eventStats.totalProcessed 
      : 0;

    return {
      totalProcessed: this.eventStats.totalProcessed,
      totalErrors: this.eventStats.totalErrors,
      averageProcessingTime: this.eventStats.averageProcessingTime,
      eventsPerSecond: this.eventStats.eventsPerSecond,
      errorRate
    };
  }
}