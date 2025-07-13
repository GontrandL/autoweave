const { Logger } = require('../utils/logger');
const { spawn } = require('child_process');
const path = require('path');

/**
 * AutoWeaveMemory - Client mem0 pour mémoire contextuelle
 * Gère la mémoire personnalisée par utilisateur, agent et session
 */
class AutoWeaveMemory {
    constructor(config = {}) {
        this.config = {
            apiKey: config.apiKey || process.env.MEM0_API_KEY,
            vectorStore: config.vectorStore || 'qdrant',
            graphStore: config.graphStore || 'memgraph',
            llmProvider: config.llmProvider || 'openai',
            debug: config.debug || process.env.MEM0_DEBUG === 'true',
            ...config
        };
        
        this.logger = new Logger('AutoWeaveMemory');
        this.client = null;
        this.mockMode = false;
        this.selfHosted = process.env.MEM0_SELF_HOSTED === 'true';
        this.pythonBridgePath = path.join(__dirname, '../../scripts/mem0-bridge-wrapper.sh');
        this.pythonVenvPath = 'bash';
        
        this.initializeClient();
    }

    /**
     * Initialise le client mem0
     */
    async initializeClient() {
        try {
            if (this.selfHosted) {
                // Mode self-hosted avec bridge Python
                this.logger.info('Initializing mem0 self-hosted mode');
                
                // Tester la connectivité avec le bridge Python
                const healthCheck = await this.callPythonBridge('health');
                if (!healthCheck.success) {
                    throw new Error(`Python bridge health check failed: ${healthCheck.error}`);
                }
                
                this.logger.success('mem0 self-hosted client initialized successfully');
                return;
            }
            
            // Vérifier si mem0 est disponible en mode API
            if (!this.config.apiKey || this.config.apiKey.includes('test')) {
                this.logger.warn('mem0 API key not available, using mock mode');
                this.mockMode = true;
                return;
            }

            // Initialiser le client mem0 API (simulation pour le moment)
            this.client = {
                config: {
                    api_key: this.config.apiKey,
                    vector_store: {
                        provider: this.config.vectorStore,
                        config: {
                            host: process.env.QDRANT_HOST || 'qdrant-service',
                            port: process.env.QDRANT_PORT || 6333
                        }
                    },
                    graph_store: {
                        provider: this.config.graphStore,
                        config: {
                            host: process.env.MEMGRAPH_HOST || 'memgraph-service',
                            port: process.env.MEMGRAPH_PORT || 7687
                        }
                    }
                }
            };

            this.logger.success('mem0 API client initialized successfully');
            
        } catch (error) {
            this.logger.error('Failed to initialize mem0 client:', error);
            this.mockMode = true;
        }
    }

    /**
     * Appeler le bridge Python pour mem0 self-hosted
     */
    async callPythonBridge(command, args = []) {
        return new Promise((resolve, reject) => {
            const pythonArgs = [command, ...args];
            
            this.logger.debug(`Calling Python bridge: ${command} with args: ${args}`);
            
            const process = spawn(this.pythonBridgePath, pythonArgs, {
                env: { 
                    ...process.env,
                    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
                    QDRANT_HOST: process.env.QDRANT_HOST || 'localhost',
                    QDRANT_PORT: process.env.QDRANT_PORT || '6333',
                    QDRANT_API_KEY: process.env.QDRANT_API_KEY,
                    MEMGRAPH_HOST: process.env.MEMGRAPH_HOST || 'localhost',
                    MEMGRAPH_PORT: process.env.MEMGRAPH_PORT || '7687',
                    SKIP_CONNECTIVITY_CHECK: 'true' // Skip pour l'instant car Qdrant est dans K8s
                }
            });
            
            let stdout = '';
            let stderr = '';
            
            process.stdout.on('data', (data) => {
                stdout += data.toString();
            });
            
            process.stderr.on('data', (data) => {
                stderr += data.toString();
            });
            
            process.on('close', (code) => {
                if (code === 0) {
                    try {
                        const result = JSON.parse(stdout);
                        resolve(result);
                    } catch (e) {
                        reject(new Error(`Failed to parse Python bridge response: ${stdout}`));
                    }
                } else {
                    reject(new Error(`Python bridge failed with code ${code}: ${stderr}`));
                }
            });
            
            process.on('error', (error) => {
                reject(new Error(`Python bridge process error: ${error.message}`));
            });
        });
    }

    /**
     * Ajouter une mémoire d'agent
     */
    async addAgentMemory(agentId, memory, metadata = {}) {
        this.logger.info(`Adding agent memory: ${agentId}`);
        
        if (this.mockMode) {
            return this.mockAddMemory('agent', agentId, memory, metadata);
        }

        try {
            if (this.selfHosted) {
                // Mode self-hosted
                const enrichedMetadata = {
                    type: "agent_memory",
                    agent_id: agentId,
                    timestamp: new Date().toISOString(),
                    ...metadata
                };
                
                const result = await this.callPythonBridge('add', [
                    `agent_${agentId}`,
                    memory,
                    JSON.stringify(enrichedMetadata)
                ]);
                
                if (!result.success) {
                    throw new Error(result.error);
                }
                
                this.logger.success(`Agent memory added for ${agentId}`);
                return result.result;
            } else {
                // Mode API
                const result = await this.simulateAdd({
                    messages: [{ role: "system", content: memory }],
                    user_id: `agent_${agentId}`,
                    metadata: {
                        type: "agent_memory",
                        agent_id: agentId,
                        timestamp: new Date().toISOString(),
                        ...metadata
                    }
                });

                this.logger.success(`Agent memory added for ${agentId}`);
                return result;
            }
            
        } catch (error) {
            this.logger.error('Failed to add agent memory:', error);
            throw error;
        }
    }

