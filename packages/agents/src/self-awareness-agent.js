const { Logger } = require('@autoweave/shared');
const { spawn } = require('child_process');
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const OSEnvironmentDetector = require('@autoweave/shared');

/**
 * SelfAwarenessAgent - Agent de conscience et synchronisation du système
 * 
 * Responsabilités:
 * - Vérifier la synchronisation DB/Fichiers
 * - Maintenir l'inventaire des outils disponibles
 * - Détecter et ingérer les nouveaux fichiers
 * - Préserver l'historique complet
 * - Informer le LLM de ses capacités
 */
class SelfAwarenessAgent {
    constructor() {
        this.logger = new Logger('SelfAwarenessAgent');
        this.initialized = false;
        
        // Configuration
        this.config = {
            scanInterval: parseInt(process.env.SELF_AWARENESS_SCAN_INTERVAL || '300000'), // 5 minutes
            autoSync: process.env.SELF_AWARENESS_AUTO_SYNC !== 'false',
            genomePath: path.join(__dirname, '../../.claude/hooks'),
            projectRoot: path.join(__dirname, '../..'),
            dbCheckScript: path.join(__dirname, '../../scripts/check-db-sync.py'),
            claudeMdPath: path.join(__dirname, '../../CLAUDE.md')
        };
        
        // État du système
        this.systemState = {
            tools: new Map(),
            files: new Map(),
            osEnvironment: null,
            dbSync: {
                lastCheck: null,
                status: 'unknown',
                discrepancies: []
            },
            capabilities: {
                hooks: [],
                apis: [],
                commands: [],
                databases: []
            }
        };
        
        // Démarrer l'agent
        this.initialize();
    }
    
    async initialize() {
        try {
            this.logger.info('🧠 Initializing Self-Awareness Agent...');
            
            // 1. Détecter l'environnement OS
            await this.detectOSEnvironment();
            
            // 2. Scanner le système
            await this.performFullSystemScan();
            
            // 3. Vérifier la synchronisation DB
            await this.checkDatabaseSync();
            
            // 3. Générer/Mettre à jour CLAUDE.md
            await this.updateSystemDocumentation();
            
            // 4. Démarrer la surveillance continue
            if (this.config.autoSync) {
                this.startContinuousMonitoring();
            }
            
            this.initialized = true;
            this.logger.success('✅ Self-Awareness Agent initialized successfully');
            
        } catch (error) {
            this.logger.error('Failed to initialize Self-Awareness Agent:', error);
        }
    }
    
    /**
     * Détecter l'environnement OS
     */
    async detectOSEnvironment() {
        this.logger.info('🖥️ Detecting OS environment...');
        
        try {
            const detector = new OSEnvironmentDetector();
            this.systemState.osEnvironment = await detector.detectComplete();
            
            // Générer la documentation pour Claude Code
            await detector.saveEnvironmentDocumentation();
            
            // Logger les informations importantes
            const env = this.systemState.osEnvironment;
            this.logger.info(`🖥️ OS: ${env.basic.distribution?.PRETTY_NAME || env.basic.platform}`);
            this.logger.info(`👤 User: ${env.permissions.currentUser} (${env.permissions.isRoot ? 'ROOT' : 'USER'})`);
            
            if (!env.permissions.canSudo && !env.permissions.isRoot) {
                this.logger.warn('⚠️ User has no sudo access - will use su for admin tasks');
            }
            
            this.logger.success('✅ OS environment detected');
            
        } catch (error) {
            this.logger.error('Failed to detect OS environment:', error);
            // Continuer même si la détection échoue
        }
    }
    
