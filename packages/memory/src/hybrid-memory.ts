import { 
    MemoryConfig, 
    IHybridMemoryManager, 
    MemoryEntry, 
    SearchOptions, 
    SearchResult, 
    GraphNode,
    GraphQuery,
    GraphTopology,
    MemoryMetrics,
    HealthStatus,
    ComponentHealth
} from './types';
import { Logger } from './logger';

// Mock imports for now - will be converted later
const AutoWeaveMemory = require('./mem0-client');
const AutoWeaveGraph = require('./graph-client');
const RedisMLCache = require('./redis-ml-cache');

/**
 * HybridMemoryManager - Gestionnaire de mémoire hybride pour AutoWeave
 * Combine mémoire contextuelle (mem0) et mémoire structurelle (GraphRAG)
 */
export class HybridMemoryManager implements IHybridMemoryManager {
    private config: MemoryConfig;
    private logger: Logger;
    private contextualMemory: any;
    private structuralMemory: any;
    private mlCache: any;
    private searchCache: Map<string, { data: any; timestamp: number }>;
    private cacheTimeout: number;
    private metrics: {
        searches: number;
        search_times: number[];
        cache_hits: number;
        errors: number;
    };

    constructor(config: MemoryConfig = {}) {
        this.config = config;
        this.logger = new Logger('HybridMemory');
        
        // Clients mémoire
        this.contextualMemory = new AutoWeaveMemory(config.vectorStore);
        this.structuralMemory = new AutoWeaveGraph(config.graphStore);
        
        // Redis ML Cache pour optimiser les performances
        this.mlCache = new RedisMLCache(config.cache);
        
        // Cache local pour optimiser les performances (fallback)
        this.searchCache = new Map();
        this.cacheTimeout = 300000; // 5 minutes
        
        // Métriques
        this.metrics = {
            searches: 0,
            search_times: [],
            cache_hits: 0,
            errors: 0
        };
    }

    /**
     * Initialise le système de mémoire hybride
     */
    async initialize(): Promise<void> {
        this.logger.info('Initializing hybrid memory system with ML cache...');
        
        try {
            // Initialize Redis ML Cache first
            await this.mlCache.initialize();
            this.logger.info('Redis ML Cache initialized');
            
            // Initialiser le schéma du graphe
            await this.structuralMemory.initializeSchema();
            
            // Vérifier la connectivité mem0
            await this.contextualMemory.healthCheck();
            
            this.logger.info('Hybrid memory system initialized successfully');
        } catch (error) {
            this.logger.error('Failed to initialize hybrid memory system:', error);
            throw error;
        }
    }

    /**
     * Ajoute une information à la mémoire
     */
    async add(entry: MemoryEntry): Promise<string> {
        const { content, metadata = {}, userId } = entry;
        
        try {
            // Add to Redis ML Cache first
            const cacheKey = `memory:${Date.now()}:${Math.random()}`;
            await this.mlCache.set(cacheKey, { content, metadata }, 3600000); // 1 hour
            
            // Ajouter à la mémoire contextuelle (vectorielle)
            const memoryId = await this.contextualMemory.add({
                content,
                metadata: {
                    ...metadata,
                    timestamp: new Date().toISOString(),
                    cacheKey
                },
                userId
            });
            
            // Ajouter un nœud au graphe structurel
            const nodeId = await this.structuralMemory.createNode({
                id: memoryId,
                type: metadata.type || 'memory',
                properties: {
                    content,
                    memoryId,
                    ...metadata
                }
            });
            
            // Analyser et créer des relations automatiques
            await this._analyzeAndLinkMemory(nodeId, content, metadata);
            
            // Invalider le cache de recherche
            this._invalidateSearchCache();
            
            return memoryId;
        } catch (error) {
            this.metrics.errors++;
            this.logger.error('Failed to add memory:', error);
            throw error;
        }
    }

