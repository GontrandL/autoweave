const { Logger } = require('../utils/logger');
const { RetryHelper } = require('../utils/retry');

/**
 * UIAgent - Generates dynamic AG-UI events for enhanced user interaction
 * This component translates system states and user actions into structured AG-UI events
 */
class UIAgent {
    constructor(config, autoweaveInstance) {
        this.config = config;
        this.autoweaveInstance = autoweaveInstance;
        this.logger = new Logger('UIAgent');
        
        // Event templates for different UI patterns
        this.eventTemplates = new Map();
        this.initializeEventTemplates();
        
        // Active sessions tracking
        this.activeSessions = new Map();
        
        // UI state management
        this.uiStates = new Map();
    }

    async initialize() {
        this.logger.info('Initializing UI Agent for AG-UI event generation...');
        
        // Load additional templates if needed
        await this.loadCustomTemplates();
        
        this.logger.success('UI Agent initialized successfully');
    }

    initializeEventTemplates() {
        // Chat event templates
        this.eventTemplates.set('chat-welcome', {
            type: 'chat',
            template: {
                text: 'Welcome to {{agent_name}}! I\'m ready to help you with {{capabilities}}.',
                sender: '{{agent_name}}',
                timestamp: '{{timestamp}}',
                metadata: {
                    event_type: 'welcome',
                    session_id: '{{session_id}}'
                }
            }
        });

        this.eventTemplates.set('chat-response', {
            type: 'chat',
            template: {
                text: '{{message}}',
                sender: '{{agent_name}}',
                timestamp: '{{timestamp}}',
                metadata: {
                    event_type: 'response',
                    session_id: '{{session_id}}',
                    tokens: '{{tokens}}'
                }
            }
        });

        this.eventTemplates.set('chat-error', {
            type: 'chat',
            template: {
                text: '❌ {{error_message}}',
                sender: '{{agent_name}}',
                timestamp: '{{timestamp}}',
                error: true,
                metadata: {
                    event_type: 'error',
                    session_id: '{{session_id}}'
                }
            }
        });

        // Display event templates
        this.eventTemplates.set('display-agent-list', {
            type: 'display',
            template: {
                type: 'table',
                title: 'Active Agents',
                columns: ['id', 'name', 'status', 'created_at'],
                data: '{{agents_data}}',
                timestamp: '{{timestamp}}',
                metadata: {
                    event_type: 'agent_list',
                    total_agents: '{{total_agents}}'
                }
            }
        });

        this.eventTemplates.set('display-metrics', {
            type: 'display',
            template: {
                type: 'metrics',
                title: 'System Metrics',
                data: '{{metrics_data}}',
                timestamp: '{{timestamp}}',
                metadata: {
                    event_type: 'metrics',
                    refresh_rate: '{{refresh_rate}}'
                }
            }
        });

        this.eventTemplates.set('display-form', {
            type: 'display',
            template: {
                type: 'form',
                title: '{{form_title}}',
                description: '{{form_description}}',
                schema: '{{form_schema}}',
                action: '{{form_action}}',
                timestamp: '{{timestamp}}',
                metadata: {
                    event_type: 'form',
                    form_id: '{{form_id}}'
                }
            }
        });

        this.eventTemplates.set('display-success', {
            type: 'display',
            template: {
                type: 'success',
                title: '✅ {{success_title}}',
                message: '{{success_message}}',
                data: '{{success_data}}',
                timestamp: '{{timestamp}}',
                metadata: {
                    event_type: 'success',
                    operation: '{{operation}}'
                }
            }
        });

        this.eventTemplates.set('display-error', {
            type: 'display',
            template: {
                type: 'error',
                title: '❌ {{error_title}}',
                message: '{{error_message}}',
                details: '{{error_details}}',
                timestamp: '{{timestamp}}',
                metadata: {
                    event_type: 'error',
                    error_code: '{{error_code}}'
                }
            }
        });

        // Input event templates
        this.eventTemplates.set('input-text', {
            type: 'input',
            template: {
                input_type: 'text',
                label: '{{label}}',
                placeholder: '{{placeholder}}',
                required: '{{required}}',
                validation: '{{validation}}',
                timestamp: '{{timestamp}}',
                metadata: {
                    event_type: 'input_request',
                    input_id: '{{input_id}}'
                }
            }
        });

        this.eventTemplates.set('input-choice', {
            type: 'input',
            template: {
                input_type: 'choice',
                label: '{{label}}',
                options: '{{options}}',
                multiple: '{{multiple}}',
                timestamp: '{{timestamp}}',
                metadata: {
                    event_type: 'input_request',
                    input_id: '{{input_id}}'
                }
            }
        });

        // Status event templates
        this.eventTemplates.set('status-update', {
            type: 'status',
            template: {
                status: '{{status}}',
                message: '{{message}}',
                progress: '{{progress}}',
                timestamp: '{{timestamp}}',
                metadata: {
                    event_type: 'status_update',
                    operation_id: '{{operation_id}}'
                }
            }
        });

        this.logger.debug(`Initialized ${this.eventTemplates.size} event templates`);
    }

