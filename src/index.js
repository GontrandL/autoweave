#!/usr/bin/env node

const { AutoWeave } = require('./core/autoweave');
const { KagentBridge } = require('./kagent/bridge');
const { Logger } = require('./utils/logger');
const config = require('../config/autoweave/config');
const WebSocket = require('ws');

function setupAGUIWebSocketServer(server, autoweave, logger) {
    logger.info('Setting up AG-UI WebSocket server...');
    
    const wss = new WebSocket.Server({ 
        server: server,
        path: '/ws'
    });

    wss.on('connection', (ws, req) => {
        const clientId = req.headers['x-forwarded-for'] || req.connection.remoteAddress || `client-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        
        // Add client to AutoWeave
        autoweave.addAGUIClient(clientId, ws);
        
        logger.info(`AG-UI client connected: ${clientId}`);

        ws.on('message', (message) => {
            try {
                const event = JSON.parse(message.toString());
                logger.debug(`AG-UI input from ${clientId}:`, event);
                
                // Handle the message through AutoWeave
                autoweave.handleAGUIInput(clientId, event);
                
            } catch (error) {
                logger.error(`Failed to parse AG-UI message from ${clientId}:`, error);
                
                // Send error response
                const errorResponse = {
                    type: 'error',
                    content: {
                        message: 'Invalid JSON format',
                        timestamp: new Date().toISOString()
                    }
                };
                
                if (ws.readyState === WebSocket.OPEN) {
                    ws.send(JSON.stringify(errorResponse));
                }
            }
        });

        ws.on('close', () => {
            autoweave.removeAGUIClient(clientId);
            logger.info(`AG-UI client disconnected: ${clientId}`);
        });

        ws.on('error', (error) => {
            logger.error(`AG-UI WebSocket error for ${clientId}:`, error);
            autoweave.removeAGUIClient(clientId);
        });

        // Send welcome message
        const welcomeMessage = {
            type: 'chat',
            content: {
                text: 'Welcome to AutoWeave AG-UI! Ready to weave agents together.',
                timestamp: new Date().toISOString(),
                sender: 'autoweave'
            }
        };
        
        if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify(welcomeMessage));
        }
    });

    logger.success('AG-UI WebSocket server configured');
}

async function main() {
    const logger = new Logger('AutoWeave');

    try {
        logger.info('🚀 Starting AutoWeave + kagent - Self-Weaving Agent Orchestrator');

        // Initialize kagent bridge first with graceful fallback
        const kagentBridge = new KagentBridge(config.kagent);
        
        try {
            await kagentBridge.initialize();
        } catch (error) {
            logger.warn('⚠️  Kagent not available, running in development mode:', error.message);
            // Create a mock kagent bridge for development
            kagentBridge.isInitialized = false;
            kagentBridge.developmentMode = true;
            kagentBridge.deployAgent = async (workflow) => ({
                id: workflow.id,
                status: 'mock-deployed',
                createdAt: new Date().toISOString()
            });
            kagentBridge.getAgentStatus = async (id) => ({
                id,
                status: 'mock-running',
                lastUpdate: new Date().toISOString()
            });
            kagentBridge.deleteAgent = async (id) => ({ deleted: true });
        }

        // Initialize AutoWeave with kagent integration
        const autoweave = new AutoWeave(config, kagentBridge);
        await autoweave.initialize();

        // Setup AG-UI WebSocket server
        const server = autoweave.getHttpServer();
        if (server) {
            setupAGUIWebSocketServer(server, autoweave, logger);
        }

        logger.success('✅ AutoWeave + kagent initialized successfully');
        logger.info(`🌐 Web UI: http://localhost:${config.port}`);
        logger.info(`☸️  kagent UI: http://localhost:8080 (port-forward)`);
        logger.info(`🔗 ANP Server: http://localhost:${config.mcp.anpPort}`);
        logger.info(`🌊 AG-UI WebSocket: ws://localhost:${config.port}/ws`);

        // Graceful shutdown
        process.on('SIGINT', async () => {
            logger.info('Received SIGINT, shutting down gracefully...');
            await autoweave.shutdown();
            await kagentBridge.shutdown();
            process.exit(0);
        });

        process.on('SIGTERM', async () => {
            logger.info('Received SIGTERM, shutting down gracefully...');
            await autoweave.shutdown();
            await kagentBridge.shutdown();
            process.exit(0);
        });

    } catch (error) {
        logger.error('❌ Failed to start AutoWeave:', error);
        process.exit(1);
    }
}

if (require.main === module) {
    main();
}

module.exports = { main };