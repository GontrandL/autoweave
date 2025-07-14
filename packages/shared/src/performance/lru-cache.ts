/**
 * High-performance LRU (Least Recently Used) cache implementation
 * Uses a Map for O(1) lookups and a doubly-linked list for O(1) eviction
 */
export class LRUCache<K, V> {
  private cache = new Map<K, Node<K, V>>();
  private head: Node<K, V> | null = null;
  private tail: Node<K, V> | null = null;
  private hits = 0;
  private misses = 0;
  private evictions = 0;

  constructor(private maxSize: number) {
    if (maxSize <= 0) {
      throw new Error('Cache size must be positive');
    }
  }

  /**
   * Get a value from the cache
   * O(1) operation
   */
  get(key: K): V | undefined {
    const node = this.cache.get(key);
    
    if (!node) {
      this.misses++;
      return undefined;
    }
    
    this.hits++;
    
    // Move to front (most recently used)
    this.moveToFront(node);
    
    return node.value;
  }

  /**
   * Set a value in the cache
   * O(1) operation
   */
  set(key: K, value: V): void {
    const existingNode = this.cache.get(key);
    
    if (existingNode) {
      // Update existing node
      existingNode.value = value;
      this.moveToFront(existingNode);
      return;
    }
    
    // Create new node
    const newNode = new Node(key, value);
    this.cache.set(key, newNode);
    
    // Add to front
    if (!this.head) {
      this.head = this.tail = newNode;
    } else {
      newNode.next = this.head;
      this.head.prev = newNode;
      this.head = newNode;
    }
    
    // Check size limit
    if (this.cache.size > this.maxSize) {
      this.evict();
    }
  }

  /**
   * Check if key exists in cache
   * O(1) operation
   */
  has(key: K): boolean {
    return this.cache.has(key);
  }

  /**
   * Delete a key from the cache
   * O(1) operation
   */
  delete(key: K): boolean {
    const node = this.cache.get(key);
    
    if (!node) {
      return false;
    }
    
    this.removeNode(node);
    this.cache.delete(key);
    
    return true;
  }

  /**
   * Clear all entries from the cache
   */
  clear(): void {
    this.cache.clear();
    this.head = null;
    this.tail = null;
    this.hits = 0;
    this.misses = 0;
    this.evictions = 0;
  }

  /**
   * Get the current size of the cache
   */
  get size(): number {
    return this.cache.size;
  }

  /**
   * Get all keys in the cache (most to least recently used)
   */
  keys(): K[] {
    const keys: K[] = [];
    let current = this.head;
    
    while (current) {
      keys.push(current.key);
      current = current.next;
    }
    
    return keys;
  }

  /**
   * Get all values in the cache (most to least recently used)
   */
  values(): V[] {
    const values: V[] = [];
    let current = this.head;
    
    while (current) {
      values.push(current.value);
      current = current.next;
    }
    
    return values;
  }

  /**
   * Get all entries in the cache (most to least recently used)
   */
  entries(): Array<[K, V]> {
    const entries: Array<[K, V]> = [];
    let current = this.head;
    
    while (current) {
      entries.push([current.key, current.value]);
      current = current.next;
    }
    
    return entries;
  }

  /**
   * Iterate over cache entries
   */
  forEach(callback: (value: V, key: K, cache: LRUCache<K, V>) => void): void {
    let current = this.head;
    
    while (current) {
      callback(current.value, current.key, this);
      current = current.next;
    }
  }

  /**
   * Get cache statistics
   */
  getStats(): {
    size: number;
    maxSize: number;
    hits: number;
    misses: number;
    hitRate: number;
    missRate: number;
    evictions: number;
  } {
    const totalRequests = this.hits + this.misses;
    
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      hits: this.hits,
      misses: this.misses,
      hitRate: totalRequests > 0 ? this.hits / totalRequests : 0,
      missRate: totalRequests > 0 ? this.misses / totalRequests : 0,
      evictions: this.evictions
    };
  }

  /**
   * Get hit rate percentage
   */
  getHitRate(): number {
    const total = this.hits + this.misses;
    return total > 0 ? this.hits / total : 0;
  }

  /**
   * Get miss rate percentage
   */
  getMissRate(): number {
    const total = this.hits + this.misses;
    return total > 0 ? this.misses / total : 0;
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.hits = 0;
    this.misses = 0;
    this.evictions = 0;
  }

  /**
   * Move a node to the front of the list (most recently used)
   */
  private moveToFront(node: Node<K, V>): void {
    if (node === this.head) {
      return; // Already at front
    }
    
    // Remove from current position
    this.removeNode(node);
    
    // Add to front
    node.next = this.head;
    node.prev = null;
    
    if (this.head) {
      this.head.prev = node;
    }
    
    this.head = node;
    
    if (!this.tail) {
      this.tail = node;
    }
  }

  /**
   * Remove a node from the linked list
   */
  private removeNode(node: Node<K, V>): void {
    if (node.prev) {
      node.prev.next = node.next;
    } else {
      this.head = node.next;
    }
    
    if (node.next) {
      node.next.prev = node.prev;
    } else {
      this.tail = node.prev;
    }
    
    node.prev = null;
    node.next = null;
  }

  /**
   * Evict the least recently used item
   */
  private evict(): void {
    if (!this.tail) {
      return;
    }
    
    const nodeToEvict = this.tail;
    
    // Remove from linked list
    if (nodeToEvict.prev) {
      nodeToEvict.prev.next = null;
      this.tail = nodeToEvict.prev;
    } else {
      this.head = this.tail = null;
    }
    
    // Remove from cache
    this.cache.delete(nodeToEvict.key);
    this.evictions++;
  }
}

/**
 * Node class for the doubly-linked list
 */
class Node<K, V> {
  prev: Node<K, V> | null = null;
  next: Node<K, V> | null = null;
  
  constructor(
    public key: K,
    public value: V
  ) {}
}

/**
 * Time-based expiring LRU cache
 * Entries expire after a specified TTL (time-to-live)
 */
export class TTLCache<K, V> extends LRUCache<K, { value: V; expires: number }> {
  constructor(
    maxSize: number,
    private ttlMs: number
  ) {
    super(maxSize);
  }

  /**
   * Get a value from the cache if not expired
   */
  get(key: K): V | undefined {
    const entry = super.get(key);
    
    if (!entry) {
      return undefined;
    }
    
    // Check if expired
    if (Date.now() > entry.expires) {
      this.delete(key);
      return undefined;
    }
    
    return entry.value;
  }

  /**
   * Set a value with TTL
   */
  set(key: K, value: V, customTTL?: number): void {
    const expires = Date.now() + (customTTL || this.ttlMs);
    super.set(key, { value, expires });
  }

  /**
   * Clean up expired entries
   */
  cleanup(): number {
    const now = Date.now();
    let cleaned = 0;
    
    for (const [key, entry] of this.entries()) {
      if (now > entry.expires) {
        this.delete(key);
        cleaned++;
      }
    }
    
    return cleaned;
  }

  /**
   * Get the actual value entries (without expiration info)
   */
  values(): V[] {
    const values: V[] = [];
    const now = Date.now();
    
    for (const entry of super.values()) {
      if (now <= entry.expires) {
        values.push(entry.value);
      }
    }
    
    return values;
  }

  /**
   * Get all non-expired entries
   */
  entries(): Array<[K, V]> {
    const entries: Array<[K, V]> = [];
    const now = Date.now();
    
    for (const [key, entry] of super.entries()) {
      if (now <= entry.expires) {
        entries.push([key, entry.value]);
      }
    }
    
    return entries;
  }
}