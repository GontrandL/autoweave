const Redis = require('ioredis');
const { Logger } = require('@autoweave/shared');

/**
 * Redis ML-Based Cache Manager
 * Intelligent cache with machine learning-based warming and pattern recognition
 */
class RedisMLCache {
    constructor(config = {}) {
        this.config = {
            host: config.host || process.env.REDIS_HOST || 'localhost',
            port: config.port || process.env.REDIS_PORT || 6379,
            password: config.password || process.env.REDIS_PASSWORD,
            db: config.db || 0,
            keyPrefix: config.keyPrefix || 'autoweave:',
            defaultTTL: config.defaultTTL || 3600, // 1 hour
            mlEnabled: config.mlEnabled !== false,
            ...config
        };
        
        this.logger = new Logger('RedisMLCache');
        this.redis = null;
        this.isConnected = false;
        
        // ML-based features
        this.accessPatterns = new Map(); // Track access patterns
        this.warmingQueue = new Set();   // Cache warming queue
        this.hitRateTracker = {
            hits: 0,
            misses: 0,
            total: 0
        };
        
        // Pattern recognition state
        this.patternAnalysis = {
            frequentKeys: new Map(),
            timeBasedPatterns: new Map(),
            userPatterns: new Map()
        };
    }

    /**
     * Initialize Redis connection with ML features
     */
    async initialize() {
        this.logger.info('Initializing Redis ML Cache...');
        
        try {
            // Create Redis connection
            this.redis = new Redis({
                host: this.config.host,
                port: this.config.port,
                password: this.config.password,
                db: this.config.db,
                keyPrefix: this.config.keyPrefix,
                retryDelayOnFailover: 100,
                enableReadyCheck: true,
                maxRetriesPerRequest: 3
            });

            // Connection event handlers
            this.redis.on('connect', () => {
                this.logger.success('Redis connected successfully');
                this.isConnected = true;
            });

            this.redis.on('error', (error) => {
                this.logger.error('Redis connection error:', error);
                this.isConnected = false;
            });

            this.redis.on('close', () => {
                this.logger.warn('Redis connection closed');
                this.isConnected = false;
            });

            // Wait for connection
            await this.redis.ping();
            
            // Initialize ML features if enabled
            if (this.config.mlEnabled) {
                await this.initializeMLFeatures();
            }
            
            this.logger.success('Redis ML Cache initialized successfully');
            
        } catch (error) {
            this.logger.error('Failed to initialize Redis ML Cache:', error);
            throw error;
        }
    }

    /**
     * Initialize machine learning features
     */
    async initializeMLFeatures() {
        this.logger.info('Initializing ML-based cache features...');
        
        // Load existing patterns from Redis
        await this.loadPatterns();
        
        // Start pattern analysis background task
        this.startPatternAnalysis();
        
        // Start cache warming background task
        this.startCacheWarming();
        
        this.logger.success('ML features initialized');
    }

    /**
     * Intelligent cache get with pattern learning
     */
    async get(key, options = {}) {
        if (!this.isConnected) {
            this.logger.warn('Redis not connected, returning null');
            return null;
        }

        try {
            const startTime = Date.now();
            const result = await this.redis.get(key);
            const duration = Date.now() - startTime;
            
            // Track access patterns
            this.trackAccess(key, result !== null, duration, options);
            
            // Update hit/miss stats
            if (result !== null) {
                this.hitRateTracker.hits++;
                this.logger.debug(`Cache HIT for key: ${key} (${duration}ms)`);
            } else {
                this.hitRateTracker.misses++;
                this.logger.debug(`Cache MISS for key: ${key} (${duration}ms)`);
            }
            this.hitRateTracker.total++;
            
            // Parse JSON if result exists
            return result ? JSON.parse(result) : null;
            
        } catch (error) {
            this.logger.error(`Cache get error for key ${key}:`, error);
            return null;
        }
    }

    /**
     * Intelligent cache set with ML-based TTL optimization
     */
    async set(key, value, options = {}) {
        if (!this.isConnected) {
            this.logger.warn('Redis not connected, skipping cache set');
            return false;
        }

        try {
            // ML-based TTL optimization
            const optimizedTTL = await this.optimizeTTL(key, options.ttl);
            
            const serialized = JSON.stringify(value);
            
            if (optimizedTTL) {
                await this.redis.setex(key, optimizedTTL, serialized);
            } else {
                await this.redis.set(key, serialized);
            }
            
            // Track setting patterns
            this.trackSet(key, value, optimizedTTL, options);
            
            this.logger.debug(`Cache SET for key: ${key} (TTL: ${optimizedTTL}s)`);
            return true;
            
        } catch (error) {
            this.logger.error(`Cache set error for key ${key}:`, error);
            return false;
        }
    }

