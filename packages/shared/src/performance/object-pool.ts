/**
 * High-performance object pool for reducing garbage collection pressure
 * Implements a lock-free pool with automatic size management
 */
export class ObjectPool<T> {
  private pool: T[] = [];
  private factory: () => T;
  private reset: (obj: T) => void;
  private maxSize: number;
  private created = 0;
  private acquired = 0;
  private released = 0;
  private hits = 0;
  private misses = 0;

  constructor(
    factory: () => T,
    reset: (obj: T) => void,
    maxSize: number = 100
  ) {
    this.factory = factory;
    this.reset = reset;
    this.maxSize = maxSize;
  }

  /**
   * Acquire an object from the pool or create a new one
   * O(1) operation
   */
  acquire(): T {
    this.acquired++;
    
    if (this.pool.length > 0) {
      this.hits++;
      return this.pool.pop()!;
    }
    
    this.misses++;
    this.created++;
    return this.factory();
  }

  /**
   * Release an object back to the pool
   * O(1) operation if pool is not full
   */
  release(obj: T): void {
    this.released++;
    
    if (this.pool.length < this.maxSize) {
      // Reset object state before returning to pool
      try {
        this.reset(obj);
        this.pool.push(obj);
      } catch (error) {
        // If reset fails, don't add to pool
        console.error('Failed to reset object for pool:', error);
      }
    }
    // If pool is full, let GC handle the object
  }

  /**
   * Pre-populate the pool with objects
   * Useful for warming up the pool before high-load scenarios
   */
  prewarm(count: number): void {
    const toCreate = Math.min(count, this.maxSize - this.pool.length);
    
    for (let i = 0; i < toCreate; i++) {
      const obj = this.factory();
      this.reset(obj); // Ensure clean state
      this.pool.push(obj);
      this.created++;
    }
  }

  /**
   * Clear all objects from the pool
   * Useful for memory pressure scenarios
   */
  clear(): void {
    this.pool.length = 0;
  }

  /**
   * Resize the pool maximum size
   * If reducing size, excess objects are removed
   */
  resize(newMaxSize: number): void {
    this.maxSize = newMaxSize;
    
    if (this.pool.length > newMaxSize) {
      this.pool.length = newMaxSize;
    }
  }

  /**
   * Get pool statistics for monitoring
   */
  getStats(): {
    poolSize: number;
    maxSize: number;
    created: number;
    acquired: number;
    released: number;
    hitRate: number;
    missRate: number;
  } {
    const totalRequests = this.hits + this.misses;
    
    return {
      poolSize: this.pool.length,
      maxSize: this.maxSize,
      created: this.created,
      acquired: this.acquired,
      released: this.released,
      hitRate: totalRequests > 0 ? this.hits / totalRequests : 0,
      missRate: totalRequests > 0 ? this.misses / totalRequests : 0
    };
  }
}

/**
 * Specialized buffer pool for binary data
 * Reduces allocation overhead for network and IPC operations
 */
export class BufferPool extends ObjectPool<Buffer> {
  constructor(bufferSize: number, maxPoolSize: number = 50) {
    super(
      () => Buffer.allocUnsafe(bufferSize),
      (buffer) => buffer.fill(0), // Clear buffer contents
      maxPoolSize
    );
  }

  /**
   * Acquire a buffer and optionally resize it
   */
  acquireWithSize(size: number): Buffer {
    const buffer = this.acquire();
    
    if (buffer.length < size) {
      // Need larger buffer, return current and create new
      this.release(buffer);
      return Buffer.allocUnsafe(size);
    }
    
    return buffer.slice(0, size);
  }
}

/**
 * Array pool for reducing array allocations
 * Useful for temporary arrays in hot paths
 */
export class ArrayPool<T> extends ObjectPool<T[]> {
  constructor(maxPoolSize: number = 100) {
    super(
      () => [],
      (arr) => { arr.length = 0; }, // Clear array contents
      maxPoolSize
    );
  }
}

/**
 * Generic object pool manager for multiple object types
 */
export class PoolManager {
  private pools = new Map<string, ObjectPool<any>>();

  /**
   * Register a new object pool
   */
  registerPool<T>(
    name: string,
    factory: () => T,
    reset: (obj: T) => void,
    maxSize: number = 100
  ): ObjectPool<T> {
    const pool = new ObjectPool(factory, reset, maxSize);
    this.pools.set(name, pool);
    return pool;
  }

  /**
   * Get a registered pool
   */
  getPool<T>(name: string): ObjectPool<T> | undefined {
    return this.pools.get(name);
  }

  /**
   * Clear all pools
   */
  clearAll(): void {
    for (const pool of this.pools.values()) {
      pool.clear();
    }
  }

  /**
   * Get statistics for all pools
   */
  getAllStats(): Map<string, ReturnType<ObjectPool<any>['getStats']>> {
    const stats = new Map();
    
    for (const [name, pool] of this.pools) {
      stats.set(name, pool.getStats());
    }
    
    return stats;
  }

  /**
   * Prewarm all pools
   */
  prewarmAll(percentage: number = 0.5): void {
    for (const pool of this.pools.values()) {
      const count = Math.floor(pool.getStats().maxSize * percentage);
      pool.prewarm(count);
    }
  }
}