    /**
     * Scanner complet du système
     */
    async performFullSystemScan() {
        this.logger.info('🔍 Performing full system scan...');
        
        try {
            // 1. Scanner les outils disponibles
            await this.scanAvailableTools();
            
            // 2. Scanner les fichiers du projet
            await this.scanProjectFiles();
            
            // 3. Scanner les hooks génétiques
            await this.scanGeneticHooks();
            
            // 4. Scanner les capacités API
            await this.scanApiCapabilities();
            
            // Marquer comme initialisé après un scan réussi
            this.initialized = true;
            this.logger.success(`✅ System scan complete: ${this.systemState.files.size} files, ${this.systemState.tools.size} tools`);
            
        } catch (error) {
            this.logger.error('System scan failed:', error);
            // Ne pas marquer comme initialisé en cas d'erreur
            this.initialized = false;
        }
    }
    
    /**
     * Scanner les outils disponibles
     */
    async scanAvailableTools() {
        const toolCategories = {
            // Outils CLI globaux
            cli: ['node', 'npm', 'python', 'git', 'docker', 'kubectl', 'kagent'],
            
            // Scripts du projet
            scripts: await this.findProjectScripts(),
            
            // Hooks Claude
            hooks: await this.findClaudeHooks(),
            
            // APIs disponibles
            apis: await this.findAvailableAPIs()
        };
        
        for (const [category, tools] of Object.entries(toolCategories)) {
            for (const tool of tools) {
                const toolInfo = await this.analyzeToolCapabilities(tool, category);
                if (toolInfo) {
                    this.systemState.tools.set(tool, toolInfo);
                }
            }
        }
    }
    
    /**
     * Scanner les fichiers du projet
     */
    async scanProjectFiles() {
        const ignorePaths = [
            'node_modules',
            '.git',
            'dist',
            'build',
            'coverage',
            '.next',
            '__pycache__',
            'venv',
            '.env'
        ];
        
        const scanDir = async (dir) => {
            try {
                const entries = await fs.readdir(dir, { withFileTypes: true });
                
                for (const entry of entries) {
                    const fullPath = path.join(dir, entry.name);
                    const relativePath = path.relative(this.config.projectRoot, fullPath);
                    
                    // Ignorer certains chemins
                    if (ignorePaths.some(ignore => relativePath.includes(ignore))) {
                        continue;
                    }
                    
                    if (entry.isDirectory()) {
                        await scanDir(fullPath);
                    } else if (entry.isFile()) {
                        const fileInfo = await this.analyzeFile(fullPath);
                        if (fileInfo) {
                            this.systemState.files.set(relativePath, fileInfo);
                        }
                    }
                }
            } catch (error) {
                // Ignorer les erreurs de permission
            }
        };
        
        await scanDir(this.config.projectRoot);
    }
    
    /**
     * Analyser un fichier
     */
    async analyzeFile(filePath) {
        try {
            const stats = await fs.stat(filePath);
            const content = await fs.readFile(filePath, 'utf-8').catch(() => null);
            
            return {
                path: filePath,
                size: stats.size,
                modified: stats.mtime,
                hash: content ? this.calculateHash(content) : null,
                type: this.detectFileType(filePath),
                hasGeneticMarker: content ? content.includes('Gene ID:') : false,
                inDatabase: false // À vérifier avec la DB
            };
        } catch (error) {
            return null;
        }
    }
    
    /**
     * Vérifier la synchronisation avec la base de données
     */
    async checkDatabaseSync() {
        this.logger.info('🔄 Checking database synchronization...');
        
        try {
            // Utiliser le script Python de vérification
            const result = await this.executePythonScript(this.config.dbCheckScript, ['check-sync']);
            
            if (result.success) {
                const syncStatus = JSON.parse(result.output);
                
                this.systemState.dbSync = {
                    lastCheck: new Date(),
                    status: syncStatus.synchronized ? 'synchronized' : 'out-of-sync',
                    discrepancies: syncStatus.discrepancies || [],
                    stats: {
                        filesInDb: syncStatus.filesInDb,
                        filesOnDisk: syncStatus.filesOnDisk,
                        missingFromDb: syncStatus.missingFromDb,
                        missingFromDisk: syncStatus.missingFromDisk
                    }
                };
                
                // Si désynchronisé et auto-sync activé
                if (!syncStatus.synchronized && this.config.autoSync) {
                    await this.performAutoSync();
                }
                
                this.logger.info(`📊 DB Sync Status: ${this.systemState.dbSync.status}`);
                
            } else {
                this.logger.error('DB sync check failed:', result.error);
            }
            
        } catch (error) {
            this.logger.error('Failed to check DB sync:', error);
        }
    }
    
