import { USBDaemon } from './usb-daemon';
import { EnhancedUSBDaemon } from './enhanced-usb-daemon';
import { USBDaemonConfig } from './types';
import { EnhancedPlatformDetector } from './platform/enhanced-platform';

/**
 * Create a standard USB daemon instance
 */
export function createUSBDaemon(config: USBDaemonConfig): USBDaemon {
  return new USBDaemon(config);
}

/**
 * Create an enhanced USB daemon with production features
 */
export function createEnhancedUSBDaemon(config: USBDaemonConfig): EnhancedUSBDaemon {
  return new EnhancedUSBDaemon(config);
}

/**
 * Create a USB daemon with automatic selection based on platform capabilities
 */
export function createAutoUSBDaemon(config: USBDaemonConfig): USBDaemon | EnhancedUSBDaemon {
  const platformInfo = EnhancedPlatformDetector.detect();
  
  // Use enhanced daemon if platform supports it
  if (platformInfo.supportsHotplug && platformInfo.capabilities.canAccessRedis) {
    console.log('Creating Enhanced USB Daemon based on platform capabilities');
    return new EnhancedUSBDaemon(config);
  } else {
    console.log('Creating standard USB Daemon due to platform limitations');
    return new USBDaemon(config);
  }
}

/**
 * Get recommended configuration for the current platform
 */
export function getRecommendedConfig(): Partial<USBDaemonConfig> {
  const platformInfo = EnhancedPlatformDetector.detect();
  const optimizedConfig = EnhancedPlatformDetector.getOptimizedConfig(platformInfo);
  
  return {
    monitoring: {
      enabled: optimizedConfig.monitoring.enabled,
      interval: optimizedConfig.monitoring.interval,
      healthcheck_port: optimizedConfig.monitoring.healthcheck_port
    },
    performance: {
      max_events_per_second: optimizedConfig.performance.max_events_per_second,
      debounce_ms: optimizedConfig.performance.debounce_ms,
      batch_size: optimizedConfig.performance.batch_size
    },
    fallback: optimizedConfig.fallback
  };
}

/**
 * Create a minimal configuration for testing
 */
export function createTestConfig(): USBDaemonConfig {
  return {
    redis: {
      host: 'localhost',
      port: 6379,
      db: 0
    },
    monitoring: {
      enabled: false,
      interval: 10000,
      healthcheck_port: 3456
    },
    filters: {},
    performance: {
      max_events_per_second: 100,
      debounce_ms: 50,
      batch_size: 10
    },
    fallback: {
      enable_udev: false,
      udev_script_path: ''
    }
  };
}