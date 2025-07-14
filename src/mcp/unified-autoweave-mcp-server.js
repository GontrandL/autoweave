/**
 * Unified AutoWeave MCP Server - Interface unifiée pour tous les outils maison
 * ===========================================================================
 * Expose tous les outils internes AutoWeave via une interface MCP cohérente
 */

const { Logger } = require('../utils/logger');
const { spawn } = require('child_process');
const fetch = require('node-fetch');
const fs = require('fs').promises;
const path = require('path');

class UnifiedAutoWeaveMCPServer {
    constructor(autoweaveInstance) {
        this.logger = new Logger('UnifiedMCPServer');
        this.autoweave = autoweaveInstance;
        this.projectRoot = path.join(__dirname, '../..');
        
        // Registre des outils internes
        this.internalTools = new Map();
        this.toolCategories = {
            'memory': [],
            'database': [],
            'genetic': [],
            'self-awareness': [],
            'config': [],
            'agents': [],
            'debugging': [],
            'files': [],
            'search': [],
            'monitoring': [],
            'coding-memory': []
        };
        
        this.initialized = false;
    }
    
    async initialize() {
        this.logger.info('🔧 Initializing Unified AutoWeave MCP Server...');
        
        try {
            // Découvrir et enregistrer tous les outils internes
            await this.discoverInternalTools();
            
            // Configurer les outils MCP
            this.setupMCPTools();
            
            // Configurer les ressources MCP
            this.setupMCPResources();
            
            // Configurer les prompts MCP
            this.setupMCPPrompts();
            
            this.initialized = true;
            this.logger.success('✅ Unified AutoWeave MCP Server initialized');
            
        } catch (error) {
            this.logger.error('Failed to initialize unified MCP server:', error);
            throw error;
        }
    }
    
    async discoverInternalTools() {
        this.logger.info('🔍 Discovering all internal AutoWeave tools...');
        
        // 1. MEMORY TOOLS
        await this.registerMemoryTools();
        
        // 2. DATABASE TOOLS  
        await this.registerDatabaseTools();
        
        // 3. GENETIC SYSTEM TOOLS
        await this.registerGeneticTools();
        
        // 4. SELF-AWARENESS TOOLS
        await this.registerSelfAwarenessTools();
        
        // 5. CONFIGURATION TOOLS
        await this.registerConfigurationTools();
        
        // 6. AGENT TOOLS
        await this.registerAgentTools();
        
        // 7. DEBUGGING TOOLS
        await this.registerDebuggingTools();
        
        // 8. FILE SYSTEM TOOLS
        await this.registerFileSystemTools();
        
        // 9. SEARCH TOOLS
        await this.registerSearchTools();
        
        // 10. MONITORING TOOLS
        await this.registerMonitoringTools();
        
        // 11. CODING MEMORY TOOLS
        await this.registerCodingMemoryTools();
        
        this.logger.info(`📊 Discovered ${this.internalTools.size} internal tools across ${Object.keys(this.toolCategories).length} categories`);
    }
    
    async registerMemoryTools() {
        // Mem0 Bridge
        this.registerTool('memory', 'mem0-search', {
            description: 'Search contextual memory using mem0 self-hosted',
            schema: {
                type: 'object',
                properties: {
                    query: { type: 'string', description: 'Search query' },
                    user_id: { type: 'string', description: 'User ID for memory context' },
                    limit: { type: 'number', default: 5 }
                },
                required: ['query']
            },
            handler: this.executeMem0Search.bind(this)
        });
        
        this.registerTool('memory', 'mem0-add', {
            description: 'Add information to contextual memory',
            schema: {
                type: 'object',
                properties: {
                    text: { type: 'string', description: 'Information to store' },
                    user_id: { type: 'string', description: 'User ID for memory context' },
                    metadata: { type: 'object', description: 'Additional metadata' }
                },
                required: ['text']
            },
            handler: this.executeMem0Add.bind(this)
        });
        
        // Hybrid Memory
        this.registerTool('memory', 'hybrid-memory-search', {
            description: 'Search both contextual and structural memory',
            schema: {
                type: 'object',
                properties: {
                    query: { type: 'string', description: 'Search query' },
                    user_id: { type: 'string', description: 'User ID' },
                    include_graph: { type: 'boolean', default: true }
                },
                required: ['query']
            },
            handler: this.executeHybridMemorySearch.bind(this)
        });
    }
    
    async registerDatabaseTools() {
        // Qdrant Operations
        this.registerTool('database', 'qdrant-search', {
            description: 'Search vectors in Qdrant database',
            schema: {
                type: 'object',
                properties: {
                    collection: { type: 'string', description: 'Collection name' },
                    query: { type: 'string', description: 'Search query' },
                    limit: { type: 'number', default: 10 }
                },
                required: ['collection', 'query']
            },
            handler: this.executeQdrantSearch.bind(this)
        });
        
        // Database Reader
        this.registerTool('database', 'db-read-collections', {
            description: 'List all database collections',
            schema: { type: 'object', properties: {} },
            handler: this.executeDbReadCollections.bind(this)
        });
        
        // Database Sync Checker
        this.registerTool('database', 'check-db-sync', {
            description: 'Check synchronization between filesystem and database',
            schema: {
                type: 'object',
                properties: {
                    deep_check: { type: 'boolean', default: false }
                }
            },
            handler: this.executeCheckDbSync.bind(this)
        });
    }
    