    /**
     * Effectuer une synchronisation automatique
     */
    async performAutoSync() {
        this.logger.info('🔧 Performing automatic synchronization...');
        
        const { discrepancies } = this.systemState.dbSync;
        
        for (const discrepancy of discrepancies) {
            try {
                switch (discrepancy.type) {
                    case 'missing_from_db':
                        // Indexer le fichier dans la DB
                        await this.indexFileInDatabase(discrepancy.file);
                        break;
                        
                    case 'missing_from_disk':
                        // Reconstruire depuis la DB si possible
                        await this.reconstructFileFromDatabase(discrepancy.file);
                        break;
                        
                    case 'content_mismatch':
                        // Résoudre le conflit (privilégier la version la plus récente)
                        await this.resolveContentConflict(discrepancy.file);
                        break;
                }
            } catch (error) {
                this.logger.error(`Failed to sync ${discrepancy.file}:`, error);
            }
        }
    }
    
    /**
     * Mettre à jour la documentation système (CLAUDE.md)
     */
    async updateSystemDocumentation() {
        this.logger.info('📝 Updating system documentation...');
        
        const documentation = this.generateSystemDocumentation();
        
        try {
            // Lire le CLAUDE.md existant
            let existingContent = '';
            try {
                existingContent = await fs.readFile(this.config.claudeMdPath, 'utf-8');
            } catch (e) {
                // Le fichier n'existe pas encore
            }
            
            // Ajouter ou mettre à jour la section Self-Awareness
            const updatedContent = this.updateClaudeMdContent(existingContent, documentation);
            
            // Écrire le fichier mis à jour
            await fs.writeFile(this.config.claudeMdPath, updatedContent);
            
            this.logger.success('✅ System documentation updated');
            
        } catch (error) {
            this.logger.error('Failed to update documentation:', error);
        }
    }
    
    /**
     * Générer la documentation du système
     */
    generateSystemDocumentation() {
        const tools = Array.from(this.systemState.tools.entries())
            .map(([name, info]) => `- **${name}**: ${info.description} (${info.category})`);
        
        const hooks = this.systemState.capabilities.hooks
            .map(h => `- **${h.name}**: ${h.description}`);
        
        const apis = this.systemState.capabilities.apis
            .map(a => `- **${a.endpoint}**: ${a.description}`);
        
        return `
## 🧠 System Self-Awareness Report

Generated: ${new Date().toISOString()}

### System Status
- **Files Tracked**: ${this.systemState.files.size}
- **Tools Available**: ${this.systemState.tools.size}
- **DB Sync Status**: ${this.systemState.dbSync.status}
- **Last Sync Check**: ${this.systemState.dbSync.lastCheck || 'Never'}

### Available Tools

${tools.join('\n')}

### Genetic Hooks

${hooks.join('\n') || 'No hooks configured'}

### API Endpoints

${apis.join('\n') || 'No APIs available'}

### IMPORTANT: Tool Usage Instructions

**Claude MUST use these tools when working with this codebase:**

1. **For file modifications**: Use the genetic hooks system
   - All edits are tracked with genetic markers
   - Use \`Edit\` or \`MultiEdit\` tools for modifications
   - Never create files without genetic tracking

2. **For database queries**: Use the DB reader tools
   - \`simple_db_reader.py\` for basic queries
   - \`db_reader.py\` for advanced searches
   - \`genetic_reconstructor.py\` for file reconstruction

3. **For system information**: Use self-awareness endpoints
   - \`GET /api/self-awareness/status\` - System status
   - \`GET /api/self-awareness/tools\` - Available tools
   - \`GET /api/self-awareness/sync\` - Sync status

### Database Synchronization

${this.systemState.dbSync.discrepancies.length > 0 ? 
`⚠️ **Warning**: ${this.systemState.dbSync.discrepancies.length} synchronization issues detected` :
'✅ Database and filesystem are synchronized'}

### Memory System

The system uses a genetic code approach where:
- Every function/class has a unique Gene ID
- All changes are tracked with full history
- Code can be reconstructed from any point in time
- Similar code patterns can be found using embeddings

**ALWAYS preserve this genetic tracking when modifying code!**
`;
    }
    