    async loadCustomTemplates() {
        // Future: Load custom templates from configuration or database
        this.logger.debug('Custom templates loading skipped (not implemented)');
    }

    // ========== EVENT GENERATION METHODS ==========

    generateChatEvent(templateId, variables, clientId = null) {
        return this.generateEvent(templateId, variables, clientId);
    }

    generateDisplayEvent(templateId, variables, clientId = null) {
        return this.generateEvent(templateId, variables, clientId);
    }

    generateInputEvent(templateId, variables, clientId = null) {
        return this.generateEvent(templateId, variables, clientId);
    }

    generateStatusEvent(templateId, variables, clientId = null) {
        return this.generateEvent(templateId, variables, clientId);
    }

    generateEvent(templateId, variables, clientId = null) {
        const template = this.eventTemplates.get(templateId);
        if (!template) {
            throw new Error(`Template '${templateId}' not found`);
        }

        // Add default variables
        const defaultVariables = {
            timestamp: new Date().toISOString(),
            agent_name: 'AutoWeave',
            session_id: this.getSessionId(clientId)
        };

        const mergedVariables = { ...defaultVariables, ...variables };

        // Process template with variables
        const event = this.processTemplate(template, mergedVariables);

        // Add AG-UI metadata
        event.agui_metadata = {
            generated_by: 'ui-agent',
            template_id: templateId,
            generated_at: new Date().toISOString(),
            client_id: clientId
        };

        return event;
    }

    processTemplate(template, variables) {
        // Deep clone template to avoid mutation
        const processedTemplate = JSON.parse(JSON.stringify(template));

        // Replace variables in template
        this.replaceVariables(processedTemplate, variables);

        return processedTemplate;
    }

    replaceVariables(obj, variables) {
        for (const key in obj) {
            if (Object.prototype.hasOwnProperty.call(obj, key)) {
                if (typeof obj[key] === 'string') {
                    obj[key] = this.replaceStringVariables(obj[key], variables);
                } else if (typeof obj[key] === 'object' && obj[key] !== null) {
                    this.replaceVariables(obj[key], variables);
                }
            }
        }
    }

    replaceStringVariables(str, variables) {
        return str.replace(/\{\{(\w+)\}\}/g, (match, variableName) => {
            return variables[variableName] !== undefined ? variables[variableName] : match;
        });
    }

    // ========== SPECIALIZED EVENT GENERATORS ==========

    async generateAgentCreationFlow(clientId, agentDescription) {
        const sessionId = this.getSessionId(clientId);
        const events = [];

        // Step 1: Show processing message
        events.push(this.generateChatEvent('chat-response', {
            message: `🤖 Creating agent: "${agentDescription}"`,
            session_id: sessionId
        }, clientId));

        // Step 2: Show form for additional details
        events.push(this.generateDisplayEvent('display-form', {
            form_title: 'Agent Configuration',
            form_description: 'Provide additional details for your agent',
            form_schema: {
                type: 'object',
                properties: {
                    name: {
                        type: 'string',
                        title: 'Agent Name',
                        description: 'Give your agent a name'
                    },
                    priority: {
                        type: 'string',
                        title: 'Priority Level',
                        enum: ['low', 'medium', 'high'],
                        default: 'medium'
                    },
                    environment: {
                        type: 'string',
                        title: 'Environment',
                        enum: ['development', 'staging', 'production'],
                        default: 'development'
                    }
                },
                required: ['name']
            },
            form_action: 'create-agent-confirm',
            form_id: `agent-form-${Date.now()}`
        }, clientId));

        // Send events
        for (const event of events) {
            await this.sendEvent(event, clientId);
        }

        return events;
    }

    async generateSystemHealthDisplay(clientId) {
        try {
            const health = await this.autoweaveInstance.getSystemHealth();
            const metrics = await this.autoweaveInstance.getMetrics();

            const event = this.generateDisplayEvent('display-metrics', {
                metrics_data: {
                    system_health: health,
                    metrics: metrics
                },
                refresh_rate: '30s'
            }, clientId);

            await this.sendEvent(event, clientId);
            return event;

        } catch (error) {
            const errorEvent = this.generateDisplayEvent('display-error', {
                error_title: 'Health Check Failed',
                error_message: 'Unable to retrieve system health',
                error_details: error.message,
                error_code: 'HEALTH_CHECK_ERROR'
            }, clientId);

            await this.sendEvent(errorEvent, clientId);
            return errorEvent;
        }
    }