    async registerGeneticTools() {
        // Intelligent Deduplication
        this.registerTool('genetic', 'analyze-duplicates', {
            description: 'Analyze code duplicates using intelligent deduplication',
            schema: {
                type: 'object',
                properties: {
                    threshold: { type: 'number', default: 0.8 },
                    include_stats: { type: 'boolean', default: true }
                }
            },
            handler: this.executeAnalyzeDuplicates.bind(this)
        });
        
        // Gene Evolution Tracking
        this.registerTool('genetic', 'track-gene-evolution', {
            description: 'Track evolution of specific genes',
            schema: {
                type: 'object',
                properties: {
                    gene_id: { type: 'string', description: 'Gene ID to track' },
                    include_mutations: { type: 'boolean', default: true }
                },
                required: ['gene_id']
            },
            handler: this.executeTrackGeneEvolution.bind(this)
        });
        
        // Genetic Reconstruction
        this.registerTool('genetic', 'reconstruct-file', {
            description: 'Reconstruct file from genetic database',
            schema: {
                type: 'object',
                properties: {
                    file_path: { type: 'string', description: 'File path to reconstruct' },
                    version: { type: 'string', description: 'Specific version (optional)' }
                },
                required: ['file_path']
            },
            handler: this.executeReconstructFile.bind(this)
        });
    }
    
    async registerSelfAwarenessTools() {
        // System Scan
        this.registerTool('self-awareness', 'full-system-scan', {
            description: 'Perform full system scan and update awareness',
            schema: {
                type: 'object',
                properties: {
                    force_refresh: { type: 'boolean', default: false }
                }
            },
            handler: this.executeFullSystemScan.bind(this)
        });
        
        // Tool Discovery
        this.registerTool('self-awareness', 'discover-tools', {
            description: 'Discover and catalog all available tools',
            schema: {
                type: 'object',
                properties: {
                    category: { type: 'string', enum: ['cli', 'scripts', 'apis', 'hooks'] }
                }
            },
            handler: this.executeDiscoverTools.bind(this)
        });
        
        // OS Environment Detection
        this.registerTool('self-awareness', 'detect-os-environment', {
            description: 'Detect and analyze OS environment for Claude Code compatibility',
            schema: {
                type: 'object',
                properties: {
                    force_redetect: { type: 'boolean', default: false }
                }
            },
            handler: this.executeDetectOSEnvironment.bind(this)
        });
        
        // System Documentation
        this.registerTool('self-awareness', 'generate-documentation', {
            description: 'Generate or update system documentation',
            schema: {
                type: 'object',
                properties: {
                    format: { type: 'string', enum: ['markdown', 'json', 'yaml'], default: 'markdown' },
                    include_apis: { type: 'boolean', default: true }
                }
            },
            handler: this.executeGenerateDocumentation.bind(this)
        });
        
        // Get Claude Code Environment Info
        this.registerTool('self-awareness', 'get-claude-environment', {
            description: 'Get environment information specifically formatted for Claude Code usage',
            schema: {
                type: 'object',
                properties: {
                    include_restrictions: { type: 'boolean', default: true },
                    include_capabilities: { type: 'boolean', default: true }
                }
            },
            handler: this.executeGetClaudeEnvironment.bind(this)
        });
    }
    
    async registerConfigurationTools() {
        // Configuration Intelligence (existing)
        this.registerTool('config', 'intelligent-config', {
            description: 'Generate intelligent configuration from natural language',
            schema: {
                type: 'object',
                properties: {
                    intent: { type: 'string', description: 'Natural language intent' },
                    platform: { type: 'string', enum: ['kubernetes', 'docker-compose', 'helm'] },
                    include_observability: { type: 'boolean', default: true }
                },
                required: ['intent']
            },
            handler: this.executeIntelligentConfig.bind(this)
        });
        
        // Fresh Sources (existing but enhanced)
        this.registerTool('config', 'find-latest-packages', {
            description: 'Find latest versions across all registries',
            schema: {
                type: 'object',
                properties: {
                    packages: {
                        type: 'object',
                        properties: {
                            docker: { type: 'array', items: { type: 'string' } },
                            npm: { type: 'array', items: { type: 'string' } },
                            helm: { type: 'array', items: { type: 'string' } },
                            github: { type: 'array', items: { type: 'string' } }
                        }
                    }
                },
                required: ['packages']
            },
            handler: this.executeFindLatestPackages.bind(this)
        });
    }
    
    async registerAgentTools() {
        // Agent Creation
        this.registerTool('agents', 'create-agent', {
            description: 'Create intelligent agent from description',
            schema: {
                type: 'object',
                properties: {
                    description: { type: 'string', description: 'Agent description' },
                    capabilities: { type: 'array', items: { type: 'string' } },
                    deploy: { type: 'boolean', default: true }
                },
                required: ['description']
            },
            handler: this.executeCreateAgent.bind(this)
        });
        
        // Agent Management
        this.registerTool('agents', 'list-agents', {
            description: 'List all created agents',
            schema: {
                type: 'object',
                properties: {
                    status: { type: 'string', enum: ['all', 'running', 'stopped'] }
                }
            },
            handler: this.executeListAgents.bind(this)
        });
    }
    
    async registerDebuggingTools() {
        // System Health Check
        this.registerTool('debugging', 'health-check', {
            description: 'Comprehensive system health check',
            schema: {
                type: 'object',
                properties: {
                    include_external: { type: 'boolean', default: true },
                    verbose: { type: 'boolean', default: false }
                }
            },
            handler: this.executeHealthCheck.bind(this)
        });
        
        // Log Analysis
        this.registerTool('debugging', 'analyze-logs', {
            description: 'Analyze system logs for issues',
            schema: {
                type: 'object',
                properties: {
                    log_file: { type: 'string', default: 'autoweave.log' },
                    lines: { type: 'number', default: 100 },
                    level: { type: 'string', enum: ['error', 'warn', 'info', 'debug'] }
                }
            },
            handler: this.executeAnalyzeLogs.bind(this)
        });
    }
    
