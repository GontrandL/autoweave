const express = require('express');
const { Logger } = require('@autoweave/shared');

const router = express.Router();
const logger = new Logger('HealthRoutes');

// Health service will be set by AutoWeave core
let healthService = null;

// Set health service (called by AutoWeave core)
router.setHealthService = (service) => {
    healthService = service;
    logger.info('Health service set for routes');
};

/**
 * @route GET /api/health
 * @desc Get system health status
 */
router.get('/', async (req, res) => {
    try {
        const health = healthService 
            ? await healthService.getSystemHealth()
            : await getBasicHealth();
        
        const statusCode = health.status === 'healthy' ? 200 : 
                          health.status === 'degraded' ? 200 : 503;
        
        res.status(statusCode).json(health);
        
    } catch (error) {
        logger.error('Health check failed:', error);
        res.status(503).json({
            status: 'unhealthy',
            timestamp: new Date().toISOString(),
            error: error.message,
            components: {}
        });
    }
});

/**
 * @route GET /api/health/detailed
 * @desc Get detailed system health with metrics
 */
router.get('/detailed', async (req, res) => {
    try {
        const health = healthService 
            ? await healthService.getDetailedHealth()
            : await getBasicHealth();
        
        // Add system metrics
        const detailedHealth = {
            ...health,
            system: {
                uptime: process.uptime(),
                memory: process.memoryUsage(),
                cpu: process.cpuUsage(),
                platform: process.platform,
                nodeVersion: process.version,
                pid: process.pid
            },
            timestamp: new Date().toISOString()
        };
        
        const statusCode = health.status === 'healthy' ? 200 : 
                          health.status === 'degraded' ? 200 : 503;
        
        res.status(statusCode).json(detailedHealth);
        
    } catch (error) {
        logger.error('Detailed health check failed:', error);
        res.status(503).json({
            status: 'unhealthy',
            timestamp: new Date().toISOString(),
            error: error.message
        });
    }
});

/**
 * @route GET /api/health/components
 * @desc Get health status of individual components
 */
router.get('/components', async (req, res) => {
    try {
        const components = healthService 
            ? await healthService.getComponentsHealth()
            : await getBasicComponentsHealth();
        
        res.json({
            timestamp: new Date().toISOString(),
            components
        });
        
    } catch (error) {
        logger.error('Components health check failed:', error);
        res.status(500).json({
            error: 'Failed to get components health',
            message: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

/**
 * @route GET /api/health/readiness
 * @desc Kubernetes readiness probe endpoint
 */
router.get('/readiness', async (req, res) => {
    try {
        const readiness = healthService 
            ? await healthService.getReadinessStatus()
            : { ready: true, checks: ['basic'] };
        
        if (readiness.ready) {
            res.status(200).json({
                status: 'ready',
                timestamp: new Date().toISOString(),
                checks: readiness.checks || []
            });
        } else {
            res.status(503).json({
                status: 'not ready',
                timestamp: new Date().toISOString(),
                failedChecks: readiness.failedChecks || [],
                checks: readiness.checks || []
            });
        }
        
    } catch (error) {
        logger.error('Readiness check failed:', error);
        res.status(503).json({
            status: 'not ready',
            timestamp: new Date().toISOString(),
            error: error.message
        });
    }
});

/**
 * @route GET /api/health/liveness
 * @desc Kubernetes liveness probe endpoint
 */
router.get('/liveness', (req, res) => {
    // Simple liveness check - if we can respond, we're alive
    res.status(200).json({
        status: 'alive',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});

/**
 * @route GET /api/health/metrics
 * @desc Get system metrics for monitoring
 */
router.get('/metrics', async (req, res) => {
    try {
        const metrics = healthService 
            ? await healthService.getMetrics()
            : await getBasicMetrics();
        
        res.json({
            timestamp: new Date().toISOString(),
            metrics
        });
        
    } catch (error) {
        logger.error('Metrics collection failed:', error);
        res.status(500).json({
            error: 'Failed to collect metrics',
            message: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

/**
 * @route POST /api/health/test
 * @desc Test system health (for development)
 */
router.post('/test', async (req, res) => {
    if (process.env.NODE_ENV === 'production') {
        return res.status(403).json({
            error: 'Health test endpoint not available in production'
        });
    }
    
    try {
        const { component } = req.body;
        
        const testResult = healthService 
            ? await healthService.testComponent(component)
            : { status: 'test_not_available', component };
        
        res.json({
            timestamp: new Date().toISOString(),
            test: testResult
        });
        
    } catch (error) {
        logger.error('Health test failed:', error);
        res.status(500).json({
            error: 'Health test failed',
            message: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// Basic health functions (fallbacks when health service is not available)

async function getBasicHealth() {
    return {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: '0.1.0',
        uptime: process.uptime(),
        components: await getBasicComponentsHealth()
    };
}

async function getBasicComponentsHealth() {
    return {
        autoweave: {
            status: 'healthy',
            uptime: process.uptime(),
            version: '0.1.0'
        },
        memory: {
            status: 'unknown',
            message: 'Health service not initialized'
        },
        kagent: {
            status: 'unknown',
            message: 'Health service not initialized'
        },
        api: {
            status: 'healthy',
            message: 'API responding'
        }
    };
}

async function getBasicMetrics() {
    const memUsage = process.memoryUsage();
    
    return {
        system: {
            uptime: process.uptime(),
            memory: {
                used: memUsage.heapUsed,
                total: memUsage.heapTotal,
                external: memUsage.external,
                rss: memUsage.rss
            },
            cpu: process.cpuUsage()
        },
        application: {
            version: '0.1.0',
            environment: process.env.NODE_ENV || 'development',
            nodeVersion: process.version
        }
    };
}

module.exports = router;