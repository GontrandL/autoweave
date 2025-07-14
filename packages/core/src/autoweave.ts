import { AgentWeaver } from './agent-weaver';
import { ConfigurationIntelligence } from './config-intelligence';
import { Request, Response, NextFunction } from 'express';
import WebSocket from 'ws';
import { AutoWeaveConfig, KagentBridge, HealthStatus, DetailedHealth, ReadinessStatus, Metrics, AGUIEvent, AGUIInputEvent, MemoryManager, AgentInterface, ServiceInterface } from './types';

import { Logger } from './logger';

/**
 * AutoWeave - Version refactorisée avec architecture de services
 * Séparation claire des responsabilités et utilisation des services
 */
export class AutoWeave {
    private config: AutoWeaveConfig;
    private kagentBridge?: KagentBridge;
    private logger: any;
    private agentWeaver: AgentWeaver;
    private memoryManager?: MemoryManager;
    private agentService?: ServiceInterface;
    // private server?: any;
    private isInitialized: boolean = false;
    // private mcpServer?: any;
    private configIntelligence?: ConfigurationIntelligence;
    private debuggingAgent?: AgentInterface;
    private aguiClients: Map<string, WebSocket>;
    // private uiAgent?: any;

    constructor(config: AutoWeaveConfig, kagentBridge?: KagentBridge) {
        this.config = config;
        this.kagentBridge = kagentBridge;
        this.logger = config.logger || new Logger('AutoWeave');

        // Core Components
        this.agentWeaver = config.agentWeaver || new AgentWeaver({
            openaiApiKey: process.env.OPENAI_API_KEY || '',
            logger: this.logger
        });
        
        this.memoryManager = config.memoryManager;

        // AG-UI WebSocket clients
        this.aguiClients = new Map();
    }

    async initialize(): Promise<void> {
        try {
            this.logger.info('Initializing AutoWeave services...');
            
            // Initialize memory manager
            if (this.memoryManager) {
                await this.memoryManager.health();
            }
            
            // Initialize configuration intelligence after core components
            this.configIntelligence = this.config.configIntelligence || new ConfigurationIntelligence({
                logger: this.logger,
                openaiApiKey: process.env.OPENAI_API_KEY
            });
            
            // Initialize debugging agent (injected via config)
            this.debuggingAgent = this.config.debuggingAgent;
            
            // Initialize MCP server
            if (this.config.port) {
                // this.mcpServer = MCPServer.create({
                //     port: this.config.port + 100,
                //     autoweave: this
                // });
            }
            
            // Initialize agent service (injected via config)
            this.agentService = this.config.agentService;
            
            this.isInitialized = true;
            this.logger.info('AutoWeave services initialized successfully');
        } catch (error) {
            this.logger.error('Failed to initialize AutoWeave services:', error);
            throw error;
        }
    }

    async createAgent(description: string, options: any = {}): Promise<any> {
        if (!this.isInitialized) {
            throw new Error('AutoWeave not initialized. Call initialize() first.');
        }

        try {
            this.logger.info('Creating agent from description:', description);
            
            // Generate workflow
            const workflow = await this.agentWeaver.generateWorkflow(description, options);
            
            // Create agent record
            const agent = await this.agentService!.createAgent({
                description,
                workflow,
                status: 'created'
            });
            
            // Deploy to Kubernetes if kagentBridge available
            if (this.kagentBridge) {
                const manifest = await this.kagentBridge.generatePipelineManifest(
                    agent.id,
                    { workflow, description }
                );
                await this.kagentBridge.deployPipeline(manifest);
                
                // Update agent status
                await this.agentService!.updateAgent(agent.id, { status: 'deployed' });
            }
            
            return agent;
        } catch (error) {
            this.logger.error('Failed to create agent:', error);
            throw error;
        }
    }

    async processMessage(message: string, context?: any): Promise<any> {
        return this.agentWeaver.processMessage(message, {
            context
        });
    }

    async getHealth(): Promise<HealthStatus> {
        const health: HealthStatus = {
            autoweave: true,
            kagent: false,
            memory: false,
            dependencies: {}
        };

        // Check kagent
        if (this.kagentBridge) {
            try {
                await this.kagentBridge.getPipelineStatus('health-check');
                health.kagent = true;
            } catch {
                health.kagent = false;
            }
        }

        // Check memory
        if (this.memoryManager) {
            try {
                const memoryHealth = await this.memoryManager.health();
                health.memory = memoryHealth.healthy;
            } catch {
                health.memory = false;
            }
        }

        return health;
    }

