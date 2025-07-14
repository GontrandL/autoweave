#!/usr/bin/env node

const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

/**
 * AutoWeave Codebase Audit Tool
 * Analyzes the entire codebase structure and generates a comprehensive report
 */

class CodebaseAuditor {
    constructor() {
        this.stats = {
            totalFiles: 0,
            filesByType: {},
            duplicates: [],
            modules: {},
            dependencies: {},
            issues: [],
            srcFiles: [],
            repoFiles: []
        };
    }

    async audit() {
        console.log('🔍 AutoWeave Codebase Audit Starting...\n');
        
        // Analyze both directory structures
        await this.analyzeDirectory('./src', 'src');
        await this.analyzeDirectory('../autoweave-repos', 'repos');
        
        // Compare and find duplicates
        await this.findDuplicates();
        
        // Analyze dependencies
        await this.analyzeDependencies();
        
        // Check for common issues
        await this.checkCommonIssues();
        
        // Generate report
        await this.generateReport();
    }

    async analyzeDirectory(dir, type) {
        try {
            const items = await fs.readdir(dir, { withFileTypes: true });
            
            for (const item of items) {
                const fullPath = path.join(dir, item.name);
                
                if (item.isDirectory()) {
                    // Skip node_modules and other build directories
                    if (['node_modules', '.git', 'dist', 'build', '.turbo'].includes(item.name)) {
                        continue;
                    }
                    
                    // Recursively analyze subdirectories
                    await this.analyzeDirectory(fullPath, type);
                } else if (item.isFile()) {
                    await this.analyzeFile(fullPath, type);
                }
            }
        } catch (error) {
            this.stats.issues.push({
                type: 'directory_error',
                path: dir,
                error: error.message
            });
        }
    }

    async analyzeFile(filePath, source) {
        const ext = path.extname(filePath);
        const fileName = path.basename(filePath);
        
        // Update file type statistics
        this.stats.filesByType[ext] = (this.stats.filesByType[ext] || 0) + 1;
        this.stats.totalFiles++;
        
        // Track source files
        if (['.js', '.ts', '.jsx', '.tsx', '.py'].includes(ext)) {
            const content = await fs.readFile(filePath, 'utf8');
            const hash = crypto.createHash('md5').update(content).digest('hex');
            
            const fileInfo = {
                path: filePath,
                name: fileName,
                size: content.length,
                hash: hash,
                source: source,
                imports: this.extractImports(content, ext),
                exports: this.extractExports(content, ext)
            };
            
            if (source === 'src') {
                this.stats.srcFiles.push(fileInfo);
            } else {
                this.stats.repoFiles.push(fileInfo);
            }
        }
        
        // Check for package.json files
        if (fileName === 'package.json') {
            await this.analyzePackageJson(filePath);
        }
    }

    extractImports(content, ext) {
        const imports = [];
        
        if (['.js', '.jsx', '.ts', '.tsx'].includes(ext)) {
            // CommonJS requires
            const requireRegex = /require\(['"]([^'"]+)['"]\)/g;
            let match;
            while ((match = requireRegex.exec(content)) !== null) {
                imports.push(match[1]);
            }
            
            // ES6 imports
            const importRegex = /import\s+(?:.*\s+from\s+)?['"]([^'"]+)['"]/g;
            while ((match = importRegex.exec(content)) !== null) {
                imports.push(match[1]);
            }
        } else if (ext === '.py') {
            // Python imports
            const pythonImportRegex = /(?:from\s+(\S+)\s+)?import\s+(\S+)/g;
            let match;
            while ((match = pythonImportRegex.exec(content)) !== null) {
                imports.push(match[1] || match[2]);
            }
        }
        
        return [...new Set(imports)];
    }

    extractExports(content, ext) {
        const exports = [];
        
        if (['.js', '.jsx', '.ts', '.tsx'].includes(ext)) {
            // CommonJS exports
            if (content.includes('module.exports')) {
                exports.push('default');
            }
            
            // ES6 named exports
            const namedExportRegex = /export\s+(?:const|let|var|function|class)\s+(\w+)/g;
            let match;
            while ((match = namedExportRegex.exec(content)) !== null) {
                exports.push(match[1]);
            }
            
            // ES6 default export
            if (/export\s+default/.test(content)) {
                exports.push('default');
            }
        }
        
        return exports;
    }

