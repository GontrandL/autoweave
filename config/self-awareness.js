/**
 * Configuration Centralisée - Système Self-Awareness + ADN
 * ========================================================
 */

module.exports = {
    // Configuration Self-Awareness Agent
    selfAwareness: {
        scanInterval: parseInt(process.env.SELF_AWARENESS_SCAN_INTERVAL) || 300000, // 5 minutes
        autoSync: process.env.SELF_AWARENESS_AUTO_SYNC === 'true',
        maxFilesInMemory: parseInt(process.env.SELF_AWARENESS_MAX_FILES) || 50000,
        maxToolsInMemory: parseInt(process.env.SELF_AWARENESS_MAX_TOOLS) || 1000,
        
        // Timeouts et performance
        scanTimeout: parseInt(process.env.SELF_AWARENESS_SCAN_TIMEOUT) || 120000, // 2 minutes
        toolAnalysisTimeout: parseInt(process.env.SELF_AWARENESS_TOOL_TIMEOUT) || 2000,
        apiResponseTimeout: parseInt(process.env.SELF_AWARENESS_API_TIMEOUT) || 1000,
        
        // Monitoring
        enableMetrics: process.env.SELF_AWARENESS_METRICS === 'true',
        logLevel: process.env.SELF_AWARENESS_LOG_LEVEL || 'info'
    },
    
    // Configuration Système Génétique
    genetic: {
        enabled: process.env.CLAUDE_GENOME_ENABLED === 'true',
        trackingLevel: process.env.CLAUDE_TRACKING_LEVEL || 'full', // minimal, standard, full
        actor: process.env.CLAUDE_ACTOR || 'Claude',
        
        // Déduplication
        deduplicationEnabled: process.env.CLAUDE_DEDUP_ENABLED !== 'false',
        similarityThreshold: parseFloat(process.env.CLAUDE_SIMILARITY_THRESHOLD) || 0.8,
        
        // Base de données
        dbPath: process.env.CLAUDE_GENOME_DB_PATH || '.claude/deduplication.db',
        backupInterval: parseInt(process.env.CLAUDE_GENOME_BACKUP_INTERVAL) || 86400000, // 24h
        
        // Performance
        maxGenesInMemory: parseInt(process.env.CLAUDE_MAX_GENES_MEMORY) || 10000,
        compressionEnabled: process.env.CLAUDE_COMPRESSION === 'true'
    },
    
    // Configuration Base de Données
    database: {
        qdrant: {
            host: process.env.QDRANT_HOST || 'localhost',
            port: parseInt(process.env.QDRANT_PORT) || 6333,
            apiKey: process.env.QDRANT_API_KEY,
            collection: process.env.QDRANT_COLLECTION || 'genetic_code_genome',
            timeout: parseInt(process.env.QDRANT_TIMEOUT) || 5000
        },
        
        neo4j: {
            uri: process.env.NEO4J_URI || 'bolt://localhost:7687',
            user: process.env.NEO4J_USER || 'neo4j',
            password: process.env.NEO4J_PASSWORD,
            database: process.env.NEO4J_DATABASE || 'autoweave'
        }
    },
    
    // Configuration Sécurité
    security: {
        maxFileSize: parseInt(process.env.MAX_FILE_SIZE) || 10485760, // 10MB
        allowedExtensions: (process.env.ALLOWED_EXTENSIONS || '.js,.ts,.py,.java,.go,.rs,.c,.cpp,.h,.jsx,.tsx').split(','),
        forbiddenPaths: (process.env.FORBIDDEN_PATHS || 'node_modules,.git,dist,build').split(','),
        
        // Rate limiting
        rateLimitEnabled: process.env.RATE_LIMIT_ENABLED === 'true',
        maxRequestsPerMinute: parseInt(process.env.MAX_REQUESTS_PER_MINUTE) || 100
    },
    
    // Configuration Monitoring
    monitoring: {
        healthCheckInterval: parseInt(process.env.HEALTH_CHECK_INTERVAL) || 60000, // 1 minute
        metricsRetention: parseInt(process.env.METRICS_RETENTION) || 604800000, // 7 jours
        alertThresholds: {
            memoryUsage: parseFloat(process.env.MEMORY_ALERT_THRESHOLD) || 0.8, // 80%
            diskUsage: parseFloat(process.env.DISK_ALERT_THRESHOLD) || 0.9, // 90%
            responseTime: parseInt(process.env.RESPONSE_TIME_ALERT) || 5000 // 5s
        }
    },
    
    // Fonctionnalités expérimentales
    experimental: {
        aiBasedDeduplication: process.env.AI_DEDUP_ENABLED === 'true',
        predictiveScanning: process.env.PREDICTIVE_SCAN_ENABLED === 'true',
        quantumGeneticEncoding: process.env.QUANTUM_GENETIC_ENABLED === 'true' // Pour le futur 😉
    },
    
    // Validation de configuration
    validate() {
        const errors = [];
        
        if (this.selfAwareness.scanInterval < 30000) {
            errors.push('scanInterval doit être >= 30 secondes');
        }
        
        if (this.genetic.similarityThreshold < 0 || this.genetic.similarityThreshold > 1) {
            errors.push('similarityThreshold doit être entre 0 et 1');
        }
        
        if (this.security.maxFileSize < 1024) {
            errors.push('maxFileSize doit être >= 1KB');
        }
        
        if (errors.length > 0) {
            throw new Error(`Configuration invalide: ${errors.join(', ')}`);
        }
        
        return true;
    }
};