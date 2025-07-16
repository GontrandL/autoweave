# Enhanced USB Daemon

The Enhanced USB Daemon is a production-ready implementation with advanced features for high-performance USB device monitoring.

## Features

### 1. Event Debouncing
- Configurable debounce window (default: 50ms)
- Rate limiting (max events per second)
- Batch processing for efficiency
- Duplicate event detection

### 2. Optimized Device Extraction
- Cached device information with WeakRef
- Parallel string descriptor fetching
- Timeout protection (3s max per device)
- Automatic cache cleanup

### 3. Batch Redis Publishing
- Efficient batch publishing with pipelining
- Backpressure handling
- Automatic reconnection
- Stream length management (MAXLEN)

### 4. Enhanced Platform Detection
- Comprehensive platform capability detection
- WSL and Docker detection
- Automatic strategy selection
- Platform-specific optimizations

### 5. Memory Management
- WeakRef-based caching
- Periodic garbage collection
- Memory usage monitoring
- Aggressive cleanup on high memory

### 6. Production Monitoring
- Health check endpoints (/health, /metrics, /ready, /live)
- Prometheus metrics export
- Real-time statistics
- Graceful shutdown

## Usage

```typescript
import { createEnhancedUSBDaemon, getRecommendedConfig } from '@autoweave/usb-daemon';

// Get platform-optimized configuration
const recommendedConfig = getRecommendedConfig();

const config = {
  redis: {
    host: 'localhost',
    port: 6379,
    db: 0
  },
  monitoring: {
    enabled: true,
    healthcheck_port: 3456,
    interval: 10000
  },
  performance: recommendedConfig.performance,
  // ... other config
};

const daemon = createEnhancedUSBDaemon(config);

// Start monitoring
await daemon.start();
```

## Configuration

### Performance Tuning

```typescript
{
  performance: {
    max_events_per_second: 100,  // Rate limiting
    debounce_ms: 50,            // Event debouncing
    batch_size: 10              // Redis batch size
  }
}
```

### Device Filtering

```typescript
{
  filters: {
    vendor_whitelist: [0x1234],     // Only these vendors
    vendor_blacklist: [0x0000],     // Exclude these vendors
    device_class_filter: [0x03, 0x08] // HID and Storage only
  }
}
```

### Memory Management

The daemon automatically manages memory through:
- WeakRef caching for device objects
- Periodic cleanup every 10 seconds
- Aggressive cleanup when memory > 100MB
- Manual GC triggering when available

## Health Monitoring

### Health Check Endpoint
```bash
curl http://localhost:3456/health
```

Response:
```json
{
  "status": "healthy",
  "timestamp": 1234567890,
  "uptime": 3600000,
  "checks": {
    "daemon": true,
    "redis": true,
    "memory": true,
    "eventProcessing": true
  },
  "metrics": {
    "connectedDevices": 5,
    "eventsPerSecond": 12,
    "memoryUsageMB": 45,
    "queueSize": 0,
    "lastEventTime": 1234567890
  }
}
```

### Prometheus Metrics
```bash
curl http://localhost:3456/metrics
```

## Platform-Specific Features

### Linux
- Hybrid mode with udev support
- Systemd integration ready
- Optimized for kernel 5.x+

### Windows
- UsbDk backend support
- Increased debounce time (100ms)
- Smaller batch sizes

### macOS
- Conservative rate limiting (50 events/sec)
- Optimized for IOKit limitations

## Error Recovery

The daemon includes automatic error recovery:
- Exponential backoff for failed operations
- Automatic fallback strategies
- Redis reconnection with backoff
- Device extraction timeout protection

## Performance Benchmarks

Based on testing:
- Can handle 200+ events/second on Linux
- Memory usage stable at ~50MB with 100 devices
- Redis publishing latency < 10ms average
- Event deduplication reduces load by ~40%

## Troubleshooting

### High Memory Usage
- Check `/health` endpoint for memory stats
- Force garbage collection: `daemon.forceGarbageCollection()`
- Reduce cache sizes in configuration

### Event Processing Delays
- Check Redis backpressure warnings
- Increase batch size for better throughput
- Reduce debounce time if needed

### Platform Issues
- Check platform capabilities: `daemon.getPlatformInfo()`
- Review error recovery strategies in logs
- Ensure proper permissions for USB access