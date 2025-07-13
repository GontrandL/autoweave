const express = require('express');
const { Logger } = require('@autoweave/shared');
const { Validator } = require('@autoweave/shared');
const { IntegrationAgentModule } = require('@autoweave/agents');

const router = express.Router();
const logger = new Logger('AgentRoutes');

// Agent service will be set by AutoWeave core
let agentService = null;

// Integration Agent Module
let integrationAgentModule = null;

// Middleware to check if agent service is initialized
const checkAgentService = (req, res, next) => {
    if (!agentService) {
        return res.status(503).json({
            error: 'Agent service not initialized',
            message: 'Please initialize the agent service before using these endpoints'
        });
    }
    next();
};

// Set agent service (called by AutoWeave core)
router.setAgentService = (service) => {
    agentService = service;
    logger.info('Agent service set for routes');
};

// Set integration agent module (called by AutoWeave core)
router.setIntegrationAgentModule = (module) => {
    integrationAgentModule = module;
    logger.info('Integration Agent Module set for routes');
};

/**
 * @route POST /api/agents
 * @desc Create and deploy a new agent
 */
router.post('/', checkAgentService, async (req, res) => {
    try {
        const { description, userId = 'system' } = req.body;
        
        // Validation
        if (!description) {
            return res.status(400).json({ 
                error: 'Description is required',
                field: 'description'
            });
        }
        
        Validator.validateAgentDescription(description);
        
        // Create and deploy agent
        const result = await agentService.createAndDeployAgent(description, userId);
        
        logger.info(`Agent created: ${result.workflow.name}`);
        
        res.status(201).json({
            success: true,
            agent: {
                id: result.workflow.id,
                name: result.workflow.name,
                description: result.workflow.description,
                status: result.status,
                capabilities: result.workflow.requiredModules.map(m => m.type),
                createdAt: new Date().toISOString()
            },
            deployment: {
                kagentName: result.deployment.kagentName,
                namespace: result.deployment.namespace,
                status: result.deployment.status
            }
        });
        
    } catch (error) {
        logger.error('Failed to create agent:', error);
        
        if (error.name === 'ValidationError') {
            return res.status(400).json({
                error: error.message,
                field: error.field,
                type: 'validation_error'
            });
        }
        
        res.status(500).json({
            error: 'Failed to create agent',
            message: error.message,
            type: 'server_error'
        });
    }
});

/**
 * @route GET /api/agents
 * @desc List all agents
 */
router.get('/', checkAgentService, async (req, res) => {
    try {
        const agents = await agentService.listAgents();
        
        res.json({
            success: true,
            count: agents.length,
            agents: agents.map(agent => ({
                id: agent.id,
                name: agent.name,
                description: agent.description,
                status: agent.status,
                createdAt: agent.createdAt,
                lastUpdated: agent.lastUpdated
            }))
        });
        
    } catch (error) {
        logger.error('Failed to list agents:', error);
        res.status(500).json({
            error: 'Failed to list agents',
            message: error.message
        });
    }
});

/**
 * @route GET /api/agents/:id
 * @desc Get agent details and status
 */
router.get('/:id', checkAgentService, async (req, res) => {
    try {
        const { id } = req.params;
        const agent = await agentService.getAgentStatus(id);
        
        if (!agent) {
            return res.status(404).json({
                error: 'Agent not found',
                agentId: id
            });
        }
        
        res.json({
            success: true,
            agent
        });
        
    } catch (error) {
        logger.error(`Failed to get agent ${req.params.id}:`, error);
        res.status(500).json({
            error: 'Failed to get agent status',
            message: error.message
        });
    }
});

/**
 * @route PUT /api/agents/:id
 * @desc Update agent configuration
 */
router.put('/:id', checkAgentService, async (req, res) => {
    try {
        const { id } = req.params;
        const updates = req.body;
        
        const agent = await agentService.updateAgent(id, updates);
        
        if (!agent) {
            return res.status(404).json({
                error: 'Agent not found',
                agentId: id
            });
        }
        
        res.json({
            success: true,
            message: 'Agent updated successfully',
            agent
        });
        
    } catch (error) {
        logger.error(`Failed to update agent ${req.params.id}:`, error);
        res.status(500).json({
            error: 'Failed to update agent',
            message: error.message
        });
    }
});

