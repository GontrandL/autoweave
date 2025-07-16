import { USBDaemonConfig } from '../types';

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export class ConfigValidator {
  static validate(config: USBDaemonConfig): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Validate Redis configuration
    if (!config.redis) {
      errors.push('Redis configuration is required');
    } else {
      if (!config.redis.host) {
        errors.push('Redis host is required');
      }
      if (!config.redis.port || config.redis.port < 1 || config.redis.port > 65535) {
        errors.push('Redis port must be between 1 and 65535');
      }
      if (config.redis.db && (config.redis.db < 0 || config.redis.db > 15)) {
        errors.push('Redis db must be between 0 and 15');
      }
    }

    // Validate monitoring configuration
    if (config.monitoring) {
      if (config.monitoring.enabled && !config.monitoring.healthcheck_port) {
        errors.push('Health check port is required when monitoring is enabled');
      }
      if (config.monitoring.healthcheck_port && 
          (config.monitoring.healthcheck_port < 1024 || 
           config.monitoring.healthcheck_port > 65535)) {
        warnings.push('Health check port should be between 1024 and 65535');
      }
      if (config.monitoring.interval && config.monitoring.interval < 1000) {
        warnings.push('Monitoring interval less than 1000ms may impact performance');
      }
    }

    // Validate performance configuration
    if (config.performance) {
      if (config.performance.max_events_per_second && 
          config.performance.max_events_per_second > 1000) {
        warnings.push('max_events_per_second > 1000 may cause high CPU usage');
      }
      if (config.performance.debounce_ms && config.performance.debounce_ms < 10) {
        warnings.push('debounce_ms < 10 may not effectively debounce events');
      }
      if (config.performance.batch_size && config.performance.batch_size > 100) {
        warnings.push('batch_size > 100 may cause latency in event processing');
      }
    }

    // Validate filters
    if (config.filters) {
      if (config.filters.vendor_whitelist && config.filters.vendor_blacklist) {
        if (config.filters.vendor_whitelist.some(v => 
            config.filters.vendor_blacklist!.includes(v))) {
          errors.push('Vendor cannot be in both whitelist and blacklist');
        }
      }
      
      if (config.filters.device_class_filter) {
        const invalidClasses = config.filters.device_class_filter.filter(
          c => c < 0 || c > 255
        );
        if (invalidClasses.length > 0) {
          errors.push(`Invalid device class values: ${invalidClasses.join(', ')}`);
        }
      }
    }

    // Validate fallback configuration
    if (config.fallback) {
      if (config.fallback.enable_udev && !config.fallback.udev_script_path) {
        errors.push('udev_script_path is required when udev is enabled');
      }
      if (config.fallback.enable_udev && process.platform !== 'linux') {
        warnings.push('udev is only available on Linux platforms');
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  static validateAndThrow(config: USBDaemonConfig): void {
    const result = this.validate(config);
    
    if (!result.valid) {
      throw new Error(`Configuration validation failed:\n${result.errors.join('\n')}`);
    }
    
    if (result.warnings.length > 0) {
      console.warn('Configuration warnings:');
      result.warnings.forEach(warning => console.warn(`  - ${warning}`));
    }
  }

  static applyDefaults(config: Partial<USBDaemonConfig>): USBDaemonConfig {
    return {
      redis: {
        host: 'localhost',
        port: 6379,
        db: 0,
        ...config.redis
      },
      monitoring: {
        enabled: false,
        interval: 10000,
        healthcheck_port: 3456,
        ...config.monitoring
      },
      filters: {
        ...config.filters
      },
      performance: {
        max_events_per_second: 100,
        debounce_ms: 50,
        batch_size: 10,
        ...config.performance
      },
      fallback: {
        enable_udev: false,
        udev_script_path: '/usr/local/bin/autoweave-udev-notify',
        ...config.fallback
      }
    };
  }

  static sanitize(config: USBDaemonConfig): USBDaemonConfig {
    const sanitized = { ...config };

    // Remove sensitive information from logs
    if (sanitized.redis.password) {
      sanitized.redis = {
        ...sanitized.redis,
        password: '***'
      };
    }

    return sanitized;
  }
}