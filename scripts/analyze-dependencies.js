#!/usr/bin/env node

const fs = require('fs').promises;
const path = require('path');

/**
 * Analyze dependencies for each package in the monorepo
 */

class DependencyAnalyzer {
    constructor() {
        this.packages = ['core', 'memory', 'agents', 'backend', 'integrations', 'cli', 'deployment', 'shared'];
        this.externalDeps = new Map();
        this.internalDeps = new Map();
    }

    async analyze() {
        console.log('📊 Analyzing package dependencies...\n');
        
        for (const pkg of this.packages) {
            await this.analyzePackage(pkg);
        }
        
        await this.generatePackageJsonFiles();
        console.log('\n✅ Package.json files updated with dependencies');
    }

    async analyzePackage(packageName) {
        console.log(`\n📦 Analyzing ${packageName}...`);
        
        const packagePath = path.join('packages', packageName);
        const srcPath = path.join(packagePath, 'src');
        
        const external = new Set();
        const internal = new Set();
        
        try {
            const files = await this.getAllJsFiles(srcPath);
            
            for (const file of files) {
                const content = await fs.readFile(file, 'utf8');
                const deps = this.extractDependencies(content);
                
                deps.forEach(dep => {
                    if (dep.startsWith('@autoweave/')) {
                        internal.add(dep);
                    } else if (!dep.startsWith('.') && !dep.startsWith('/')) {
                        // Map common Node.js built-ins
                        if (!this.isBuiltinModule(dep)) {
                            external.add(dep);
                        }
                    }
                });
            }
            
            this.externalDeps.set(packageName, Array.from(external));
            this.internalDeps.set(packageName, Array.from(internal));
            
            console.log(`  External: ${external.size} dependencies`);
            console.log(`  Internal: ${internal.size} workspace dependencies`);
            
        } catch (error) {
            console.error(`  Error analyzing ${packageName}:`, error.message);
        }
    }

    extractDependencies(content) {
        const deps = new Set();
        
        // CommonJS requires
        const requireRegex = /require\(['"]([^'"]+)['"]\)/g;
        let match;
        while ((match = requireRegex.exec(content)) !== null) {
            deps.add(match[1]);
        }
        
        // ES6 imports
        const importRegex = /import\s+(?:.*\s+from\s+)?['"]([^'"]+)['"]/g;
        while ((match = importRegex.exec(content)) !== null) {
            deps.add(match[1]);
        }
        
        return deps;
    }

    isBuiltinModule(module) {
        const builtins = [
            'fs', 'path', 'crypto', 'http', 'https', 'url', 'util', 
            'stream', 'events', 'os', 'child_process', 'cluster',
            'net', 'dgram', 'dns', 'tls', 'readline', 'repl',
            'vm', 'assert', 'buffer', 'process', 'console'
        ];
        return builtins.includes(module.split('/')[0]);
    }

    async getAllJsFiles(dir) {
        const files = [];
        
        try {
            const items = await fs.readdir(dir, { withFileTypes: true });
            
            for (const item of items) {
                const fullPath = path.join(dir, item.name);
                
                if (item.isDirectory()) {
                    files.push(...await this.getAllJsFiles(fullPath));
                } else if (item.name.endsWith('.js')) {
                    files.push(fullPath);
                }
            }
        } catch (error) {
            // Directory might not exist
        }
        
        return files;
    }

    async generatePackageJsonFiles() {
        // Known dependency versions from the main package.json
        const knownVersions = {
            'express': '^4.18.2',
            'ws': '^8.13.0',
            'openai': '^4.0.0',
            'ioredis': '^5.3.2',
            'neo4j-driver': '^5.9.0',
            '@qdrant/js-client-rest': '^1.2.0',
            'winston': '^3.8.2',
            'dotenv': '^16.0.3',
            'uuid': '^9.0.0',
            'axios': '^1.4.0',
            'yaml': '^2.3.1',
            'simple-git': '^3.19.0',
            'swagger-parser': '^10.0.3',
            'inquirer': '^9.2.0',
            'commander': '^11.0.0',
            'chalk': '^5.2.0',
            'jest': '^29.5.0',
            'eslint': '^8.42.0',
            'prettier': '^2.8.8'
        };

        for (const pkg of this.packages) {
            const packagePath = path.join('packages', pkg);
            const packageJsonPath = path.join(packagePath, 'package.json');
            
            // Read existing package.json
            const existing = JSON.parse(await fs.readFile(packageJsonPath, 'utf8'));
            
            // Update dependencies
            const external = this.externalDeps.get(pkg) || [];
            const internal = this.internalDeps.get(pkg) || [];
            
            existing.dependencies = {};
            
            // Add workspace dependencies
            internal.forEach(dep => {
                existing.dependencies[dep] = 'workspace:*';
            });
            
            // Add external dependencies with known versions
            external.forEach(dep => {
                const depName = dep.split('/')[0]; // Handle scoped packages
                existing.dependencies[dep] = knownVersions[depName] || 'latest';
            });
            
            // Add specific dev dependencies based on package
            if (pkg !== 'deployment') {
                existing.devDependencies = {
                    'jest': knownVersions['jest'],
                    'eslint': knownVersions['eslint']
                };
            }
            
            // Add main entry point if not present
            if (!existing.main) {
                existing.main = './src/index.js';
            }
            
            // Add test script if not present
            if (!existing.scripts) {
                existing.scripts = {};
            }
            if (!existing.scripts.test) {
                existing.scripts.test = 'jest';
            }
            
            // Write updated package.json
            await fs.writeFile(
                packageJsonPath,
                JSON.stringify(existing, null, 2) + '\n'
            );
            
            console.log(`\n✅ Updated ${pkg}/package.json`);
            if (external.length > 0) {
                console.log(`   External: ${external.join(', ')}`);
            }
            if (internal.length > 0) {
                console.log(`   Internal: ${internal.join(', ')}`);
            }
        }
    }
}

// Run the analyzer
const analyzer = new DependencyAnalyzer();
analyzer.analyze().catch(console.error);