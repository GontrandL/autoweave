# Plugin Loader Test Suite

Comprehensive test suite for the AutoWeave Plugin Loader component validating Sprint 1 security and performance requirements.

## Test Categories

### Unit Tests (`/unit`)

Tests individual components in isolation with mocked dependencies.

#### `manifest-validator.test.ts`
- **Purpose**: Validates plugin manifest schema compliance with AJV
- **Coverage**:
  - Required field validation
  - Version format compliance (semver)
  - Permission format validation
  - Resource limit validation
  - Signature format validation
  - Dependency declaration validation
- **Targets**: Validation time < 10ms, 100% schema coverage

#### `permission-manager.test.ts`
- **Purpose**: Tests security permission validation and enforcement
- **Coverage**:
  - Permission checking and enforcement
  - Path traversal attack prevention
  - Filesystem access boundaries
  - Network access control
  - Rate limiting per plugin
  - Permission auditing and logging
- **Security Focus**: Zero false positives for valid permissions, zero bypass attempts succeed

#### `plugin-worker-pool.test.ts`
- **Purpose**: Validates worker pool management and scaling
- **Coverage**:
  - Worker creation and termination
  - Task queuing and execution
  - Auto-scaling based on load
  - Resource limit enforcement
  - Error recovery and worker restart
  - Graceful shutdown procedures
- **Targets**: Worker startup < 100ms, pool scaling < 500ms

### Integration Tests (`/integration`)

Tests plugin loading and hot-reload functionality with real filesystem operations.

#### `plugin-hot-reload.test.ts`
- **Purpose**: End-to-end plugin lifecycle management
- **Coverage**:
  - Plugin loading within 250ms target
  - Manifest validation in real scenarios
  - Security boundary enforcement
  - Hot-reload detection and execution
  - State preservation during reload
  - Concurrent plugin operations
  - Error recovery scenarios
- **Requirements**: Filesystem access, Redis instance
- **Targets**: Load time < 250ms, hot-reload < 500ms

### Security Tests (`/security`)

Validates security sandbox effectiveness against escape attempts.

#### `sandbox-escape.test.ts`
- **Purpose**: Prevents plugin security sandbox bypass
- **Coverage**:
  - Filesystem access prevention
  - Process spawning blocking
  - Network access control
  - Global object pollution prevention
  - Eval and code generation blocking
  - Resource exhaustion prevention
  - Timing attack mitigation
- **Security Requirements**: 100% escape attempt prevention

### Performance Tests (`/performance`)

Validates performance requirements under various load conditions.

#### `load-time.test.ts`
- **Purpose**: Ensures plugin load times meet Sprint 1 targets
- **Coverage**:
  - Single plugin load time < 250ms
  - Parallel plugin loading performance
  - Load time optimization verification
  - Memory usage during loading
  - Complex plugin handling
  - Dependency resolution performance
- **Targets**: 95th percentile load time < 250ms

## Running Tests

### Prerequisites

```bash
# Install dependencies
npm install

# Start Redis (for integration tests)
docker run -d --name test-redis -p 6379:6379 redis:7-alpine

# Create test plugin directory
mkdir -p /tmp/autoweave-test-plugins

# Enable garbage collection (for memory tests)
export NODE_OPTIONS="--expose-gc"
```

### Individual Test Categories

```bash
# Unit tests only
npm run test:plugin-loader:unit

# Integration tests (requires Redis and filesystem)
npm run test:plugin-loader:integration

# Security tests (isolated sandbox testing)
npm run test:plugin-loader:security

# Performance tests
npm run test:plugin-loader:performance

# All plugin loader tests
npm run test:plugin-loader
```

### Test Configuration

Tests use environment variables for configuration:

```bash
# Plugin configuration
PLUGIN_SANDBOX_ENABLED=true
PLUGIN_VALIDATION_STRICT=true
PLUGIN_TEST_DIR=/tmp/autoweave-test-plugins

# Performance targets
PLUGIN_LOAD_TIME_TARGET=250  # ms
PLUGIN_MEMORY_LIMIT=134217728  # 128MB
PLUGIN_WORKER_TIMEOUT=5000  # ms

# Security configuration
SECURITY_TEST_TIMEOUT=10000
SECURITY_VIOLATION_ACTION=log
```

## Test Structure

### Mock Strategy

- **Unit Tests**: Full isolation with mocked filesystem, workers, and Redis
- **Integration Tests**: Real filesystem and Redis, controlled plugin environment
- **Security Tests**: Isolated sandbox with malicious plugin code
- **Performance Tests**: Optimized real operations with precise timing

### Security Test Methodology

Security tests use actual malicious code patterns:

```typescript
// Example: Path traversal test
const maliciousCode = `
  const fs = require('fs');
  try {
    const data = fs.readFileSync('../../../etc/passwd', 'utf8');
    module.exports = { data };
  } catch (error) {
    module.exports = { error: error.message };
  }
`;
```

### Performance Measurement

