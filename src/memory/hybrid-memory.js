const AutoWeaveMemory = require('./mem0-client');
const AutoWeaveGraph = require('./graph-client');
const { Logger } = require('../utils/logger');
const { RedisMLCache } = require('../cache/redis-ml-cache');

/**
 * HybridMemoryManager - Gestionnaire de mémoire hybride pour AutoWeave
 * Combine mémoire contextuelle (mem0) et mémoire structurelle (GraphRAG)
 */
class HybridMemoryManager {
    constructor(config = {}) {
        this.config = config;
        this.logger = new Logger('HybridMemory');
        
        // Clients mémoire
        this.contextualMemory = new AutoWeaveMemory(config.mem0);
        this.structuralMemory = new AutoWeaveGraph(config.graph);
        
        // Redis ML Cache pour optimiser les performances
        this.mlCache = new RedisMLCache(config.redis);
        
        // Cache local pour optimiser les performances (fallback)
        this.searchCache = new Map();
        this.cacheTimeout = config.cacheTimeout || 300000; // 5 minutes
        
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
    async initialize() {
        this.logger.info('Initializing hybrid memory system with ML cache...');
        
        try {
            // Initialize Redis ML Cache first
            await this.mlCache.initialize();
            this.logger.success('Redis ML Cache initialized');
            
            // Initialiser le schéma du graphe
            await this.structuralMemory.initializeSchema();
            
            // Vérifier la connectivité mem0
            await this.contextualMemory.healthCheck();
            
            this.isInitialized = true;
            this.logger.success('Hybrid memory system with ML cache initialized successfully');
        } catch (error) {
            this.logger.error('Failed to initialize hybrid memory system:', error);
            // Continue without ML cache if Redis is not available
            this.logger.warn('Continuing without Redis ML Cache...');
            this.isInitialized = true;
        }
    }
    
    /**
     * Shutdown the hybrid memory system
     */
    async shutdown() {
        this.logger.info('Shutting down hybrid memory system...');
        
        try {
            // Close graph database connection
            await this.structuralMemory.close();
            
            // Clear cache
            this.searchCache.clear();
            
            this.isInitialized = false;
            this.logger.info('Hybrid memory system shutdown complete');
        } catch (error) {
            this.logger.error('Error during hybrid memory system shutdown:', error);
        }
    }

    /**
     * Création d'agent avec mémoire hybride
     */
    async createAgentWithMemory(agentData, userId) {
        this.logger.info(`Creating agent with memory: ${agentData.name}`);
        
        try {
            // 1. Créer l'agent dans le graphe structurel
            const graphAgent = await this.structuralMemory.createAgent(agentData);
            
            // 2. Initialiser la mémoire contextuelle
            await this.contextualMemory.addAgentMemory(
                agentData.id,
                `Agent ${agentData.name} créé avec la description: ${agentData.description}`,
                {
                    action: 'creation',
                    user_id: userId,
                    agent_config: agentData.config,
                    timestamp: new Date().toISOString()
                }
            );

            // 3. Lier à l'utilisateur dans le graphe
            await this.structuralMemory.linkAgentToUser(agentData.id, userId);

            this.logger.success(`Agent ${agentData.name} created with hybrid memory`);
            
            return {
                success: true,
                agent: graphAgent,
                memory_initialized: true,
                contextual_memory: true,
                structural_memory: true
            };
            
        } catch (error) {
            this.logger.error('Failed to create agent with memory:', error);
            throw error;
        }
    }

    /**
     * Recherche intelligente hybride
     */
    async intelligentSearch(query, userId, context = {}) {
        const startTime = Date.now();
        this.metrics.searches++;
        
        this.logger.info(`Hybrid search with ML cache: "${query}" for user: ${userId}`);
        
        try {
            // Vérifier le cache ML Redis d'abord
            const cacheKey = `memory:search:${userId}:${Buffer.from(query).toString('base64').slice(0, 20)}`;
            const mlCached = await this.mlCache.get(cacheKey, { userId, context });
            if (mlCached) {
                this.metrics.cache_hits++;
                this.logger.info('ML Cache hit for search query');
                return mlCached;
            }
            
            // Fallback sur cache local
            const localCacheKey = `${query}_${userId}_${JSON.stringify(context)}`;
            const cached = this.getCachedResult(localCacheKey);
            if (cached) {
                this.metrics.cache_hits++;
                this.logger.info('Local cache hit for search query');
                return cached;
            }

            // 1. Recherche contextuelle avec mem0
            const contextualPromise = this.contextualMemory.searchMemory(
                query,
                userId,
                { type: context.type || 'all' }
            );

            // 2. Recherche structurelle avec GraphRAG
            const structuralPromise = this.structuralMemory.semanticSearch(query);

            // Exécuter en parallèle
            const [contextualResults, structuralResults] = await Promise.all([
                contextualPromise,
                structuralPromise
            ]);

            // 3. Fusion et scoring des résultats
            const hybridResults = this.mergeResults(contextualResults, structuralResults);

            const result = {
                query,
                contextual_matches: contextualResults.length,
                structural_matches: structuralResults.length,
                hybrid_results: hybridResults,
                search_metadata: {
                    timestamp: new Date().toISOString(),
                    user_id: userId,
                    context,
                    duration: Date.now() - startTime
                }
            };

            // Cache du résultat dans ML Cache et local cache
            await this.mlCache.set(cacheKey, result, { 
                ttl: 1800, // 30 minutes 
                userId, 
                context 
            });
            this.cacheResult(localCacheKey, result);
            
            // Métriques (limit array size to prevent memory growth)
            this.metrics.search_times.push(Date.now() - startTime);
            if (this.metrics.search_times.length > 1000) {
                this.metrics.search_times = this.metrics.search_times.slice(-1000);
            }
            
            this.logger.success(`Hybrid search completed in ${Date.now() - startTime}ms`);
            return result;
            
        } catch (error) {
            this.metrics.errors++;
            this.logger.error('Hybrid search failed:', error);
            throw error;
        }
    }

    /**
     * Analyse de l'état du système
     */
    async analyzeSystemState(userId) {
        this.logger.info(`Analyzing system state for user: ${userId}`);
        
        try {
            // 1. Récupérer l'historique contextuel de l'utilisateur
            const userHistory = await this.contextualMemory.searchMemory(
                "system state analysis",
                userId,
                { type: "system_analysis" }
            );

            // 2. Analyser la topologie du graphe
            const systemTopology = await this.structuralMemory.getSystemTopology();

            // 3. Générer des insights
            const insights = await this.generateSystemInsights(userHistory, systemTopology);

            return {
                user_context: userHistory,
                system_topology: systemTopology,
                insights,
                recommendations: await this.generateRecommendations(insights),
                timestamp: new Date().toISOString()
            };
            
        } catch (error) {
            this.logger.error('System analysis failed:', error);
            throw error;
        }
    }

    /**
     * Ajouter une interaction à la mémoire
     */
    async addInteraction(userId, agentId, interaction) {
        this.logger.info(`Adding interaction to memory: ${agentId}`);
        
        try {
            // Mémoire contextuelle
            await this.contextualMemory.addUserMemory(
                userId,
                interaction.content,
                {
                    type: 'interaction',
                    agent_id: agentId,
                    interaction_type: interaction.type,
                    timestamp: new Date().toISOString()
                }
            );

            // Graphe structurel
            await this.structuralMemory.createInteraction(userId, agentId, interaction);
            
            this.logger.success('Interaction added to hybrid memory');
            
        } catch (error) {
            this.logger.error('Failed to add interaction:', error);
            throw error;
        }
    }

    /**
     * Fusion des résultats contextuels et structurels
     */
    mergeResults(contextual, structural) {
        const merged = [];

        // Scoring contextuel (basé sur la pertinence temporelle et personnelle)
        contextual.forEach(result => {
            merged.push({
                ...result,
                source: 'contextual',
                score: (result.score || 0.5) * 0.6, // Pondération contextuelle
                type: 'memory',
                relevance: 'personal'
            });
        });

        // Scoring structurel (basé sur la similarité sémantique et les relations)
        structural.forEach(result => {
            merged.push({
                ...result,
                source: 'structural',
                score: (result.similarity || 0.5) * 0.4, // Pondération structurelle
                type: 'graph',
                relevance: 'system'
            });
        });

        // Tri par score combiné et déduplication
        return merged
            .sort((a, b) => b.score - a.score)
            .slice(0, 20); // Limiter à 20 résultats
    }

    /**
     * Génération d'insights système
     */
    async generateSystemInsights(history, topology) {
        const insights = {
            agent_health: topology.agents ? topology.agents.filter(a => a.status === 'healthy').length : 0,
            total_agents: topology.agents ? topology.agents.length : 0,
            active_workflows: topology.workflows ? topology.workflows.filter(w => w.status === 'active').length : 0,
            user_activity: history.length,
            system_recommendations: []
        };

        // Calcul du taux de santé
        insights.health_rate = insights.total_agents > 0 
            ? (insights.agent_health / insights.total_agents) 
            : 1;

        // Recommandations basées sur l'état
        if (insights.health_rate < 0.8) {
            insights.system_recommendations.push({
                type: 'health',
                priority: 'high',
                message: 'Plusieurs agents nécessitent une attention',
                action: 'review_failed_agents'
            });
        }

        if (insights.user_activity < 5) {
            insights.system_recommendations.push({
                type: 'engagement',
                priority: 'medium',
                message: 'Activité utilisateur faible',
                action: 'suggest_new_agents'
            });
        }

        return insights;
    }

    /**
     * Génération de recommandations
     */
    async generateRecommendations(insights) {
        const recommendations = [];

        // Recommandations basées sur la santé du système
        if (insights.health_rate < 0.9) {
            recommendations.push({
                type: 'system_health',
                priority: 'high',
                title: 'Améliorer la santé du système',
                description: 'Certains agents rencontrent des problèmes',
                actions: ['Vérifier les logs', 'Redémarrer les agents défaillants']
            });
        }

        // Recommandations d'optimisation
        if (insights.total_agents > 10) {
            recommendations.push({
                type: 'optimization',
                priority: 'medium',
                title: 'Optimiser les performances',
                description: 'Grand nombre d\'agents déployés',
                actions: ['Consolider les agents similaires', 'Optimiser les ressources']
            });
        }

        return recommendations;
    }

    /**
     * Gestion du cache
     */
    getCachedResult(key) {
        const cached = this.searchCache.get(key);
        if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
            return cached.result;
        }
        return null;
    }

