const express = require('express');
const { Logger } = require('../utils/logger');
const { Validator } = require('../utils/validation');

const router = express.Router();
const logger = new Logger('KagentRoutes');

// Kagent service will be set by AutoWeave core
let kagentService = null;

// Middleware to check if kagent service is initialized
const checkKagentService = (req, res, next) => {
    if (!kagentService) {
        return res.status(503).json({
            error: 'Kagent service not initialized',
            message: 'Please initialize the kagent service before using these endpoints'
        });
    }
    next();
};

// Set kagent service (called by AutoWeave core)
router.setKagentService = (service) => {
    kagentService = service;
    logger.info('Kagent service set for routes');
};

/**
 * @route GET /api/kagent/status
 * @desc Get kagent system status
 */
router.get('/status', checkKagentService, async (req, res) => {
    try {
        const status = await kagentService.getSystemStatus();
        
        res.json({
            success: true,
            kagent: status
        });
        
    } catch (error) {
        logger.error('Failed to get kagent status:', error);
        res.status(500).json({
            error: 'Failed to get kagent status',
            message: error.message
        });
    }
});

/**
 * @route GET /api/kagent/tools
 * @desc List available kagent tools
 */
router.get('/tools', checkKagentService, async (req, res) => {
    try {
        const tools = await kagentService.getAvailableTools();
        
        res.json({
            success: true,
            count: tools.length,
            tools: tools.map(tool => ({
                name: tool.metadata.name,
                description: tool.spec.description,
                type: tool.spec.type,
                capabilities: tool.spec.capabilities || [],
                status: tool.status?.phase || 'unknown',
                namespace: tool.metadata.namespace
            }))
        });
        
    } catch (error) {
        logger.error('Failed to list kagent tools:', error);
        res.status(500).json({
            error: 'Failed to list kagent tools',
            message: error.message
        });
    }
});

/**
 * @route GET /api/kagent/tools/:name
 * @desc Get specific kagent tool details
 */
router.get('/tools/:name', checkKagentService, async (req, res) => {
    try {
        const { name } = req.params;
        const tool = await kagentService.getTool(name);
        
        if (!tool) {
            return res.status(404).json({
                error: 'Tool not found',
                toolName: name
            });
        }
        
        res.json({
            success: true,
            tool
        });
        
    } catch (error) {
        logger.error(`Failed to get tool ${req.params.name}:`, error);
        res.status(500).json({
            error: 'Failed to get tool',
            message: error.message
        });
    }
});

/**
 * @route POST /api/kagent/tools
 * @desc Create a custom kagent tool
 */
router.post('/tools', checkKagentService, async (req, res) => {
    try {
        const toolSpec = req.body;
        
        // Basic validation
        if (!toolSpec.metadata?.name) {
            return res.status(400).json({
                error: 'Tool name is required',
                field: 'metadata.name'
            });
        }
        
        if (!toolSpec.spec?.type) {
            return res.status(400).json({
                error: 'Tool type is required',
                field: 'spec.type'
            });
        }
        
        const tool = await kagentService.createTool(toolSpec);
        
        logger.info(`Custom tool created: ${toolSpec.metadata.name}`);
        
        res.status(201).json({
            success: true,
            message: 'Tool created successfully',
            tool
        });
        
    } catch (error) {
        logger.error('Failed to create tool:', error);
        
        if (error.name === 'ValidationError') {
            return res.status(400).json({
                error: error.message,
                field: error.field,
                type: 'validation_error'
            });
        }
        
        res.status(500).json({
            error: 'Failed to create tool',
            message: error.message
        });
    }
});

/**
 * @route DELETE /api/kagent/tools/:name
 * @desc Delete a kagent tool
 */
router.delete('/tools/:name', checkKagentService, async (req, res) => {
    try {
        const { name } = req.params;
        await kagentService.deleteTool(name);
        
        logger.info(`Tool deleted: ${name}`);
        
        res.json({
            success: true,
            message: 'Tool deleted successfully',
            toolName: name
        });
        
    } catch (error) {
        logger.error(`Failed to delete tool ${req.params.name}:`, error);
        
        if (error.code === 'TOOL_NOT_FOUND') {
            return res.status(404).json({
                error: 'Tool not found',
                toolName: req.params.name
            });
        }
        
        res.status(500).json({
            error: 'Failed to delete tool',
            message: error.message
        });
    }
});

/**
 * @route GET /api/kagent/agents
 * @desc List kagent agents (deployed via kagent)
 */
router.get('/agents', checkKagentService, async (req, res) => {
    try {
        const agents = await kagentService.getKagentAgents();
        
        res.json({
            success: true,
            count: agents.length,
            agents: agents.map(agent => ({
                name: agent.metadata.name,
                namespace: agent.metadata.namespace,
                status: agent.status?.phase || 'unknown',
                createdAt: agent.metadata.creationTimestamp,
                labels: agent.metadata.labels || {}
            }))
        });
        
    } catch (error) {
        logger.error('Failed to list kagent agents:', error);
        res.status(500).json({
            error: 'Failed to list kagent agents',
            message: error.message
        });
    }
});