    async registerFileSystemTools() {
        // File Indexing
        this.registerTool('files', 'index-file', {
            description: 'Index file in genetic database',
            schema: {
                type: 'object',
                properties: {
                    file_path: { type: 'string', description: 'File path to index' },
                    force: { type: 'boolean', default: false }
                },
                required: ['file_path']
            },
            handler: this.executeIndexFile.bind(this)
        });
        
        // File Search
        this.registerTool('files', 'search-files', {
            description: 'Search files by content or metadata',
            schema: {
                type: 'object',
                properties: {
                    query: { type: 'string', description: 'Search query' },
                    type: { type: 'string', enum: ['content', 'name', 'metadata'] },
                    extensions: { type: 'array', items: { type: 'string' } }
                },
                required: ['query']
            },
            handler: this.executeSearchFiles.bind(this)
        });
    }
    
    async registerSearchTools() {
        // Web Search (si disponible)
        this.registerTool('search', 'web-search', {
            description: 'Search web for information',
            schema: {
                type: 'object',
                properties: {
                    query: { type: 'string', description: 'Search query' },
                    domains: { type: 'array', items: { type: 'string' } },
                    limit: { type: 'number', default: 5 }
                },
                required: ['query']
            },
            handler: this.executeWebSearch.bind(this)
        });
        
        // Code Search
        this.registerTool('search', 'code-search', {
            description: 'Search code in project',
            schema: {
                type: 'object',
                properties: {
                    pattern: { type: 'string', description: 'Search pattern/regex' },
                    include: { type: 'string', description: 'File pattern to include' },
                    context_lines: { type: 'number', default: 3 }
                },
                required: ['pattern']
            },
            handler: this.executeCodeSearch.bind(this)
        });
    }
    
    async registerMonitoringTools() {
        // System Metrics
        this.registerTool('monitoring', 'get-metrics', {
            description: 'Get system performance metrics',
            schema: {
                type: 'object',
                properties: {
                    metric_type: { type: 'string', enum: ['cpu', 'memory', 'disk', 'network', 'all'] },
                    time_range: { type: 'string', default: '5m' }
                }
            },
            handler: this.executeGetMetrics.bind(this)
        });
        
        // Service Status
        this.registerTool('monitoring', 'service-status', {
            description: 'Check status of all services',
            schema: {
                type: 'object',
                properties: {
                    service: { type: 'string', description: 'Specific service (optional)' }
                }
            },
            handler: this.executeServiceStatus.bind(this)
        });
    }
    
    async registerCodingMemoryTools() {
        // Code Context Memory
        this.registerTool('coding-memory', 'remember-code-context', {
            description: 'Remember code context with intelligent metadata',
            schema: {
                type: 'object',
                properties: {
                    file: { type: 'string', description: 'File path' },
                    function: { type: 'string', description: 'Function name' },
                    purpose: { type: 'string', description: 'Purpose of the code' },
                    patterns: { type: 'array', items: { type: 'string' } },
                    dependencies: { type: 'array', items: { type: 'string' } },
                    linkedFiles: { type: 'array', items: { type: 'string' } },
                    codeStyle: { type: 'string' },
                    complexity: { type: 'string', enum: ['low', 'medium', 'high'] },
                    content: { type: 'string', description: 'Code content for analysis' }
                },
                required: ['file', 'function', 'purpose']
            },
            handler: this.executeRememberCodeContext.bind(this)
        });
        
        // Code Relations
        this.registerTool('coding-memory', 'create-code-relation', {
            description: 'Create relations between code elements',
            schema: {
                type: 'object',
                properties: {
                    type: { type: 'string', default: 'function_calls' },
                    source: {
                        type: 'object',
                        properties: {
                            file: { type: 'string' },
                            function: { type: 'string' }
                        },
                        required: ['file']
                    },
                    target: {
                        type: 'object',
                        properties: {
                            file: { type: 'string' },
                            function: { type: 'string' }
                        },
                        required: ['file']
                    },
                    relationship: { type: 'string' },
                    frequency: { type: 'string', enum: ['low', 'medium', 'high'] },
                    dataFlow: { type: 'array', items: { type: 'string' } }
                },
                required: ['source', 'target', 'relationship']
            },
            handler: this.executeCreateCodeRelation.bind(this)
        });
        
        // Intelligent Code Search
        this.registerTool('coding-memory', 'search-code-context', {
            description: 'Search code with enhanced context and relations',
            schema: {
                type: 'object',
                properties: {
                    query: { type: 'string', description: 'Search query' },
                    file: { type: 'string', description: 'Specific file to search in' },
                    language: { type: 'string', description: 'Programming language' },
                    includeRelations: { type: 'boolean', default: true }
                },
                required: ['query']
            },
            handler: this.executeSearchCodeContext.bind(this)
        });
        
        // Explain Code Context
        this.registerTool('coding-memory', 'explain-code', {
            description: 'Explain code context with rich information',
            schema: {
                type: 'object',
                properties: {
                    file: { type: 'string', description: 'File path' },
                    line: { type: 'number', description: 'Line number' },
                    functionName: { type: 'string', description: 'Function name' }
                },
                required: ['file']
            },
            handler: this.executeExplainCode.bind(this)
        });
        
        // Suggest Refactoring
        this.registerTool('coding-memory', 'suggest-refactoring', {
            description: 'Suggest refactoring based on code patterns',
            schema: {
                type: 'object',
                properties: {
                    file: { type: 'string', description: 'File path' },
                    functionName: { type: 'string', description: 'Function to refactor' },
                    issues: { 
                        type: 'array', 
                        items: { type: 'string' },
                        description: 'Specific issues to address'
                    }
                },
                required: ['file', 'functionName']
            },
            handler: this.executeSuggestRefactoring.bind(this)
        });
        
        // Learn from Commits
        this.registerTool('coding-memory', 'learn-from-commit', {
            description: 'Learn patterns from git commits',
            schema: {
                type: 'object',
                properties: {
                    commit: { type: 'string', description: 'Commit hash' },
                    changes: {
                        type: 'object',
                        properties: {
                            added: { type: 'array', items: { type: 'string' } },
                            modified: { type: 'array', items: { type: 'string' } },
                            deleted: { type: 'array', items: { type: 'string' } }
                        }
                    },
                    patterns: { type: 'object', description: 'Patterns identified in commit' }
                },
                required: ['commit', 'changes']
            },
            handler: this.executeLearnFromCommit.bind(this)
        });
        
        // Learn Code Style
        this.registerTool('coding-memory', 'learn-code-style', {
            description: 'Learn code style from project files',
            schema: {
                type: 'object',
                properties: {
                    project: { type: 'string', description: 'Project name' },
                    files: { type: 'array', items: { type: 'string' } },
                    aspects: {
                        type: 'array',
                        items: {
                            type: 'string',
                            enum: ['naming_conventions', 'function_structure', 'error_handling', 'documentation_patterns', 'test_patterns']
                        }
                    }
                },
                required: ['project', 'files', 'aspects']
            },
            handler: this.executeLearnCodeStyle.bind(this)
        });
        
        // Predict Next Action
        this.registerTool('coding-memory', 'predict-next-action', {
            description: 'Predict next developer action based on context',
            schema: {
                type: 'object',
                properties: {
                    currentFile: { type: 'string', description: 'Current file being edited' },
                    cursorPosition: {
                        type: 'object',
                        properties: {
                            line: { type: 'number' },
                            column: { type: 'number' }
                        }
                    },
                    recentActions: { type: 'array', items: { type: 'string' } },
                    context: { type: 'string', description: 'Current context' }
                },
                required: ['currentFile']
            },
            handler: this.executePredictNextAction.bind(this)
        });
        
        // Team Analytics
        this.registerTool('coding-memory', 'get-team-analytics', {
            description: 'Get team coding analytics and patterns',
            schema: {
                type: 'object',
                properties: {
                    period: { type: 'string', default: '30days' },
                    metrics: {
                        type: 'array',
                        items: {
                            type: 'string',
                            enum: ['complexity_trends', 'refactoring_patterns', 'code_quality']
                        }
                    }
                },
                required: ['metrics']
            },
            handler: this.executeGetTeamAnalytics.bind(this)
        });
        
        // Code Dependency Analysis
        this.registerTool('coding-memory', 'analyze-dependencies', {
            description: 'Analyze code dependencies and suggest improvements',
            schema: {
                type: 'object',
                properties: {
                    module: { type: 'string', description: 'Module to analyze' },
                    depth: { type: 'number', default: 3, description: 'Dependency depth' },
                    includeExternal: { type: 'boolean', default: true }
                },
                required: ['module']
            },
            handler: this.executeAnalyzeDependencies.bind(this)
        });
    }
    
