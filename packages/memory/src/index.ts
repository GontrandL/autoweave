/**
 * @autoweave/memory - Hybrid memory system
 */

export { HybridMemoryManager } from './hybrid-memory';
export { Logger } from './logger';

// Export types
export * from './types';

// Keep legacy exports as CommonJS for now
export const Mem0Client = require('./mem0-client.js').Mem0Client;
export const GraphClient = require('./graph-client.js').GraphClient;
export const RedisMlCache = require('./redis-ml-cache.js').RedisMlCache;
export const CodingMemoryManager = require('./coding-memory-manager.js').CodingMemoryManager;