    /**
     * Recherche dans la mémoire hybride
     */
    async search(query: string, options: SearchOptions = {}): Promise<SearchResult[]> {
        const startTime = Date.now();
        const cacheKey = `search:${query}:${JSON.stringify(options)}`;
        
        // Check ML cache first
        try {
            const cachedResults = await this.mlCache.semanticSearch(query, {
                limit: options.limit || 10,
                threshold: options.threshold || 0.7
            });
            
            if (cachedResults && cachedResults.length > 0) {
                this.metrics.cache_hits++;
                return cachedResults;
            }
        } catch (error) {
            this.logger.warn('ML cache search failed, falling back to direct search:', error);
        }
        
        // Vérifier le cache local
        const cached = this._getFromCache(cacheKey);
        if (cached) {
            this.metrics.cache_hits++;
            return cached;
        }
        
        try {
            // Recherche contextuelle (vectorielle)
            const contextResults = await this.contextualMemory.search(query, {
                limit: options.limit || 10,
                userId: options.userId
            });
            
            // Recherche structurelle (graphe)
            const graphResults = await this._searchGraph(query, options);
            
            // Fusionner et scorer les résultats
            const mergedResults = this._mergeResults(contextResults, graphResults);
            
            // Mettre en cache
            this._addToCache(cacheKey, mergedResults);
            
            // Mettre à jour les métriques
            const searchTime = Date.now() - startTime;
            this.metrics.searches++;
            this.metrics.search_times.push(searchTime);
            
            return mergedResults;
        } catch (error) {
            this.metrics.errors++;
            this.logger.error('Search failed:', error);
            throw error;
        }
    }

    /**
     * Met à jour une entrée mémoire
     */
    async update(id: string, entry: Partial<MemoryEntry>): Promise<void> {
        try {
            // Mettre à jour dans mem0
            await this.contextualMemory.update(id, entry);
            
            // Mettre à jour dans le graphe
            if (entry.metadata) {
                await this.structuralMemory.updateNode(id, entry.metadata);
            }
            
            // Invalider le cache
            this._invalidateSearchCache();
        } catch (error) {
            this.logger.error('Failed to update memory:', error);
            throw error;
        }
    }

    /**
     * Supprime une entrée mémoire
     */
    async delete(id: string): Promise<void> {
        try {
            // Supprimer de mem0
            await this.contextualMemory.delete(id);
            
            // Supprimer du graphe
            await this.structuralMemory.deleteNode(id);
            
            // Invalider le cache
            this._invalidateSearchCache();
        } catch (error) {
            this.logger.error('Failed to delete memory:', error);
            throw error;
        }
    }

    /**
     * Ajoute une relation entre deux nœuds
     */
    async addRelation(from: string, to: string, type: string, properties?: Record<string, any>): Promise<void> {
        try {
            await this.structuralMemory.createEdge({
                from,
                to,
                type,
                properties
            });
        } catch (error) {
            this.logger.error('Failed to add relation:', error);
            throw error;
        }
    }

    /**
     * Obtient les nœuds liés
     */
    async getRelated(nodeId: string, relationType?: string, depth: number = 1): Promise<GraphNode[]> {
        try {
            return await this.structuralMemory.getRelated(nodeId, relationType, depth);
        } catch (error) {
            this.logger.error('Failed to get related nodes:', error);
            throw error;
        }
    }

    /**
     * Obtient la topologie du graphe
     */
    async getTopology(query?: GraphQuery): Promise<GraphTopology> {
        try {
            const topology = await this.structuralMemory.getTopology(query);
            
            // Calculer les métriques
            const nodeCount = topology.nodes.length;
            const edgeCount = topology.edges.length;
            const density = nodeCount > 1 ? (2 * edgeCount) / (nodeCount * (nodeCount - 1)) : 0;
            const avgDegree = nodeCount > 0 ? (2 * edgeCount) / nodeCount : 0;
            
            return {
                ...topology,
                metrics: {
                    nodeCount,
                    edgeCount,
                    density,
                    avgDegree
                }
            };
        } catch (error) {
            this.logger.error('Failed to get topology:', error);
            throw error;
        }
    }

    /**
     * Obtient les métriques du système
     */
    async getMetrics(): Promise<MemoryMetrics> {
        const avgSearchTime = this.metrics.search_times.length > 0
            ? this.metrics.search_times.reduce((a, b) => a + b, 0) / this.metrics.search_times.length
            : 0;
        
        const [vectorStats, graphStats, cacheStats] = await Promise.all([
            this.contextualMemory.getStats(),
            this.structuralMemory.getStats(),
            this.mlCache.getStats()
        ]);
        
        return {
            vectorStore: {
                count: vectorStats.count || 0,
                size: vectorStats.size || 0,
                dimensions: vectorStats.dimensions || 1536
            },
            graphStore: {
                nodes: graphStats.nodes || 0,
                edges: graphStats.edges || 0,
                avgDegree: graphStats.avgDegree || 0
            },
            cache: {
                hits: this.metrics.cache_hits,
                misses: this.metrics.searches - this.metrics.cache_hits,
                evictions: cacheStats.evictions || 0,
                size: cacheStats.size || 0
            },
            performance: {
                avgSearchTime,
                avgWriteTime: 0, // TODO: Implement write time tracking
                totalOperations: this.metrics.searches
            }
        };
    }