```typescript
// Load time measurement
const start = performance.now();
await pluginManager.loadPlugin(pluginPath);
const loadTime = performance.now() - start;
expect(loadTime).toMeetLoadTimeTarget();

// Memory leak detection
performanceTestUtils.startMeasurement('memory-test', 1000);
// ... run 1000 cycles
const results = performanceTestUtils.endMeasurement();
expect(results.memoryIncrease).toNotLeakMemory(1000);
```

### Custom Matchers

```typescript
// Plugin validation
expect(manifest).toHaveValidPluginManifest();

// Security validation
expect(() => plugin.executeCode()).toThrow('Permission denied');

// Performance validation
expect(loadTime).toMeetLoadTimeTarget();
expect(memoryIncrease).toNotLeakMemory(cycles);
```

## Security Testing Framework

### Attack Vectors Tested

1. **Filesystem Attacks**
   - Path traversal (`../../../etc/passwd`)
   - System file access (`/etc/shadow`)
   - Write attempts to protected directories

2. **Process Attacks**
   - Child process spawning
   - Shell command execution
   - Process binding access

3. **Network Attacks**
   - Unauthorized HTTP requests
   - Raw socket creation
   - Port scanning attempts

4. **Code Injection**
   - `eval()` usage
   - `Function` constructor
   - VM module exploitation

5. **Resource Exhaustion**
   - Infinite loops
   - Memory bombs
   - Fork bombs

6. **Privilege Escalation**
   - Global object pollution
   - Prototype pollution
   - Require cache manipulation

### Security Test Results

All security tests must achieve:
- **0 successful escapes**: No malicious code executes successfully
- **100% detection rate**: All attack attempts are caught and logged
- **Graceful handling**: System remains stable after attack attempts

## Performance Requirements

| Component | Metric | Target | Test Coverage |
|-----------|--------|--------|---------------|
| Plugin Loading | Load Time | < 250ms | 95th percentile |
| Manifest Validation | Validation Time | < 10ms | Average |
| Worker Pool | Startup Time | < 100ms | Cold start |
| Worker Pool | Scaling Time | < 500ms | Load response |
| Hot Reload | Reload Time | < 500ms | File change to ready |
| Memory Usage | Leak Prevention | < 1MB/1000 cycles | Extended operation |

## Plugin Test Fixtures

Test plugins are created programmatically:

```typescript
// Simple plugin
await createTestPlugin(pluginPath, {
  name: 'test-plugin',
  version: '1.0.0',
  entry: './index.js',
  permissions: ['memory:read'],
});

// Complex plugin with dependencies
await createTestPlugin(pluginPath, {
  name: 'complex-plugin',
  version: '1.0.0',
  entry: './index.js',
  dependencies: {
    external: ['lodash@4.17.21'],
    autoweave: ['@autoweave/memory@2.0.0'],
  },
  hooks: {
    onLoad: './hooks/onLoad.js',
    onUnload: './hooks/onUnload.js',
  },
});
```

## Troubleshooting

### Plugin Loading Issues

```bash
# Check plugin directory permissions
ls -la /tmp/autoweave-test-plugins

# Verify Node.js worker threads support
node -e "console.log(require('worker_threads').isMainThread)"
```

### Security Test Failures

```bash
# Check sandbox configuration
echo $PLUGIN_SANDBOX_ENABLED  # Should be "true"

# Verify security policies are active
node -e "console.log(process.binding)"  # Should be restricted
```

### Performance Test Variations

```bash
# Enable high-resolution timers
export NODE_OPTIONS="--expose-gc --enable-precise-memory-info"

# Disable other system processes for consistent timing
sudo service docker stop  # If not needed for tests
```

## Coverage Requirements

- **Unit Tests**: 85% line coverage, 80% branch coverage
- **Integration Tests**: All critical workflows covered
- **Security Tests**: 100% attack vector coverage
- **Performance Tests**: All targets validated

## Continuous Integration

Security and performance gates:

```yaml
# CI Pipeline
- name: Security Tests
  run: npm run test:plugin-loader:security
  # Must pass 100% - no security bypasses allowed

- name: Performance Tests  
  run: npm run test:plugin-loader:performance
  # Must meet all performance targets

- name: Load Time Gate
  run: |
    RESULT=$(npm run test:plugin-loader:performance:load-time)
    if [[ $RESULT =~ "FAILED" ]]; then exit 1; fi
```

## Contributing

When adding new plugin loader features:

1. **Security First**: Add security tests before implementation
2. **Performance Validation**: Ensure new features meet load time targets
3. **Comprehensive Coverage**: Add unit, integration, and E2E tests
4. **Documentation**: Update test documentation and requirements
5. **Backwards Compatibility**: Ensure existing plugins continue to work

### Security Review Checklist

- [ ] New permissions are properly scoped
- [ ] Sandbox restrictions are maintained
- [ ] Performance targets are preserved
- [ ] Attack vectors are tested
- [ ] Error handling doesn't leak information
- [ ] Resource limits are enforced