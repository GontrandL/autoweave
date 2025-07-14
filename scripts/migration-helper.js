#!/usr/bin/env node

const fs = require('fs').promises;
const path = require('path');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

/**
 * AutoWeave Migration Helper
 * Automates the migration from dual structure to unified monorepo
 */

class MigrationHelper {
    constructor() {
        this.divergedFiles = [
            { name: 'autoweave.js', src: 'src/core/autoweave.js', repo: '../autoweave-repos/autoweave-core/src/core/autoweave.js' },
            { name: 'agent-weaver.js', src: 'src/core/agent-weaver.js', repo: '../autoweave-repos/autoweave-core/src/core/agent-weaver.js' },
            { name: 'hybrid-memory.js', src: 'src/memory/hybrid-memory.js', repo: '../autoweave-repos/autoweave-memory/src/memory/hybrid-memory.js' },
            { name: 'mem0-client.js', src: 'src/memory/mem0-client.js', repo: '../autoweave-repos/autoweave-memory/src/memory/mem0-client.js' },
            { name: 'langchain-orchestrator.js', src: 'src/agents/integration-agent/langchain-orchestrator.js', repo: '../autoweave-repos/autoweave-agents/src/agents/integration-agent/langchain-orchestrator.js' },
            { name: 'unified-autoweave-mcp-server.js', src: 'src/mcp/unified-autoweave-mcp-server.js', repo: '../autoweave-repos/autoweave-integrations/src/mcp/unified-autoweave-mcp-server.js' },
            { name: 'coding-memory-manager.js', src: 'src/memory/coding/coding-memory-manager.js', repo: '../autoweave-repos/autoweave-backend/src/memory/coding/coding-memory-manager.js' },
            { name: 'create-agent.js', src: 'src/cli/create-agent.js', repo: '../autoweave-repos/autoweave-cli/src/commands/create-agent.js' },
            { name: 'logger.js', src: 'src/utils/logger.js', repo: '../autoweave-repos/autoweave-core/src/utils/logger.js' },
            { name: 'coding-memory.js', src: 'src/routes/coding-memory.js', repo: '../autoweave-repos/autoweave-backend/src/routes/coding-memory.js' }
        ];
        
        this.packageMapping = {
            'core': ['autoweave.js', 'agent-weaver.js', 'config-intelligence.js', 'logger.js'],
            'memory': ['hybrid-memory.js', 'mem0-client.js', 'memgraph-client.js', 'redis-ml-cache.js', 'coding-memory-manager.js'],
            'agents': ['debugging-agent', 'integration-agent', 'performance-agent', 'security-agent', 'testing-agent'],
            'backend': ['routes', 'middleware', 'services'],
            'integrations': ['mcp', 'anp', 'protocols'],
            'cli': ['commands', 'utils'],
            'deployment': ['k8s', 'docker', 'helm'],
            'shared': ['utils', 'types', 'constants']
        };
    }

    async run() {
        console.log('🚀 AutoWeave Migration Helper\n');
        
        const action = process.argv[2];
        
        switch (action) {
            case 'analyze':
                await this.analyzeDivergence();
                break;
            case 'prepare':
                await this.prepareStructure();
                break;
            case 'migrate':
                const packageName = process.argv[3];
                if (!packageName) {
                    console.error('Please specify a package to migrate: core, memory, agents, etc.');
                    process.exit(1);
                }
                await this.migratePackage(packageName);
                break;
            case 'validate':
                await this.validateMigration();
                break;
            case 'update-imports':
                await this.updateImports();
                break;
            default:
                this.showHelp();
        }
    }

    showHelp() {
        console.log(`
Usage: node migration-helper.js <command> [options]

Commands:
  analyze         Analyze divergence between /src and /autoweave-repos
  prepare         Prepare the new monorepo structure
  migrate <pkg>   Migrate a specific package (core, memory, agents, etc.)
  validate        Validate the migration
  update-imports  Update all import paths to use workspace references

Examples:
  node migration-helper.js analyze
  node migration-helper.js prepare
  node migration-helper.js migrate core
  node migration-helper.js validate
        `);
    }