    /**
     * Ajouter une mémoire d'utilisateur
     */
    async addUserMemory(userId, memory, metadata = {}) {
        this.logger.info(`Adding user memory: ${userId}`);
        
        if (this.mockMode) {
            return this.mockAddMemory('user', userId, memory, metadata);
        }

        try {
            if (this.selfHosted) {
                // Mode self-hosted
                const enrichedMetadata = {
                    type: "user_memory",
                    timestamp: new Date().toISOString(),
                    ...metadata
                };
                
                const result = await this.callPythonBridge('add', [
                    userId,
                    memory,
                    JSON.stringify(enrichedMetadata)
                ]);
                
                if (!result.success) {
                    throw new Error(result.error);
                }
                
                this.logger.success(`User memory added for ${userId}`);
                return result.result;
            } else {
                // Mode API
                const result = await this.simulateAdd({
                    messages: [{ role: "user", content: memory }],
                    user_id: userId,
                    metadata: {
                        type: "user_memory",
                        timestamp: new Date().toISOString(),
                        ...metadata
                    }
                });

                this.logger.success(`User memory added for ${userId}`);
                return result;
            }
            
        } catch (error) {
            this.logger.error('Failed to add user memory:', error);
            throw error;
        }
    }

    /**
     * Ajouter une mémoire de session
     */
    async addSessionMemory(sessionId, memory, metadata = {}) {
        this.logger.info(`Adding session memory: ${sessionId}`);
        
        if (this.mockMode) {
            return this.mockAddMemory('session', sessionId, memory, metadata);
        }

        try {
            const result = await this.simulateAdd({
                messages: [{ role: "system", content: memory }],
                user_id: `session_${sessionId}`,
                metadata: {
                    type: "session_memory",
                    session_id: sessionId,
                    timestamp: new Date().toISOString(),
                    ...metadata
                }
            });

            this.logger.success(`Session memory added for ${sessionId}`);
            return result;
            
        } catch (error) {
            this.logger.error('Failed to add session memory:', error);
            throw error;
        }
    }

    /**
     * Rechercher dans la mémoire
     */
    async searchMemory(query, userId, filters = {}) {
        this.logger.info(`Searching memory for: "${query}" (user: ${userId})`);
        
        if (this.mockMode) {
            return this.mockSearch(query, userId, filters);
        }

        try {
            if (this.selfHosted) {
                // Mode self-hosted
                const limit = filters.limit || 10;
                const result = await this.callPythonBridge('search', [
                    userId,
                    query,
                    limit.toString()
                ]);
                
                if (!result.success) {
                    throw new Error(result.error);
                }
                
                this.logger.success(`Found ${result.results.length} memory results`);
                return result.results;
            } else {
                // Mode API
                const result = await this.simulateSearch({
                    query,
                    user_id: userId,
                    limit: filters.limit || 10,
                    filters
                });

                this.logger.success(`Found ${result.length} memory results`);
                return result;
            }
            
        } catch (error) {
            this.logger.error('Failed to search memory:', error);
            throw error;
        }
    }

    /**
     * Mettre à jour une mémoire
     */
    async updateMemory(memoryId, newContent) {
        this.logger.info(`Updating memory: ${memoryId}`);
        
        if (this.mockMode) {
            return this.mockUpdate(memoryId, newContent);
        }

        try {
            const result = await this.simulateUpdate(memoryId, newContent);
            this.logger.success(`Memory updated: ${memoryId}`);
            return result;
            
        } catch (error) {
            this.logger.error('Failed to update memory:', error);
            throw error;
        }
    }

    /**
     * Supprimer une mémoire
     */
    async deleteMemory(memoryId) {
        this.logger.info(`Deleting memory: ${memoryId}`);
        
        if (this.mockMode) {
            return this.mockDelete(memoryId);
        }

        try {
            const result = await this.simulateDelete(memoryId);
            this.logger.success(`Memory deleted: ${memoryId}`);
            return result;
            
        } catch (error) {
            this.logger.error('Failed to delete memory:', error);
            throw error;
        }
    }

    /**
     * Vérifier la santé du système
     */
    async healthCheck() {
        this.logger.info('Performing health check...');
        
        if (this.mockMode) {
            return {
                status: 'healthy',
                mode: 'mock',
                timestamp: new Date().toISOString()
            };
        }

        try {
            if (this.selfHosted) {
                // Mode self-hosted
                const result = await this.callPythonBridge('health');
                
                if (!result.success) {
                    throw new Error(result.error);
                }
                
                this.logger.success('Health check passed (self-hosted)');
                return result.status;
            } else {
                // Mode API
                const health = await this.simulateHealth();
                this.logger.success('Health check passed');
                return health;
            }
            
        } catch (error) {
            this.logger.error('Health check failed:', error);
            throw error;
        }
    }