/**
 * @route GET /api/kagent/agents/:name
 * @desc Get kagent agent details
 */
router.get('/agents/:name', checkKagentService, async (req, res) => {
    try {
        const { name } = req.params;
        const { namespace = 'default' } = req.query;
        
        const agent = await kagentService.getKagentAgent(name, namespace);
        
        if (!agent) {
            return res.status(404).json({
                error: 'Kagent agent not found',
                agentName: name,
                namespace
            });
        }
        
        res.json({
            success: true,
            agent
        });
        
    } catch (error) {
        logger.error(`Failed to get kagent agent ${req.params.name}:`, error);
        res.status(500).json({
            error: 'Failed to get kagent agent',
            message: error.message
        });
    }
});

/**
 * @route GET /api/kagent/logs/:agentName
 * @desc Get logs for a kagent agent
 */
router.get('/logs/:agentName', checkKagentService, async (req, res) => {
    try {
        const { agentName } = req.params;
        const { namespace = 'default', lines = 100, since } = req.query;
        
        const logs = await kagentService.getAgentLogs(agentName, namespace, {
            lines: parseInt(lines),
            since
        });
        
        res.json({
            success: true,
            agentName,
            namespace,
            logs
        });
        
    } catch (error) {
        logger.error(`Failed to get logs for ${req.params.agentName}:`, error);
        res.status(500).json({
            error: 'Failed to get agent logs',
            message: error.message
        });
    }
});

/**
 * @route GET /api/kagent/metrics
 * @desc Get kagent system metrics
 */
router.get('/metrics', checkKagentService, async (req, res) => {
    try {
        const metrics = await kagentService.getMetrics();
        
        res.json({
            success: true,
            timestamp: new Date().toISOString(),
            metrics
        });
        
    } catch (error) {
        logger.error('Failed to get kagent metrics:', error);
        res.status(500).json({
            error: 'Failed to get kagent metrics',
            message: error.message
        });
    }
});

/**
 * @route POST /api/kagent/yaml/generate
 * @desc Generate kagent YAML from workflow
 */
router.post('/yaml/generate', checkKagentService, async (req, res) => {
    try {
        const { workflow } = req.body;
        
        if (!workflow) {
            return res.status(400).json({
                error: 'Workflow is required',
                field: 'workflow'
            });
        }
        
        // Validate workflow structure
        if (!workflow.id || !workflow.name) {
            return res.status(400).json({
                error: 'Workflow must have id and name',
                fields: ['workflow.id', 'workflow.name']
            });
        }
        
        const yaml = await kagentService.generateYAML(workflow);
        
        res.json({
            success: true,
            workflow: {
                id: workflow.id,
                name: workflow.name
            },
            yaml
        });
        
    } catch (error) {
        logger.error('Failed to generate YAML:', error);
        
        if (error.name === 'ValidationError') {
            return res.status(400).json({
                error: error.message,
                field: error.field,
                type: 'validation_error'
            });
        }
        
        res.status(500).json({
            error: 'Failed to generate YAML',
            message: error.message
        });
    }
});

/**
 * @route POST /api/kagent/deploy
 * @desc Deploy workflow to kagent
 */
router.post('/deploy', checkKagentService, async (req, res) => {
    try {
        const { workflow } = req.body;
        
        if (!workflow) {
            return res.status(400).json({
                error: 'Workflow is required',
                field: 'workflow'
            });
        }
        
        const deployment = await kagentService.deployWorkflow(workflow);
        
        logger.info(`Workflow deployed to kagent: ${workflow.name}`);
        
        res.status(201).json({
            success: true,
            message: 'Workflow deployed successfully',
            deployment
        });
        
    } catch (error) {
        logger.error('Failed to deploy workflow:', error);
        
        if (error.name === 'ValidationError') {
            return res.status(400).json({
                error: error.message,
                field: error.field,
                type: 'validation_error'
            });
        }
        
        res.status(500).json({
            error: 'Failed to deploy workflow',
            message: error.message
        });
    }
});

/**
 * @route GET /api/kagent/health
 * @desc Get kagent health status
 */
router.get('/health', (req, res) => {
    const health = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        kagentService: kagentService ? 'available' : 'unavailable',
        endpoints: {
            status: '/api/kagent/status',
            tools: '/api/kagent/tools',
            agents: '/api/kagent/agents',
            metrics: '/api/kagent/metrics',
            deploy: '/api/kagent/deploy',
            health: '/api/kagent/health'
        }
    };
    
    if (kagentService) {
        health.kagent = {
            initialized: kagentService.isInitialized || false,
            namespace: kagentService.config?.namespace || 'unknown'
        };
    }
    
    res.json(health);
});

module.exports = router;