    async generateAgentListDisplay(clientId) {
        try {
            const agents = await this.autoweaveInstance.listAgents();
            
            const event = this.generateDisplayEvent('display-agent-list', {
                agents_data: agents.agents || [],
                total_agents: agents.agents ? agents.agents.length : 0
            }, clientId);

            await this.sendEvent(event, clientId);
            return event;

        } catch (error) {
            const errorEvent = this.generateDisplayEvent('display-error', {
                error_title: 'Agent List Failed',
                error_message: 'Unable to retrieve agent list',
                error_details: error.message,
                error_code: 'AGENT_LIST_ERROR'
            }, clientId);

            await this.sendEvent(errorEvent, clientId);
            return errorEvent;
        }
    }

    async generateOperationStatus(clientId, operationId, status, message, progress = null) {
        const event = this.generateStatusEvent('status-update', {
            status: status,
            message: message,
            progress: progress || 0,
            operation_id: operationId
        }, clientId);

        await this.sendEvent(event, clientId);
        return event;
    }

    async generateWelcomeSequence(clientId) {
        const sessionId = this.getSessionId(clientId);
        const events = [];

        // Welcome message
        events.push(this.generateChatEvent('chat-welcome', {
            capabilities: 'agent creation, system monitoring, and workflow orchestration',
            session_id: sessionId
        }, clientId));

        // Quick actions display
        events.push(this.generateDisplayEvent('display-form', {
            form_title: 'Quick Actions',
            form_description: 'What would you like to do?',
            form_schema: {
                type: 'object',
                properties: {
                    action: {
                        type: 'string',
                        title: 'Choose an action',
                        enum: ['create-agent', 'list-agents', 'system-health', 'chat'],
                        enumNames: ['Create Agent', 'List Agents', 'System Health', 'Chat with AutoWeave']
                    }
                },
                required: ['action']
            },
            form_action: 'quick-action',
            form_id: `welcome-actions-${Date.now()}`
        }, clientId));

        // Send events
        for (const event of events) {
            await this.sendEvent(event, clientId);
        }

        return events;
    }

    // ========== UTILITY METHODS ==========

    getSessionId(clientId) {
        if (!clientId) {
            return `session-${Date.now()}`;
        }

        if (!this.activeSessions.has(clientId)) {
            this.activeSessions.set(clientId, {
                session_id: `session-${clientId}-${Date.now()}`,
                created_at: new Date().toISOString(),
                last_activity: new Date().toISOString()
            });
        }

        // Update last activity
        this.activeSessions.get(clientId).last_activity = new Date().toISOString();

        return this.activeSessions.get(clientId).session_id;
    }

    async sendEvent(event, clientId) {
        if (this.autoweaveInstance && this.autoweaveInstance.sendAGUIEvent) {
            await this.autoweaveInstance.sendAGUIEvent(event, clientId);
            this.logger.debug(`Event sent to ${clientId}: ${event.type}`);
        } else {
            this.logger.warn('AutoWeave instance not available for sending events');
        }
    }

    updateUIState(clientId, stateKey, stateValue) {
        if (!this.uiStates.has(clientId)) {
            this.uiStates.set(clientId, new Map());
        }

        this.uiStates.get(clientId).set(stateKey, stateValue);
        this.logger.debug(`UI state updated for ${clientId}: ${stateKey} = ${stateValue}`);
    }

    getUIState(clientId, stateKey) {
        return this.uiStates.get(clientId)?.get(stateKey);
    }

    // ========== TEMPLATE MANAGEMENT ==========

    addCustomTemplate(templateId, template) {
        this.eventTemplates.set(templateId, template);
        this.logger.debug(`Custom template added: ${templateId}`);
    }

    removeTemplate(templateId) {
        const removed = this.eventTemplates.delete(templateId);
        if (removed) {
            this.logger.debug(`Template removed: ${templateId}`);
        }
        return removed;
    }

    listTemplates() {
        return Array.from(this.eventTemplates.keys());
    }

    getTemplate(templateId) {
        return this.eventTemplates.get(templateId);
    }

    // ========== ANALYTICS ==========

    getEventGenerationStats() {
        return {
            templates_available: this.eventTemplates.size,
            active_sessions: this.activeSessions.size,
            ui_states: this.uiStates.size,
            event_types: {
                chat: Array.from(this.eventTemplates.keys()).filter(k => k.startsWith('chat-')).length,
                display: Array.from(this.eventTemplates.keys()).filter(k => k.startsWith('display-')).length,
                input: Array.from(this.eventTemplates.keys()).filter(k => k.startsWith('input-')).length,
                status: Array.from(this.eventTemplates.keys()).filter(k => k.startsWith('status-')).length
            }
        };
    }

    async shutdown() {
        this.logger.info('Shutting down UI Agent...');
        
        // Clear active sessions
        this.activeSessions.clear();
        
        // Clear UI states
        this.uiStates.clear();
        
        this.logger.success('UI Agent shutdown complete');
    }
}

module.exports = { UIAgent };