    /**
     * ML-based TTL optimization
     */
    async optimizeTTL(key, requestedTTL) {
        if (!this.config.mlEnabled) {
            return requestedTTL || this.config.defaultTTL;
        }

        // Analyze historical access patterns for this key type
        const keyPattern = this.extractKeyPattern(key);
        const patterns = this.patternAnalysis.frequentKeys.get(keyPattern);
        
        if (patterns && patterns.accessFrequency > 10) {
            // High frequency keys get longer TTL
            const optimizedTTL = Math.min(
                (requestedTTL || this.config.defaultTTL) * (1 + patterns.accessFrequency / 100),
                86400 // Max 24 hours
            );
            
            this.logger.debug(`TTL optimized for ${key}: ${requestedTTL} → ${optimizedTTL}`);
            return Math.floor(optimizedTTL);
        }
        
        return requestedTTL || this.config.defaultTTL;
    }

    /**
     * Track access patterns for ML
     */
    trackAccess(key, isHit, duration, options) {
        if (!this.config.mlEnabled) return;

        const now = new Date();
        const keyPattern = this.extractKeyPattern(key);
        const userId = options.userId || 'anonymous';
        
        // Track frequent keys
        if (!this.patternAnalysis.frequentKeys.has(keyPattern)) {
            this.patternAnalysis.frequentKeys.set(keyPattern, {
                accessCount: 0,
                accessFrequency: 0,
                avgDuration: 0,
                hitRate: 0,
                lastAccess: now
            });
        }
        
        const pattern = this.patternAnalysis.frequentKeys.get(keyPattern);
        pattern.accessCount++;
        pattern.avgDuration = (pattern.avgDuration + duration) / 2;
        pattern.hitRate = (pattern.hitRate * (pattern.accessCount - 1) + (isHit ? 1 : 0)) / pattern.accessCount;
        pattern.lastAccess = now;
        pattern.accessFrequency = pattern.accessCount / ((now - pattern.lastAccess) / 3600000 || 1); // per hour
        
        // Track time-based patterns
        const hour = now.getHours();
        if (!this.patternAnalysis.timeBasedPatterns.has(hour)) {
            this.patternAnalysis.timeBasedPatterns.set(hour, { count: 0, keys: new Set() });
        }
        this.patternAnalysis.timeBasedPatterns.get(hour).count++;
        this.patternAnalysis.timeBasedPatterns.get(hour).keys.add(keyPattern);
        
        // Track user patterns
        if (!this.patternAnalysis.userPatterns.has(userId)) {
            this.patternAnalysis.userPatterns.set(userId, { keys: new Set(), accessCount: 0 });
        }
        this.patternAnalysis.userPatterns.get(userId).keys.add(keyPattern);
        this.patternAnalysis.userPatterns.get(userId).accessCount++;
    }

    /**
     * Track cache set operations
     */
    trackSet(key, value, ttl, options) {
        if (!this.config.mlEnabled) return;
        
        const keyPattern = this.extractKeyPattern(key);
        
        // Add to warming queue if it's a frequent pattern
        const patterns = this.patternAnalysis.frequentKeys.get(keyPattern);
        if (patterns && patterns.accessFrequency > 5) {
            this.warmingQueue.add(keyPattern);
        }
    }

    /**
     * Extract pattern from cache key
     */
    extractKeyPattern(key) {
        // Remove dynamic parts (IDs, timestamps) to identify patterns
        return key
            .replace(/:\d+/g, ':*')           // Replace numeric IDs
            .replace(/:[a-f0-9-]{36}/g, ':*') // Replace UUIDs
            .replace(/:\d{4}-\d{2}-\d{2}/g, ':*') // Replace dates
            .replace(/:\d{13}/g, ':*');       // Replace timestamps
    }

    /**
     * Start pattern analysis background task
     */
    startPatternAnalysis() {
        setInterval(async () => {
            await this.analyzePatterns();
        }, 300000); // Every 5 minutes
    }

    /**
     * Analyze patterns and optimize cache strategy
     */
    async analyzePatterns() {
        if (!this.config.mlEnabled || !this.isConnected) return;

        try {
            this.logger.debug('Analyzing cache patterns...');
            
            // Identify top patterns for warming
            const topPatterns = Array.from(this.patternAnalysis.frequentKeys.entries())
                .sort(([,a], [,b]) => b.accessFrequency - a.accessFrequency)
                .slice(0, 10);
            
            // Add top patterns to warming queue
            topPatterns.forEach(([pattern]) => {
                this.warmingQueue.add(pattern);
            });
            
            // Save patterns to Redis for persistence
            await this.savePatterns();
            
            this.logger.debug(`Pattern analysis complete. Top patterns: ${topPatterns.length}`);
            
        } catch (error) {
            this.logger.error('Pattern analysis error:', error);
        }
    }

