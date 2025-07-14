// Types
export * from './types/plugin';

// Core components
export * from './plugin-manager';
export * from './enhanced-plugin-manager';

// Security
export * from './security/permission-manager';

// Workers
export * from './workers/secure-plugin-worker';
export * from './workers/plugin-worker-pool';

// Watchers
export * from './watcher/optimized-plugin-watcher';

// Parsers
export * from './parsers/fast-manifest-parser';

// Loaders
export * from './loaders/lazy-plugin-loader';

// Validators
export * from './validators/manifest-validator';

// Legacy exports for compatibility
export { PluginWorker } from './plugin-manager';