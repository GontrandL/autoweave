const express = require('express');
const router = express.Router();
const selfAwarenessAgent = require('../agents/self-awareness-agent');
const { Logger } = require('../utils/logger');

const logger = new Logger('SelfAwarenessRoutes');

/**
 * Routes pour l'agent de Self-Awareness
 * Fournit des informations sur l'état du système et ses capacités
 */

/**
 * GET /api/self-awareness/status
 * Obtenir l'état complet du système
 */
router.get('/status', async (req, res) => {
    try {
        const status = selfAwarenessAgent.getSystemState();
        
        res.json({
            success: true,
            status,
            message: 'System status retrieved successfully'
        });
        
    } catch (error) {
        logger.error('Failed to get system status:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to retrieve system status'
        });
    }
});

/**
 * GET /api/self-awareness/tools
 * Lister tous les outils disponibles
 */
router.get('/tools', async (req, res) => {
    try {
        const { category } = req.query;
        const state = selfAwarenessAgent.getSystemState();
        
        let tools = Array.from(selfAwarenessAgent.systemState.tools.entries());
        
        // Filtrer par catégorie si demandé
        if (category) {
            tools = tools.filter(([name, info]) => info.category === category);
        }
        
        const toolsList = tools.map(([name, info]) => ({
            name,
            ...info
        }));
        
        res.json({
            success: true,
            tools: toolsList,
            count: toolsList.length,
            categories: [...new Set(toolsList.map(t => t.category))]
        });
        
    } catch (error) {
        logger.error('Failed to get tools:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to retrieve tools'
        });
    }
});

/**
 * GET /api/self-awareness/files
 * Lister les fichiers trackés
 */
router.get('/files', async (req, res) => {
    try {
        const { type, inDatabase, hasGeneticMarker } = req.query;
        const state = selfAwarenessAgent.getSystemState();
        
        let files = Array.from(selfAwarenessAgent.systemState.files.entries());
        
        // Filtrer selon les critères
        if (type) {
            files = files.filter(([path, info]) => info.type === type);
        }
        
        if (inDatabase !== undefined) {
            const inDb = inDatabase === 'true';
            files = files.filter(([path, info]) => info.inDatabase === inDb);
        }
        
        if (hasGeneticMarker !== undefined) {
            const hasMarker = hasGeneticMarker === 'true';
            files = files.filter(([path, info]) => info.hasGeneticMarker === hasMarker);
        }
        
        const filesList = files.map(([path, info]) => ({
            path,
            ...info
        }));
        
        res.json({
            success: true,
            files: filesList,
            count: filesList.length,
            stats: {
                total: selfAwarenessAgent.systemState.files.size,
                inDatabase: files.filter(([p, i]) => i.inDatabase).length,
                withGeneticMarkers: files.filter(([p, i]) => i.hasGeneticMarker).length
            }
        });
        
    } catch (error) {
        logger.error('Failed to get files:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to retrieve files'
        });
    }
});

/**
 * GET /api/self-awareness/sync
 * Obtenir l'état de synchronisation DB
 */
router.get('/sync', async (req, res) => {
    try {
        const state = selfAwarenessAgent.getSystemState();
        
        res.json({
            success: true,
            sync: state.dbSync,
            recommendation: state.dbSync.status === 'out-of-sync' ? 
                'Run POST /api/self-awareness/sync to synchronize' : 
                'System is synchronized'
        });
        
    } catch (error) {
        logger.error('Failed to get sync status:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to retrieve sync status'
        });
    }
});

/**
 * POST /api/self-awareness/sync
 * Forcer une synchronisation
 */
router.post('/sync', async (req, res) => {
    try {
        logger.info('Forcing system synchronization...');
        
        const result = await selfAwarenessAgent.forceSynchronization();
        
        res.json({
            success: true,
            result,
            message: 'Synchronization completed'
        });
        
    } catch (error) {
        logger.error('Failed to sync:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to perform synchronization'
        });
    }
});