    /**
     * Start cache warming background task
     */
    startCacheWarming() {
        setInterval(async () => {
            await this.performCacheWarming();
        }, 600000); // Every 10 minutes
    }

    /**
     * Perform intelligent cache warming
     */
    async performCacheWarming() {
        if (!this.config.mlEnabled || !this.isConnected) return;
        if (this.warmingQueue.size === 0) return;

        try {
            this.logger.debug('Starting cache warming...');
            
            // Warm cache for patterns in queue
            for (const pattern of this.warmingQueue) {
                await this.warmPattern(pattern);
            }
            
            this.warmingQueue.clear();
            this.logger.debug('Cache warming complete');
            
        } catch (error) {
            this.logger.error('Cache warming error:', error);
        }
    }

    /**
     * Warm cache for specific pattern
     */
    async warmPattern(pattern) {
        // This would be implemented based on your specific use case
        // For example, pre-fetch common memory searches, agent statuses, etc.
        this.logger.debug(`Warming pattern: ${pattern}`);
        
        // Example: If it's a memory search pattern, pre-execute common searches
        if (pattern.includes('memory:search:')) {
            // Pre-warm common searches
            // Implementation would depend on your memory service
        }
    }

    /**
     * Load patterns from Redis
     */
    async loadPatterns() {
        try {
            const patternsData = await this.redis.get('ml:patterns');
            if (patternsData) {
                const patterns = JSON.parse(patternsData);
                
                // Restore frequent keys patterns
                if (patterns.frequentKeys) {
                    this.patternAnalysis.frequentKeys = new Map(patterns.frequentKeys);
                }
                
                this.logger.debug('Patterns loaded from Redis');
            }
        } catch (error) {
            this.logger.error('Error loading patterns:', error);
        }
    }

    /**
     * Save patterns to Redis
     */
    async savePatterns() {
        try {
            const patterns = {
                frequentKeys: Array.from(this.patternAnalysis.frequentKeys.entries()),
                timestamp: new Date().toISOString()
            };
            
            await this.redis.setex('ml:patterns', 86400, JSON.stringify(patterns)); // 24h TTL
            
        } catch (error) {
            this.logger.error('Error saving patterns:', error);
        }
    }

    /**
     * Get cache statistics and ML insights
     */
    getStats() {
        const hitRate = this.hitRateTracker.total > 0 
            ? (this.hitRateTracker.hits / this.hitRateTracker.total * 100).toFixed(2)
            : 0;

        return {
            connected: this.isConnected,
            hitRate: `${hitRate}%`,
            totalRequests: this.hitRateTracker.total,
            hits: this.hitRateTracker.hits,
            misses: this.hitRateTracker.misses,
            mlEnabled: this.config.mlEnabled,
            patternsDiscovered: this.patternAnalysis.frequentKeys.size,
            warmingQueueSize: this.warmingQueue.size,
            topPatterns: Array.from(this.patternAnalysis.frequentKeys.entries())
                .sort(([,a], [,b]) => b.accessFrequency - a.accessFrequency)
                .slice(0, 5)
                .map(([pattern, stats]) => ({
                    pattern,
                    frequency: stats.accessFrequency.toFixed(2),
                    hitRate: (stats.hitRate * 100).toFixed(2) + '%'
                }))
        };
    }

    /**
     * Force cache warming for specific patterns
     */
    async forceWarm(patterns = []) {
        if (!this.isConnected) return false;
        
        patterns.forEach(pattern => this.warmingQueue.add(pattern));
        await this.performCacheWarming();
        
        return true;
    }

    /**
     * Clear cache with pattern support
     */
    async clear(pattern = '*') {
        if (!this.isConnected) return false;
        
        try {
            const keys = await this.redis.keys(pattern);
            if (keys.length > 0) {
                await this.redis.del(...keys);
                this.logger.info(`Cleared ${keys.length} cache entries matching pattern: ${pattern}`);
            }
            return true;
            
        } catch (error) {
            this.logger.error('Cache clear error:', error);
            return false;
        }
    }

    /**
     * Shutdown cache manager
     */
    async shutdown() {
        this.logger.info('Shutting down Redis ML Cache...');
        
        if (this.config.mlEnabled) {
            await this.savePatterns();
        }
        
        if (this.redis) {
            await this.redis.quit();
        }
        
        this.isConnected = false;
        this.logger.info('Redis ML Cache shutdown complete');
    }
}

module.exports = { RedisMLCache };