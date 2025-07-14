#!/usr/bin/env node

const fs = require('fs').promises;
const path = require('path');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

/**
 * Compare diverged files between /src and /autoweave-repos
 * Helps decide which version to keep
 */

class DivergedFileAnalyzer {
    constructor() {
        this.divergedFiles = [
            {
                name: 'autoweave.js',
                src: 'src/core/autoweave.js',
                repo: '../autoweave-repos/autoweave-core/src/core/autoweave.js'
            },
            {
                name: 'agent-weaver.js',
                src: 'src/core/agent-weaver.js',
                repo: '../autoweave-repos/autoweave-core/src/core/agent-weaver.js'
            },
            {
                name: 'hybrid-memory.js',
                src: 'src/memory/hybrid-memory.js',
                repo: '../autoweave-repos/autoweave-memory/src/memory/hybrid-memory.js'
            },
            {
                name: 'mem0-client.js',
                src: 'src/memory/mem0-client.js',
                repo: '../autoweave-repos/autoweave-memory/src/memory/mem0-client.js'
            },
            {
                name: 'langchain-orchestrator.js',
                src: 'src/agents/integration-agent/langchain-orchestrator.js',
                repo: '../autoweave-repos/autoweave-agents/src/agents/integration-agent/langchain-orchestrator.js'
            },
            {
                name: 'unified-autoweave-mcp-server.js',
                src: 'src/mcp/unified-autoweave-mcp-server.js',
                repo: '../autoweave-repos/autoweave-integrations/src/mcp/unified-autoweave-mcp-server.js'
            },
            {
                name: 'coding-memory-manager.js',
                src: 'src/memory/coding/coding-memory-manager.js',
                repo: '../autoweave-repos/autoweave-backend/src/memory/coding/coding-memory-manager.js'
            },
            {
                name: 'create-agent.js',
                src: 'src/cli/create-agent.js',
                repo: '../autoweave-repos/autoweave-cli/src/commands/create-agent.js'
            },
            {
                name: 'logger.js',
                src: 'src/utils/logger.js',
                repo: '../autoweave-repos/autoweave-core/src/utils/logger.js'
            },
            {
                name: 'coding-memory.js',
                src: 'src/routes/coding-memory.js',
                repo: '../autoweave-repos/autoweave-backend/src/routes/coding-memory.js'
            }
        ];
        
        this.results = [];
    }

    async analyze() {
        console.log('🔍 Analyzing Diverged Files...\n');
        
        for (const file of this.divergedFiles) {
            console.log(`\n📄 Analyzing: ${file.name}`);
            console.log('─'.repeat(50));
            
            try {
                const analysis = await this.analyzeFile(file);
                this.results.push(analysis);
                this.printAnalysis(analysis);
            } catch (error) {
                console.error(`❌ Error analyzing ${file.name}:`, error.message);
            }
        }
        
        await this.generateComparisonReport();
    }

    async analyzeFile(file) {
        const srcStats = await fs.stat(file.src);
        const repoStats = await fs.stat(file.repo);
        
        const srcContent = await fs.readFile(file.src, 'utf8');
        const repoContent = await fs.readFile(file.repo, 'utf8');
        
        // Count meaningful lines (non-empty, non-comment)
        const srcLines = this.countMeaningfulLines(srcContent);
        const repoLines = this.countMeaningfulLines(repoContent);
        
        // Extract imports
        const srcImports = this.extractImports(srcContent);
        const repoImports = this.extractImports(repoContent);
        
        // Extract exports
        const srcExports = this.extractExports(srcContent);
        const repoExports = this.extractExports(repoContent);
        
        // Detect features
        const srcFeatures = this.detectFeatures(srcContent);
        const repoFeatures = this.detectFeatures(repoContent);
        
        // Calculate diff stats
        let diffStats = { additions: 0, deletions: 0 };
        try {
            const { stdout } = await execPromise(`diff -u "${file.src}" "${file.repo}" | grep -E "^[+-]" | grep -v "^[+-]{3}" | wc -l`);
            const totalChanges = parseInt(stdout.trim()) || 0;
            diffStats.totalChanges = totalChanges;
        } catch (error) {
            // diff returns non-zero exit code when files differ, which is expected
            diffStats.totalChanges = Math.abs(srcLines - repoLines);
        }
        
        return {
            name: file.name,
            src: {
                path: file.src,
                size: srcStats.size,
                modified: srcStats.mtime,
                lines: srcLines,
                imports: srcImports.length,
                exports: srcExports.length,
                features: srcFeatures,
                uniqueImports: srcImports.filter(i => !repoImports.includes(i)),
                uniqueExports: srcExports.filter(e => !repoExports.includes(e))
            },
            repo: {
                path: file.repo,
                size: repoStats.size,
                modified: repoStats.mtime,
                lines: repoLines,
                imports: repoImports.length,
                exports: repoExports.length,
                features: repoFeatures,
                uniqueImports: repoImports.filter(i => !srcImports.includes(i)),
                uniqueExports: repoExports.filter(e => !srcExports.includes(e))
            },
            diff: diffStats,
            recommendation: this.generateRecommendation(file, srcStats, repoStats, srcFeatures, repoFeatures)
        };
    }

