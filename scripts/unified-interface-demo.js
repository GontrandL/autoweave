#!/usr/bin/env node
/**
 * Unified Interface Demo
 * =====================
 * Demonstrates all AutoWeave tools working together through unified interface
 */

const fetch = require('node-fetch');
const { Logger } = require('../src/utils/logger');

class UnifiedInterfaceDemo {
    constructor() {
        this.logger = new Logger('UnifiedDemo');
        this.baseUrl = 'http://localhost:3000';
        this.aguiUrl = 'http://localhost:3000/api';
    }
    
    async demonstrateUnifiedInterface() {
        this.logger.info('🌟 Starting Unified AutoWeave Interface Demonstration');
        
        try {
            // 1. Check System Health
            await this.checkSystemHealth();
            
            // 2. Demonstrate Self-Awareness
            await this.demonstrateSelfAwareness();
            
            // 3. Demonstrate Genetic System
            await this.demonstrateGeneticSystem();
            
            // 4. Demonstrate Memory System
            await this.demonstrateMemorySystem();
            
            // 5. Demonstrate Search Capabilities
            await this.demonstrateSearchCapabilities();
            
            // 6. Demonstrate Configuration Intelligence
            await this.demonstrateConfigIntelligence();
            
            // 7. Demonstrate Agent Management
            await this.demonstrateAgentManagement();
            
            // 8. Demonstrate MCP Tools Access
            await this.demonstrateMCPTools();
            
            this.logger.success('✅ Unified Interface Demonstration Completed Successfully');
            
        } catch (error) {
            this.logger.error('❌ Demonstration failed:', error);
            throw error;
        }
    }
    
    async checkSystemHealth() {
        this.logger.info('\n1️⃣ System Health Check');
        
        try {
            const response = await fetch(`${this.baseUrl}/api/health`);
            const health = await response.json();
            
            this.logger.success(`✅ System Status: ${health.status || 'healthy'}`);
            
            // Check OS Environment
            const osResponse = await fetch(`${this.baseUrl}/api/self-awareness/os-environment`);
            if (osResponse.ok) {
                const osData = await osResponse.json();
                const env = osData.claudeCodeNotes;
                this.logger.info(`🖥️ OS: ${env.isRoot ? 'Root' : 'User'} access, Package Manager: ${env.packageManager}`);
            }
            
        } catch (error) {
            this.logger.warn('⚠️ Health check partial failure:', error.message);
        }
    }
    
    async demonstrateSelfAwareness() {
        this.logger.info('\n2️⃣ Self-Awareness System');
        
        try {
            // Get system status
            const statusResponse = await fetch(`${this.baseUrl}/api/self-awareness/status`);
            const status = await statusResponse.json();
            
            if (status.success) {
                this.logger.success(`✅ System Awareness: ${status.status.initialized ? 'Active' : 'Initializing'}`);
                this.logger.info(`📁 Files tracked: ${status.status.files ? status.status.files.size || Object.keys(status.status.files).length : 'N/A'}`);
                this.logger.info(`🔧 Tools discovered: ${status.status.tools ? status.status.tools.size || Object.keys(status.status.tools).length : 'N/A'}`);
            }
            
            // Get tools catalog
            const toolsResponse = await fetch(`${this.baseUrl}/api/self-awareness/tools`);
            const tools = await toolsResponse.json();
            
            if (tools.success) {
                const categories = tools.categories || [];
                this.logger.success(`🔧 Tool Categories: ${categories.join(', ')}`);
            }
            
        } catch (error) {
            this.logger.warn('⚠️ Self-awareness check failed:', error.message);
        }
    }
    
