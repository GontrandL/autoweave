#!/usr/bin/env node

/**
 * AutoWeave-Taskcafe Bridge
 * This bridge connects Taskcafe with AutoWeave API for seamless task management
 */

const express = require('express');
const axios = require('axios');
const cors = require('cors');
const { WebSocket } = require('ws');

// Configuration
const config = {
    taskcafe: {
        apiUrl: process.env.TASKCAFE_API_URL || 'http://localhost:3333',
        apiKey: process.env.TASKCAFE_API_KEY || 'taskcafe-api-key',
    },
    autoweave: {
        apiUrl: process.env.AUTOWEAVE_API_URL || 'http://localhost:3002',
        apiKey: process.env.AUTOWEAVE_API_KEY || 'autoweave-api-key',
        wsUrl: process.env.AUTOWEAVE_WS_URL || 'ws://localhost:3002/ws',
    },
    bridge: {
        port: process.env.BRIDGE_PORT || 3334,
        host: process.env.BRIDGE_HOST || '0.0.0.0',
    }
};

// Initialize Express app
const app = express();
app.use(cors());
app.use(express.json());

// Logging utility
const log = (level, message, data = null) => {
    const timestamp = new Date().toISOString();
    const logEntry = {
        timestamp,
        level,
        message,
        ...(data && { data })
    };
    console.log(JSON.stringify(logEntry));
};

// AutoWeave API client
class AutoWeaveClient {
    constructor() {
        this.apiUrl = config.autoweave.apiUrl;
        this.apiKey = config.autoweave.apiKey;
        this.wsUrl = config.autoweave.wsUrl;
        this.ws = null;
    }

    async makeRequest(method, endpoint, data = null) {
        try {
            const response = await axios({
                method,
                url: `${this.apiUrl}${endpoint}`,
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'Content-Type': 'application/json',
                },
                data,
            });
            return response.data;
        } catch (error) {
            log('error', `AutoWeave API request failed: ${method} ${endpoint}`, {
                error: error.message,
                status: error.response?.status,
                data: error.response?.data,
            });
            throw error;
        }
    }

    async createAgent(description, metadata = {}) {
        return await this.makeRequest('POST', '/api/agents', {
            description,
            metadata: {
                ...metadata,
                source: 'taskcafe',
                created_at: new Date().toISOString(),
            }
        });
    }

    async getAgents() {
        return await this.makeRequest('GET', '/api/agents');
    }

    async getAgent(agentId) {
        return await this.makeRequest('GET', `/api/agents/${agentId}`);
    }

    async deleteAgent(agentId) {
        return await this.makeRequest('DELETE', `/api/agents/${agentId}`);
    }

    async addMemory(content, metadata = {}) {
        return await this.makeRequest('POST', '/api/memory', {
            message: content,
            user_id: 'taskcafe',
            metadata: {
                ...metadata,
                source: 'taskcafe',
                timestamp: new Date().toISOString(),
            }
        });
    }

    async searchMemory(query) {
        return await this.makeRequest('POST', '/api/memory/search', {
            query,
            user_id: 'taskcafe',
        });
    }

    connectWebSocket() {
        try {
            this.ws = new WebSocket(this.wsUrl);
            
            this.ws.on('open', () => {
                log('info', 'WebSocket connected to AutoWeave');
            });

            this.ws.on('message', (data) => {
                try {
                    const message = JSON.parse(data);
                    this.handleWebSocketMessage(message);
                } catch (error) {
                    log('error', 'Failed to parse WebSocket message', { error: error.message });
                }
            });

            this.ws.on('close', () => {
                log('info', 'WebSocket disconnected from AutoWeave');
                // Reconnect after 5 seconds
                setTimeout(() => this.connectWebSocket(), 5000);
            });

            this.ws.on('error', (error) => {
                log('error', 'WebSocket error', { error: error.message });
            });
        } catch (error) {
            log('error', 'Failed to connect WebSocket', { error: error.message });
        }
    }

    handleWebSocketMessage(message) {
        log('debug', 'Received WebSocket message', { message });
        
        // Handle different message types
        switch (message.type) {
            case 'agent_created':
                this.handleAgentCreated(message.data);
                break;
            case 'agent_updated':
                this.handleAgentUpdated(message.data);
                break;
            case 'task_completed':
                this.handleTaskCompleted(message.data);
                break;
            default:
                log('debug', 'Unhandled WebSocket message type', { type: message.type });
        }
    }

    handleAgentCreated(agentData) {
        log('info', 'Agent created in AutoWeave', { agentData });
        // TODO: Update Taskcafe with new agent information
    }

    handleAgentUpdated(agentData) {
        log('info', 'Agent updated in AutoWeave', { agentData });
        // TODO: Update Taskcafe with agent changes
    }

    handleTaskCompleted(taskData) {
        log('info', 'Task completed in AutoWeave', { taskData });
        // TODO: Update Taskcafe task status
    }

    sendWebSocketMessage(message) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(message));
        }
    }
}

