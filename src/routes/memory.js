const express = require('express');
const HybridMemoryManager = require('../memory/hybrid-memory');
const { Logger } = require('../utils/logger');

const router = express.Router();
const logger = new Logger('MemoryRoutes');

// Initialize memory manager (will be set by AutoWeave core)
let memoryManager = null;

// Middleware to check if memory manager is initialized
const checkMemoryManager = (req, res, next) => {
    if (!memoryManager) {
        return res.status(503).json({
            error: 'Memory system not initialized',
            message: 'Please initialize the memory system before using these endpoints'
        });
    }
    next();
};

// Set memory manager (called by AutoWeave core)
router.setMemoryManager = (manager) => {
    memoryManager = manager;
    logger.info('Memory manager set for routes');
};

/**
 * @route POST /api/memory/initialize
 * @desc Initialize memory system
 */
router.post('/initialize', async (req, res) => {
    try {
        if (!memoryManager) {
            return res.status(503).json({
                error: 'Memory manager not available',
                message: 'Memory system configuration issue'
            });
        }

        await memoryManager.initialize();
        
        res.json({
            success: true,
            message: 'Memory system initialized successfully',
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        logger.error('Memory initialization failed:', error);
        res.status(500).json({
            error: 'Initialization failed',
            message: error.message
        });
    }
});

/**
 * @route POST /api/memory/search
 * @desc Perform hybrid memory search
 */
router.post('/search', checkMemoryManager, async (req, res) => {
    try {
        const { query, user_id, context = {} } = req.body;
        
        if (!query || !user_id) {
            return res.status(400).json({
                error: 'Missing required parameters',
                message: 'query and user_id are required'
            });
        }

        const results = await memoryManager.intelligentSearch(query, user_id, context);
        
        res.json({
            success: true,
            results,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        logger.error('Memory search failed:', error);
        res.status(500).json({
            error: 'Search failed',
            message: error.message
        });
    }
});

/**
 * @route GET /api/memory/system-analysis/:userId
 * @desc Get system analysis for user
 */
router.get('/system-analysis/:userId', checkMemoryManager, async (req, res) => {
    try {
        const { userId } = req.params;
        
        const analysis = await memoryManager.analyzeSystemState(userId);
        
        res.json({
            success: true,
            analysis,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        logger.error('System analysis failed:', error);
        res.status(500).json({
            error: 'Analysis failed',
            message: error.message
        });
    }
});

/**
 * @route POST /api/memory/agent/:agentId/memory
 * @desc Add memory for specific agent
 */
router.post('/agent/:agentId/memory', checkMemoryManager, async (req, res) => {
    try {
        const { agentId } = req.params;
        const { memory, metadata = {} } = req.body;
        
        if (!memory) {
            return res.status(400).json({
                error: 'Missing memory content',
                message: 'memory field is required'
            });
        }

        await memoryManager.contextualMemory.addAgentMemory(agentId, memory, metadata);
        
        res.json({
            success: true,
            message: `Memory added for agent ${agentId}`,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        logger.error('Failed to add agent memory:', error);
        res.status(500).json({
            error: 'Memory addition failed',
            message: error.message
        });
    }
});

/**
 * @route POST /api/memory/user/:userId/memory
 * @desc Add memory for specific user
 */
router.post('/user/:userId/memory', checkMemoryManager, async (req, res) => {
    try {
        const { userId } = req.params;
        const { memory, metadata = {} } = req.body;
        
        if (!memory) {
            return res.status(400).json({
                error: 'Missing memory content',
                message: 'memory field is required'
            });
        }

        await memoryManager.contextualMemory.addUserMemory(userId, memory, metadata);
        
        res.json({
            success: true,
            message: `Memory added for user ${userId}`,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        logger.error('Failed to add user memory:', error);
        res.status(500).json({
            error: 'Memory addition failed',
            message: error.message
        });
    }
});

/**
 * @route POST /api/memory/interaction
 * @desc Add interaction to memory
 */
router.post('/interaction', checkMemoryManager, async (req, res) => {
    try {
        const { user_id, agent_id, interaction } = req.body;
        
        if (!user_id || !agent_id || !interaction) {
            return res.status(400).json({
                error: 'Missing required parameters',
                message: 'user_id, agent_id, and interaction are required'
            });
        }

        await memoryManager.addInteraction(user_id, agent_id, interaction);
        
        res.json({
            success: true,
            message: 'Interaction added to memory',
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        logger.error('Failed to add interaction:', error);
        res.status(500).json({
            error: 'Interaction addition failed',
            message: error.message
        });
    }
});

/**
 * @route POST /api/memory/graph/relation
 * @desc Create relation in graph
 */
router.post('/graph/relation', checkMemoryManager, async (req, res) => {
    try {
        const { source_id, target_id, relation_type } = req.body;
        
        if (!source_id || !target_id || !relation_type) {
            return res.status(400).json({
                error: 'Missing required parameters',
                message: 'source_id, target_id, and relation_type are required'
            });
        }

        await memoryManager.structuralMemory.linkAgentToWorkflow(source_id, target_id, relation_type);
        
        res.json({
            success: true,
            message: 'Relation created in graph',
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        logger.error('Failed to create graph relation:', error);
        res.status(500).json({
            error: 'Relation creation failed',
            message: error.message
        });
    }
});

/**
 * @route GET /api/memory/agent/:agentId/related
 * @desc Get related entities for agent
 */
router.get('/agent/:agentId/related', checkMemoryManager, async (req, res) => {
    try {
        const { agentId } = req.params;
        const { depth = 2 } = req.query;
        
        const related = await memoryManager.structuralMemory.findRelatedAgents(agentId, parseInt(depth));
        
        res.json({
            success: true,
            agent_id: agentId,
            related_entities: related,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        logger.error('Failed to get related entities:', error);
        res.status(500).json({
            error: 'Related entities retrieval failed',
            message: error.message
        });
    }
});

/**
 * @route GET /api/memory/agent/:agentId/dependencies
 * @desc Analyze agent dependencies
 */
router.get('/agent/:agentId/dependencies', checkMemoryManager, async (req, res) => {
    try {
        const { agentId } = req.params;
        
        const dependencies = await memoryManager.structuralMemory.analyzeDependencies(agentId);
        
        res.json({
            success: true,
            dependencies,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        logger.error('Failed to analyze dependencies:', error);
        res.status(500).json({
            error: 'Dependencies analysis failed',
            message: error.message
        });
    }
});

/**
 * @route GET /api/memory/metrics
 * @desc Get memory system metrics
 */
router.get('/metrics', checkMemoryManager, async (req, res) => {
    try {
        const metrics = memoryManager.getMetrics();
        
        res.json({
            success: true,
            metrics,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        logger.error('Failed to get metrics:', error);
        res.status(500).json({
            error: 'Metrics retrieval failed',
            message: error.message
        });
    }
});

/**
 * @route GET /api/memory/health
 * @desc Check memory system health
 */
router.get('/health', checkMemoryManager, async (req, res) => {
    try {
        const health = await memoryManager.contextualMemory.healthCheck();
        
        res.json({
            success: true,
            health,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        logger.error('Memory health check failed:', error);
        res.status(500).json({
            error: 'Health check failed',
            message: error.message
        });
    }
});

/**
 * @route GET /api/memory/system/topology
 * @desc Get system topology
 */
router.get('/system/topology', checkMemoryManager, async (req, res) => {
    try {
        const topology = await memoryManager.structuralMemory.getSystemTopology();
        
        res.json({
            success: true,
            topology,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        logger.error('Failed to get system topology:', error);
        res.status(500).json({
            error: 'Topology retrieval failed',
            message: error.message
        });
    }
});

/**
 * @route POST /api/memory/metrics/reset
 * @desc Reset memory metrics
 */
router.post('/metrics/reset', checkMemoryManager, async (req, res) => {
    try {
        memoryManager.resetMetrics();
        
        res.json({
            success: true,
            message: 'Metrics reset successfully',
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        logger.error('Failed to reset metrics:', error);
        res.status(500).json({
            error: 'Metrics reset failed',
            message: error.message
        });
    }
});

module.exports = router;