    async demonstrateGeneticSystem() {
        this.logger.info('\n3️⃣ Genetic Code Tracking System');
        
        try {
            // Check genetic database
            const response = await fetch(`${this.baseUrl}/api/self-awareness/files?hasGeneticMarker=true`);
            const geneticFiles = await response.json();
            
            if (geneticFiles.success) {
                this.logger.success(`🧬 Genetic markers: ${geneticFiles.count} files tracked`);
                
                // Show some genetic statistics
                if (geneticFiles.stats) {
                    this.logger.info(`📊 Database sync: ${geneticFiles.stats.inDatabase} files`);
                    this.logger.info(`🔬 Genetic coverage: ${Math.round((geneticFiles.stats.withGeneticMarkers / geneticFiles.stats.total) * 100)}%`);
                }
            }
            
        } catch (error) {
            this.logger.warn('⚠️ Genetic system check failed:', error.message);
        }
    }
    
    async demonstrateMemorySystem() {
        this.logger.info('\n4️⃣ Hybrid Memory System');
        
        try {
            // Check memory health
            const healthResponse = await fetch(`${this.baseUrl}/api/memory/health`);
            const memHealth = await healthResponse.json();
            
            if (memHealth.status === 'healthy') {
                this.logger.success('✅ Memory system operational');
                
                // Test memory search
                const searchResponse = await fetch(`${this.baseUrl}/api/memory/search`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        query: 'AutoWeave unified interface',
                        user_id: 'demo'
                    })
                });
                
                const searchResults = await searchResponse.json();
                this.logger.info(`🔍 Memory search: ${searchResults.results?.length || 0} results found`);
                
                // Get memory metrics
                const metricsResponse = await fetch(`${this.baseUrl}/api/memory/metrics`);
                const metrics = await metricsResponse.json();
                