// Taskcafe API client
class TaskcafeClient {
    constructor() {
        this.apiUrl = config.taskcafe.apiUrl;
        this.apiKey = config.taskcafe.apiKey;
    }

    async makeRequest(method, endpoint, data = null) {
        try {
            const response = await axios({
                method,
                url: `${this.apiUrl}${endpoint}`,
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'Content-Type': 'application/json',
                },
                data,
            });
            return response.data;
        } catch (error) {
            log('error', `Taskcafe API request failed: ${method} ${endpoint}`, {
                error: error.message,
                status: error.response?.status,
                data: error.response?.data,
            });
            throw error;
        }
    }

    async getProjects() {
        return await this.makeRequest('GET', '/api/projects');
    }

    async getProject(projectId) {
        return await this.makeRequest('GET', `/api/projects/${projectId}`);
    }

    async createProject(name, description) {
        return await this.makeRequest('POST', '/api/projects', {
            name,
            description,
            metadata: {
                source: 'autoweave',
                created_at: new Date().toISOString(),
            }
        });
    }

    async getTasks(projectId) {
        return await this.makeRequest('GET', `/api/projects/${projectId}/tasks`);
    }

    async createTask(projectId, title, description, assigneeId = null) {
        return await this.makeRequest('POST', `/api/projects/${projectId}/tasks`, {
            title,
            description,
            assignee_id: assigneeId,
            metadata: {
                source: 'autoweave',
                created_at: new Date().toISOString(),
            }
        });
    }

    async updateTask(taskId, updates) {
        return await this.makeRequest('PUT', `/api/tasks/${taskId}`, {
            ...updates,
            metadata: {
                updated_at: new Date().toISOString(),
            }
        });
    }
}

// Initialize clients
const autoweaveClient = new AutoWeaveClient();
const taskcafeClient = new TaskcafeClient();

// Bridge service
class TaskcafeBridge {
    constructor() {
        this.autoweave = autoweaveClient;
        this.taskcafe = taskcafeClient;
    }

    async syncProjectToAutoWeave(projectId) {
        try {
            const project = await this.taskcafe.getProject(projectId);
            const tasks = await this.taskcafe.getTasks(projectId);

            // Create an agent for the project
            const agentDescription = `Project management agent for "${project.name}": ${project.description}`;
            const agent = await this.autoweave.createAgent(agentDescription, {
                project_id: projectId,
                project_name: project.name,
                task_count: tasks.length,
            });

            // Add project information to memory
            await this.autoweave.addMemory(`Project: ${project.name}`, {
                type: 'project',
                project_id: projectId,
                agent_id: agent.id,
            });

            // Add tasks to memory
            for (const task of tasks) {
                await this.autoweave.addMemory(`Task: ${task.title} - ${task.description}`, {
                    type: 'task',
                    task_id: task.id,
                    project_id: projectId,
                    agent_id: agent.id,
                });
            }

            log('info', 'Project synced to AutoWeave', { 
                projectId, 
                agentId: agent.id,
                taskCount: tasks.length 
            });

            return { agent, tasks };
        } catch (error) {
            log('error', 'Failed to sync project to AutoWeave', { 
                projectId, 
                error: error.message 
            });
            throw error;
        }
    }

