const express = require('express');
const { Logger } = require('../utils/logger');

const router = express.Router();
const logger = new Logger('ConfigRoutes');

// These will be injected by the main routes file
let configIntelligence = null;
let freshSources = null;
let debuggingAgent = null;

/**
 * Set services for routes
 */
function setServices(services) {
    configIntelligence = services.configIntelligence;
    freshSources = services.freshSources;
    debuggingAgent = services.debuggingAgent;
    logger.info('Configuration services set for routes');
}

/**
 * POST /api/config/generate-with-fresh
 * Generate configuration with fresh sources
 */
router.post('/generate-with-fresh', async (req, res) => {
    try {
        const { intent, options } = req.body;
        
        if (!intent) {
            return res.status(400).json({
                error: 'Intent is required',
                message: 'Please provide a natural language description of what you want to configure'
            });
        }
        
        logger.info('Generating configuration for intent:', intent);
        
        const configuration = await configIntelligence.generateConfiguration(intent, options || {});
        
        res.json({
            success: true,
            configuration,
            metadata: {
                generatedAt: new Date().toISOString(),
                intent
            }
        });
        
    } catch (error) {
        logger.error('Failed to generate configuration:', error);
        res.status(500).json({
            error: 'Configuration generation failed',
            message: error.message
        });
    }
});

/**
 * GET /api/config/suggestions
 * Get configuration suggestions based on partial intent
 */
router.get('/suggestions', async (req, res) => {
    try {
        const { q } = req.query;
        
        if (!q) {
            return res.status(400).json({
                error: 'Query parameter q is required'
            });
        }
        
        const suggestions = await configIntelligence.generateSuggestions(q);
        
        res.json({
            success: true,
            query: q,
            suggestions
        });
        
    } catch (error) {
        logger.error('Failed to generate suggestions:', error);
        res.status(500).json({
            error: 'Failed to generate suggestions',
            message: error.message
        });
    }
});

/**
 * GET /api/sources/latest/:type/:name
 * Get latest version information for a package
 */
router.get('/sources/latest/:type/:name', async (req, res) => {
    try {
        const { type, name } = req.params;
        
        let result;
        switch (type) {
            case 'docker':
                result = await freshSources.getDockerLatestTags(name);
                break;
            case 'npm':
                result = await freshSources.getNpmLatestVersion(name);
                break;
            case 'helm':
                result = await freshSources.getHelmChartVersions(name);
                break;
            case 'github':
                result = await freshSources.getGitHubPackageVersions(name);
                break;
            default:
                return res.status(400).json({
                    error: 'Invalid package type',
                    validTypes: ['docker', 'npm', 'helm', 'github']
                });
        }
        
        res.json({
            success: true,
            type,
            name,
            ...result
        });
        
    } catch (error) {
        logger.error(`Failed to get latest version for ${req.params.type}:${req.params.name}:`, error);
        res.status(500).json({
            error: 'Failed to get latest version',
            message: error.message
        });
    }
});

/**
 * POST /api/sources/search
 * Search packages across multiple registries
 */
router.post('/sources/search', async (req, res) => {
    try {
        const { query, options } = req.body;
        
        if (!query) {
            return res.status(400).json({
                error: 'Query is required'
            });
        }
        
        const results = await freshSources.searchPackage(query, options || {});
        
        res.json({
            success: true,
            query,
            results
        });
        
    } catch (error) {
        logger.error('Package search failed:', error);
        res.status(500).json({
            error: 'Search failed',
            message: error.message
        });
    }
});

/**
 * POST /api/sources/check-outdated
 * Check if package versions are outdated
 */
router.post('/sources/check-outdated', async (req, res) => {
    try {
        const { packages } = req.body;
        
        if (!packages || !Array.isArray(packages)) {
            return res.status(400).json({
                error: 'Packages array is required',
                example: [{ type: 'docker', name: 'nginx', currentVersion: '1.24' }]
            });
        }
        
        const results = await Promise.all(
            packages.map(pkg => 
                freshSources.checkIfOutdated(pkg.type, pkg.name, pkg.currentVersion)
                    .catch(err => ({ ...pkg, error: err.message }))
            )
        );
        
        res.json({
            success: true,
            results,
            summary: {
                total: results.length,
                outdated: results.filter(r => r.isOutdated).length,
                errors: results.filter(r => r.error).length
            }
        });
        
    } catch (error) {
        logger.error('Outdated check failed:', error);
        res.status(500).json({
            error: 'Outdated check failed',
            message: error.message
        });
    }
});

/**
 * POST /api/debug/diagnose
 * Diagnose issues with an agent or application
 */
router.post('/debug/diagnose', async (req, res) => {
    try {
        const { identifier, options } = req.body;
        
        if (!identifier) {
            return res.status(400).json({
                error: 'Identifier is required',
                message: 'Provide agent name, pod name, or service name to diagnose'
            });
        }
        
        logger.info('Starting diagnosis for:', identifier);
        
        const diagnosis = await debuggingAgent.diagnose(identifier, options || {});
        
        res.json({
            success: true,
            diagnosis
        });
        
    } catch (error) {
        logger.error('Diagnosis failed:', error);
        res.status(500).json({
            error: 'Diagnosis failed',
            message: error.message
        });
    }
});

/**
 * POST /api/gitops/validate
 * Validate GitOps configuration
 */
router.post('/gitops/validate', async (req, res) => {
    try {
        const { manifests } = req.body;
        
        if (!manifests) {
            return res.status(400).json({
                error: 'Manifests are required'
            });
        }
        
        // Basic validation for GitOps patterns
        const validations = [];
        
        // Check for required GitOps labels
        const requiredLabels = ['app.kubernetes.io/name', 'app.kubernetes.io/version'];
        for (const [name, manifest] of Object.entries(manifests)) {
            const validation = {
                file: name,
                valid: true,
                issues: []
            };
            
            if (!manifest.metadata?.labels) {
                validation.valid = false;
                validation.issues.push('Missing metadata.labels');
            } else {
                for (const label of requiredLabels) {
                    if (!manifest.metadata.labels[label]) {
                        validation.valid = false;
                        validation.issues.push(`Missing required label: ${label}`);
                    }
                }
            }
            
            // Check for resource limits
            if (manifest.kind === 'Deployment' && !manifest.spec?.template?.spec?.containers?.[0]?.resources) {
                validation.issues.push('Warning: No resource limits defined');
            }
            
            validations.push(validation);
        }
        
        res.json({
            success: true,
            valid: validations.every(v => v.valid),
            validations
        });
        
    } catch (error) {
        logger.error('GitOps validation failed:', error);
        res.status(500).json({
            error: 'Validation failed',
            message: error.message
        });
    }
});

module.exports = { router, setServices };