import { EventEmitter } from 'events';

interface MemoryStats {
  heapUsed: number;
  heapTotal: number;
  external: number;
  rss: number;
  cacheSize: number;
  weakRefCount: number;
}

interface CacheEntry<T> {
  weakRef: WeakRef<T>;
  lastAccess: number;
  size: number;
}

export class USBDaemonMemoryManager extends EventEmitter {
  private caches = new Map<string, Map<string, CacheEntry<any>>>();
  private cleanupInterval: NodeJS.Timeout;
  private memoryThreshold = 100 * 1024 * 1024; // 100MB
  private lastGC = Date.now();
  private gcInterval = 30000; // 30 seconds

  constructor() {
    super();
    
    // Start periodic cleanup
    this.cleanupInterval = setInterval(() => {
      this.performCleanup();
    }, 10000); // Every 10 seconds

    // Monitor memory usage
    this.startMemoryMonitoring();
  }

  public registerCache(name: string): void {
    if (!this.caches.has(name)) {
      this.caches.set(name, new Map());
    }
  }

  public cacheObject<T extends object>(
    cacheName: string, 
    key: string, 
    object: T,
    estimatedSize: number = 0
  ): WeakRef<T> {
    const cache = this.caches.get(cacheName);
    if (!cache) {
      throw new Error(`Cache ${cacheName} not registered`);
    }

    const weakRef = new WeakRef(object);
    cache.set(key, {
      weakRef,
      lastAccess: Date.now(),
      size: estimatedSize
    });

    return weakRef;
  }

  public getCachedObject<T extends object>(
    cacheName: string,
    key: string
  ): T | undefined {
    const cache = this.caches.get(cacheName);
    if (!cache) return undefined;

    const entry = cache.get(key);
    if (!entry) return undefined;

    const object = entry.weakRef.deref();
    if (object) {
      entry.lastAccess = Date.now();
      return object as T;
    } else {
      // Object was garbage collected
      cache.delete(key);
      return undefined;
    }
  }

  private performCleanup(): void {
    const stats = this.getMemoryStats();
    
    // Check if we need aggressive cleanup
    if (stats.heapUsed > this.memoryThreshold) {
      this.performAggressiveCleanup();
    } else {
      this.performNormalCleanup();
    }

    // Consider manual GC if needed
    this.considerManualGC(stats);
  }

  private performNormalCleanup(): void {
    const now = Date.now();
    const maxAge = 5 * 60 * 1000; // 5 minutes

    this.caches.forEach((cache, cacheName) => {
      const toDelete: string[] = [];
      
      cache.forEach((entry, key) => {
        // Check if object is still alive
        if (!entry.weakRef.deref()) {
          toDelete.push(key);
        } else if (now - entry.lastAccess > maxAge) {
          // Remove old entries
          toDelete.push(key);
        }
      });

      toDelete.forEach(key => cache.delete(key));
      
      if (toDelete.length > 0) {
        console.log(`Cleaned ${toDelete.length} entries from ${cacheName} cache`);
      }
    });
  }

  private performAggressiveCleanup(): void {
    console.warn('Performing aggressive memory cleanup');
    
    this.caches.forEach((cache, cacheName) => {
      // Keep only the most recently accessed 50% of entries
      const entries = Array.from(cache.entries())
        .sort((a, b) => b[1].lastAccess - a[1].lastAccess);
      
      const keepCount = Math.floor(entries.length / 2);
      const toDelete = entries.slice(keepCount);
      
      toDelete.forEach(([key]) => cache.delete(key));
      
      if (toDelete.length > 0) {
        console.log(`Aggressively cleaned ${toDelete.length} entries from ${cacheName} cache`);
      }
    });

    this.emit('aggressive-cleanup');
  }

  private considerManualGC(stats: MemoryStats): void {
    const now = Date.now();
    
    // Trigger GC if:
    // 1. It's been more than gcInterval since last GC
    // 2. Memory usage is high
    if (now - this.lastGC > this.gcInterval && stats.heapUsed > this.memoryThreshold * 0.8) {
      if (global.gc) {
        console.log('Triggering manual garbage collection');
        global.gc();
        this.lastGC = now;
        this.emit('gc-triggered');
      }
    }
  }

  private startMemoryMonitoring(): void {
    setInterval(() => {
      const stats = this.getMemoryStats();
      
      // Emit warning if memory usage is high
      if (stats.heapUsed > this.memoryThreshold * 0.9) {
        this.emit('memory-warning', stats);
      }
      
      // Emit critical if memory usage is very high
      if (stats.heapUsed > this.memoryThreshold * 1.2) {
        this.emit('memory-critical', stats);
      }
    }, 5000); // Check every 5 seconds
  }

  public getMemoryStats(): MemoryStats {
    const memUsage = process.memoryUsage();
    
    let cacheSize = 0;
    let weakRefCount = 0;
    
    this.caches.forEach(cache => {
      cache.forEach(entry => {
        if (entry.weakRef.deref()) {
          cacheSize += entry.size;
          weakRefCount++;
        }
      });
    });
    
    return {
      heapUsed: memUsage.heapUsed,
      heapTotal: memUsage.heapTotal,
      external: memUsage.external,
      rss: memUsage.rss,
      cacheSize,
      weakRefCount
    };
  }

  public clearCache(cacheName?: string): void {
    if (cacheName) {
      const cache = this.caches.get(cacheName);
      if (cache) {
        cache.clear();
        console.log(`Cleared cache: ${cacheName}`);
      }
    } else {
      this.caches.forEach((cache, name) => {
        cache.clear();
        console.log(`Cleared cache: ${name}`);
      });
    }
  }

  public destroy(): void {
    clearInterval(this.cleanupInterval);
    this.caches.clear();
    this.removeAllListeners();
  }

  public setMemoryThreshold(bytes: number): void {
    this.memoryThreshold = bytes;
  }

  public forceCleanup(): void {
    this.performAggressiveCleanup();
    
    if (global.gc) {
      global.gc();
      this.lastGC = Date.now();
    }
  }
}