    async getDetailedHealth(): Promise<DetailedHealth> {
        // const startTime = Date.now();
        const health: DetailedHealth = {
            status: 'healthy',
            timestamp: new Date().toISOString(),
            components: {
                autoweave: {
                    status: 'healthy',
                    message: 'Core service operational',
                    latency: 0
                },
                kagent: {
                    status: 'unhealthy',
                    message: 'Not connected'
                },
                memory: {
                    status: 'unhealthy',
                    message: 'Not connected'
                }
            },
            dependencies: {}
        };

        // Check kagent
        if (this.kagentBridge) {
            const kagentStart = Date.now();
            try {
                await this.kagentBridge.getPipelineStatus('health-check');
                health.components.kagent = {
                    status: 'healthy',
                    message: 'Connected to Kubernetes',
                    latency: Date.now() - kagentStart
                };
            } catch (error: any) {
                health.components.kagent = {
                    status: 'unhealthy',
                    message: error.message || 'Connection failed',
                    latency: Date.now() - kagentStart
                };
            }
        }

        // Check memory
        const memoryStart = Date.now();
        if (this.memoryManager) {
            try {
                const memoryHealth = await this.memoryManager.health();
                health.components.memory = {
                    status: memoryHealth.healthy ? 'healthy' : 'unhealthy',
                    message: memoryHealth.healthy ? 'All memory systems operational' : 'Memory system degraded',
                    latency: Date.now() - memoryStart,
                    details: memoryHealth.details
                };
            } catch (error: any) {
                health.components.memory = {
                    status: 'unhealthy',
                    message: error.message || 'Connection failed',
                    latency: Date.now() - memoryStart
                };
            }
        } else {
            health.components.memory = {
                status: 'unhealthy',
                message: 'Memory manager not configured',
                latency: Date.now() - memoryStart
            };
        }

        // Determine overall status
        const componentStatuses = Object.values(health.components).map(c => c.status);
        if (componentStatuses.every(s => s === 'healthy')) {
            health.status = 'healthy';
        } else if (componentStatuses.some(s => s === 'healthy')) {
            health.status = 'degraded';
        } else {
            health.status = 'unhealthy';
        }

        return health;
    }

    async getReadiness(): Promise<ReadinessStatus> {
        const readiness: ReadinessStatus = {
            ready: false,
            services: {
                kagent: false,
                memory: false
            }
        };

        // Check all services
        if (this.kagentBridge) {
            try {
                await this.kagentBridge.getPipelineStatus('readiness-check');
                readiness.services.kagent = true;
            } catch {
                readiness.services.kagent = false;
            }
        }

        if (this.memoryManager) {
            try {
                const memoryHealth = await this.memoryManager.health();
                readiness.services.memory = memoryHealth.healthy;
            } catch {
                readiness.services.memory = false;
            }
        } else {
            readiness.services.memory = false;
        }

        // Ready if all critical services are up
        readiness.ready = readiness.services.memory && (readiness.services.kagent || !this.kagentBridge);

        return readiness;
    }

    async getMetrics(): Promise<Metrics> {
        const memoryUsage = process.memoryUsage();
        
        return {
            timestamp: new Date().toISOString(),
            uptime: process.uptime(),
            memory: {
                used: memoryUsage.heapUsed,
                total: memoryUsage.heapTotal,
                percentage: (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100
            },
            cpu: {
                usage: process.cpuUsage().user / 1000000 // Convert to seconds
            },
            requests: {
                total: 0, // TODO: Implement request tracking
                active: 0,
                errors: 0
            },
            agents: {
                total: await this.agentService?.listAgents().then(agents => agents.length) || 0,
                active: 0, // TODO: Implement active agent tracking
                deployed: 0 // TODO: Implement deployed agent tracking
            }
        };
    }

    // AG-UI WebSocket handling
    handleAGUIConnection(ws: WebSocket, clientId: string): void {
        this.logger.info(`AG-UI client connected: ${clientId}`);
        this.aguiClients.set(clientId, ws);
        
        // Send initial state
        this.broadcastAGUIEvent({
            timestamp: new Date().toISOString(),
            type: 'status',
            data: {
                message: 'Connected to AutoWeave',
                clientId
            }
        });
        
        ws.on('message', async (data: WebSocket.Data) => {
            try {
                const event = JSON.parse(data.toString()) as AGUIInputEvent;
                await this.handleAGUIInput(event, clientId);
            } catch (error) {
                this.logger.error('Failed to handle AG-UI input:', error);
                ws.send(JSON.stringify({
                    type: 'error',
                    data: { message: 'Failed to process input' }
                }));
            }
        });
        
        ws.on('close', () => {
            this.logger.info(`AG-UI client disconnected: ${clientId}`);
            this.aguiClients.delete(clientId);
        });
    }

    private async handleAGUIInput(event: AGUIInputEvent, clientId: string): Promise<void> {
        switch (event.type) {
            case 'input':
            case 'query':
                const response = await this.processMessage(event.content, event.metadata);
                this.broadcastAGUIEvent({
                    timestamp: new Date().toISOString(),
                    type: 'chat',
                    data: {
                        role: 'assistant',
                        content: response.response,
                        metadata: response.metadata
                    }
                });
                break;
                
            case 'command':
                // Handle special commands
                await this.handleAGUICommand(event.content, clientId);
                break;
        }
    }

    private async handleAGUICommand(command: string, clientId: string): Promise<void> {
        // Implement command handling
        this.logger.info(`Handling AG-UI command: ${command} from ${clientId}`);
    }

    private broadcastAGUIEvent(event: AGUIEvent): void {
        const message = JSON.stringify(event);
        this.aguiClients.forEach((ws) => {
            if (ws.readyState === WebSocket.OPEN) {
                ws.send(message);
            }
        });
    }

    // Express middleware
    middleware() {
        return async (req: Request, _res: Response, next: NextFunction) => {
            req.autoweave = this;
            next();
        };
    }

    // Getters
    getAgentWeaver(): AgentWeaver {
        return this.agentWeaver;
    }

    getMemoryManager(): MemoryManager | undefined {
        return this.memoryManager;
    }

    getConfigIntelligence(): ConfigurationIntelligence | undefined {
        return this.configIntelligence;
    }

    getDebuggingAgent(): AgentInterface | undefined {
        return this.debuggingAgent;
    }

    getLogger(): any {
        return this.logger;
    }
}

// Extend Express Request type
declare global {
    namespace Express {
        interface Request {
            autoweave?: AutoWeave;
        }
    }
}