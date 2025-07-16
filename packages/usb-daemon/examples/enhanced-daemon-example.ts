import { createEnhancedUSBDaemon, getRecommendedConfig, USBDaemonConfig } from '../src';

async function main() {
  // Get platform-optimized configuration
  const recommendedConfig = getRecommendedConfig();
  
  // Create full configuration
  const config: USBDaemonConfig = {
    redis: {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD,
      db: 0
    },
    monitoring: {
      enabled: true,
      interval: 10000,
      healthcheck_port: 3456
    },
    filters: {
      // Example: Only monitor HID and storage devices
      device_class_filter: [0x03, 0x08], // HID and Mass Storage
      // Example: Exclude specific vendor
      vendor_blacklist: [0x0000] // Unknown vendor
    },
    performance: recommendedConfig.performance || {
      max_events_per_second: 100,
      debounce_ms: 50,
      batch_size: 10
    },
    fallback: recommendedConfig.fallback || {
      enable_udev: false,
      udev_script_path: '/usr/local/bin/autoweave-udev-notify'
    }
  };

  // Create enhanced daemon
  const daemon = createEnhancedUSBDaemon(config);

  // Setup event handlers
  daemon.on('device:attach', (device) => {
    console.log('Device attached:', {
      manufacturer: device.manufacturer,
      product: device.product,
      vendorId: device.vendorId.toString(16),
      productId: device.productId.toString(16),
      signature: device.signature
    });
  });

  daemon.on('device:detach', (device) => {
    console.log('Device detached:', {
      manufacturer: device.manufacturer,
      product: device.product,
      signature: device.signature
    });
  });

  daemon.on('error', (error, context) => {
    console.error('Daemon error:', { error, context });
  });

  daemon.on('memory-warning', (stats) => {
    console.warn('Memory warning:', stats);
  });

  daemon.on('backpressure', (length) => {
    console.warn('Redis backpressure:', length);
  });

  // Start the daemon
  try {
    await daemon.start();
    console.log('Enhanced USB Daemon started successfully');
    
    // Get platform info
    const platformInfo = daemon.getPlatformInfo();
    console.log('Platform capabilities:', platformInfo.capabilities);
    
    // Monitor stats
    setInterval(() => {
      const stats = daemon.getStats();
      console.log('Daemon stats:', {
        devices: stats.devices,
        events: stats.events,
        memory: {
          heapUsedMB: Math.round(stats.memory.heapUsed / 1024 / 1024),
          cacheSize: stats.memory.cacheSize
        },
        redis: stats.redis
      });
    }, 30000); // Every 30 seconds

  } catch (error) {
    console.error('Failed to start daemon:', error);
    process.exit(1);
  }

  // Graceful shutdown
  process.on('SIGINT', async () => {
    console.log('Shutting down...');
    await daemon.stop();
    process.exit(0);
  });
}

// Run the example
main().catch(console.error);