    async analyzeDivergence() {
        console.log('📊 Analyzing file divergence...\n');
        
        for (const file of this.divergedFiles) {
            try {
                const srcExists = await this.fileExists(file.src);
                const repoExists = await this.fileExists(file.repo);
                
                if (srcExists && repoExists) {
                    const srcContent = await fs.readFile(file.src, 'utf8');
                    const repoContent = await fs.readFile(file.repo, 'utf8');
                    
                    if (srcContent === repoContent) {
                        console.log(`✅ ${file.name}: Identical`);
                    } else {
                        console.log(`⚠️  ${file.name}: Diverged`);
                        await this.analyzeDifferences(file);
                    }
                } else {
                    console.log(`❌ ${file.name}: Missing in ${!srcExists ? 'src' : 'repo'}`);
                }
            } catch (error) {
                console.error(`Error analyzing ${file.name}:`, error.message);
            }
        }
    }

    async analyzeDifferences(file) {
        try {
            const { stdout } = await execPromise(`diff -u "${file.src}" "${file.repo}" | head -20`);
            console.log(`   Differences preview:\n${stdout}\n`);
        } catch (error) {
            // diff returns non-zero when files differ, which is expected
        }
    }

    async prepareStructure() {
        console.log('📁 Preparing new monorepo structure...\n');
        
        const packages = Object.keys(this.packageMapping);
        
        for (const pkg of packages) {
            const pkgPath = path.join('packages', pkg);
            
            try {
                await fs.mkdir(pkgPath, { recursive: true });
                await fs.mkdir(path.join(pkgPath, 'src'), { recursive: true });
                await fs.mkdir(path.join(pkgPath, 'tests'), { recursive: true });
                
                // Create package.json
                const packageJson = {
                    name: `@autoweave/${pkg}`,
                    version: '1.0.0',
                    type: 'module',
                    main: './src/index.js',
                    scripts: {
                        test: 'jest',
                        build: 'echo "No build step"',
                        lint: 'eslint src'
                    },
                    dependencies: {},
                    devDependencies: {}
                };
                
                await fs.writeFile(
                    path.join(pkgPath, 'package.json'),
                    JSON.stringify(packageJson, null, 2)
                );
                
                console.log(`✅ Created package: @autoweave/${pkg}`);
            } catch (error) {
                console.error(`❌ Error creating ${pkg}:`, error.message);
            }
        }
        
        // Create root workspace configuration
        await this.createWorkspaceConfig();
    }

    async createWorkspaceConfig() {
        const workspacePackage = {
            name: 'autoweave',
            version: '2.0.0',
            private: true,
            workspaces: [
                'packages/*'
            ],
            scripts: {
                test: 'turbo run test',
                build: 'turbo run build',
                lint: 'turbo run lint',
                dev: 'turbo run dev --parallel',
                'type-check': 'turbo run type-check'
            },
            devDependencies: {
                'turbo': '^1.13.0',
                '@types/node': '^20.0.0',
                'typescript': '^5.0.0',
                'eslint': '^8.0.0',
                'prettier': '^3.0.0'
            }
        };
        
        await fs.writeFile(
            'package.json.workspace',
            JSON.stringify(workspacePackage, null, 2)
        );
        
        console.log('\n✅ Created workspace configuration');
    }

    async migratePackage(packageName) {
        console.log(`📦 Migrating ${packageName} package...\n`);
        
        const files = this.packageMapping[packageName];
        if (!files) {
            console.error(`Unknown package: ${packageName}`);
            return;
        }
        
        const targetDir = path.join('packages', packageName, 'src');
        
        for (const fileName of files) {
            // Find the file in both locations
            const srcPath = await this.findFile('src', fileName);
            const repoPath = await this.findFile('../autoweave-repos', fileName);
            
            if (srcPath || repoPath) {
                await this.migrateFile(fileName, srcPath, repoPath, targetDir, packageName);
            } else {
                console.log(`⚠️  ${fileName}: Not found in either location`);
            }
        }
        
        console.log(`\n✅ Migration of ${packageName} complete`);
    }

    async migrateFile(fileName, srcPath, repoPath, targetDir, packageName) {
        let sourcePath;
        let sourceType;
        
        // Determine which version to use
        if (srcPath && repoPath) {
            // File exists in both - need to merge or choose
            const choice = await this.chooseBestVersion(fileName, srcPath, repoPath);
            sourcePath = choice.path;
            sourceType = choice.type;
        } else if (srcPath) {
            sourcePath = srcPath;
            sourceType = 'src';
        } else {
            sourcePath = repoPath;
            sourceType = 'repo';
        }
        
        // Copy to new location
        const targetPath = path.join(targetDir, fileName);
        await fs.mkdir(path.dirname(targetPath), { recursive: true });
        
        const content = await fs.readFile(sourcePath, 'utf8');
        const updatedContent = this.updateImportPaths(content, packageName);
        
        await fs.writeFile(targetPath, updatedContent);
        console.log(`✅ Migrated ${fileName} from ${sourceType} to ${targetPath}`);
    }