    async createAgentTask(agentId, taskDescription) {
        try {
            // Get agent information
            const agent = await this.autoweave.getAgent(agentId);
            
            if (!agent.metadata.project_id) {
                throw new Error('Agent is not associated with a Taskcafe project');
            }

            // Create task in Taskcafe
            const task = await this.taskcafe.createTask(
                agent.metadata.project_id,
                'AutoWeave Task',
                taskDescription
            );

            // Add task to AutoWeave memory
            await this.autoweave.addMemory(`Task created: ${task.title}`, {
                type: 'task',
                task_id: task.id,
                project_id: agent.metadata.project_id,
                agent_id: agentId,
            });

            log('info', 'Task created from AutoWeave agent', { 
                agentId, 
                taskId: task.id,
                projectId: agent.metadata.project_id 
            });

            return task;
        } catch (error) {
            log('error', 'Failed to create agent task', { 
                agentId, 
                error: error.message 
            });
            throw error;
        }
    }
}

// Initialize bridge
const bridge = new TaskcafeBridge();

// API Routes
app.get('/health', (req, res) => {
    res.json({ 
        status: 'healthy', 
        timestamp: new Date().toISOString(),
        config: {
            taskcafe: config.taskcafe.apiUrl,
            autoweave: config.autoweave.apiUrl,
        }
    });
});

// Sync project to AutoWeave
app.post('/sync/project/:projectId', async (req, res) => {
    try {
        const { projectId } = req.params;
        const result = await bridge.syncProjectToAutoWeave(projectId);
        res.json({
            success: true,
            data: result,
            message: 'Project synced to AutoWeave successfully'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Create task from AutoWeave agent
app.post('/agent/:agentId/task', async (req, res) => {
    try {
        const { agentId } = req.params;
        const { description } = req.body;
        
        const task = await bridge.createAgentTask(agentId, description);
        res.json({
            success: true,
            data: task,
            message: 'Task created from AutoWeave agent successfully'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Get projects with AutoWeave integration status
app.get('/projects', async (req, res) => {
    try {
        const projects = await bridge.taskcafe.getProjects();
        const agents = await bridge.autoweave.getAgents();
        
        // Add AutoWeave integration status to each project
        const projectsWithStatus = projects.map(project => {
            const associatedAgent = agents.find(agent => 
                agent.metadata.project_id === project.id
            );
            
            return {
                ...project,
                autoweave_integration: {
                    enabled: !!associatedAgent,
                    agent_id: associatedAgent?.id || null,
                    last_sync: associatedAgent?.metadata.created_at || null,
                }
            };
        });
        
        res.json({
            success: true,
            data: projectsWithStatus
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Get AutoWeave agents
app.get('/agents', async (req, res) => {
    try {
        const agents = await bridge.autoweave.getAgents();
        res.json({
            success: true,
            data: agents
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Search AutoWeave memory
app.post('/memory/search', async (req, res) => {
    try {
        const { query } = req.body;
        const results = await bridge.autoweave.searchMemory(query);
        res.json({
            success: true,
            data: results
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Error handling middleware
app.use((error, req, res, next) => {
    log('error', 'Unhandled error', { 
        error: error.message, 
        stack: error.stack,
        url: req.url,
        method: req.method 
    });
    
    res.status(500).json({
        success: false,
        error: 'Internal server error'
    });
});

// Start server
const server = app.listen(config.bridge.port, config.bridge.host, () => {
    log('info', `AutoWeave-Taskcafe Bridge started`, {
        port: config.bridge.port,
        host: config.bridge.host,
        taskcafe: config.taskcafe.apiUrl,
        autoweave: config.autoweave.apiUrl,
    });
    
    // Connect to AutoWeave WebSocket
    autoweaveClient.connectWebSocket();
});

// Graceful shutdown
process.on('SIGTERM', () => {
    log('info', 'Received SIGTERM, shutting down gracefully');
    server.close(() => {
        if (autoweaveClient.ws) {
            autoweaveClient.ws.close();
        }
        process.exit(0);
    });
});

module.exports = { bridge, autoweaveClient, taskcafeClient };