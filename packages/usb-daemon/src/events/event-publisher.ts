import Redis, { RedisOptions } from 'ioredis';
import { USBDeviceInfo, USBEvent } from '../types';

export class USBEventPublisher {
  private redis: Redis;
  private streamName = 'aw:hotplug';

  constructor(redisConfig: RedisOptions) {
    this.redis = new Redis(redisConfig);
  }

  async publishUSBEvent(action: 'attach' | 'detach', deviceInfo: USBDeviceInfo): Promise<string> {
    const eventData = {
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
      timestamp: deviceInfo.timestamp.toString(),
      device_descriptor: JSON.stringify(deviceInfo.deviceDescriptor)
    };

    try {
      const messageId = await this.redis.xadd(
        this.streamName, 
        '*', 
        ...Object.entries(eventData).flat()
      ) as string;
      
      console.log(`Published USB event ${action} to Redis stream: ${messageId}`);
      return messageId;
    } catch (error) {
      console.error('Failed to publish USB event to Redis:', error);
      throw error;
    }
  }

  async getRecentEvents(count = 10): Promise<any[]> {
    return this.redis.xrevrange(this.streamName, '+', '-', 'COUNT', count);
  }

  async createConsumerGroup(groupName: string): Promise<void> {
    try {
      await this.redis.xgroup('CREATE', this.streamName, groupName, '$', 'MKSTREAM');
    } catch (error: any) {
      // Group might already exist
      if (!error.message.includes('BUSYGROUP')) {
        throw error;
      }
    }
  }

  async close(): Promise<void> {
    await this.redis.quit();
  }
}

export class USBEventConsumer {
  private redis: Redis;
  private streamName = 'aw:hotplug';
  private groupName: string;
  private consumerName: string;
  private isRunning = false;

  constructor(redisConfig: RedisOptions, groupName = 'plugin-loader', consumerName = 'main') {
    this.redis = new Redis(redisConfig);
    this.groupName = groupName;
    this.consumerName = consumerName;
  }

  async startConsuming(eventHandler: (event: USBEvent) => Promise<void>): Promise<void> {
    this.isRunning = true;
    
    // Ensure consumer group exists
    await this.createConsumerGroup();
    
    while (this.isRunning) {
      try {
        const results = await this.redis.xreadgroup(
          'GROUP', this.groupName, this.consumerName,
          'COUNT', 1,
          'BLOCK', 1000,
          'STREAMS', this.streamName, '>'
        );

        if (results && results.length > 0) {
          const [_streamName, messages] = results[0] as [string, Array<[string, string[]]>];
          
          for (const [messageId, fields] of messages) {
            const event = this.parseUSBEvent(messageId, fields);
            await eventHandler(event);
            
            // Acknowledge message
            await this.redis.xack(this.streamName, this.groupName, messageId);
          }
        }
      } catch (error) {
        if (this.isRunning) {
          console.error('Error consuming USB events:', error);
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
    }
  }

  async stop(): Promise<void> {
    this.isRunning = false;
    await this.redis.quit();
  }

  private async createConsumerGroup(): Promise<void> {
    try {
      await this.redis.xgroup('CREATE', this.streamName, this.groupName, '$', 'MKSTREAM');
    } catch (error: any) {
      // Group might already exist
      if (!error.message.includes('BUSYGROUP')) {
        throw error;
      }
    }
  }

  private parseUSBEvent(messageId: string, fields: string[]): USBEvent {
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
      vendorId: parseInt(fieldObj.vendor_id || '0', 16),
      productId: parseInt(fieldObj.product_id || '0', 16),
      deviceSignature: fieldObj.device_signature || '',
      manufacturer: fieldObj.manufacturer || '',
      product: fieldObj.product || '',
      serialNumber: fieldObj.serial_number || '',
      timestamp: parseInt(fieldObj.timestamp || '0'),
      deviceDescriptor: fieldObj.device_descriptor ? JSON.parse(fieldObj.device_descriptor) : null
    };
  }
}