    async chooseBestVersion(fileName, srcPath, repoPath) {
        // For now, use simple heuristics
        // In practice, this would be more sophisticated
        
        const srcStats = await fs.stat(srcPath);
        const repoStats = await fs.stat(repoPath);
        
        // Prefer newer file by default
        if (srcStats.mtime > repoStats.mtime) {
            return { path: srcPath, type: 'src' };
        } else {
            return { path: repoPath, type: 'repo' };
        }
    }

    updateImportPaths(content, packageName) {
        // Update relative imports to workspace imports
        content = content.replace(
            /from ['"]\.\.\/([^'"]+)['"]/g,
            (match, importPath) => {
                const targetPackage = this.resolvePackage(importPath);
                if (targetPackage && targetPackage !== packageName) {
                    return `from '@autoweave/${targetPackage}'`;
                }
                return match;
            }
        );
        
        // Update require statements
        content = content.replace(
            /require\(['"]\.\.\/([^'"]+)['"]\)/g,
            (match, importPath) => {
                const targetPackage = this.resolvePackage(importPath);
                if (targetPackage && targetPackage !== packageName) {
                    return `require('@autoweave/${targetPackage}')`;
                }
                return match;
            }
        );
        
        return content;
    }

    resolvePackage(importPath) {
        // Determine which package an import path belongs to
        if (importPath.includes('memory')) return 'memory';
        if (importPath.includes('agents')) return 'agents';
        if (importPath.includes('routes')) return 'backend';
        if (importPath.includes('mcp') || importPath.includes('anp')) return 'integrations';
        if (importPath.includes('utils')) return 'shared';
        return 'core';
    }

    async findFile(baseDir, fileName) {
        try {
            const { stdout } = await execPromise(`find ${baseDir} -name "${fileName}" -type f | head -1`);
            return stdout.trim() || null;
        } catch (error) {
            return null;
        }
    }

    async fileExists(filePath) {
        try {
            await fs.access(filePath);
            return true;
        } catch {
            return false;
        }
    }

    async validateMigration() {
        console.log('🔍 Validating migration...\n');
        
        const packages = Object.keys(this.packageMapping);
        let allValid = true;
        
        for (const pkg of packages) {
            const pkgPath = path.join('packages', pkg);
            const valid = await this.validatePackage(pkgPath);
            
            if (valid) {
                console.log(`✅ ${pkg}: Valid`);
            } else {
                console.log(`❌ ${pkg}: Invalid`);
                allValid = false;
            }
        }
        
        if (allValid) {
            console.log('\n✅ All packages validated successfully!');
        } else {
            console.log('\n❌ Validation failed. Please check the errors above.');
        }
    }

    async validatePackage(pkgPath) {
        try {
            // Check package.json exists
            await fs.access(path.join(pkgPath, 'package.json'));
            
            // Check src directory exists
            await fs.access(path.join(pkgPath, 'src'));
            
            // Could add more validation here (linting, tests, etc.)
            
            return true;
        } catch {
            return false;
        }
    }

    async updateImports() {
        console.log('🔄 Updating all import paths...\n');
        
        const packages = Object.keys(this.packageMapping);
        
        for (const pkg of packages) {
            const pkgPath = path.join('packages', pkg, 'src');
            await this.updatePackageImports(pkgPath, pkg);
        }
        
        console.log('✅ Import paths updated');
    }

    async updatePackageImports(pkgPath, packageName) {
        try {
            const files = await this.getAllFiles(pkgPath);
            
            for (const file of files) {
                if (file.endsWith('.js') || file.endsWith('.ts')) {
                    const content = await fs.readFile(file, 'utf8');
                    const updated = this.updateImportPaths(content, packageName);
                    
                    if (content !== updated) {
                        await fs.writeFile(file, updated);
                        console.log(`✅ Updated imports in ${file}`);
                    }
                }
            }
        } catch (error) {
            console.error(`Error updating imports in ${pkgPath}:`, error.message);
        }
    }

    async getAllFiles(dir) {
        const files = [];
        const items = await fs.readdir(dir, { withFileTypes: true });
        
        for (const item of items) {
            const fullPath = path.join(dir, item.name);
            
            if (item.isDirectory()) {
                files.push(...await this.getAllFiles(fullPath));
            } else {
                files.push(fullPath);
            }
        }
        
        return files;
    }
}

// Run the migration helper
const helper = new MigrationHelper();
helper.run().catch(console.error);