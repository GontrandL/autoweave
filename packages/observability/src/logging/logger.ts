// @ts-ignore
import winston from 'winston';

export interface LoggingConfig {
  level: string;
  service: string;
  environment: string;
  lokiEndpoint?: string;
  enableConsole?: boolean;
  enableFile?: boolean;
  logFilePath?: string;
}

export class AutoWeaveLogger {
  private logger: winston.Logger;
  private config: LoggingConfig;

  constructor(config: LoggingConfig) {
    this.config = config;
    this.logger = this.createLogger();
  }

  private createLogger(): winston.Logger {
    const formats = [
      winston.format.timestamp(),
      winston.format.errors({ stack: true }),
      winston.format.json()
    ];

    // Add structured metadata
    const defaultMeta = {
      service: this.config.service,
      environment: this.config.environment
    };

    const transports: winston.transport[] = [];

    // Console transport
    if (this.config.enableConsole !== false) {
      transports.push(new winston.transports.Console({
        format: winston.format.combine(
          winston.format.colorize(),
          winston.format.simple()
        )
      }));
    }

    // File transport
    if (this.config.enableFile) {
      transports.push(new winston.transports.File({
        filename: this.config.logFilePath || 'autoweave.log',
        format: winston.format.combine(...formats)
      }));
    }

    // HTTP transport for Loki (if endpoint provided)
    if (this.config.lokiEndpoint) {
      transports.push(new winston.transports.Http({
        host: this.extractHost(this.config.lokiEndpoint),
        port: this.extractPort(this.config.lokiEndpoint),
        path: '/loki/api/v1/push',
        format: winston.format.combine(...formats)
      }));
    }

    return winston.createLogger({
      level: this.config.level,
      format: winston.format.combine(...formats),
      defaultMeta,
      transports
    });
  }

  private extractHost(endpoint: string): string {
    try {
      const url = new URL(endpoint);
      return url.hostname;
    } catch {
      return 'localhost';
    }
  }

  private extractPort(endpoint: string): number {
    try {
      const url = new URL(endpoint);
      return parseInt(url.port) || (url.protocol === 'https:' ? 443 : 80);
    } catch {
      return 3100; // Default Loki port
    }
  }

  // Structured logging methods
  info(message: string, meta?: any): void {
    this.logger.info(message, meta);
  }

  error(message: string, error?: Error, meta?: any): void {
    this.logger.error(message, {
      error: error ? {
        name: error.name,
        message: error.message,
        stack: error.stack
      } : undefined,
      ...meta
    });
  }

  warn(message: string, meta?: any): void {
    this.logger.warn(message, meta);
  }

  debug(message: string, meta?: any): void {
    this.logger.debug(message, meta);
  }

  // Component-specific logging methods
  logUSBEvent(action: 'attach' | 'detach', deviceInfo: any): void {
    this.info(`USB device ${action}`, {
      component: 'usb-daemon',
      event_type: 'usb_event',
      action,
      vendor_id: deviceInfo.vendorId?.toString(16),
      product_id: deviceInfo.productId?.toString(16),
      manufacturer: deviceInfo.manufacturer,
      product: deviceInfo.product
    });
  }

  logPluginEvent(action: 'load' | 'unload' | 'error', pluginName: string, details?: any): void {
    const level = action === 'error' ? 'error' : 'info';
    this.logger.log(level, `Plugin ${action}`, {
      component: 'plugin-loader',
      event_type: 'plugin_event',
      action,
      plugin_name: pluginName,
      ...details
    });
  }

  logJobEvent(action: 'started' | 'completed' | 'failed', jobData: any): void {
    const level = action === 'failed' ? 'error' : 'info';
    this.logger.log(level, `Job ${action}`, {
      component: 'queue',
      event_type: 'job_event',
      action,
      job_id: jobData.id,
      job_type: jobData.type,
      queue_name: jobData.queueName,
      tenant_id: jobData.metadata?.tenantId,
      plugin_id: jobData.metadata?.pluginId
    });
  }

  logHTTPRequest(req: any, res: any, duration: number): void {
    this.info('HTTP request', {
      component: 'http',
      event_type: 'http_request',
      method: req.method,
      url: req.url,
      status_code: res.statusCode,
      duration_ms: duration,
      user_agent: req.get('User-Agent'),
      ip: req.ip
    });
  }

  logSystemEvent(event: string, details?: any): void {
    this.info(`System event: ${event}`, {
      component: 'system',
      event_type: 'system_event',
      event,
      ...details
    });
  }

  // Performance logging
  logPerformance(operation: string, duration: number, metadata?: any): void {
    this.info(`Performance: ${operation}`, {
      component: 'performance',
      event_type: 'performance',
      operation,
      duration_ms: duration,
      ...metadata
    });
  }

  // Security logging
  logSecurityEvent(event: string, severity: 'low' | 'medium' | 'high', details?: any): void {
    const level = severity === 'high' ? 'error' : severity === 'medium' ? 'warn' : 'info';
    this.logger.log(level, `Security event: ${event}`, {
      component: 'security',
      event_type: 'security_event',
      event,
      severity,
      ...details
    });
  }

  getLogger(): winston.Logger {
    return this.logger;
  }
}

// Singleton instance
let globalLogger: AutoWeaveLogger | undefined;

export function initializeLogging(config: LoggingConfig): AutoWeaveLogger {
  if (globalLogger) {
    console.warn('Logging already initialized');
    return globalLogger;
  }

  globalLogger = new AutoWeaveLogger(config);
  return globalLogger;
}

export function getLogger(): AutoWeaveLogger {
  if (!globalLogger) {
    // Initialize with default config if not already initialized
    globalLogger = new AutoWeaveLogger({
      level: 'info',
      service: 'autoweave',
      environment: process.env.NODE_ENV || 'development',
      enableConsole: true
    });
  }
  return globalLogger;
}