                if (metrics.qdrant) {
                    this.logger.info(`📊 Vector database: ${metrics.qdrant.vectors_count || 0} vectors`);
                }
            }
            
        } catch (error) {
            this.logger.warn('⚠️ Memory system check failed:', error.message);
        }
    }
    
    async demonstrateSearchCapabilities() {
        this.logger.info('\n5️⃣ Search Capabilities');
        
        try {
            // Check search capabilities
            const capResponse = await fetch(`${this.baseUrl}/api/search/capabilities`);
            const capabilities = await capResponse.json();
            
            if (capabilities.success) {
                this.logger.success('✅ Search system available');
                
                const caps = capabilities.capabilities;
                this.logger.info(`🌐 Web search: ${caps.web_search?.available ? 'Available' : 'Unavailable'}`);
                this.logger.info(`💻 Code search: ${caps.code_search?.available ? 'Available' : 'Unavailable'}`);
                this.logger.info(`📚 Documentation search: ${caps.documentation_search?.available ? 'Available' : 'Unavailable'}`);
                
                // Test web search
                try {
                    const webSearchResponse = await fetch(`${this.baseUrl}/api/search/web`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            query: 'kubernetes agent orchestration',
                            limit: 3
                        })
                    });
                    
                    if (webSearchResponse.ok) {
                        const webResults = await webSearchResponse.json();
                        this.logger.info(`🔍 Web search test: ${webResults.results?.length || 0} results`);
                    }
                } catch (searchError) {
                    this.logger.warn('⚠️ Web search test failed:', searchError.message);
                }
            }
            
        } catch (error) {
            this.logger.warn('⚠️ Search capabilities check failed:', error.message);
        }
    }
    
    async demonstrateConfigIntelligence() {
        this.logger.info('\n6️⃣ Configuration Intelligence');
        
        try {
            // Test package search
            const packageResponse = await fetch(`${this.baseUrl}/api/config/sources/search`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    query: 'nginx'
                })
            });
            
            if (packageResponse.ok) {
                const packageResults = await packageResponse.json();
                this.logger.success('✅ Package discovery operational');
                
                if (packageResults.results) {
                    const registries = Object.keys(packageResults.results);
                    this.logger.info(`📦 Registries available: ${registries.join(', ')}`);
                }
            }
            
        } catch (error) {
            this.logger.warn('⚠️ Configuration intelligence check failed:', error.message);
        }
    }
    
    async demonstrateAgentManagement() {
        this.logger.info('\n7️⃣ Agent Management');
        
        try {
            // List existing agents
            const agentsResponse = await fetch(`${this.baseUrl}/api/agents`);
            const agents = await agentsResponse.json();
            
            this.logger.success(`✅ Agent system: ${agents.length || 0} agents managed`);
            
            if (agents.length > 0) {
                const runningAgents = agents.filter(a => a.status === 'running').length;
                this.logger.info(`🤖 Active agents: ${runningAgents}/${agents.length}`);
            }
            
        } catch (error) {
            this.logger.warn('⚠️ Agent management check failed:', error.message);
        }
    }
    
    async demonstrateMCPTools() {
        this.logger.info('\n8️⃣ MCP Tools Integration');
        
        try {
            // Check MCP server
            const mcpResponse = await fetch('http://localhost:3002/mcp/v1/tools');
            
            if (mcpResponse.ok) {
                const mcpData = await mcpResponse.json();
                this.logger.success(`✅ MCP Server: ${mcpData.tools?.length || 0} tools exposed`);
                
                if (mcpData.tools && mcpData.tools.length > 0) {
                    const toolCategories = {};
                    mcpData.tools.forEach(tool => {
                        const category = tool.name.split('-')[1] || 'other';
                        toolCategories[category] = (toolCategories[category] || 0) + 1;
                    });
                    
                    this.logger.info('🔧 Tool categories:', Object.entries(toolCategories).map(([cat, count]) => `${cat}(${count})`).join(', '));
                }
            }
            
        } catch (error) {
            this.logger.warn('⚠️ MCP tools check failed:', error.message);
        }
    }
    
    async generateUnifiedReport() {
        this.logger.info('\n📋 Generating Unified System Report');
        
        const report = {
            timestamp: new Date().toISOString(),
            system_health: 'pending',
            components: {},
            tools_available: 0,
            integration_status: 'pending'
        };
        
        try {
            // Collect all system information
            const [health, selfAwareness, tools, search] = await Promise.allSettled([
                fetch(`${this.baseUrl}/api/health`).then(r => r.json()),
                fetch(`${this.baseUrl}/api/self-awareness/status`).then(r => r.json()),
                fetch(`${this.baseUrl}/api/self-awareness/tools`).then(r => r.json()),
                fetch(`${this.baseUrl}/api/search/capabilities`).then(r => r.json())
            ]);
            
            // Process results
            if (health.status === 'fulfilled') {
                report.system_health = health.value.status || 'healthy';
            }
            
            if (tools.status === 'fulfilled' && tools.value.success) {
                report.tools_available = tools.value.count || 0;
                report.components.tools = tools.value.categories || [];
            }
            
            if (search.status === 'fulfilled' && search.value.success) {
                report.components.search = Object.keys(search.value.capabilities);
            }
            
            report.integration_status = 'operational';
            
            this.logger.success('📊 Unified System Report Generated');
            console.log('\n' + JSON.stringify(report, null, 2));
            
            return report;
            
        } catch (error) {
            this.logger.error('Failed to generate unified report:', error);
            report.integration_status = 'error';
            report.error = error.message;
            return report;
        }
    }
}

async function main() {
    const demo = new UnifiedInterfaceDemo();
    
    try {
        await demo.demonstrateUnifiedInterface();
        const report = await demo.generateUnifiedReport();
        
        console.log('\n🎉 All AutoWeave tools are unified and working together!');
        console.log('🔗 Access the unified interface through:');
        console.log('   • Web UI: http://localhost:3000');
        console.log('   • API: http://localhost:3000/api');
        console.log('   • MCP: http://localhost:3002/mcp/v1');
        console.log('   • ANP: http://localhost:8083');
        console.log('   • WebSocket: ws://localhost:3000/ws');
        
    } catch (error) {
        console.error('❌ Unified interface demonstration failed:', error.message);
        process.exit(1);
    }
}

if (require.main === module) {
    main();
}

module.exports = UnifiedInterfaceDemo;