/**
 * GET /api/self-awareness/capabilities
 * Obtenir les capacités du système
 */
router.get('/capabilities', async (req, res) => {
    try {
        const state = selfAwarenessAgent.getSystemState();
        
        res.json({
            success: true,
            capabilities: state.capabilities,
            summary: {
                hooks: state.capabilities.hooks.length,
                apis: state.capabilities.apis.length,
                commands: state.capabilities.commands.length,
                databases: state.capabilities.databases.length
            }
        });
        
    } catch (error) {
        logger.error('Failed to get capabilities:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to retrieve capabilities'
        });
    }
});

/**
 * POST /api/self-awareness/scan
 * Déclencher un scan manuel du système
 */
router.post('/scan', async (req, res) => {
    try {
        logger.info('Triggering manual system scan...');
        
        await selfAwarenessAgent.performFullSystemScan();
        const state = selfAwarenessAgent.getSystemState();
        
        res.json({
            success: true,
            state,
            message: 'System scan completed'
        });
        
    } catch (error) {
        logger.error('Failed to scan:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to perform system scan'
        });
    }
});

/**
 * GET /api/self-awareness/documentation
 * Obtenir la documentation système générée
 */
router.get('/documentation', async (req, res) => {
    try {
        const documentation = selfAwarenessAgent.generateSystemDocumentation();
        
        res.json({
            success: true,
            documentation,
            format: 'markdown'
        });
        
    } catch (error) {
        logger.error('Failed to get documentation:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to generate documentation'
        });
    }
});

/**
 * POST /api/self-awareness/ingest
 * Ingérer un nouveau fichier dans le système
 */
router.post('/ingest', async (req, res) => {
    try {
        const { filePath } = req.body;
        
        if (!filePath) {
            return res.status(400).json({
                success: false,
                error: 'filePath is required'
            });
        }
        
        logger.info(`Ingesting file: ${filePath}`);
        
        const result = await selfAwarenessAgent.indexFileInDatabase(filePath);
        
        res.json({
            success: result,
            message: result ? 'File ingested successfully' : 'Failed to ingest file'
        });
        
    } catch (error) {
        logger.error('Failed to ingest file:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to ingest file'
        });
    }
});

/**
 * GET /api/self-awareness/health
 * Vérification de santé simple
 */
router.get('/health', (req, res) => {
    const state = selfAwarenessAgent.getSystemState();
    
    res.json({
        success: true,
        initialized: state.initialized,
        dbSync: state.dbSync.status,
        files: state.files,
        tools: state.tools
    });
});

/**
 * GET /api/self-awareness/os-environment
 * Obtenir l'environnement OS détaillé pour Claude Code
 */
router.get('/os-environment', (req, res) => {
    const state = selfAwarenessAgent.getSystemState();
    
    if (!state.osEnvironment) {
        return res.status(503).json({
            success: false,
            message: 'OS environment not yet detected'
        });
    }
    
    res.json({
        success: true,
        osEnvironment: state.osEnvironment,
        claudeCodeNotes: {
            isRoot: state.osEnvironment.permissions.isRoot,
            canSudo: state.osEnvironment.permissions.canSudo,
            adminAccess: state.osEnvironment.permissions.isRoot || state.osEnvironment.permissions.canSudo,
            adminMethod: state.osEnvironment.permissions.isRoot ? 'already_root' : 
                        state.osEnvironment.permissions.canSudo ? 'sudo' :
                        state.osEnvironment.permissions.canSu ? 'su_with_password' : 'no_admin_access',
            packageManager: state.osEnvironment.capabilities.packageManagers?.[0]?.name || 'none',
            developmentTools: state.osEnvironment.capabilities.development?.map(t => ({ name: t.name, version: t.version })) || [],
            userWarnings: state.osEnvironment.permissions.adminNote ? [state.osEnvironment.permissions.adminNote] : []
        }
    });
});

module.exports = router;