/**
 * @route DELETE /api/agents/:id
 * @desc Delete an agent
 */
router.delete('/:id', checkAgentService, async (req, res) => {
    try {
        const { id } = req.params;
        await agentService.deleteAgent(id);
        
        logger.info(`Agent ${id} deleted`);
        
        res.json({
            success: true,
            message: 'Agent deleted successfully',
            agentId: id
        });
        
    } catch (error) {
        logger.error(`Failed to delete agent ${req.params.id}:`, error);
        
        if (error.code === 'AGENT_NOT_FOUND') {
            return res.status(404).json({
                error: 'Agent not found',
                agentId: req.params.id
            });
        }
        
        res.status(500).json({
            error: 'Failed to delete agent',
            message: error.message
        });
    }
});

/**
 * @route POST /api/agents/:id/start
 * @desc Start an agent
 */
router.post('/:id/start', checkAgentService, async (req, res) => {
    try {
        const { id } = req.params;
        const result = await agentService.startAgent(id);
        
        res.json({
            success: true,
            message: 'Agent start initiated',
            agentId: id,
            status: result.status
        });
        
    } catch (error) {
        logger.error(`Failed to start agent ${req.params.id}:`, error);
        res.status(500).json({
            error: 'Failed to start agent',
            message: error.message
        });
    }
});

/**
 * @route POST /api/agents/:id/stop
 * @desc Stop an agent
 */
router.post('/:id/stop', checkAgentService, async (req, res) => {
    try {
        const { id } = req.params;
        const result = await agentService.stopAgent(id);
        
        res.json({
            success: true,
            message: 'Agent stop initiated',
            agentId: id,
            status: result.status
        });
        
    } catch (error) {
        logger.error(`Failed to stop agent ${req.params.id}:`, error);
        res.status(500).json({
            error: 'Failed to stop agent',
            message: error.message
        });
    }
});

/**
 * @route GET /api/agents/:id/logs
 * @desc Get agent logs
 */
router.get('/:id/logs', checkAgentService, async (req, res) => {
    try {
        const { id } = req.params;
        const { limit = 100, since } = req.query;
        
        const logs = await agentService.getAgentLogs(id, { limit: parseInt(limit), since });
        
        res.json({
            success: true,
            agentId: id,
            logs
        });
        
    } catch (error) {
        logger.error(`Failed to get logs for agent ${req.params.id}:`, error);
        res.status(500).json({
            error: 'Failed to get agent logs',
            message: error.message
        });
    }
});

/**
 * @route GET /api/agents/:id/metrics
 * @desc Get agent metrics
 */
router.get('/:id/metrics', checkAgentService, async (req, res) => {
    try {
        const { id } = req.params;
        const metrics = await agentService.getAgentMetrics(id);
        
        res.json({
            success: true,
            agentId: id,
            metrics
        });
        
    } catch (error) {
        logger.error(`Failed to get metrics for agent ${req.params.id}:`, error);
        res.status(500).json({
            error: 'Failed to get agent metrics',
            message: error.message
        });
    }
});

// ============================================================================
// INTEGRATION AGENT ROUTES
// ============================================================================

/**
 * @route POST /api/agents/integration
 * @desc Create integration agent from OpenAPI specification
 */
router.post('/integration', async (req, res) => {
    try {
        const { openapi_url, target_namespace, git_repo, deploy_config } = req.body;
        
        if (!openapi_url) {
            return res.status(400).json({
                error: 'Missing required parameter: openapi_url',
                message: 'Please provide a valid OpenAPI specification URL or file path'
            });
        }
        
        if (!integrationAgentModule) {
            return res.status(503).json({
                error: 'Integration Agent Module not initialized',
                message: 'Please initialize the Integration Agent Module first'
            });
        }
        
        logger.info('Creating integration agent:', { openapi_url, target_namespace, git_repo });
        
        const result = await integrationAgentModule.createIntegrationAgent({
            openapi_url,
            target_namespace,
            git_repo,
            deploy_config
        });
        
        res.json({
            success: true,
            message: 'Integration agent created successfully',
            ...result
        });
        
    } catch (error) {
        logger.error('Failed to create integration agent:', error);
        res.status(500).json({
            error: 'Failed to create integration agent',
            message: error.message
        });
    }
});