    /**
     * Scanner les hooks génétiques
     */
    async scanGeneticHooks() {
        try {
            const hooksDir = path.join(this.config.genomePath);
            const files = await fs.readdir(hooksDir);
            
            for (const file of files) {
                if (file.endsWith('.py') && file.includes('hook')) {
                    const hookPath = path.join(hooksDir, file);
                    const content = await fs.readFile(hookPath, 'utf-8');
                    
                    // Extraire les informations du hook
                    const hookInfo = {
                        name: file,
                        path: hookPath,
                        description: this.extractDocstring(content),
                        type: file.includes('pre_') ? 'pre' : 'post',
                        enabled: !content.includes('disabled=True')
                    };
                    
                    this.systemState.capabilities.hooks.push(hookInfo);
                }
            }
        } catch (error) {
            this.logger.error('Failed to scan genetic hooks:', error);
        }
    }
    
    /**
     * Scanner les capacités API
     */
    async scanApiCapabilities() {
        try {
            // Scanner les APIs AutoWeave
            const apis = await this.findAvailableAPIs();
            
            for (const api of apis) {
                const apiInfo = await this.analyzeAPI(api);
                if (apiInfo) {
                    this.systemState.capabilities.apis.push(apiInfo);
                }
            }
            
            // Scanner les capacités MCP
            await this.scanMCPCapabilities();
            
            // Scanner les capacités Kubernetes
            await this.scanKubernetesCapabilities();
            
        } catch (error) {
            this.logger.error('Failed to scan API capabilities:', error);
        }
    }
    
    /**
     * Scanner les capacités MCP
     */
    async scanMCPCapabilities() {
        try {
            // Tester l'endpoint MCP
            const mcpUrl = 'http://localhost:3002/mcp/v1';
            const response = await fetch(`${mcpUrl}/tools`);
            
            if (response.ok) {
                const tools = await response.json();
                this.systemState.capabilities.commands.push({
                    name: 'MCP Tools',
                    count: tools.tools ? tools.tools.length : 0,
                    endpoint: mcpUrl,
                    available: true
                });
            }
        } catch (error) {
            this.systemState.capabilities.commands.push({
                name: 'MCP Tools',
                available: false,
                error: error.message
            });
        }
    }
    
    /**
     * Scanner les capacités Kubernetes
     */
    async scanKubernetesCapabilities() {
        try {
            // Vérifier les namespaces et ressources
            const kubeInfo = {
                name: 'Kubernetes Integration',
                kagentNamespace: 'kagent-system',
                available: false
            };
            
            // Tester kubectl si disponible
            const kubectlTest = await this.executePythonScript(
                path.join(this.config.projectRoot, 'scripts/check-k8s.sh'),
                []
            );
            
            if (kubectlTest.success) {
                kubeInfo.available = true;
                kubeInfo.details = kubectlTest.output;
            }
            
            this.systemState.capabilities.databases.push(kubeInfo);
            
        } catch (error) {
            this.systemState.capabilities.databases.push({
                name: 'Kubernetes Integration',
                available: false,
                error: error.message
            });
        }
    }
    
    /**
     * Démarrer la surveillance continue
     */
    startContinuousMonitoring() {
        this.logger.info('👁️ Starting continuous monitoring...');
        
        // Scanner périodiquement
        setInterval(async () => {
            await this.checkForChanges();
        }, this.config.scanInterval);
        
        // Watcher sur les fichiers critiques
        this.watchCriticalFiles();
    }
    