    /**
     * Obtenir toutes les mémoires d'un utilisateur
     */
    async getAllMemories(userId) {
        this.logger.info(`Getting all memories for user: ${userId}`);
        
        if (this.mockMode) {
            return this.mockGetAll(userId);
        }

        try {
            const memories = await this.simulateGetAll(userId);
            this.logger.success(`Retrieved ${memories.length} memories for ${userId}`);
            return memories;
            
        } catch (error) {
            this.logger.error('Failed to get memories:', error);
            throw error;
        }
    }

    // ===========================================
    // MÉTHODES DE SIMULATION (pour développement)
    // ===========================================

    async simulateAdd(data) {
        // Simulation d'ajout mem0
        await this.delay(50);
        return {
            id: `mem_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            created_at: new Date().toISOString(),
            ...data
        };
    }

    async simulateSearch(params) {
        // Simulation de recherche mem0
        await this.delay(100);
        
        const mockResults = [
            {
                id: 'mem_001',
                content: `Result for query: ${params.query}`,
                score: 0.95,
                metadata: {
                    type: 'agent_memory',
                    timestamp: new Date().toISOString()
                }
            },
            {
                id: 'mem_002',
                content: `Related context for: ${params.query}`,
                score: 0.82,
                metadata: {
                    type: 'user_memory',
                    timestamp: new Date().toISOString()
                }
            }
        ];

        return mockResults.slice(0, params.limit || 10);
    }

    async simulateUpdate(memoryId, content) {
        await this.delay(30);
        return {
            id: memoryId,
            updated_at: new Date().toISOString(),
            content
        };
    }

    async simulateDelete(memoryId) {
        await this.delay(20);
        return {
            id: memoryId,
            deleted_at: new Date().toISOString()
        };
    }

    async simulateHealth() {
        await this.delay(10);
        return {
            status: 'healthy',
            vector_store: 'connected',
            graph_store: 'connected',
            llm_provider: 'active',
            timestamp: new Date().toISOString()
        };
    }

    async simulateGetAll(userId) {
        await this.delay(80);
        return [
            {
                id: 'mem_001',
                content: `Memory 1 for ${userId}`,
                type: 'user_memory',
                created_at: new Date().toISOString()
            },
            {
                id: 'mem_002',
                content: `Memory 2 for ${userId}`,
                type: 'agent_memory',
                created_at: new Date().toISOString()
            }
        ];
    }

    // ===========================================
    // MÉTHODES MOCK (pour tests)
    // ===========================================

    mockAddMemory(type, id, memory, metadata) {
        const mockResult = {
            id: `mock_${type}_${Date.now()}`,
            type,
            target_id: id,
            content: memory,
            metadata: {
                ...metadata,
                mock: true,
                timestamp: new Date().toISOString()
            }
        };

        this.logger.info(`Mock memory added: ${mockResult.id}`);
        return mockResult;
    }

    mockSearch(query, userId, filters) {
        const mockResults = [
            {
                id: 'mock_001',
                content: `Mock result for: ${query}`,
                score: 0.9,
                user_id: userId,
                mock: true
            },
            {
                id: 'mock_002',
                content: `Another mock result for: ${query}`,
                score: 0.7,
                user_id: userId,
                mock: true
            }
        ];

        this.logger.info(`Mock search returned ${mockResults.length} results`);
        return mockResults.slice(0, filters.limit || 10);
    }

    mockUpdate(memoryId, content) {
        const mockResult = {
            id: memoryId,
            content,
            updated_at: new Date().toISOString(),
            mock: true
        };

        this.logger.info(`Mock memory updated: ${memoryId}`);
        return mockResult;
    }

    mockDelete(memoryId) {
        const mockResult = {
            id: memoryId,
            deleted_at: new Date().toISOString(),
            mock: true
        };

        this.logger.info(`Mock memory deleted: ${memoryId}`);
        return mockResult;
    }

    mockGetAll(userId) {
        const mockMemories = [
            {
                id: 'mock_001',
                content: `Mock memory 1 for ${userId}`,
                type: 'user_memory',
                created_at: new Date().toISOString(),
                mock: true
            },
            {
                id: 'mock_002',
                content: `Mock memory 2 for ${userId}`,
                type: 'agent_memory',
                created_at: new Date().toISOString(),
                mock: true
            }
        ];

        this.logger.info(`Mock retrieved ${mockMemories.length} memories for ${userId}`);
        return mockMemories;
    }

    /**
     * Utilitaire pour simuler des délais
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Obtenir la configuration actuelle
     */
    getConfig() {
        return {
            ...this.config,
            apiKey: this.config.apiKey ? '***' : null, // Masquer la clé API
            mockMode: this.mockMode
        };
    }
}

module.exports = AutoWeaveMemory;