/**
 * @route GET /api/agents/integration
 * @desc List all integration agents
 */
router.get('/integration', async (req, res) => {
    try {
        if (!integrationAgentModule) {
            return res.status(503).json({
                error: 'Integration Agent Module not initialized'
            });
        }
        
        const agents = await integrationAgentModule.listIntegrationAgents();
        
        res.json({
            success: true,
            agents,
            count: agents.length
        });
        
    } catch (error) {
        logger.error('Failed to list integration agents:', error);
        res.status(500).json({
            error: 'Failed to list integration agents',
            message: error.message
        });
    }
});

/**
 * @route GET /api/agents/integration/:id
 * @desc Get integration agent status
 */
router.get('/integration/:id', async (req, res) => {
    try {
        const { id } = req.params;
        
        if (!integrationAgentModule) {
            return res.status(503).json({
                error: 'Integration Agent Module not initialized'
            });
        }
        
        const agent = await integrationAgentModule.getIntegrationAgentStatus(id);
        
        res.json({
            success: true,
            agent
        });
        
    } catch (error) {
        logger.error(`Failed to get integration agent ${req.params.id}:`, error);
        
        if (error.message.includes('not found')) {
            return res.status(404).json({
                error: 'Integration agent not found',
                agentId: req.params.id
            });
        }
        
        res.status(500).json({
            error: 'Failed to get integration agent',
            message: error.message
        });
    }
});

/**
 * @route DELETE /api/agents/integration/:id
 * @desc Delete integration agent
 */
router.delete('/integration/:id', async (req, res) => {
    try {
        const { id } = req.params;
        
        if (!integrationAgentModule) {
            return res.status(503).json({
                error: 'Integration Agent Module not initialized'
            });
        }
        
        const result = await integrationAgentModule.deleteIntegrationAgent(id);
        
        res.json({
            success: true,
            message: 'Integration agent deleted successfully',
            ...result
        });
        
    } catch (error) {
        logger.error(`Failed to delete integration agent ${req.params.id}:`, error);
        
        if (error.message.includes('not found')) {
            return res.status(404).json({
                error: 'Integration agent not found',
                agentId: req.params.id
            });
        }
        
        res.status(500).json({
            error: 'Failed to delete integration agent',
            message: error.message
        });
    }
});

/**
 * @route GET /api/agents/integration/metrics
 * @desc Get integration agent metrics
 */
router.get('/integration/metrics', async (req, res) => {
    try {
        if (!integrationAgentModule) {
            return res.status(503).json({
                error: 'Integration Agent Module not initialized'
            });
        }
        
        const metrics = await integrationAgentModule.getMetrics();
        
        res.json({
            success: true,
            metrics
        });
        
    } catch (error) {
        logger.error('Failed to get integration agent metrics:', error);
        res.status(500).json({
            error: 'Failed to get integration agent metrics',
            message: error.message
        });
    }
});

/**
 * @route GET /api/agents/integration/metrics/prometheus
 * @desc Get Prometheus metrics for integration agents
 */
router.get('/integration/metrics/prometheus', async (req, res) => {
    try {
        if (!integrationAgentModule) {
            return res.status(503).json({
                error: 'Integration Agent Module not initialized'
            });
        }
        
        const metrics = await integrationAgentModule.getMetrics();
        const promMetrics = metrics.prometheus || '# No Prometheus metrics available\n';
        
        res.set('Content-Type', 'text/plain');
        res.send(promMetrics);
        
    } catch (error) {
        logger.error('Failed to get Prometheus metrics:', error);
        res.status(500).send('# Error getting metrics\n');
    }
});

module.exports = router;