    /**
     * Vérifier les changements
     */
    async checkForChanges() {
        try {
            // 1. Re-scanner les fichiers
            const oldFileCount = this.systemState.files.size;
            await this.scanProjectFiles();
            const newFileCount = this.systemState.files.size;
            
            if (newFileCount > oldFileCount) {
                this.logger.info(`📁 ${newFileCount - oldFileCount} new files detected`);
                
                // Ingérer les nouveaux fichiers
                await this.ingestNewFiles();
            }
            
            // 2. Vérifier la sync DB
            await this.checkDatabaseSync();
            
            // 3. Mettre à jour la documentation si nécessaire
            if (this.hasSignificantChanges()) {
                await this.updateSystemDocumentation();
            }
            
        } catch (error) {
            this.logger.error('Error during change check:', error);
        }
    }
    
    /**
     * Ingérer les nouveaux fichiers détectés
     */
    async ingestNewFiles() {
        const newFiles = [];
        
        for (const [path, info] of this.systemState.files.entries()) {
            if (!info.inDatabase && this.shouldIngestFile(path)) {
                newFiles.push(path);
            }
        }
        
        if (newFiles.length > 0) {
            this.logger.info(`🔄 Ingesting ${newFiles.length} new files...`);
            
            for (const filePath of newFiles) {
                try {
                    await this.indexFileInDatabase(filePath);
                    this.logger.success(`✅ Indexed: ${filePath}`);
                } catch (error) {
                    this.logger.error(`Failed to index ${filePath}:`, error);
                }
            }
        }
    }
    
    /**
     * Déterminer si un fichier doit être ingéré
     */
    shouldIngestFile(filePath) {
        // Fichiers de code source
        const codeExtensions = ['.js', '.ts', '.py', '.java', '.go', '.rs', '.c', '.cpp', '.h'];
        
        // Fichiers de configuration importants
        const configFiles = ['package.json', 'tsconfig.json', '.eslintrc', 'Dockerfile', 'docker-compose.yml'];
        
        const ext = path.extname(filePath);
        const basename = path.basename(filePath);
        
        return codeExtensions.includes(ext) || configFiles.includes(basename);
    }
    
    /**
     * Indexer un fichier dans la base de données
     */
    async indexFileInDatabase(filePath) {
        const result = await this.executePythonScript(
            path.join(this.config.genomePath, 'index_file.py'),
            ['index', filePath]
        );
        
        if (result.success) {
            const fileInfo = this.systemState.files.get(filePath);
            if (fileInfo) {
                fileInfo.inDatabase = true;
            }
        }
        
        return result.success;
    }
    
    /**
     * Reconstruire un fichier depuis la base de données
     */
    async reconstructFileFromDatabase(filePath) {
        const result = await this.executePythonScript(
            path.join(this.config.genomePath, 'genetic_reconstructor.py'),
            ['reconstruct-file', filePath]
        );
        
        return result.success;
    }
    
    /**
     * Exécuter un script Python
     */
    executePythonScript(scriptPath, args = []) {
        return new Promise((resolve) => {
            const pythonPath = path.join(this.config.projectRoot, 'venv/bin/python');
            const process = spawn(pythonPath, [scriptPath, ...args]);
            
            let stdout = '';
            let stderr = '';
            
            process.stdout.on('data', (data) => {
                stdout += data.toString();
            });
            
            process.stderr.on('data', (data) => {
                stderr += data.toString();
            });
            
            process.on('close', (code) => {
                resolve({
                    success: code === 0,
                    output: stdout,
                    error: stderr
                });
            });
        });
    }
    
    /**
     * Calculer le hash d'un contenu
     */
    calculateHash(content) {
        return crypto.createHash('sha256').update(content).digest('hex').substring(0, 8);
    }
    
