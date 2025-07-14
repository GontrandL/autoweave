/**
 * USB Event Publisher
 * Publishes USB events to Redis Streams
 */

const Redis = require('ioredis');

/**
 * USB Event Publisher - Publishes USB events to Redis
 */
class USBEventPublisher {
  constructor(redisConfig) {
    this.redis = new Redis(redisConfig);
    this.streamName = 'aw:hotplug';
    this.publishCount = 0;
    this.lastPublishTime = Date.now();
  }

  /**
   * Publish USB event to Redis stream
   */
  async publishUSBEvent(action, deviceInfo) {
    const eventData = {
      source: 'node-usb',
      action,
      vendor_id: deviceInfo.vendorId.toString(16).padStart(4, '0'),
      product_id: deviceInfo.productId.toString(16).padStart(4, '0'),
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
      );

      this.publishCount++;
      this.lastPublishTime = Date.now();

      console.log(
        `Published USB event ${action} to Redis stream: ${messageId}`
      );
      
      return messageId;
    } catch (error) {
      console.error('Failed to publish USB event to Redis:', error);
      throw error;
    }
  }

  /**
   * Get recent events from the stream
   */
  async getRecentEvents(count = 10) {
    return this.redis.xrevrange(this.streamName, '+', '-', 'COUNT', count);
  }

  /**
   * Create consumer group for the stream
   */
  async createConsumerGroup(groupName) {
    try {
      await this.redis.xgroup(
        'CREATE',
        this.streamName,
        groupName,
        '$',
        'MKSTREAM'
      );
    } catch (error) {
      // Group might already exist
      if (!error.message.includes('BUSYGROUP')) {
        throw error;
      }
    }
  }

  /**
   * Get publisher statistics
   */
  getStats() {
    return {
      streamName: this.streamName,
      publishCount: this.publishCount,
      lastPublishTime: this.lastPublishTime,
      uptime: Date.now() - this.lastPublishTime
    };
  }

  /**
   * Cleanup resources
   */
  async cleanup() {
    if (this.redis) {
      await this.redis.quit();
    }
  }
}

module.exports = USBEventPublisher;