    registerTool(category, name, config) {
        const fullName = `autoweave-${category}-${name}`;
        this.internalTools.set(fullName, {
            category,
            name,
            fullName,
            ...config
        });
        
        if (!this.toolCategories[category]) {
            this.toolCategories[category] = [];
        }
        this.toolCategories[category].push(fullName);
    }
    
    setupMCPTools() {
        this.mcpTools = Array.from(this.internalTools.values()).map(tool => ({
            name: tool.fullName,
            description: tool.description,
            inputSchema: tool.schema
        }));
        
        this.logger.info(`🔧 Configured ${this.mcpTools.length} MCP tools`);
    }
    
    setupMCPResources() {
        this.mcpResources = [
            {
                name: 'autoweave-tools-catalog',
                description: 'Complete catalog of available AutoWeave tools',
                mimeType: 'application/json'
            },
            {
                name: 'autoweave-system-status',
                description: 'Real-time system status and metrics',
                mimeType: 'application/json'
            },
            {
                name: 'autoweave-tool-usage-stats',
                description: 'Tool usage statistics and performance',
                mimeType: 'application/json'
            }
        ];
    }
    
    setupMCPPrompts() {
        this.mcpPrompts = [
            {
                name: 'autoweave-diagnose-system',
                description: 'Diagnose AutoWeave system issues',
                arguments: [
                    {
                        name: 'symptoms',
                        description: 'Observed symptoms or issues',
                        required: false
                    }
                ]
            },
            {
                name: 'autoweave-optimize-performance',
                description: 'Optimize AutoWeave system performance',
                arguments: [
                    {
                        name: 'focus_area',
                        description: 'Specific area to optimize (memory, cpu, storage, network)',
                        required: false
                    }
                ]
            },
            {
                name: 'autoweave-setup-integration',
                description: 'Setup integration with external system',
                arguments: [
                    {
                        name: 'system_type',
                        description: 'Type of system to integrate with',
                        required: true
                    },
                    {
                        name: 'requirements',
                        description: 'Integration requirements',
                        required: false
                    }
                ]
            }
        ];
    }
    
    // MCP Protocol Methods
    async listTools() {
        return { tools: this.mcpTools };
    }
    
    async callTool(name, args) {
        const tool = this.internalTools.get(name);
        if (!tool) {
            throw new Error(`Tool not found: ${name}`);
        }
        
        try {
            this.logger.info(`🔧 Executing tool: ${name}`);
            const result = await tool.handler(args);
            this.logger.success(`✅ Tool executed successfully: ${name}`);
            return result;
        } catch (error) {
            this.logger.error(`❌ Tool execution failed: ${name}`, error);
            throw error;
        }
    }
    
