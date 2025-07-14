#!/usr/bin/env node

const fs = require('fs').promises;
const path = require('path');

/**
 * Documentation Verification Script
 * Checks that all documentation is up-to-date with the new monorepo structure
 */

class DocumentationVerifier {
    constructor() {
        this.issues = [];
        this.outdatedPaths = [];
        this.missingDocs = [];
    }

    async verify() {
        console.log('📚 Verifying AutoWeave Documentation...\n');
        
        // Check main documentation files
        await this.checkMainDocs();
        
        // Check for outdated paths
        await this.checkOutdatedPaths();
        
        // Check package documentation
        await this.checkPackageDocs();
        
        // Generate report
        await this.generateReport();
    }

    async checkMainDocs() {
        const mainDocs = [
            'README.md',
            'CLAUDE.md',
            'PLANNING.md',
            'TASKS.md',
            'CONTRIBUTING.md',
            'CHANGELOG.md'
        ];

        for (const doc of mainDocs) {
            try {
                const content = await fs.readFile(doc, 'utf8');
                
                // Check for outdated references
                if (content.includes('/src/') && !content.includes('/packages/')) {
                    this.outdatedPaths.push({
                        file: doc,
                        issue: 'Contains references to old /src/ structure'
                    });
                }
                
                if (content.includes('autoweave-repos')) {
                    this.outdatedPaths.push({
                        file: doc,
                        issue: 'Contains references to old autoweave-repos'
                    });
                }
                
                // Check specific patterns
                this.checkDocumentPatterns(doc, content);
                
            } catch (error) {
                this.missingDocs.push(doc);
            }
        }
    }

    checkDocumentPatterns(filename, content) {
        const patterns = [
            {
                pattern: /src\/core\//g,
                replacement: 'packages/core/src/',
                description: 'Core module path'
            },
            {
                pattern: /src\/memory\//g,
                replacement: 'packages/memory/src/',
                description: 'Memory module path'
            },
            {
                pattern: /src\/agents\//g,
                replacement: 'packages/agents/src/',
                description: 'Agents module path'
            },
            {
                pattern: /src\/routes\//g,
                replacement: 'packages/backend/src/routes/',
                description: 'Routes path'
            },
            {
                pattern: /src\/mcp\//g,
                replacement: 'packages/integrations/src/mcp/',
                description: 'MCP integration path'
            },
            {
                pattern: /src\/utils\//g,
                replacement: 'packages/shared/src/utils/',
                description: 'Utils path'
            }
        ];

        patterns.forEach(({ pattern, replacement, description }) => {
            if (pattern.test(content)) {
                this.issues.push({
                    file: filename,
                    issue: `Outdated path for ${description}`,
                    oldPath: pattern.source,
                    newPath: replacement
                });
            }
        });
    }

    async checkOutdatedPaths() {
        const docsToCheck = await this.getAllMarkdownFiles('.');
        
        for (const docPath of docsToCheck) {
            try {
                const content = await fs.readFile(docPath, 'utf8');
                
                // Check import statements
                const importRegex = /(?:from|require\s*\()\s*['"]([^'"]+)['"]/g;
                let match;
                
                while ((match = importRegex.exec(content)) !== null) {
                    const importPath = match[1];
                    
                    if (importPath.includes('../') && !importPath.includes('@autoweave/')) {
                        this.issues.push({
                            file: docPath,
                            issue: 'Relative import should use @autoweave/* workspace',
                            path: importPath
                        });
                    }
                }
            } catch (error) {
                // Skip files that can't be read
            }
        }
    }

    async checkPackageDocs() {
        const packages = ['core', 'memory', 'agents', 'backend', 'integrations', 'cli', 'deployment', 'shared'];
        
        for (const pkg of packages) {
            const packagePath = path.join('packages', pkg);
            const readmePath = path.join(packagePath, 'README.md');
            
            try {
                await fs.access(readmePath);
            } catch {
                this.missingDocs.push(`${pkg} package README.md`);
            }
        }
    }

    async getAllMarkdownFiles(dir) {
        const files = [];
        
        try {
            const items = await fs.readdir(dir, { withFileTypes: true });
            
            for (const item of items) {
                // Skip certain directories
                if (['node_modules', '.git', 'dist', 'build', 'archive'].includes(item.name)) {
                    continue;
                }
                
                const fullPath = path.join(dir, item.name);
                
                if (item.isDirectory()) {
                    files.push(...await this.getAllMarkdownFiles(fullPath));
                } else if (item.name.endsWith('.md')) {
                    files.push(fullPath);
                }
            }
        } catch (error) {
            // Skip directories that can't be read
        }
        
        return files;
    }

    async generateReport() {
        console.log('\n📋 Documentation Verification Report');
        console.log('=====================================\n');
        
        if (this.outdatedPaths.length > 0) {
            console.log('❌ Outdated Path References:');
            this.outdatedPaths.forEach(({ file, issue }) => {
                console.log(`   - ${file}: ${issue}`);
            });
            console.log('');
        }
        
        if (this.issues.length > 0) {
            console.log('⚠️  Documentation Issues:');
            this.issues.forEach(({ file, issue, oldPath, newPath }) => {
                console.log(`   - ${file}: ${issue}`);
                if (oldPath && newPath) {
                    console.log(`     Old: ${oldPath} → New: ${newPath}`);
                }
            });
            console.log('');
        }
        
        if (this.missingDocs.length > 0) {
            console.log('📄 Missing Documentation:');
            this.missingDocs.forEach(doc => {
                console.log(`   - ${doc}`);
            });
            console.log('');
        }
        
        // Summary
        const totalIssues = this.outdatedPaths.length + this.issues.length + this.missingDocs.length;
        
        if (totalIssues === 0) {
            console.log('✅ All documentation is up to date!');
        } else {
            console.log(`\n📊 Summary: Found ${totalIssues} documentation issues`);
            console.log('\n💡 Run the update script to fix these issues automatically.');
        }
        
        // Save report
        const report = {
            timestamp: new Date().toISOString(),
            outdatedPaths: this.outdatedPaths,
            issues: this.issues,
            missingDocs: this.missingDocs,
            summary: {
                totalIssues,
                outdatedPathCount: this.outdatedPaths.length,
                issueCount: this.issues.length,
                missingDocCount: this.missingDocs.length
            }
        };
        
        await fs.writeFile(
            'DOCUMENTATION_VERIFICATION_REPORT.json',
            JSON.stringify(report, null, 2)
        );
        
        console.log('\n📁 Full report saved to DOCUMENTATION_VERIFICATION_REPORT.json');
    }
}

// Run the verifier
const verifier = new DocumentationVerifier();
verifier.verify().catch(console.error);