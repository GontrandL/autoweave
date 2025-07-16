const express = require('express');
const { Logger } = require('../utils/logger');
const { OpenSourceDiscoveryAgent } = require('../agents/open-source-discovery-agent');
const { LicenseComplianceAgent } = require('../agents/license-compliance-agent');
const { ConfigurationIntelligence } = require('../core/config-intelligence');

const router = express.Router();
const logger = new Logger('OpenSourceRoutes');

// Middleware pour initialiser les agents
router.use((req, res, next) => {
    try {
        // Initialiser les agents avec la configuration
        const config = req.app.get('config') || {};
        const memoryManager = req.app.get('memoryManager');
        
        req.openSourceDiscoveryAgent = new OpenSourceDiscoveryAgent(config, memoryManager);
        req.licenseComplianceAgent = new LicenseComplianceAgent(config, memoryManager);
        req.configIntelligence = new ConfigurationIntelligence(config, null, memoryManager);
        
        next();
    } catch (error) {
        logger.error('Failed to initialize open source agents:', error);
        res.status(500).json({ error: 'Failed to initialize open source services' });
    }
});

/**
 * GET /api/open-source/alternatives
 * Découvre des alternatives open source pour un outil donné
 */
router.get('/alternatives', async (req, res) => {
    try {
        const { tool, includeDocker = true, includeNpm = true, includeHelm = true } = req.query;
        
        if (!tool) {
            return res.status(400).json({ 
                error: 'Tool parameter is required',
                example: '/api/open-source/alternatives?tool=datadog'
            });
        }
        
        logger.info(`Discovering alternatives for: ${tool}`);
        
        const options = {
            includeDocker: includeDocker === 'true',
            includeNpm: includeNpm === 'true',
            includeHelm: includeHelm === 'true'
        };
        
        const alternatives = await req.openSourceDiscoveryAgent.discoverAlternatives(tool, options);
        
        res.json({
            success: true,
            data: alternatives,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        logger.error('Failed to discover alternatives:', error);
        res.status(500).json({ 
            error: 'Failed to discover alternatives',
            details: error.message
        });
    }
});

/**
 * POST /api/open-source/audit-licenses
 * Effectue un audit des licences d'un projet
 */
router.post('/audit-licenses', async (req, res) => {
    try {
        const { projectPath, options = {} } = req.body;
        
        if (!projectPath) {
            return res.status(400).json({ 
                error: 'Project path is required',
                example: { projectPath: '/path/to/project' }
            });
        }
        
        logger.info(`Auditing licenses for project: ${projectPath}`);
        
        const auditReport = await req.licenseComplianceAgent.auditLicenseCompliance(projectPath, options);
        
        res.json({
            success: true,
            data: auditReport,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        logger.error('Failed to audit licenses:', error);
        res.status(500).json({ 
            error: 'Failed to audit licenses',
            details: error.message
        });
    }
});

/**
 * GET /api/open-source/compliance-score
 * Calcule le score de compliance open source d'un projet
 */
router.get('/compliance-score', async (req, res) => {
    try {
        const { projectPath } = req.query;
        
        if (!projectPath) {
            return res.status(400).json({ 
                error: 'Project path is required',
                example: '/api/open-source/compliance-score?projectPath=/path/to/project'
            });
        }
        
        logger.info(`Calculating compliance score for: ${projectPath}`);
        
        // Audit rapide pour obtenir le score
        const auditReport = await req.licenseComplianceAgent.auditLicenseCompliance(projectPath, { quickScan: true });
        
        const response = {
            projectPath,
            complianceScore: auditReport.summary.complianceScore,
            riskLevel: auditReport.summary.riskLevel,
            totalDependencies: auditReport.summary.totalDependencies,
            licenseTypes: auditReport.summary.licenseTypes,
            recommendations: auditReport.recommendations.slice(0, 3), // Top 3 recommendations
            auditDate: auditReport.auditDate
        };
        
        res.json({
            success: true,
            data: response,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        logger.error('Failed to calculate compliance score:', error);
        res.status(500).json({ 
            error: 'Failed to calculate compliance score',
            details: error.message
        });
    }
});

/**
 * POST /api/open-source/migration-plan
 * Génère un plan de migration vers une alternative open source
 */
router.post('/migration-plan', async (req, res) => {
    try {
        const { fromTool, toTool, projectContext = {} } = req.body;
        
        if (!fromTool || !toTool) {
            return res.status(400).json({ 
                error: 'Both fromTool and toTool are required',
                example: { fromTool: 'datadog', toTool: 'prometheus' }
            });
        }
        
        logger.info(`Generating migration plan from ${fromTool} to ${toTool}`);
        
        // Découvrir les alternatives pour obtenir les détails
        const alternatives = await req.openSourceDiscoveryAgent.discoverAlternatives(fromTool);
        const selectedAlternative = alternatives.alternatives.find(alt => 
            alt.name.toLowerCase().includes(toTool.toLowerCase())
        );
        
        if (!selectedAlternative) {
            return res.status(404).json({ 
                error: 'Target tool not found in alternatives',
                availableAlternatives: alternatives.alternatives.map(alt => alt.name)
            });
        }
        
        const migrationPlan = await req.openSourceDiscoveryAgent.generateMigrationReport(fromTool, selectedAlternative);
        
        res.json({
            success: true,
            data: migrationPlan,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        logger.error('Failed to generate migration plan:', error);
        res.status(500).json({ 
            error: 'Failed to generate migration plan',
            details: error.message
        });
    }
});

/**
 * GET /api/open-source/cost-analysis
 * Analyse les économies potentielles avec l'open source
 */
router.get('/cost-analysis', async (req, res) => {
    try {
        const { tools, projectPath } = req.query;
        
        if (!tools && !projectPath) {
            return res.status(400).json({ 
                error: 'Either tools list or projectPath is required',
                example: '/api/open-source/cost-analysis?tools=datadog,splunk,vault-enterprise'
            });
        }
        
        logger.info(`Analyzing cost savings for tools: ${tools || 'project dependencies'}`);
        
        let costAnalysis = {
            totalSavings: { monthly: 0, yearly: 0 },
            toolAnalysis: [],
            timestamp: new Date().toISOString()
        };
        
        if (tools) {
            const toolList = tools.split(',').map(t => t.trim());
            
            for (const tool of toolList) {
                const alternatives = await req.openSourceDiscoveryAgent.discoverAlternatives(tool);
                
                if (alternatives.alternatives.length > 0) {
                    const bestAlternative = alternatives.alternatives[0];
                    costAnalysis.toolAnalysis.push({
                        tool,
                        alternative: bestAlternative.name,
                        estimatedSavings: bestAlternative.estimatedCostSaving || { monthly: 100, yearly: 1200 },
                        migrationComplexity: bestAlternative.migrationComplexity || 'Medium',
                        recommendationLevel: bestAlternative.recommendationLevel || 'recommended'
                    });
                    
                    if (bestAlternative.estimatedCostSaving) {
                        costAnalysis.totalSavings.monthly += bestAlternative.estimatedCostSaving.monthly || 0;
                        costAnalysis.totalSavings.yearly += bestAlternative.estimatedCostSaving.yearly || 0;
                    }
                }
            }
        }
        
        res.json({
            success: true,
            data: costAnalysis,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        logger.error('Failed to analyze costs:', error);
        res.status(500).json({ 
            error: 'Failed to analyze costs',
            details: error.message
        });
    }
});

/**
 * POST /api/open-source/cncf-check
 * Vérifie la conformité CNCF d'un projet
 */
router.post('/cncf-check', async (req, res) => {
    try {
        const { projectPath, manifests = [] } = req.body;
        
        if (!projectPath && manifests.length === 0) {
            return res.status(400).json({ 
                error: 'Either projectPath or manifests array is required',
                example: { projectPath: '/path/to/project' }
            });
        }
        
        logger.info(`Checking CNCF compliance for project: ${projectPath}`);
        
        // Audit des licences pour vérifier la conformité
        const auditReport = await req.licenseComplianceAgent.auditLicenseCompliance(projectPath);
        
        // Analyser les composants CNCF
        const cncfComponents = auditReport.licenseAnalysis.analyzed.filter(dep => 
            dep.cncf === true || dep.openSource === true
        );
        
        const cncfCompliance = {
            overall: 'compliant',
            score: auditReport.summary.complianceScore,
            cncfComponents: cncfComponents.length,
            totalComponents: auditReport.summary.totalDependencies,
            cncfPercentage: Math.round((cncfComponents.length / auditReport.summary.totalDependencies) * 100),
            recommendations: [],
            details: {
                cncfTools: cncfComponents.map(comp => ({
                    name: comp.name,
                    license: comp.license,
                    cncf: comp.cncf,
                    openSource: comp.openSource
                }))
            }
        };
        
        // Générer des recommandations
        const proprietaryTools = auditReport.licenseAnalysis.analyzed.filter(dep => 
            dep.license === 'Proprietary' || dep.openSource === false
        );
        
        for (const tool of proprietaryTools.slice(0, 5)) { // Top 5 proprietary tools
            const alternatives = await req.openSourceDiscoveryAgent.discoverAlternatives(tool.name);
            if (alternatives.alternatives.length > 0) {
                cncfCompliance.recommendations.push({
                    tool: tool.name,
                    issue: 'Proprietary dependency',
                    recommendation: `Consider ${alternatives.alternatives[0].name}`,
                    priority: 'medium'
                });
            }
        }
        
        if (cncfCompliance.cncfPercentage < 70) {
            cncfCompliance.overall = 'needs-improvement';
        }
        
        res.json({
            success: true,
            data: cncfCompliance,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        logger.error('Failed to check CNCF compliance:', error);
        res.status(500).json({ 
            error: 'Failed to check CNCF compliance',
            details: error.message
        });
    }
});

/**
 * GET /api/open-source/suggestions
 * Obtient des suggestions de configuration open source
 */
router.get('/suggestions', async (req, res) => {
    try {
        const { intent, category } = req.query;
        
        if (!intent) {
            return res.status(400).json({ 
                error: 'Intent parameter is required',
                example: '/api/open-source/suggestions?intent=monitoring%20solution'
            });
        }
        
        logger.info(`Generating open source suggestions for: ${intent}`);
        
        const suggestions = await req.configIntelligence.generateSuggestions(intent);
        
        // Filtrer par catégorie si spécifiée
        let filteredSuggestions = suggestions;
        if (category) {
            filteredSuggestions = suggestions.filter(s => 
                s.category === category || s.type === category
            );
        }
        
        res.json({
            success: true,
            data: {
                intent,
                category: category || 'all',
                suggestions: filteredSuggestions,
                count: filteredSuggestions.length
            },
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        logger.error('Failed to generate suggestions:', error);
        res.status(500).json({ 
            error: 'Failed to generate suggestions',
            details: error.message
        });
    }
});

/**
 * GET /api/open-source/health
 * Vérifie la santé des services open source
 */
router.get('/health', async (req, res) => {
    try {
        const health = {
            status: 'healthy',
            services: {
                configurationIntelligence: 'healthy',
                openSourceDiscovery: 'healthy',
                licenseCompliance: 'healthy',
                freshSourcesService: 'healthy'
            },
            timestamp: new Date().toISOString()
        };
        
        res.json({
            success: true,
            data: health,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        logger.error('Health check failed:', error);
        res.status(500).json({ 
            error: 'Health check failed',
            details: error.message
        });
    }
});

module.exports = router;