    cacheResult(key, result) {
        // Limit cache size to prevent memory leaks
        if (this.searchCache.size > 1000) {
            // Remove oldest entries
            const entriesToRemove = [];
            const now = Date.now();
            for (const [k, v] of this.searchCache.entries()) {
                if (now - v.timestamp > this.cacheTimeout) {
                    entriesToRemove.push(k);
                }
            }
            
            // If not enough expired entries, remove oldest 100
            if (entriesToRemove.length < 100) {
                const sortedEntries = Array.from(this.searchCache.entries())
                    .sort((a, b) => a[1].timestamp - b[1].timestamp)
                    .slice(0, 100);
                entriesToRemove.push(...sortedEntries.map(e => e[0]));
            }
            
            // Clean up
            entriesToRemove.forEach(k => this.searchCache.delete(k));
            this.logger.debug(`Cache cleanup: removed ${entriesToRemove.length} entries`);
        }
        
        this.searchCache.set(key, {
            result,
            timestamp: Date.now()
        });
    }

    /**
     * Obtenir les métriques
     */
    getMetrics() {
        const avgSearchTime = this.metrics.search_times.length > 0
            ? this.metrics.search_times.reduce((a, b) => a + b) / this.metrics.search_times.length
            : 0;

        return {
            total_searches: this.metrics.searches,
            average_search_time: Math.round(avgSearchTime),
            error_rate: this.metrics.errors / Math.max(this.metrics.searches, 1),
            cache_hit_rate: this.metrics.cache_hits / Math.max(this.metrics.searches, 1),
            cache_size: this.searchCache.size
        };
    }

    /**
     * Réinitialiser les métriques
     */
    resetMetrics() {
        this.metrics = {
            searches: 0,
            search_times: [],
            cache_hits: 0,
            errors: 0
        };
    }

    /**
     * Fermeture des connexions
     */
    async close() {
        this.logger.info('Closing hybrid memory system...');
        
        try {
            await this.structuralMemory.close();
            this.logger.success('Hybrid memory system closed');
        } catch (error) {
            this.logger.error('Error closing hybrid memory system:', error);
        }
    }
}

module.exports = HybridMemoryManager;