    async listResources() {
        return { resources: this.mcpResources };
    }
    
    async readResource(uri) {
        switch (uri) {
            case 'autoweave-tools-catalog':
                return {
                    contents: [{
                        type: 'text',
                        text: JSON.stringify({
                            categories: this.toolCategories,
                            tools: Array.from(this.internalTools.values()),
                            total: this.internalTools.size
                        }, null, 2)
                    }]
                };
                
            case 'autoweave-system-status':
                return {
                    contents: [{
                        type: 'text',
                        text: JSON.stringify(await this.getSystemStatus(), null, 2)
                    }]
                };
                
            case 'autoweave-tool-usage-stats':
                return {
                    contents: [{
                        type: 'text',
                        text: JSON.stringify(await this.getToolUsageStats(), null, 2)
                    }]
                };
                
            default:
                throw new Error(`Resource not found: ${uri}`);
        }
    }
    
    async listPrompts() {
        return { prompts: this.mcpPrompts };
    }
    
    async getPrompt(name, args) {
        switch (name) {
            case 'autoweave-diagnose-system':
                return await this.generateSystemDiagnosisPrompt(args.symptoms);
                
            case 'autoweave-optimize-performance':
                return await this.generatePerformanceOptimizationPrompt(args.focus_area);
                
            case 'autoweave-setup-integration':
                return await this.generateIntegrationSetupPrompt(args.system_type, args.requirements);
                
            default:
                throw new Error(`Prompt not found: ${name}`);
        }
    }
    
    // Tool Implementation Methods (placeholders - to be implemented)
    async executeMem0Search(args) {
        return this.executePythonScript('scripts/mem0-bridge.py', ['search', args.query, args.user_id || 'system']);
    }
    
    async executeMem0Add(args) {
        return this.executePythonScript('scripts/mem0-bridge.py', ['add', args.text, args.user_id || 'system']);
    }
    
