import * as http from 'http';
import { USBDaemon } from '../usb-daemon';
import { EventEmitter } from 'events';

interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: number;
  uptime: number;
  checks: {
    daemon: boolean;
    redis: boolean;
    memory: boolean;
    eventProcessing: boolean;
  };
  metrics: {
    connectedDevices: number;
    eventsPerSecond: number;
    memoryUsageMB: number;
    queueSize: number;
    lastEventTime: number;
  };
  errors: string[];
}

export class HealthCheckServer extends EventEmitter {
  private server: http.Server | null = null;
  private daemon: USBDaemon;
  private startTime = Date.now();
  private lastHealthCheck: HealthStatus | null = null;
  private isShuttingDown = false;

  constructor(daemon: USBDaemon, private port: number = 3456) {
    super();
    this.daemon = daemon;
  }

  public async start(): Promise<void> {
    if (this.server) return;

    this.server = http.createServer((req, res) => {
      this.handleRequest(req, res);
    });

    return new Promise((resolve, reject) => {
      this.server!.listen(this.port, () => {
        console.log(`Health check server listening on port ${this.port}`);
        this.emit('started');
        resolve();
      });

      this.server!.on('error', (error) => {
        console.error('Health check server error:', error);
        reject(error);
      });
    });
  }

  private async handleRequest(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    const url = new URL(req.url || '/', `http://localhost:${this.port}`);

    switch (url.pathname) {
      case '/health':
        await this.handleHealthCheck(res);
        break;
      case '/metrics':
        await this.handleMetrics(res);
        break;
      case '/ready':
        await this.handleReadiness(res);
        break;
      case '/live':
        await this.handleLiveness(res);
        break;
      default:
        res.writeHead(404);
        res.end('Not Found');
    }
  }

  private async handleHealthCheck(res: http.ServerResponse): Promise<void> {
    const health = await this.getHealthStatus();
    this.lastHealthCheck = health;

    const statusCode = health.status === 'healthy' ? 200 : 
                      health.status === 'degraded' ? 200 : 503;

    res.writeHead(statusCode, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(health, null, 2));
  }

  private async handleMetrics(res: http.ServerResponse): Promise<void> {
    const metrics = await this.getPrometheusMetrics();
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end(metrics);
  }

  private async handleReadiness(res: http.ServerResponse): Promise<void> {
    const health = await this.getHealthStatus();
    
    if (this.isShuttingDown) {
      res.writeHead(503);
      res.end('Shutting down');
      return;
    }

    if (health.checks.daemon && health.checks.redis) {
      res.writeHead(200);
      res.end('Ready');
    } else {
      res.writeHead(503);
      res.end('Not ready');
    }
  }

  private async handleLiveness(res: http.ServerResponse): Promise<void> {
    const memUsage = process.memoryUsage();
    const memoryOk = memUsage.heapUsed < 500 * 1024 * 1024; // 500MB limit

    if (memoryOk && !this.isShuttingDown) {
      res.writeHead(200);
      res.end('Alive');
    } else {
      res.writeHead(503);
      res.end('Not alive');
    }
  }

  private async getHealthStatus(): Promise<HealthStatus> {
    const errors: string[] = [];
    const stats = this.daemon.getStats();
    const memUsage = process.memoryUsage();

    // Perform health checks
    const checks = {
      daemon: stats.isRunning,
      redis: await this.checkRedis(),
      memory: memUsage.heapUsed < 200 * 1024 * 1024, // 200MB threshold
      eventProcessing: this.checkEventProcessing()
    };

    // Collect errors
    if (!checks.daemon) errors.push('Daemon not running');
    if (!checks.redis) errors.push('Redis connection failed');
    if (!checks.memory) errors.push('High memory usage');
    if (!checks.eventProcessing) errors.push('Event processing stalled');

    // Determine overall status
    const failedChecks = Object.values(checks).filter(v => !v).length;
    const status = failedChecks === 0 ? 'healthy' :
                  failedChecks === 1 ? 'degraded' : 'unhealthy';

    return {
      status,
      timestamp: Date.now(),
      uptime: Date.now() - this.startTime,
      checks,
      metrics: {
        connectedDevices: stats.connectedDevicesCount,
        eventsPerSecond: 0, // This would come from event debouncer
        memoryUsageMB: Math.round(memUsage.heapUsed / 1024 / 1024),
        queueSize: 0, // This would come from batch publisher
        lastEventTime: 0 // This would be tracked
      },
      errors
    };
  }

  private async checkRedis(): Promise<boolean> {
    try {
      // This would check the actual Redis connection
      // For now, return true if daemon is running
      return this.daemon.getStats().isRunning;
    } catch {
      return false;
    }
  }

  private checkEventProcessing(): boolean {
    // This would check if events are being processed
    // For now, return true if daemon is running
    return this.daemon.getStats().isRunning;
  }

  private async getPrometheusMetrics(): Promise<string> {
    const stats = this.daemon.getStats();
    const memUsage = process.memoryUsage();
    const health = await this.getHealthStatus();

    const metrics = [
      '# HELP usb_daemon_up USB daemon status (1=up, 0=down)',
      '# TYPE usb_daemon_up gauge',
      `usb_daemon_up ${stats.isRunning ? 1 : 0}`,
      '',
      '# HELP usb_daemon_connected_devices Number of connected USB devices',
      '# TYPE usb_daemon_connected_devices gauge',
      `usb_daemon_connected_devices ${stats.connectedDevicesCount}`,
      '',
      '# HELP usb_daemon_memory_usage_bytes Memory usage in bytes',
      '# TYPE usb_daemon_memory_usage_bytes gauge',
      `usb_daemon_memory_usage_bytes{type="heap_used"} ${memUsage.heapUsed}`,
      `usb_daemon_memory_usage_bytes{type="heap_total"} ${memUsage.heapTotal}`,
      `usb_daemon_memory_usage_bytes{type="rss"} ${memUsage.rss}`,
      '',
      '# HELP usb_daemon_health_status Health status (1=healthy, 0=unhealthy)',
      '# TYPE usb_daemon_health_status gauge',
      `usb_daemon_health_status ${health.status === 'healthy' ? 1 : 0}`,
      '',
      '# HELP usb_daemon_uptime_seconds Daemon uptime in seconds',
      '# TYPE usb_daemon_uptime_seconds counter',
      `usb_daemon_uptime_seconds ${Math.floor(health.uptime / 1000)}`,
    ];

    return metrics.join('\n');
  }

  public async stop(): Promise<void> {
    this.isShuttingDown = true;

    if (this.server) {
      return new Promise((resolve) => {
        this.server!.close(() => {
          console.log('Health check server stopped');
          this.emit('stopped');
          resolve();
        });
      });
    }
  }

  public getLastHealthStatus(): HealthStatus | null {
    return this.lastHealthCheck;
  }
}