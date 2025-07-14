const { Logger } = require('@autoweave/shared');
const { Validator } = require('@autoweave/shared');
const { RetryHelper } = require('@autoweave/shared');

/**
 * AgentService - Service de gestion centralisée des agents AutoWeave
 * Orchestration entre AgentWeaver, KagentBridge et HybridMemoryManager
 */
class AgentService {
    constructor(agentWeaver, kagentBridge, memoryManager) {
        this.agentWeaver = agentWeaver;
        this.kagentBridge = kagentBridge;
        this.memoryManager = memoryManager;
        this.logger = new Logger('AgentService');
        
        // Agent registry
        this.agents = new Map();
        this.isInitialized = false;
    }
    
    async initialize() {
        this.logger.info('Initializing Agent Service...');
        
        try {
            // Ensure dependencies are initialized (with graceful fallbacks)
            if (!this.agentWeaver.mockMode && !this.agentWeaver.openai) {
                await this.agentWeaver.initialize();
            }
            
            // Try to initialize kagent, but don't fail if it's not available
            if (!this.kagentBridge.isInitialized) {
                try {
                    await this.kagentBridge.initialize();
                } catch (error) {
                    this.logger.warn('kagent not available, running in development mode:', error.message);
                    this.kagentBridge.developmentMode = true;
                }
            }
            
            if (!this.memoryManager.isInitialized) {
                await this.memoryManager.initialize();
            }
            
            this.isInitialized = true;
            this.logger.success('Agent Service initialized successfully');
            
        } catch (error) {
            this.logger.error('Failed to initialize Agent Service:', error);
            throw error;
        }
    }
    
    /**
     * Create and deploy a new agent
     */
    async createAndDeployAgent(description, userId = 'system') {
        this.logger.info(`Creating agent: "${description}"`);
        
        try {
            // Validate input
            Validator.validateAgentDescription(description);
            
            // 1. Generate workflow with Agent Weaver
            const workflow = await this.agentWeaver.generateWorkflow(description);
            
            // 2. Enhance workflow with kagent tools
            const enhancedWorkflow = await this.enhanceWithKagentTools(workflow);
            
            // 3. Create agent record
            const agent = {
                id: workflow.id,
                name: workflow.name,
                description: workflow.description,
                status: 'creating',
                workflow: enhancedWorkflow,
                userId,
                createdAt: new Date(),
                lastUpdated: new Date()
            };
            
            this.agents.set(workflow.id, agent);
            
            // 4. Add to memory system
            await this.memoryManager.createAgentWithMemory(agent, userId);
            
            // 5. Deploy to kagent
            const deployment = await this.kagentBridge.deployAgent(enhancedWorkflow);
            
            // 6. Update agent record
            agent.status = 'deployed';
            agent.deployment = deployment;
            agent.lastUpdated = new Date();
            
            // 7. Add deployment memory
            await this.memoryManager.contextualMemory.addAgentMemory(
                workflow.id,
                `Agent ${workflow.name} deployed successfully`,
                {
                    action: 'deployment',
                    status: 'deployed',
                    timestamp: new Date().toISOString()
                }
            );
            
            this.logger.success(`Agent ${workflow.name} created and deployed`);
            
            return {
                workflow: enhancedWorkflow,
                deployment,
                status: 'deployed'
            };
            
        } catch (error) {
            this.logger.error('Failed to create and deploy agent:', error);
            
            // Cleanup on failure
            if (this.agents.has(workflow?.id)) {
                const agent = this.agents.get(workflow.id);
                agent.status = 'failed';
                agent.error = error.message;
                agent.lastUpdated = new Date();
            }
            
            throw error;
        }
    }
    
    /**
     * List all agents
     */
    async listAgents() {
        const agents = [];
        
        for (const [id, agent] of this.agents) {
            try {
                // Get real-time status from kagent
                const kagentStatus = await this.kagentBridge.getAgentStatus(id);
                
                agents.push({
                    ...agent,
                    status: kagentStatus?.status || agent.status,
                    kagentDetails: kagentStatus
                });
                
            } catch (error) {
                this.logger.warn(`Failed to get status for agent ${id}:`, error.message);
                agents.push(agent);
            }
        }
        
        return agents.sort((a, b) => b.createdAt - a.createdAt);
    }
    
    /**
     * Get agent status and details
     */
    async getAgentStatus(agentId) {
        const agent = this.agents.get(agentId);
        if (!agent) {
            return null;
        }
        
        try {
            // Get real-time status from kagent
            const kagentStatus = await this.kagentBridge.getAgentStatus(agentId);
            
            return {
                ...agent,
                status: kagentStatus?.status || agent.status,
                kagentDetails: kagentStatus,
                lastUpdated: new Date()
            };
            
        } catch (error) {
            this.logger.warn(`Failed to get kagent status for ${agentId}:`, error.message);
            return agent;
        }
    }
    
    /**
     * Update agent configuration
     */
    async updateAgent(agentId, updates) {
        const agent = this.agents.get(agentId);
        if (!agent) {
            return null;
        }
        
        try {
            // Validate updates
            if (updates.description) {
                Validator.validateAgentDescription(updates.description);
            }
            
            // Update agent record
            const updatedAgent = {
                ...agent,
                ...updates,
                lastUpdated: new Date()
            };
            
            this.agents.set(agentId, updatedAgent);
            
            // Add to memory
            await this.memoryManager.contextualMemory.addAgentMemory(
                agentId,
                `Agent ${agent.name} updated`,
                {
                    action: 'update',
                    updates,
                    timestamp: new Date().toISOString()
                }
            );
            
            this.logger.info(`Agent ${agentId} updated`);
            return updatedAgent;
            
        } catch (error) {
            this.logger.error(`Failed to update agent ${agentId}:`, error);
            throw error;
        }
    }
    
