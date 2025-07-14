import Redis, { RedisOptions } from 'ioredis';
import { USBDeviceInfo } from '../types';
import { EventEmitter } from 'events';

interface BatchEvent {
  action: 'attach' | 'detach';
  deviceInfo: USBDeviceInfo;
  timestamp: number;
}

interface PublishStats {
  totalPublished: number;
  failedPublishes: number;
  batchesPublished: number;
  lastPublishTime: number;
  averageLatency: number;
}

export class BatchRedisPublisher extends EventEmitter {
  private redis: Redis;
  private batchQueue: BatchEvent[] = [];
  private publishTimer: NodeJS.Timeout | null = null;
  private stats: PublishStats = {
    totalPublished: 0,
    failedPublishes: 0,
    batchesPublished: 0,
    lastPublishTime: 0,
    averageLatency: 0
  };
  private latencies: number[] = [];
  private readonly streamName = 'aw:hotplug';
  private readonly maxStreamLength = 10000;
  private isConnected = false;
  private reconnectTimer: NodeJS.Timeout | null = null;

  constructor(
    redisConfig: RedisOptions,
    private batchSize: number = 10,
    private flushInterval: number = 100
  ) {
    super();
    this.initializeRedis(redisConfig);
  }

  private initializeRedis(redisConfig: RedisOptions): void {
    this.redis = new Redis({
      ...redisConfig,
      enableReadyCheck: true,
      maxRetriesPerRequest: 3,
      retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      }
    });

    this.redis.on('connect', () => {
      this.isConnected = true;
      console.log('BatchRedisPublisher connected to Redis');
      this.emit('connected');
    });

    this.redis.on('error', (error) => {
      console.error('BatchRedisPublisher Redis error:', error);
      this.emit('error', error);
    });

    this.redis.on('close', () => {
      this.isConnected = false;
      console.log('BatchRedisPublisher disconnected from Redis');
      this.emit('disconnected');
    });
  }

  public async publishEvent(action: 'attach' | 'detach', deviceInfo: USBDeviceInfo): Promise<void> {
    const event: BatchEvent = {
      action,
      deviceInfo,
      timestamp: Date.now()
    };

    this.batchQueue.push(event);

    // Check if we should flush immediately
    if (this.batchQueue.length >= this.batchSize) {
      await this.flushBatch();
    } else {
      this.scheduleFlush();
    }
  }

  private scheduleFlush(): void {
    if (this.publishTimer) return;

    this.publishTimer = setTimeout(() => {
      this.publishTimer = null;
      this.flushBatch().catch(error => {
        console.error('Batch flush error:', error);
      });
    }, this.flushInterval);
  }

  private async flushBatch(): Promise<void> {
    if (this.batchQueue.length === 0) return;

    const batch = this.batchQueue.splice(0, this.batchSize);
    const startTime = Date.now();

    try {
      if (!this.isConnected) {
        throw new Error('Redis not connected');
      }

      // Build pipeline for batch publishing
      const pipeline = this.redis.pipeline();

      for (const event of batch) {
        const eventData = this.formatEventData(event);
        pipeline.xadd(
          this.streamName,
          'MAXLEN', '~', this.maxStreamLength,
          '*',
          ...Object.entries(eventData).flat()
        );
      }

      // Execute pipeline
      const results = await pipeline.exec();
      
      // Update stats
      const latency = Date.now() - startTime;
      this.updateStats(batch.length, latency, results);

      // Check for backpressure
      await this.checkBackpressure();

    } catch (error) {
      console.error('Failed to publish batch:', error);
      this.stats.failedPublishes += batch.length;
      
      // Re-queue events if possible
      if (this.batchQueue.length + batch.length < this.batchSize * 10) {
        this.batchQueue.unshift(...batch);
      }
      
      throw error;
    }
  }

  private formatEventData(event: BatchEvent): Record<string, string> {
    const { action, deviceInfo } = event;
    
    return {
      source: 'node-usb',
      action,
      vendor_id: deviceInfo.vendorId.toString(16),
      product_id: deviceInfo.productId.toString(16),
      device_signature: deviceInfo.signature,
      manufacturer: deviceInfo.manufacturer || '',
      product: deviceInfo.product || '',
      serial_number: deviceInfo.serialNumber || '',
      bus_number: deviceInfo.location.busNumber.toString(),
      device_address: deviceInfo.location.deviceAddress.toString(),
      port_path: deviceInfo.location.portPath,
      timestamp: event.timestamp.toString(),
      device_descriptor: JSON.stringify(deviceInfo.deviceDescriptor)
    };
  }

  private updateStats(batchSize: number, latency: number, results: any[]): void {
    // Count successful publishes
    const successful = results?.filter(([err]) => !err).length || 0;
    
    this.stats.totalPublished += successful;
    this.stats.failedPublishes += (batchSize - successful);
    this.stats.batchesPublished++;
    this.stats.lastPublishTime = Date.now();

    // Update latency stats
    this.latencies.push(latency);
    if (this.latencies.length > 100) {
      this.latencies.shift();
    }
    this.stats.averageLatency = this.latencies.reduce((a, b) => a + b, 0) / this.latencies.length;
  }

  private async checkBackpressure(): Promise<void> {
    try {
      const streamLength = await this.redis.xlen(this.streamName);
      
      if (streamLength > this.maxStreamLength * 0.9) {
        console.warn(`Stream backpressure warning: ${streamLength} messages`);
        this.emit('backpressure', streamLength);
        
        // Slow down publishing
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    } catch (error) {
      // Ignore backpressure check errors
    }
  }

  public async forceFlush(): Promise<void> {
    if (this.publishTimer) {
      clearTimeout(this.publishTimer);
      this.publishTimer = null;
    }

    while (this.batchQueue.length > 0) {
      await this.flushBatch();
    }
  }

  public async close(): Promise<void> {
    // Flush remaining events
    await this.forceFlush();

    if (this.publishTimer) {
      clearTimeout(this.publishTimer);
    }

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }

    await this.redis.quit();
  }

  public getStats(): PublishStats {
    return { ...this.stats };
  }

  public getQueueSize(): number {
    return this.batchQueue.length;
  }

  public isHealthy(): boolean {
    return this.isConnected && this.batchQueue.length < this.batchSize * 5;
  }
}