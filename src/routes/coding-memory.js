/**
 * Coding Memory API Routes
 * ========================
 * REST API endpoints for the intelligent code memory module
 */

const express = require('express');
const router = express.Router();
const { Logger } = require('../utils/logger');
const CodingMemoryManager = require('../memory/coding/coding-memory-manager');
const config = require('../../config/autoweave/config');

const logger = new Logger('CodingMemoryAPI');
let codingMemory;

// Initialize coding memory manager
const initializeCodingMemory = async () => {
    if (!codingMemory) {
        try {
            // Pass the memory configuration from main config
            codingMemory = new CodingMemoryManager(config.memory);
            await codingMemory.initialize();
            logger.success('Coding memory manager initialized');
        } catch (error) {
            logger.error('Failed to initialize coding memory:', error);
            throw error;
        }
    }
    return codingMemory;
};

// Middleware to ensure coding memory is initialized
router.use(async (req, res, next) => {
    try {
        await initializeCodingMemory();
        next();
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Coding memory system not available'
        });
    }
});

/**
 * POST /api/memory/code/context
 * Remember code context with metadata
 */
router.post('/context', async (req, res) => {
    try {
        const result = await codingMemory.rememberCodeContext(req.body);
        res.json({
            success: true,
            ...result
        });
    } catch (error) {
        logger.error('Failed to remember code context:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/memory/code/context/:fileHash
 * Get code context by file hash
 */
router.get('/context/:fileHash', async (req, res) => {
    try {
        const context = await codingMemory.getCodeContext(
            req.params.fileHash,
            req.query.function
        );
        
        res.json({
            success: true,
            context
        });
    } catch (error) {
        logger.error('Failed to get code context:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * POST /api/memory/code/search-similar
 * Search for similar code contexts
 */
router.post('/search-similar', async (req, res) => {
    try {
        const { query, context = {} } = req.body;
        const results = await codingMemory.intelligentCodeSearch(query, context);
        
        res.json({
            success: true,
            ...results
        });
    } catch (error) {
        logger.error('Code search failed:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * POST /api/memory/code/relations
 * Create code relations
 */
router.post('/relations', async (req, res) => {
    try {
        const result = await codingMemory.createCodeRelation(req.body);
        res.json({
            success: true,
            ...result
        });
    } catch (error) {
        logger.error('Failed to create code relation:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/memory/code/dependencies/:module
 * Get module dependencies
 */
router.get('/dependencies/:module', async (req, res) => {
    try {
        const dependencies = await codingMemory.analyzeCodeDependencies(
            req.params.module
        );
        
        res.json({
            success: true,
            module: req.params.module,
            dependencies
        });
    } catch (error) {
        logger.error('Failed to analyze dependencies:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/memory/code/call-graph/:function
 * Get function call graph
 */
router.get('/call-graph/:function', async (req, res) => {
    try {
        const relations = await codingMemory.getCodeRelations(
            req.query.file,
            req.params.function
        );
        
        res.json({
            success: true,
            function: req.params.function,
            file: req.query.file,
            relations
        });
    } catch (error) {
        logger.error('Failed to get call graph:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/memory/code/analytics/patterns
 * Get code patterns analytics
 */
router.get('/analytics/patterns', async (req, res) => {
    try {
        const patterns = await codingMemory.findCommonPatterns(
            req.query.period || '30days'
        );
        
        res.json({
            success: true,
            period: req.query.period || '30days',
            patterns
        });
    } catch (error) {
        logger.error('Failed to get pattern analytics:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/memory/code/analytics/complexity
 * Get complexity analytics
 */
router.get('/analytics/complexity', async (req, res) => {
    try {
        const analytics = await codingMemory.analyzeComplexityTrends(
            req.query.period || '30days'
        );
        
        res.json({
            success: true,
            period: req.query.period || '30days',
            analytics
        });
    } catch (error) {
        logger.error('Failed to get complexity analytics:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/memory/code/recommendations
 * Get code improvement recommendations
 */
router.get('/recommendations', async (req, res) => {
    try {
        const analytics = await codingMemory.getTeamAnalytics({
            period: req.query.period || '30days',
            metrics: ['complexity_trends', 'refactoring_patterns', 'code_quality']
        });
        
        res.json({
            success: true,
            recommendations: analytics.recommendations,
            analytics
        });
    } catch (error) {
        logger.error('Failed to get recommendations:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * POST /api/memory/code/learn-from-diff
 * Learn from code diff
 */
router.post('/learn-from-diff', async (req, res) => {
    try {
        const { commit, changes, patterns } = req.body;
        const result = await codingMemory.learnFromCommit({
            commit,
            changes,
            patterns
        });
        
        res.json({
            success: true,
            ...result
        });
    } catch (error) {
        logger.error('Failed to learn from diff:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * POST /api/memory/code/learn-from-review
 * Learn from code review
 */
router.post('/learn-from-review', async (req, res) => {
    try {
        const { pr, feedback } = req.body;
        
        // Extract patterns from review feedback
        const patterns = {};
        for (const item of feedback) {
            patterns[item.topic] = item.type;
        }
        
        const result = await codingMemory.learnFromCommit({
            commit: `PR-${pr}`,
            changes: { reviewed: feedback.map(f => f.file) },
            patterns
        });
        
        res.json({
            success: true,
            pr,
            ...result
        });
    } catch (error) {
        logger.error('Failed to learn from review:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * POST /api/memory/code/suggest-refactor
 * Suggest refactoring for code
 */
router.post('/suggest-refactor', async (req, res) => {
    try {
        const suggestions = await codingMemory.suggestRefactoring(req.body);
        
        res.json({
            success: true,
            ...suggestions
        });
    } catch (error) {
        logger.error('Failed to suggest refactoring:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * POST /api/memory/code/explain
 * Explain code context
 */
router.post('/explain', async (req, res) => {
    try {
        const explanation = await codingMemory.explainCodeContext(req.body);
        
        res.json({
            success: true,
            ...explanation
        });
    } catch (error) {
        logger.error('Failed to explain code:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * POST /api/memory/code/predict-next
 * Predict next developer action
 */
router.post('/predict-next', async (req, res) => {
    try {
        const predictions = await codingMemory.predictNextAction(req.body);
        
        res.json({
            success: true,
            ...predictions
        });
    } catch (error) {
        logger.error('Failed to predict next action:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * POST /api/memory/code/learn-style
 * Learn code style from project
 */
router.post('/learn-style', async (req, res) => {
    try {
        const styleGuide = await codingMemory.learnCodeStyle(req.body);
        
        res.json({
            success: true,
            styleGuide
        });
    } catch (error) {
        logger.error('Failed to learn code style:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/memory/code/health
 * Health check for coding memory
 */
router.get('/health', async (req, res) => {
    try {
        const health = {
            status: 'operational',
            initialized: !!codingMemory,
            features: {
                contextMemory: true,
                codeRelations: true,
                patternAnalysis: true,
                predictiveCapabilities: true,
                styleAnalysis: true
            }
        };
        
        res.json({
            success: true,
            health
        });
    } catch (error) {
        logger.error('Health check failed:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

module.exports = router;