    /**
     * Delete an agent
     */
    async deleteAgent(agentId) {
        const agent = this.agents.get(agentId);
        if (!agent) {
            throw new Error('Agent not found');
        }
        
        try {
            // Delete from kagent
            await this.kagentBridge.deleteAgent(agentId);
            
            // Remove from registry
            this.agents.delete(agentId);
            
            // Add to memory
            await this.memoryManager.contextualMemory.addAgentMemory(
                agentId,
                `Agent ${agent.name} deleted`,
                {
                    action: 'deletion',
                    timestamp: new Date().toISOString()
                }
            );
            
            this.logger.info(`Agent ${agentId} deleted`);
            
        } catch (error) {
            this.logger.error(`Failed to delete agent ${agentId}:`, error);
            throw error;
        }
    }
    
    /**
     * Start an agent
     */
    async startAgent(agentId) {
        const agent = this.agents.get(agentId);
        if (!agent) {
            throw new Error('Agent not found');
        }
        
        try {
            // Implementation depends on kagent capabilities
            // For now, return current status
            const status = await this.kagentBridge.getAgentStatus(agentId);
            
            this.logger.info(`Start request for agent ${agentId}`);
            return { status: status?.status || 'unknown' };
            
        } catch (error) {
            this.logger.error(`Failed to start agent ${agentId}:`, error);
            throw error;
        }
    }
    
    /**
     * Stop an agent
     */
    async stopAgent(agentId) {
        const agent = this.agents.get(agentId);
        if (!agent) {
            throw new Error('Agent not found');
        }
        
        try {
            // Implementation depends on kagent capabilities
            // For now, return current status
            const status = await this.kagentBridge.getAgentStatus(agentId);
            
            this.logger.info(`Stop request for agent ${agentId}`);
            return { status: status?.status || 'unknown' };
            
        } catch (error) {
            this.logger.error(`Failed to stop agent ${agentId}:`, error);
            throw error;
        }
    }
    
    /**
     * Get agent logs
     */
    async getAgentLogs(agentId, options = {}) {
        const agent = this.agents.get(agentId);
        if (!agent) {
            throw new Error('Agent not found');
        }
        
        try {
            // Get logs from kagent/Kubernetes
            const kagentStatus = await this.kagentBridge.getAgentStatus(agentId);
            
            if (!kagentStatus || !kagentStatus.pods) {
                return [];
            }
            
            // For now, return mock logs - would need kubernetes client integration
            return [
                {
                    timestamp: new Date().toISOString(),
                    level: 'info',
                    message: `Agent ${agent.name} is running`,
                    pod: kagentStatus.pods[0]?.name || 'unknown'
                }
            ];
            
        } catch (error) {
            this.logger.error(`Failed to get logs for agent ${agentId}:`, error);
            throw error;
        }
    }
    
    /**
     * Get agent metrics
     */
    async getAgentMetrics(agentId) {
        const agent = this.agents.get(agentId);
        if (!agent) {
            throw new Error('Agent not found');
        }
        
        try {
            const status = await this.kagentBridge.getAgentStatus(agentId);
            
            return {
                agentId,
                name: agent.name,
                status: status?.status || 'unknown',
                uptime: status?.pods?.[0]?.uptime || 0,
                restarts: status?.pods?.[0]?.restarts || 0,
                memoryUsage: 'unknown',
                cpuUsage: 'unknown',
                lastUpdated: new Date().toISOString()
            };
            
        } catch (error) {
            this.logger.error(`Failed to get metrics for agent ${agentId}:`, error);
            throw error;
        }
    }
    
    /**
     * Enhance workflow with available kagent tools
     */
    async enhanceWithKagentTools(workflow) {
        this.logger.debug('Enhancing workflow with kagent tools...');
        
        try {
            const availableTools = this.kagentBridge.availableTools || [];
            
            const enhancedModules = workflow.requiredModules.map(module => {
                const matchingTools = availableTools.filter(tool => {
                    const toolName = tool.metadata.name.toLowerCase();
                    const moduleType = module.type.toLowerCase();
                    
                    return toolName.includes(moduleType) ||
                           moduleType.includes(toolName) ||
                           (module.keywords && module.keywords.some(k => toolName.includes(k)));
                });
                
                return {
                    ...module,
                    kagentTools: matchingTools,
                    available: matchingTools.length > 0
                };
            });
            
            return {
                ...workflow,
                requiredModules: enhancedModules,
                kagentCompatible: enhancedModules.every(m => m.available)
            };
            
        } catch (error) {
            this.logger.warn('Failed to enhance with kagent tools:', error.message);
            return workflow;
        }
    }
    
    /**
     * Get service statistics
     */
    getStats() {
        const statuses = Array.from(this.agents.values()).map(a => a.status);
        
        return {
            totalAgents: this.agents.size,
            byStatus: {
                deployed: statuses.filter(s => s === 'deployed').length,
                creating: statuses.filter(s => s === 'creating').length,
                failed: statuses.filter(s => s === 'failed').length,
                unknown: statuses.filter(s => !['deployed', 'creating', 'failed'].includes(s)).length
            },
            isInitialized: this.isInitialized
        };
    }
    
    /**
     * Shutdown service
     */
    async shutdown() {
        this.logger.info('Shutting down Agent Service...');
        this.isInitialized = false;
        this.agents.clear();
        this.logger.info('Agent Service shutdown complete');
    }
}

module.exports = { AgentService };