    async executeHybridMemorySearch(args) {
        try {
            const response = await fetch('http://localhost:3000/api/memory/search', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(args)
            });
            return await response.json();
        } catch (error) {
            throw new Error(`Hybrid memory search failed: ${error.message}`);
        }
    }
    
    async executeQdrantSearch(args) {
        return this.executePythonScript('scripts/simple_db_reader.py', ['search-collection', args.collection, args.query]);
    }
    
    async executeDbReadCollections(args) {
        return this.executePythonScript('scripts/simple_db_reader.py', ['list-collections']);
    }
    
    async executeCheckDbSync(args) {
        try {
            const response = await fetch('http://localhost:3000/api/self-awareness/sync');
            return await response.json();
        } catch (error) {
            throw new Error(`DB sync check failed: ${error.message}`);
        }
    }
    
    async executeAnalyzeDuplicates(args) {
        return this.executePythonScript('scripts/intelligent_deduplication.py', ['analyze', JSON.stringify(args)]);
    }
    
    async executeFullSystemScan(args) {
        try {
            const response = await fetch('http://localhost:3000/api/self-awareness/scan', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(args)
            });
            return await response.json();
        } catch (error) {
            throw new Error(`System scan failed: ${error.message}`);
        }
    }
    
    async executeCreateAgent(args) {
        try {
            const response = await fetch('http://localhost:3000/api/agents', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(args)
            });
            return await response.json();
        } catch (error) {
            throw new Error(`Agent creation failed: ${error.message}`);
        }
    }
    
    async executeDetectOSEnvironment(args) {
        try {
            if (args.force_redetect) {
                // Force une nouvelle détection
                const OSEnvironmentDetector = require('../utils/os-environment-detector');
                const detector = new OSEnvironmentDetector();
                const env = await detector.detectComplete();
                await detector.saveEnvironmentDocumentation();
                return {
                    success: true,
                    environment: env,
                    message: 'OS environment re-detected'
                };
            } else {
                // Utiliser l'environnement déjà détecté
                const response = await fetch('http://localhost:3000/api/self-awareness/os-environment');
                return await response.json();
            }
        } catch (error) {
            throw new Error(`OS environment detection failed: ${error.message}`);
        }
    }
    
    async executeGetClaudeEnvironment(args) {
        try {
            const response = await fetch('http://localhost:3000/api/self-awareness/os-environment');
            const data = await response.json();
            
            if (!data.success) {
                throw new Error('OS environment not available');
            }
            
            const env = data.osEnvironment;
            const notes = data.claudeCodeNotes;
            
            return {
                claude_code_environment: {
                    user: {
                        name: env.permissions.currentUser,
                        is_root: notes.isRoot,
                        admin_access: notes.adminAccess,
                        admin_method: notes.adminMethod
                    },
                    system: {
                        os: env.basic.distribution?.PRETTY_NAME || env.basic.platform,
                        package_manager: notes.packageManager,
                        development_tools: notes.developmentTools
                    },
                    restrictions: args.include_restrictions ? {
                        sudo_available: notes.canSudo,
                        su_available: env.permissions.canSu,
                        writeable_locations: env.restrictions?.filesystem?.writeableLocations || [],
                        readonly_locations: env.restrictions?.filesystem?.readOnlyLocations || []
                    } : undefined,
                    capabilities: args.include_capabilities ? {
                        containerization: env.capabilities.containerization?.map(c => ({ name: c.name, version: c.version })) || [],
                        package_managers: env.capabilities.packageManagers?.map(p => ({ name: p.name, version: p.version })) || [],
                        network_interfaces: Object.keys(env.network?.interfaces || {}).length,
                        storage_filesystems: env.storage?.filesystems?.length || 0
                    } : undefined,
                    warnings: notes.userWarnings,
                    claude_instructions: this.generateClaudeInstructions(env, notes)
                }
            };
        } catch (error) {
            throw new Error(`Failed to get Claude environment: ${error.message}`);
        }
    }
    
    generateClaudeInstructions(env, notes) {
        const instructions = [];
        
        if (!notes.adminAccess) {
            instructions.push("⚠️ NO ADMIN ACCESS: User cannot install system packages or modify system files");
        } else if (notes.adminMethod === 'su_with_password') {
            instructions.push("⚠️ NO SUDO: Use 'su -c \"command\"' for admin tasks, not 'sudo'");
        }
        
        if (notes.packageManager === 'apt') {
            instructions.push(`📦 Package Manager: Use 'apt install' for packages (requires ${notes.adminMethod})`);
        } else if (notes.packageManager === 'yum') {
            instructions.push(`📦 Package Manager: Use 'yum install' for packages (requires ${notes.adminMethod})`);
        }
        
        instructions.push("🏠 User Home: " + env.permissions.homeDir);
        instructions.push("🔧 Prefer user-space installations when possible");
        
        return instructions;
    }
    
    generateLogAnalysisSuggestions(analysis) {
        const suggestions = [];
        
        if (analysis.errors > 0) {
            suggestions.push("🔴 Fix recent errors to improve system stability");
            suggestions.push("📋 Review error patterns for recurring issues");
        }
        
        if (analysis.warnings > 5) {
            suggestions.push("⚠️ High number of warnings detected - investigate potential issues");
        }
        
        if (analysis.errors === 0 && analysis.warnings < 3) {
            suggestions.push("✅ System logs appear healthy");
        }
        
        suggestions.push("📊 Consider implementing log rotation if file size is large");
        suggestions.push("🔍 Use log analysis tools for deeper insights");
        
        return suggestions;
    }
    
    async executeHealthCheck(args) {
        try {
            const response = await fetch('http://localhost:3000/api/health');
            return await response.json();
        } catch (error) {
            throw new Error(`Health check failed: ${error.message}`);
        }
    }
    
    async executeWebSearch(args) {
        try {
            // Vérifier si l'AutoWeave a un service de recherche web disponible
            const response = await fetch('http://localhost:3000/api/self-awareness/tools?category=web');
            const toolsData = await response.json();
            
            if (toolsData.success && toolsData.tools.length > 0) {
                // Utiliser le service de recherche web d'AutoWeave
                const searchResponse = await fetch('http://localhost:3000/api/search/web', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(args)
                });
                return await searchResponse.json();
            } else {
                // Fallback vers curl/wget si disponible
                const curlResult = await this.executeBashCommand(`curl -s "https://api.duckduckgo.com/?q=${encodeURIComponent(args.query)}&format=json&no_html=1&skip_disambig=1"`);
                
                if (curlResult.code === 0) {
                    try {
                        const results = JSON.parse(curlResult.stdout);
                        return {
                            success: true,
                            results: results.AbstractText ? [{ 
                                title: results.Heading || 'DuckDuckGo Result',
                                content: results.AbstractText,
                                url: results.AbstractURL
                            }] : [],
                            source: 'duckduckgo-api',
                            query: args.query
                        };
                    } catch (parseError) {
                        throw new Error(`Failed to parse search results: ${parseError.message}`);
                    }
                } else {
                    throw new Error(`Web search failed: ${curlResult.stderr}`);
                }
            }
        } catch (error) {
            return { 
                success: false, 
                error: `Web search failed: ${error.message}`, 
                query: args.query,
                fallback_suggestion: "Consider implementing a dedicated web search service or configuring external search APIs"
            };
        }
    }
    
    async executeCodeSearch(args) {
        return this.executeBashCommand(`rg "${args.pattern}" --type-add 'include:${args.include || "*"}' -n -C ${args.context_lines}`);
    }
    
    async executeTrackGeneEvolution(args) {
        return this.executePythonScript('scripts/intelligent_deduplication.py', ['track-evolution', args.gene_id, JSON.stringify({ include_mutations: args.include_mutations })]);
    }
    
    async executeReconstructFile(args) {
        return this.executePythonScript('scripts/genetic-reconstruction.py', ['reconstruct', args.file_path, args.version || 'latest']);
    }
    
    async executeDiscoverTools(args) {
        try {
            const response = await fetch(`http://localhost:3000/api/self-awareness/tools${args.category ? `?category=${args.category}` : ''}`);
            return await response.json();
        } catch (error) {
            throw new Error(`Tool discovery failed: ${error.message}`);
        }
    }
    
    async executeGenerateDocumentation(args) {
        try {
            const response = await fetch('http://localhost:3000/api/self-awareness/documentation');
            const docData = await response.json();
            
            if (args.format === 'json') {
                return docData;
            } else if (args.format === 'yaml') {
                const yaml = require('js-yaml');
                return { documentation: yaml.dump(docData.documentation) };
            } else {
                return docData; // markdown par défaut
            }
        } catch (error) {
            throw new Error(`Documentation generation failed: ${error.message}`);
        }
    }
    
    async executeIntelligentConfig(args) {
        try {
            const response = await fetch('http://localhost:3000/api/config/generate-with-fresh', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(args)
            });
            return await response.json();
        } catch (error) {
            throw new Error(`Intelligent config generation failed: ${error.message}`);
        }
    }
    
    async executeFindLatestPackages(args) {
        try {
            const response = await fetch('http://localhost:3000/api/config/sources/search', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ packages: args.packages })
            });
            return await response.json();
        } catch (error) {
            throw new Error(`Package search failed: ${error.message}`);
        }
    }
    
    async executeListAgents(args) {
        try {
            const response = await fetch(`http://localhost:3000/api/agents${args.status ? `?status=${args.status}` : ''}`);
            return await response.json();
        } catch (error) {
            throw new Error(`Agent listing failed: ${error.message}`);
        }
    }
    
    // Coding Memory Tool Handlers
    
    async executeRememberCodeContext(args) {
        try {
            const CodingMemoryManager = require('../memory/coding/coding-memory-manager');
            const config = require('../../config/autoweave/config');
            if (!this.codingMemory) {
                this.codingMemory = new CodingMemoryManager(config.memory);
                await this.codingMemory.initialize();
            }
            
            return await this.codingMemory.rememberCodeContext(args);
        } catch (error) {
            throw new Error(`Failed to remember code context: ${error.message}`);
        }
    }
    
    async executeCreateCodeRelation(args) {
        try {
            const CodingMemoryManager = require('../memory/coding/coding-memory-manager');
            const config = require('../../config/autoweave/config');
            if (!this.codingMemory) {
                this.codingMemory = new CodingMemoryManager(config.memory);
                await this.codingMemory.initialize();
            }
            
            return await this.codingMemory.createCodeRelation(args);
        } catch (error) {
            throw new Error(`Failed to create code relation: ${error.message}`);
        }
    }
    
    async executeSearchCodeContext(args) {
        try {
            const CodingMemoryManager = require('../memory/coding/coding-memory-manager');
            const config = require('../../config/autoweave/config');
            if (!this.codingMemory) {
                this.codingMemory = new CodingMemoryManager(config.memory);
                await this.codingMemory.initialize();
            }
            
            return await this.codingMemory.intelligentCodeSearch(args.query, args);
        } catch (error) {
            throw new Error(`Code search failed: ${error.message}`);
        }
    }
    
    async executeExplainCode(args) {
        try {
            const CodingMemoryManager = require('../memory/coding/coding-memory-manager');
            const config = require('../../config/autoweave/config');
            if (!this.codingMemory) {
                this.codingMemory = new CodingMemoryManager(config.memory);
                await this.codingMemory.initialize();
            }
            
            return await this.codingMemory.explainCodeContext(args);
        } catch (error) {
            throw new Error(`Failed to explain code: ${error.message}`);
        }
    }
    
    async executeSuggestRefactoring(args) {
        try {
            const CodingMemoryManager = require('../memory/coding/coding-memory-manager');
            const config = require('../../config/autoweave/config');
            if (!this.codingMemory) {
                this.codingMemory = new CodingMemoryManager(config.memory);
                await this.codingMemory.initialize();
            }
            
            return await this.codingMemory.suggestRefactoring(args);
        } catch (error) {
            throw new Error(`Failed to suggest refactoring: ${error.message}`);
        }
    }
    
    async executeLearnFromCommit(args) {
        try {
            const CodingMemoryManager = require('../memory/coding/coding-memory-manager');
            const config = require('../../config/autoweave/config');
            if (!this.codingMemory) {
                this.codingMemory = new CodingMemoryManager(config.memory);
                await this.codingMemory.initialize();
            }
            
            return await this.codingMemory.learnFromCommit(args);
        } catch (error) {
            throw new Error(`Failed to learn from commit: ${error.message}`);
        }
    }
    
    async executeLearnCodeStyle(args) {
        try {
            const CodingMemoryManager = require('../memory/coding/coding-memory-manager');
            const config = require('../../config/autoweave/config');
            if (!this.codingMemory) {
                this.codingMemory = new CodingMemoryManager(config.memory);
                await this.codingMemory.initialize();
            }
            
            return await this.codingMemory.learnCodeStyle(args);
        } catch (error) {
            throw new Error(`Failed to learn code style: ${error.message}`);
        }
    }
    
    async executePredictNextAction(args) {
        try {
            const CodingMemoryManager = require('../memory/coding/coding-memory-manager');
            const config = require('../../config/autoweave/config');
            if (!this.codingMemory) {
                this.codingMemory = new CodingMemoryManager(config.memory);
                await this.codingMemory.initialize();
            }
            
            return await this.codingMemory.predictNextAction(args);
        } catch (error) {
            throw new Error(`Failed to predict next action: ${error.message}`);
        }
    }
    
    async executeGetTeamAnalytics(args) {
        try {
            const CodingMemoryManager = require('../memory/coding/coding-memory-manager');
            const config = require('../../config/autoweave/config');
            if (!this.codingMemory) {
                this.codingMemory = new CodingMemoryManager(config.memory);
                await this.codingMemory.initialize();
            }
            
            return await this.codingMemory.getTeamAnalytics(args);
        } catch (error) {
            throw new Error(`Failed to get team analytics: ${error.message}`);
        }
    }
    
    async executeAnalyzeDependencies(args) {
        try {
            const CodingMemoryManager = require('../memory/coding/coding-memory-manager');
            const config = require('../../config/autoweave/config');
            if (!this.codingMemory) {
                this.codingMemory = new CodingMemoryManager(config.memory);
                await this.codingMemory.initialize();
            }
            
            // For now, use a simplified dependency analysis
            const dependencies = await this.codingMemory.analyzeCodeDependencies(args.module);
            return {
                module: args.module,
                dependencies,
                depth: args.depth,
                suggestions: [
                    'Consider reducing coupling between modules',
                    'Update outdated dependencies'
                ]
            };
        } catch (error) {
            throw new Error(`Failed to analyze dependencies: ${error.message}`);
        }
    }
    
    async executeAnalyzeLogs(args) {
        try {
            const logContent = await this.executeBashCommand(`tail -n ${args.lines} "${this.projectRoot}/${args.log_file}"`);
            
            if (logContent.code !== 0) {
                throw new Error(`Failed to read log file: ${logContent.stderr}`);
            }
            
            const lines = logContent.stdout.split('\n').filter(line => line.trim());
            const analysis = {
                total_lines: lines.length,
                errors: lines.filter(line => line.includes('[ERROR]')).length,
                warnings: lines.filter(line => line.includes('[WARN]')).length,
                info: lines.filter(line => line.includes('[INFO]')).length,
                recent_errors: lines.filter(line => line.includes('[ERROR]')).slice(-5),
                recent_warnings: lines.filter(line => line.includes('[WARN]')).slice(-5)
            };
            
            return {
                success: true,
                log_file: args.log_file,
                analysis,
                suggestions: this.generateLogAnalysisSuggestions(analysis)
            };
        } catch (error) {
            throw new Error(`Log analysis failed: ${error.message}`);
        }
    }
    
    async executeIndexFile(args) {
        try {
            const response = await fetch('http://localhost:3000/api/self-awareness/ingest', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ filePath: args.file_path, force: args.force })
            });
            return await response.json();
        } catch (error) {
            throw new Error(`File indexing failed: ${error.message}`);
        }
    }
    
    async executeSearchFiles(args) {
        try {
            const response = await fetch(`http://localhost:3000/api/self-awareness/files?type=${args.type || 'content'}&query=${encodeURIComponent(args.query)}`);
            return await response.json();
        } catch (error) {
            throw new Error(`File search failed: ${error.message}`);
        }
    }
    
    async executeGetMetrics(args) {
        try {
            const response = await fetch('http://localhost:3000/api/memory/metrics');
            const metricsData = await response.json();
            
            if (args.metric_type && args.metric_type !== 'all') {
                // Filtrer les métriques par type si demandé
                const filtered = {};
                if (metricsData[args.metric_type]) {
                    filtered[args.metric_type] = metricsData[args.metric_type];
                }
                return { metrics: filtered, type: args.metric_type };
            }
            
            return metricsData;
        } catch (error) {
            throw new Error(`Metrics retrieval failed: ${error.message}`);
        }
    }
    
    async executeServiceStatus(args) {
        try {
            const response = await fetch('http://localhost:3000/api/health');
            const healthData = await response.json();
            
            if (args.service) {
                // Filtrer pour un service spécifique
                const serviceData = healthData.services?.find(s => s.name === args.service);
                return serviceData ? { service: serviceData } : { error: `Service ${args.service} not found` };
            }
            
            return healthData;
        } catch (error) {
            throw new Error(`Service status check failed: ${error.message}`);
        }
    }
    
    // Utility Methods
    async executePythonScript(scriptPath, args) {
        return new Promise((resolve, reject) => {
            const pythonPath = path.join(this.projectRoot, 'venv/bin/python');
            const fullScriptPath = path.join(this.projectRoot, scriptPath);
            const process = spawn(pythonPath, [fullScriptPath, ...args]);
            
            let stdout = '';
            let stderr = '';
            
            process.stdout.on('data', (data) => stdout += data.toString());
            process.stderr.on('data', (data) => stderr += data.toString());
            
            process.on('close', (code) => {
                if (code === 0) {
                    try {
                        resolve(JSON.parse(stdout));
                    } catch (e) {
                        resolve({ output: stdout, raw: true });
                    }
                } else {
                    reject(new Error(`Script failed: ${stderr || stdout}`));
                }
            });
        });
    }
    
    async executeBashCommand(command) {
        return new Promise((resolve, reject) => {
            const process = spawn('bash', ['-c', command], { cwd: this.projectRoot });
            
            let stdout = '';
            let stderr = '';
            
            process.stdout.on('data', (data) => stdout += data.toString());
            process.stderr.on('data', (data) => stderr += data.toString());
            
            process.on('close', (code) => {
                resolve({ code, stdout, stderr });
            });
        });
    }
    
    async getSystemStatus() {
        try {
            const response = await fetch('http://localhost:3000/api/self-awareness/health');
            return await response.json();
        } catch (error) {
            return { error: error.message, available: false };
        }
    }
    
    async getToolUsageStats() {
        return {
            totalTools: this.internalTools.size,
            categories: Object.fromEntries(
                Object.entries(this.toolCategories).map(([cat, tools]) => [cat, tools.length])
            ),
            lastUpdated: new Date().toISOString()
        };
    }
    
    // Prompt Generation Methods
    async generateSystemDiagnosisPrompt(symptoms) {
        const systemStatus = await this.getSystemStatus();
        return {
            messages: [{
                role: 'user',
                content: {
                    type: 'text',
                    text: `Diagnose AutoWeave system issues.
                    
System Status: ${JSON.stringify(systemStatus, null, 2)}
Symptoms: ${symptoms || 'General health check requested'}
Available Tools: ${this.internalTools.size} tools across ${Object.keys(this.toolCategories).length} categories

Please analyze the system and suggest appropriate actions using available AutoWeave tools.`
                }
            }]
        };
    }
    
    async generatePerformanceOptimizationPrompt(focusArea) {
        const stats = await this.getToolUsageStats();
        return {
            messages: [{
                role: 'user',
                content: {
                    type: 'text',
                    text: `Optimize AutoWeave system performance.
                    
Focus Area: ${focusArea || 'general'}
Tool Statistics: ${JSON.stringify(stats, null, 2)}

Suggest optimization strategies using available AutoWeave tools.`
                }
            }]
        };
    }
    
    async generateIntegrationSetupPrompt(systemType, requirements) {
        return {
            messages: [{
                role: 'user',
                content: {
                    type: 'text',
                    text: `Setup integration with external system.
                    
System Type: ${systemType}
Requirements: ${requirements || 'Standard integration'}
Available Integration Tools: ${this.toolCategories.config.length + this.toolCategories.agents.length}

Provide step-by-step integration setup using AutoWeave tools.`
                }
            }]
        };
    }
}

module.exports = UnifiedAutoWeaveMCPServer;