    /**
     * Vérifie la santé du système
     */
    async health(): Promise<HealthStatus> {
        
        const [vectorHealth, graphHealth, cacheHealth] = await Promise.allSettled([
            this._checkVectorStoreHealth(),
            this._checkGraphStoreHealth(),
            this._checkCacheHealth()
        ]);
        
        const getHealth = (result: PromiseSettledResult<ComponentHealth>): ComponentHealth => {
            if (result.status === 'fulfilled') {
                return result.value;
            }
            return {
                status: 'unhealthy',
                message: result.reason?.message || 'Health check failed'
            };
        };
        
        const services = {
            vectorStore: getHealth(vectorHealth),
            graphStore: getHealth(graphHealth),
            cache: getHealth(cacheHealth)
        };
        
        const healthy = Object.values(services).every(s => s.status !== 'unhealthy');
        
        return {
            healthy,
            services,
            timestamp: new Date()
        };
    }

    /**
     * Efface toute la mémoire
     */
    async clear(): Promise<void> {
        try {
            await Promise.all([
                this.contextualMemory.clear(),
                this.structuralMemory.clear(),
                this.mlCache.clear()
            ]);
            
            this.searchCache.clear();
            this.metrics = {
                searches: 0,
                search_times: [],
                cache_hits: 0,
                errors: 0
            };
        } catch (error) {
            this.logger.error('Failed to clear memory:', error);
            throw error;
        }
    }

    // Private methods
    
    private async _analyzeAndLinkMemory(_nodeId: string, _content: string, _metadata: any): Promise<void> {
        // TODO: Implement automatic relationship detection
        // - Detect entities, topics, references
        // - Create edges to related memories
        // - Use NLP to understand relationships
    }

    private async _searchGraph(_query: string, _options: SearchOptions): Promise<any[]> {
        // TODO: Implement graph-based search
        return [];
    }

    private _mergeResults(contextResults: any[], graphResults: any[]): SearchResult[] {
        const merged = new Map<string, SearchResult>();
        
        // Add context results
        contextResults.forEach(result => {
            merged.set(result.id, {
                id: result.id,
                content: result.content,
                score: result.score || 0,
                metadata: result.metadata
            });
        });
        
        // Merge graph results (boost score if in both)
        graphResults.forEach(result => {
            const existing = merged.get(result.id);
            if (existing) {
                existing.score *= 1.2; // Boost score
            } else {
                merged.set(result.id, {
                    id: result.id,
                    content: result.content,
                    score: result.score || 0,
                    metadata: result.metadata
                });
            }
        });
        
        // Sort by score
        return Array.from(merged.values()).sort((a, b) => b.score - a.score);
    }

    private _getFromCache(key: string): any | null {
        const cached = this.searchCache.get(key);
        if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
            return cached.data;
        }
        return null;
    }

    private _addToCache(key: string, data: any): void {
        this.searchCache.set(key, {
            data,
            timestamp: Date.now()
        });
        
        // Clean old cache entries
        if (this.searchCache.size > 1000) {
            const oldestKey = this.searchCache.keys().next().value;
            if (oldestKey) {
                this.searchCache.delete(oldestKey);
            }
        }
    }

    private _invalidateSearchCache(): void {
        this.searchCache.clear();
    }

    private async _checkVectorStoreHealth(): Promise<ComponentHealth> {
        const start = Date.now();
        try {
            await this.contextualMemory.healthCheck();
            return {
                status: 'healthy',
                message: 'Vector store operational',
                latency: Date.now() - start
            };
        } catch (error: any) {
            return {
                status: 'unhealthy',
                message: error.message || 'Vector store unavailable',
                latency: Date.now() - start
            };
        }
    }

    private async _checkGraphStoreHealth(): Promise<ComponentHealth> {
        const start = Date.now();
        try {
            await this.structuralMemory.healthCheck();
            return {
                status: 'healthy',
                message: 'Graph store operational',
                latency: Date.now() - start
            };
        } catch (error: any) {
            return {
                status: 'unhealthy',
                message: error.message || 'Graph store unavailable',
                latency: Date.now() - start
            };
        }
    }

    private async _checkCacheHealth(): Promise<ComponentHealth> {
        const start = Date.now();
        try {
            await this.mlCache.healthCheck();
            return {
                status: 'healthy',
                message: 'Cache operational',
                latency: Date.now() - start
            };
        } catch (error: any) {
            return {
                status: 'degraded',
                message: 'Cache unavailable, using fallback',
                latency: Date.now() - start
            };
        }
    }
}

// Default export for backward compatibility
export default HybridMemoryManager;