    countMeaningfulLines(content) {
        return content.split('\n').filter(line => {
            const trimmed = line.trim();
            return trimmed.length > 0 && 
                   !trimmed.startsWith('//') && 
                   !trimmed.startsWith('*') &&
                   !trimmed.startsWith('/*');
        }).length;
    }

    extractImports(content) {
        const imports = [];
        
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
        
        return [...new Set(imports)];
    }

    extractExports(content) {
        const exports = [];
        
        // CommonJS exports
        const moduleExportsRegex = /module\.exports\s*=\s*{([^}]+)}/;
        const moduleMatch = content.match(moduleExportsRegex);
        if (moduleMatch) {
            const exportedItems = moduleMatch[1].match(/\w+/g) || [];
            exports.push(...exportedItems);
        }
        
        // ES6 named exports
        const namedExportRegex = /export\s+(?:const|let|var|function|class)\s+(\w+)/g;
        let match;
        while ((match = namedExportRegex.exec(content)) !== null) {
            exports.push(match[1]);
        }
        
        return [...new Set(exports)];
    }

    detectFeatures(content) {
        const features = [];
        
        // Detect async/await
        if (/async\s+\w+|await\s+\w+/.test(content)) {
            features.push('async/await');
        }
        
        // Detect classes
        if (/class\s+\w+/.test(content)) {
            features.push('ES6 classes');
        }
        
        // Detect error handling
        if (/try\s*{|\.catch\(/.test(content)) {
            features.push('error handling');
        }
        
        // Detect logging
        if (/logger\.|console\./.test(content)) {
            features.push('logging');
        }
        
        // Detect tests
        if (/describe\(|test\(|it\(/.test(content)) {
            features.push('tests');
        }
        
        // Detect WebSocket
        if (/WebSocket|ws\.|wss:/.test(content)) {
            features.push('WebSocket');
        }
        
        // Detect AI/LLM integration
        if (/openai|gpt|claude|anthropic/i.test(content)) {
            features.push('AI/LLM integration');
        }
        
        // Detect Kubernetes
        if (/kubernetes|k8s|kubectl|pod/i.test(content)) {
            features.push('Kubernetes integration');
        }
        
        return features;
    }

    generateRecommendation(file, srcStats, repoStats, srcFeatures, repoFeatures) {
        // More recent file is usually preferred
        const srcNewer = srcStats.mtime > repoStats.mtime;
        
        // More features usually indicates more complete implementation
        const srcMoreFeatures = srcFeatures.length > repoFeatures.length;
        
        // Larger file might have more functionality (but could also be bloated)
        const srcLarger = srcStats.size > repoStats.size;
        
        // Scoring system
        let srcScore = 0;
        let repoScore = 0;
        
        if (srcNewer) srcScore += 2;
        else repoScore += 2;
        
        if (srcMoreFeatures) srcScore += 1;
        else if (repoFeatures.length > srcFeatures.length) repoScore += 1;
        
        // Check for critical features
        const criticalFeatures = ['error handling', 'logging', 'tests'];
        criticalFeatures.forEach(feature => {
            if (srcFeatures.includes(feature) && !repoFeatures.includes(feature)) srcScore += 1;
            if (repoFeatures.includes(feature) && !srcFeatures.includes(feature)) repoScore += 1;
        });
        
        if (srcScore > repoScore) {
            return {
                keep: 'src',
                reason: `Newer (${srcNewer ? 'yes' : 'no'}), more features (${srcFeatures.length} vs ${repoFeatures.length})`,
                confidence: 'medium'
            };
        } else if (repoScore > srcScore) {
            return {
                keep: 'repo',
                reason: `Better organized, ${repoNewer ? 'newer' : 'established'} module structure`,
                confidence: 'medium'
            };
        } else {
            return {
                keep: 'manual review needed',
                reason: 'Similar scores, requires detailed comparison',
                confidence: 'low'
            };
        }
    }

    printAnalysis(analysis) {
        console.log(`\n📊 ${analysis.name}`);
        console.log(`├─ /src version:`);
        console.log(`│  ├─ Size: ${(analysis.src.size / 1024).toFixed(2)} KB`);
        console.log(`│  ├─ Lines: ${analysis.src.lines}`);
        console.log(`│  ├─ Modified: ${analysis.src.modified.toLocaleDateString()}`);
        console.log(`│  ├─ Features: ${analysis.src.features.join(', ') || 'none detected'}`);
        console.log(`│  └─ Unique imports: ${analysis.src.uniqueImports.length}`);
        
        console.log(`├─ /autoweave-repos version:`);
        console.log(`│  ├─ Size: ${(analysis.repo.size / 1024).toFixed(2)} KB`);
        console.log(`│  ├─ Lines: ${analysis.repo.lines}`);
        console.log(`│  ├─ Modified: ${analysis.repo.modified.toLocaleDateString()}`);
        console.log(`│  ├─ Features: ${analysis.repo.features.join(', ') || 'none detected'}`);
        console.log(`│  └─ Unique imports: ${analysis.repo.uniqueImports.length}`);
        
        console.log(`└─ 🎯 Recommendation: Keep ${analysis.recommendation.keep}`);
        console.log(`   └─ Reason: ${analysis.recommendation.reason}`);
    }

    async generateComparisonReport() {
        const report = {
            timestamp: new Date().toISOString(),
            summary: {
                totalFiles: this.results.length,
                keepSrc: this.results.filter(r => r.recommendation.keep === 'src').length,
                keepRepo: this.results.filter(r => r.recommendation.keep === 'repo').length,
                needsReview: this.results.filter(r => r.recommendation.keep === 'manual review needed').length
            },
            files: this.results,
            overallRecommendation: this.generateOverallRecommendation()
        };
        
        await fs.writeFile(
            './DIVERGED_FILES_COMPARISON.json',
            JSON.stringify(report, null, 2)
        );
        
        console.log('\n\n📋 Summary Report');
        console.log('═'.repeat(50));
        console.log(`Total diverged files analyzed: ${report.summary.totalFiles}`);
        console.log(`Recommend keeping /src version: ${report.summary.keepSrc}`);
        console.log(`Recommend keeping /autoweave-repos version: ${report.summary.keepRepo}`);
        console.log(`Needs manual review: ${report.summary.needsReview}`);
        console.log('\n✅ Detailed report saved to DIVERGED_FILES_COMPARISON.json');
        
        console.log('\n🎯 Overall Recommendation:');
        console.log(report.overallRecommendation);
    }

    generateOverallRecommendation() {
        const srcVotes = this.results.filter(r => r.recommendation.keep === 'src').length;
        const repoVotes = this.results.filter(r => r.recommendation.keep === 'repo').length;
        
        if (repoVotes > srcVotes) {
            return `Use /autoweave-repos as the base (Option A). The modular structure is more mature and better organized. 
Migrate any unique features from /src to the modular structure.`;
        } else if (srcVotes > repoVotes) {
            return `The /src directory has more recent updates. Consider Option B: Create a new unified structure 
taking the best from both, but maintaining the modular architecture of /autoweave-repos.`;
        } else {
            return `The codebases have diverged significantly. Option B is recommended: Create a new unified structure 
in /packages, carefully merging features from both sources. This requires manual review of each file.`;
        }
    }
}

// Run the analyzer
const analyzer = new DivergedFileAnalyzer();
analyzer.analyze().catch(console.error);