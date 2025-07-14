# USB Daemon Test Suite

Comprehensive test suite for the AutoWeave USB Daemon component validating Sprint 1 requirements.

## Test Categories

### Unit Tests (`/unit`)

Tests individual components in isolation with mocked dependencies.

#### `event-debouncer.test.ts`
- **Purpose**: Validates event debouncing logic to prevent duplicate USB events
- **Coverage**: 
  - Event deduplication within time windows
  - Per-device event tracking
  - Memory cleanup and statistics
  - Edge cases (rapid connect/disconnect, missing serial numbers)
- **Targets**: Event processing latency < 10ms

#### `device-extractor.test.ts`
- **Purpose**: Tests USB device information extraction with timeout handling
- **Coverage**:
  - Device descriptor parsing
  - String descriptor extraction with retries
  - Timeout handling and error recovery
  - Platform-specific device path generation
  - Caching for performance
- **Targets**: Extraction timeout < 1000ms, retry mechanism

#### `batch-publisher.test.ts`
- **Purpose**: Validates Redis batch publishing for optimal performance
- **Coverage**:
  - Event batching and flush intervals
  - Error handling with exponential backoff
  - Memory management for large batches
  - Graceful shutdown with pending events
  - Redis connection resilience
- **Targets**: Batch processing < 100ms, no memory leaks

### Integration Tests (`/integration`)

Tests components working together with real Redis instances.

#### `usb-redis-flow.test.ts`
- **Purpose**: End-to-end USB event to Redis stream flow
- **Coverage**:
  - Complete USB attachment/detachment workflow
  - Redis stream message format validation
  - Concurrent device handling
  - Error recovery and reconnection
  - Performance under sustained load
- **Requirements**: Redis instance running
- **Targets**: Event latency < 100ms, throughput > 50 events/sec

### Performance Tests (`/performance`)

Validates performance requirements under load conditions.

#### `memory-leak.test.ts`
- **Purpose**: Ensures no memory leaks during extended operation
- **Coverage**:
  - 1000 plug/unplug cycles without memory growth
  - Event listener cleanup verification
  - Worker thread resource management
  - Long-running stability testing
- **Targets**: Memory increase < 1MB per 1000 cycles

## Running Tests

### Prerequisites

```bash
# Install dependencies
npm install

# Start Redis (for integration tests)
docker run -d --name test-redis -p 6379:6379 redis:7-alpine

# Enable garbage collection (for memory tests)
export NODE_OPTIONS="--expose-gc"
```

### Individual Test Categories

```bash
# Unit tests only
npm run test:usb-daemon:unit

# Integration tests (requires Redis)
npm run test:usb-daemon:integration

# Performance tests
npm run test:usb-daemon:performance

# All USB daemon tests
npm run test:usb-daemon
```

### Test Configuration

Tests use environment variables for configuration:

```bash
# Redis connection
REDIS_URL=redis://localhost:6379

# USB mocking
USB_MOCK_MODE=true

# Performance targets
PERF_LOAD_TIME_TARGET=250
PERF_MEMORY_LEAK_TARGET=1048576  # 1MB
PERF_LATENCY_TARGET=100
```

## Test Structure

### Mock Strategy

- **Unit Tests**: Full mocking of external dependencies (Redis, USB, fs)
- **Integration Tests**: Real Redis, mocked USB hardware
- **Performance Tests**: Optimized mocks for consistent timing

### Custom Matchers

```typescript
// Performance validation
expect(loadTime).toMeetPerformanceTarget(250, 'load time');

// USB device validation
expect(device).toBeValidUSBDevice();

// Memory leak detection
expect(memoryIncrease).toNotLeakMemory(1000);
```

### Test Utilities

```typescript
// Performance measurement
performanceTestUtils.startMeasurement('test-name');
// ... test operations
const results = performanceTestUtils.endMeasurement();

// Redis message validation
const message = await integrationTestUtils.waitForRedisMessage('aw:hotplug');

// Mock device creation
const device = integrationTestUtils.createMockUSBDevice(0x1234, 0x5678);
```

## Performance Targets

| Metric | Target | Validation |
|--------|--------|------------|
| Event Debouncing | < 10ms | Unit tests |
| Device Extraction | < 1000ms | Unit tests |
| Redis Publishing | < 100ms | Integration tests |
| Event Latency | < 100ms | Integration tests |
| Memory Leak | < 1MB/1000 cycles | Performance tests |
| Throughput | > 50 events/sec | Integration tests |

## Troubleshooting

### Redis Connection Issues

```bash
# Check Redis is running
docker ps | grep redis

# Start Redis if needed
docker run -d --name test-redis -p 6379:6379 redis:7-alpine

# Check Redis logs
docker logs test-redis
```

### Memory Test Issues

```bash
# Ensure garbage collection is available
node --expose-gc -e "console.log(typeof global.gc)"

# Should output "function"
```

### USB Mock Issues

```bash
# Verify USB mocking is enabled
echo $USB_MOCK_MODE  # Should be "true"

# Check for conflicting USB processes
lsof -i :3000  # USB daemon default port
```

## Coverage Requirements

- **Unit Tests**: 85% coverage minimum
- **Integration Tests**: Core workflows covered
- **Performance Tests**: All performance targets validated

## Continuous Integration

Tests are integrated into CI/CD pipeline:

```yaml
# Example CI configuration
- name: USB Daemon Tests
  run: |
    docker run -d --name ci-redis -p 6379:6379 redis:7-alpine
    npm run test:usb-daemon
    docker stop ci-redis
```

## Contributing

When adding new USB daemon features:

1. Add unit tests for new components
2. Update integration tests for new workflows
3. Add performance tests for new requirements
4. Update documentation and targets
5. Ensure all tests pass locally before submitting