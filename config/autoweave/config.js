require('dotenv').config();

module.exports = {
    port: process.env.PORT || 3002,
    logLevel: process.env.LOG_LEVEL || 'info',

    agentWeaver: {
        openaiApiKey: process.env.OPENAI_API_KEY,
        model: 'gpt-4',
        temperature: 0.7,
        maxTokens: 4000,
        timeout: 30000
    },

    kagent: {
        namespace: process.env.KAGENT_NAMESPACE || 'default',
        systemNamespace: 'kagent',
        timeout: parseInt(process.env.KAGENT_TIMEOUT) || 30000,
        retryAttempts: parseInt(process.env.KAGENT_RETRY_ATTEMPTS) || 3,
        clusterName: process.env.K8S_CLUSTER_NAME || 'autoweave'
    },

    mcp: {
        discoveryEnabled: process.env.MCP_DISCOVERY_ENABLED === 'true',
        discoveryPort: 8081,
        registryUrl: process.env.MCP_REGISTRY_URL,
        anpPort: parseInt(process.env.ANP_PORT) || 8083,
        externalAnpRegistries: process.env.EXTERNAL_ANP_REGISTRIES ? 
            process.env.EXTERNAL_ANP_REGISTRIES.split(',') : []
    },

    kubernetes: {
        kubeconfig: process.env.KUBECONFIG || '~/.kube/config',
        inCluster: process.env.K8S_IN_CLUSTER === 'true'
    },

    memory: {
        // mem0 configuration
        mem0: {
            apiKey: process.env.MEM0_API_KEY,
            baseUrl: process.env.MEM0_BASE_URL || 'https://api.mem0.ai',
            mock: process.env.MEM0_MOCK === 'true' || !process.env.MEM0_API_KEY
        },
        
        // Memgraph configuration
        memgraph: {
            host: process.env.MEMGRAPH_HOST || 'localhost',
            port: parseInt(process.env.MEMGRAPH_PORT) || 7687,
            user: process.env.MEMGRAPH_USER || 'admin',
            password: process.env.MEMGRAPH_PASSWORD || 'admin123!',
            database: process.env.MEMGRAPH_DATABASE || 'memgraph',
            mock: process.env.MEMGRAPH_MOCK === 'true' || !process.env.MEMGRAPH_HOST
        },
        
        // Qdrant configuration
        qdrant: {
            host: process.env.QDRANT_HOST || 'localhost',
            port: parseInt(process.env.QDRANT_PORT) || 6333,
            apiKey: process.env.QDRANT_API_KEY,
            collection: process.env.QDRANT_COLLECTION || 'autoweave',
            mock: process.env.QDRANT_MOCK === 'true' || !process.env.QDRANT_HOST
        },
        
        // Hybrid memory configuration
        hybrid: {
            fusionWeight: parseFloat(process.env.MEMORY_FUSION_WEIGHT) || 0.5,
            cacheSize: parseInt(process.env.MEMORY_CACHE_SIZE) || 1000,
            cacheTtl: parseInt(process.env.MEMORY_CACHE_TTL) || 3600000,
            searchLimit: parseInt(process.env.MEMORY_SEARCH_LIMIT) || 10
        }
    }
};