    /**
     * Détecter le type de fichier
     */
    detectFileType(filePath) {
        const ext = path.extname(filePath);
        const typeMap = {
            '.js': 'javascript',
            '.ts': 'typescript',
            '.py': 'python',
            '.json': 'json',
            '.md': 'markdown',
            '.yml': 'yaml',
            '.yaml': 'yaml'
        };
        
        return typeMap[ext] || 'unknown';
    }
    
    /**
     * Extraire la docstring d'un fichier Python
     */
    extractDocstring(content) {
        const match = content.match(/"""([\s\S]*?)"""/);
        if (match) {
            return match[1].trim().split('\n')[0];
        }
        return 'No description';
    }
    
    /**
     * Obtenir l'état du système
     */
    getSystemState() {
        return {
            initialized: this.initialized,
            files: this.systemState.files.size,
            tools: this.systemState.tools.size,
            osEnvironment: this.systemState.osEnvironment,
            dbSync: this.systemState.dbSync,
            capabilities: this.systemState.capabilities,
            lastUpdate: new Date(),
            // Serialized versions pour l'API
            serialized: {
                tools: Array.from(this.systemState.tools.entries()).map(([name, info]) => ({name, ...info})),
                files: Array.from(this.systemState.files.entries()).slice(0, 100).map(([path, info]) => ({path, ...info})) // Limite pour perf
            }
        };
    }
    
    /**
     * Forcer une synchronisation
     */
    async forceSynchronization() {
        this.logger.info('🔄 Forcing full synchronization...');
        
        await this.performFullSystemScan();
        await this.checkDatabaseSync();
        await this.updateSystemDocumentation();
        
        return this.getSystemState();
    }
    
    /**
     * Trouver les scripts du projet
     */
    async findProjectScripts() {
        const scripts = [];
        
        // Scripts du package.json
        try {
            const packagePath = path.join(this.config.projectRoot, 'package.json');
            const packageData = JSON.parse(await fs.readFile(packagePath, 'utf-8'));
            if (packageData.scripts) {
                scripts.push(...Object.keys(packageData.scripts).map(name => ({
                    name: `npm run ${name}`,
                    type: 'npm',
                    command: packageData.scripts[name]
                })));
            }
        } catch (error) {
            // Ignorer si package.json n'existe pas
        }
        
        // Scripts Python dans le dossier scripts/
        try {
            const scriptsDir = path.join(this.config.projectRoot, 'scripts');
            const scriptFiles = await fs.readdir(scriptsDir);
            
            for (const file of scriptFiles) {
                if (file.endsWith('.py') || file.endsWith('.sh')) {
                    scripts.push({
                        name: file,
                        type: file.endsWith('.py') ? 'python' : 'shell',
                        path: path.join(scriptsDir, file)
                    });
                }
            }
        } catch (error) {
            // Ignorer si le dossier scripts/ n'existe pas
        }
        
        return scripts;
    }
    
    /**
     * Trouver les hooks Claude
     */
    async findClaudeHooks() {
        const hooks = [];
        
        try {
            const hooksDir = path.join(this.config.projectRoot, '.claude/hooks');
            const hookFiles = await fs.readdir(hooksDir);
            
            for (const file of hookFiles) {
                if (file.endsWith('.py')) {
                    const hookPath = path.join(hooksDir, file);
                    const content = await fs.readFile(hookPath, 'utf-8');
                    
                    hooks.push({
                        name: file,
                        type: 'claude-hook',
                        path: hookPath,
                        hasGeneticFeature: content.includes('genetic') || content.includes('Gene ID'),
                        enabled: !file.includes('disabled')
                    });
                }
            }
        } catch (error) {
            // Ignorer si les hooks n'existent pas
        }
        
        return hooks;
    }
    
