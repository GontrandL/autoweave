// Original USB Daemon
export { USBDaemon } from './usb-daemon';
export { USBEventPublisher, USBEventConsumer } from './events/event-publisher';

// Enhanced USB Daemon
export { EnhancedUSBDaemon } from './enhanced-usb-daemon';
export { BatchRedisPublisher } from './events/batch-publisher';
export { USBEventDebouncer } from './core/event-debouncer';
export { OptimizedDeviceExtractor } from './core/device-extractor';
export { USBDaemonMemoryManager } from './core/memory-manager';
export { HealthCheckServer } from './monitoring/health-check';

// Platform detection
export { PlatformDetector, PlatformInfo } from './platform/platform-detection';
export { EnhancedPlatformDetector, EnhancedPlatformInfo } from './platform/enhanced-platform';

// Types
export * from './types';

// Utilities
export { createUSBDaemon, createEnhancedUSBDaemon } from './factory';