    async analyzePackageJson(filePath) {
        try {
            const content = await fs.readFile(filePath, 'utf8');
            const pkg = JSON.parse(content);
            
            const moduleName = pkg.name || path.dirname(filePath);
            
            this.stats.modules[moduleName] = {
                path: filePath,
                version: pkg.version,
                dependencies: Object.keys(pkg.dependencies || {}),
                devDependencies: Object.keys(pkg.devDependencies || {}),
                scripts: Object.keys(pkg.scripts || {}),
                main: pkg.main,
                type: pkg.type
            };
            
            // Track all dependencies
            Object.keys(pkg.dependencies || {}).forEach(dep => {
                this.stats.dependencies[dep] = (this.stats.dependencies[dep] || 0) + 1;
            });
            
        } catch (error) {
            this.stats.issues.push({
                type: 'package_json_error',
                path: filePath,
                error: error.message
            });
        }
    }

    async findDuplicates() {
        // Compare files by hash to find exact duplicates
        const filesByHash = {};
        
        [...this.stats.srcFiles, ...this.stats.repoFiles].forEach(file => {
            if (!filesByHash[file.hash]) {
                filesByHash[file.hash] = [];
            }
            filesByHash[file.hash].push(file);
        });
        
        // Find duplicates
        Object.values(filesByHash).forEach(files => {
            if (files.length > 1) {
                this.stats.duplicates.push({
                    hash: files[0].hash,
                    files: files.map(f => ({
                        path: f.path,
                        source: f.source,
                        size: f.size
                    }))
                });
            }
        });
        
        // Find similar files by name
        const filesByName = {};
        [...this.stats.srcFiles, ...this.stats.repoFiles].forEach(file => {
            if (!filesByName[file.name]) {
                filesByName[file.name] = [];
            }
            filesByName[file.name].push(file);
        });
        
        // Check for same-named files with different content
        Object.entries(filesByName).forEach(([name, files]) => {
            if (files.length > 1) {
                const uniqueHashes = new Set(files.map(f => f.hash));
                if (uniqueHashes.size > 1) {
                    this.stats.issues.push({
                        type: 'diverged_files',
                        name: name,
                        locations: files.map(f => ({
                            path: f.path,
                            source: f.source,
                            hash: f.hash
                        }))
                    });
                }
            }
        });
    }

    async analyzeDependencies() {
        // Find circular dependencies
        const dependencyGraph = {};
        
        [...this.stats.srcFiles, ...this.stats.repoFiles].forEach(file => {
            file.imports.forEach(imp => {
                if (imp.startsWith('.') || imp.startsWith('@autoweave')) {
                    if (!dependencyGraph[file.path]) {
                        dependencyGraph[file.path] = [];
                    }
                    dependencyGraph[file.path].push(imp);
                }
            });
        });
        
        // Simple circular dependency detection
        Object.entries(dependencyGraph).forEach(([file, deps]) => {
            deps.forEach(dep => {
                if (dependencyGraph[dep] && dependencyGraph[dep].includes(file)) {
                    this.stats.issues.push({
                        type: 'circular_dependency',
                        files: [file, dep]
                    });
                }
            });
        });
    }

    async checkCommonIssues() {
        // Check for missing dependencies
        const allImports = new Set();
        [...this.stats.srcFiles, ...this.stats.repoFiles].forEach(file => {
            file.imports.forEach(imp => {
                if (!imp.startsWith('.') && !imp.startsWith('/')) {
                    allImports.add(imp);
                }
            });
        });
        
        const declaredDeps = new Set(Object.keys(this.stats.dependencies));
        const builtinModules = new Set(['fs', 'path', 'crypto', 'http', 'https', 'url', 'util', 'stream', 'events']);
        
        allImports.forEach(imp => {
            const basePackage = imp.split('/')[0];
            if (!declaredDeps.has(basePackage) && !builtinModules.has(basePackage)) {
                this.stats.issues.push({
                    type: 'missing_dependency',
                    package: imp
                });
            }
        });
        
        // Check for TODO/FIXME comments
        for (const file of [...this.stats.srcFiles, ...this.stats.repoFiles]) {
            if (['.js', '.ts', '.jsx', '.tsx'].includes(path.extname(file.path))) {
                try {
                    const content = await fs.readFile(file.path, 'utf8');
                    const todoMatches = content.match(/TODO|FIXME|HACK|XXX/gi) || [];
                    if (todoMatches.length > 0) {
                        this.stats.issues.push({
                            type: 'todo_comments',
                            path: file.path,
                            count: todoMatches.length
                        });
                    }
                } catch (error) {
                    // Skip if file cannot be read
                }
            }
        }
    }