    /**
     * Trouver les APIs disponibles
     */
    async findAvailableAPIs() {
        const apis = [];
        
        // AutoWeave API
        apis.push({
            name: 'AutoWeave Main API',
            url: 'http://localhost:3000/api',
            type: 'main',
            endpoints: ['/agents', '/memory', '/chat', '/health', '/self-awareness']
        });
        
        // ANP Server
        apis.push({
            name: 'ANP Server',
            url: 'http://localhost:8083',
            type: 'anp',
            endpoints: ['/agent', '/agent/tasks', '/agent/capabilities']
        });
        
        // MCP Server
        apis.push({
            name: 'MCP Server',
            url: 'http://localhost:3002',
            type: 'mcp',
            endpoints: ['/mcp/v1', '/mcp/v1/tools']
        });
        
        // Qdrant
        try {
            const qdrantUrl = `http://${process.env.QDRANT_HOST || 'localhost'}:${process.env.QDRANT_PORT || '6333'}`;
            apis.push({
                name: 'Qdrant Vector DB',
                url: qdrantUrl,
                type: 'database',
                endpoints: ['/collections']
            });
        } catch (error) {
            // Ignorer si Qdrant n'est pas disponible
        }
        
        return apis;
    }
    
    /**
     * Analyser les capacités d'un outil
     */
    async analyzeToolCapabilities(tool, category) {
        try {
            switch (category) {
                case 'cli':
                    return await this.analyzeCLITool(tool);
                    
                case 'scripts':
                    return await this.analyzeScript(tool);
                    
                case 'hooks':
                    return await this.analyzeHook(tool);
                    
                case 'apis':
                    return await this.analyzeAPI(tool);
                    
                default:
                    return null;
            }
        } catch (error) {
            this.logger.debug(`Failed to analyze tool ${tool}:`, error);
            return null;
        }
    }
    
    /**
     * Analyser un outil CLI
     */
    async analyzeCLITool(toolName) {
        return new Promise((resolve) => {
            const { spawn } = require('child_process');
            const process = spawn('which', [toolName]);
            
            let output = '';
            process.stdout.on('data', (data) => {
                output += data.toString();
            });
            
            process.on('close', (code) => {
                if (code === 0) {
                    resolve({
                        name: toolName,
                        category: 'cli',
                        available: true,
                        path: output.trim(),
                        type: 'command'
                    });
                } else {
                    resolve({
                        name: toolName,
                        category: 'cli',
                        available: false,
                        type: 'command'
                    });
                }
            });
            
            // Timeout après 2 secondes
            setTimeout(() => {
                process.kill();
                resolve(null);
            }, 2000);
        });
    }
    
    /**
     * Analyser un script
     */
    async analyzeScript(scriptInfo) {
        if (typeof scriptInfo === 'string') {
            return {
                name: scriptInfo,
                category: 'scripts',
                available: true,
                type: 'unknown'
            };
        }
        
        return {
            name: scriptInfo.name,
            category: 'scripts',
            available: true,
            type: scriptInfo.type,
            path: scriptInfo.path,
            command: scriptInfo.command
        };
    }
    
    /**
     * Analyser un hook
     */
    async analyzeHook(hookInfo) {
        return {
            name: hookInfo.name,
            category: 'hooks',
            available: true,
            type: hookInfo.type,
            path: hookInfo.path,
            hasGeneticFeature: hookInfo.hasGeneticFeature,
            enabled: hookInfo.enabled
        };
    }
    
    /**
     * Analyser une API
     */
    async analyzeAPI(apiInfo) {
        try {
            // Tester la disponibilité de l'API avec un timeout court
            const response = await Promise.race([
                fetch(apiInfo.url, { method: 'HEAD' }),
                new Promise((_, reject) => 
                    setTimeout(() => reject(new Error('timeout')), 1000)
                )
            ]);
            
            return {
                name: apiInfo.name,
                category: 'apis',
                available: response.ok,
                type: apiInfo.type,
                url: apiInfo.url,
                endpoints: apiInfo.endpoints,
                status: response.status
            };
        } catch (error) {
            return {
                name: apiInfo.name,
                category: 'apis',
                available: false,
                type: apiInfo.type,
                url: apiInfo.url,
                endpoints: apiInfo.endpoints,
                error: error.message
            };
        }
    }
}

// Export singleton
module.exports = new SelfAwarenessAgent();