    async generateReport() {
        const report = {
            timestamp: new Date().toISOString(),
            summary: {
                totalFiles: this.stats.totalFiles,
                sourceFiles: this.stats.srcFiles.length,
                repoFiles: this.stats.repoFiles.length,
                duplicateGroups: this.stats.duplicates.length,
                modules: Object.keys(this.stats.modules).length,
                issues: this.stats.issues.length
            },
            fileTypes: this.stats.filesByType,
            modules: this.stats.modules,
            duplicates: this.stats.duplicates,
            issues: this.stats.issues,
            recommendations: this.generateRecommendations()
        };
        
        // Save report
        await fs.writeFile(
            './CODEBASE_AUDIT_REPORT.json',
            JSON.stringify(report, null, 2)
        );
        
        // Print summary
        console.log('📊 Audit Summary:');
        console.log(`   Total Files: ${report.summary.totalFiles}`);
        console.log(`   Source Files: ${report.summary.sourceFiles} (/src)`);
        console.log(`   Repo Files: ${report.summary.repoFiles} (/autoweave-repos)`);
        console.log(`   Duplicate Groups: ${report.summary.duplicateGroups}`);
        console.log(`   Modules Found: ${report.summary.modules}`);
        console.log(`   Issues Found: ${report.summary.issues}`);
        console.log('\n✅ Full report saved to CODEBASE_AUDIT_REPORT.json');
        
        // Print top issues
        if (this.stats.issues.length > 0) {
            console.log('\n⚠️  Top Issues:');
            const issueTypes = {};
            this.stats.issues.forEach(issue => {
                issueTypes[issue.type] = (issueTypes[issue.type] || 0) + 1;
            });
            
            Object.entries(issueTypes)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 5)
                .forEach(([type, count]) => {
                    console.log(`   - ${type}: ${count}`);
                });
        }
    }

    generateRecommendations() {
        const recommendations = [];
        
        if (this.stats.duplicates.length > 0) {
            recommendations.push({
                priority: 'high',
                type: 'duplicates',
                message: `Found ${this.stats.duplicates.length} groups of duplicate files. Consider consolidating.`,
                action: 'Review duplicate files and decide which version to keep'
            });
        }
        
        const divergedFiles = this.stats.issues.filter(i => i.type === 'diverged_files');
        if (divergedFiles.length > 0) {
            recommendations.push({
                priority: 'high',
                type: 'divergence',
                message: `Found ${divergedFiles.length} files that exist in both /src and /autoweave-repos with different content`,
                action: 'Reconcile diverged files to maintain single source of truth'
            });
        }
        
        if (this.stats.srcFiles.length > 0 && this.stats.repoFiles.length > 0) {
            recommendations.push({
                priority: 'high',
                type: 'structure',
                message: 'Code exists in both /src (monolithic) and /autoweave-repos (modular) structures',
                action: 'Decide on single structure and migrate all code accordingly'
            });
        }
        
        const missingDeps = this.stats.issues.filter(i => i.type === 'missing_dependency');
        if (missingDeps.length > 0) {
            recommendations.push({
                priority: 'medium',
                type: 'dependencies',
                message: `Found ${missingDeps.length} potentially missing dependencies`,
                action: 'Review and add missing dependencies to package.json files'
            });
        }
        
        const todoComments = this.stats.issues.filter(i => i.type === 'todo_comments');
        if (todoComments.length > 0) {
            const totalTodos = todoComments.reduce((sum, i) => sum + i.count, 0);
            recommendations.push({
                priority: 'low',
                type: 'maintenance',
                message: `Found ${totalTodos} TODO/FIXME comments across ${todoComments.length} files`,
                action: 'Create issues for TODO items and address them systematically'
            });
        }
        
        return recommendations;
    }
}

// Run the audit
const auditor = new CodebaseAuditor();
auditor.audit().catch(console.error);