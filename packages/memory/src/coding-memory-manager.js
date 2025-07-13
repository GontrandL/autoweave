/**
 * CodingMemoryManager - Intelligent Code Memory Module
 * =====================================================
 * Manages intelligent code memory using composition pattern
 */

const AutoWeaveMemory = require('@autoweave/core');
const AutoWeaveGraph = require('@autoweave/core');
const { RedisMLCache } = require('@autoweave/core');
const { Logger } = require('@autoweave/shared');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs').promises;

class CodingMemoryManager {
    constructor(config = {}) {
        this.config = config;
        this.logger = new Logger('CodingMemoryManager');
        
        // Initialize memory components using composition
        this.contextualMemory = null;
        this.structuralMemory = null;
        this.mlCache = null;
        
        // Code-specific collections
        this.collections = {
            codeContext: 'code_context',
            codeRelations: 'code_relations',
            codePatterns: 'code_patterns',
            codeStyle: 'code_style',
            codePredictions: 'code_predictions'
        };
        
        // Analyzers and predictors
        this.codeAnalyzers = new Map();
        this.predictors = new Map();
        
        // Cache for code analysis
        this.analysisCache = new Map();
        this.styleLearningEnabled = config.styleLearning !== false;
        
        // Search configuration
        this.searchTimeout = config.searchTimeout || 10000;
        this.searchCache = new Map();
        this.cacheTimeout = config.cacheTimeout || 300000; // 5 minutes
        
        // Metrics
        this.metrics = {
            searches: 0,
            search_times: [],
            cache_hits: 0,
            errors: 0
        };
        
        // Initialization flag
        this.isInitialized = false;
    }
    
    async initialize() {
        this.logger.info('🚀 Initializing CodingMemoryManager with composition pattern...');
        
        try {
            // Initialize contextual memory (mem0)
            this.logger.debug('Initializing contextual memory...');
            this.contextualMemory = new AutoWeaveMemory(this.config.mem0 || {});
            await this.contextualMemory.initializeClient();
            this.logger.success('Contextual memory initialized');
            
            // Initialize structural memory (GraphRAG)
            this.logger.debug('Initializing structural memory...');
            this.structuralMemory = new AutoWeaveGraph(this.config.graph || {});
            await this.structuralMemory.initializeSchema();
            this.logger.success('Structural memory initialized');
            
            // Initialize ML cache (Redis)
            this.logger.debug('Initializing ML cache...');
            this.mlCache = new RedisMLCache(this.config.redis || {});
            await this.mlCache.initialize();
            this.logger.success('ML cache initialized');
            
            // Initialize code-specific features
            await this.initializeCodingFeatures();
            
            this.isInitialized = true;
            this.logger.success('✅ CodingMemoryManager fully initialized');
            
        } catch (error) {
            this.logger.error('Failed to initialize CodingMemoryManager:', error);
            // Continue with partial initialization
            this.logger.warn('Continuing with partial initialization...');
            
            // Initialize coding features anyway
            await this.initializeCodingFeatures();
            this.isInitialized = true;
        }
    }
    
    async initializeCodingFeatures() {
        this.logger.info('🔧 Initializing coding-specific features...');
        
        // Initialize code analyzers
        await this.setupAnalyzers();
        
        // Initialize predictors
        await this.setupPredictors();
        
        this.logger.success('✅ Coding features initialized');
    }
    
    async setupAnalyzers() {
        // Code complexity analyzer
        this.codeAnalyzers.set('complexity', {
            analyze: this.analyzeCodeComplexity.bind(this)
        });
        
        // Dependency analyzer
        this.codeAnalyzers.set('dependencies', {
            analyze: this.analyzeCodeDependencies.bind(this)
        });
        
        // Pattern analyzer
        this.codeAnalyzers.set('patterns', {
            analyze: this.analyzeCodePatterns.bind(this)
        });
        
        // Style analyzer
        this.codeAnalyzers.set('style', {
            analyze: this.analyzeCodeStyle.bind(this)
        });
    }
    
    async setupPredictors() {
        // Next action predictor
        this.predictors.set('nextAction', {
            predict: this.predictNextAction.bind(this)
        });
        
        // Refactoring predictor
        this.predictors.set('refactoring', {
            predict: this.predictRefactoring.bind(this)
        });
        
        // Quality predictor
        this.predictors.set('quality', {
            predict: this.predictCodeQuality.bind(this)
        });
    }
    
    /**
     * Shutdown the memory system gracefully
     */
    async shutdown() {
        this.logger.info('Shutting down CodingMemoryManager...');
        
        try {
            // Close graph database connection
            if (this.structuralMemory) {
                await this.structuralMemory.close();
            }
            
            // Clear caches
            this.searchCache.clear();
            this.analysisCache.clear();
            
            this.isInitialized = false;
            this.logger.info('CodingMemoryManager shutdown complete');
        } catch (error) {
            this.logger.error('Error during shutdown:', error);
        }
    }
    
    /**
     * Remember code context with intelligent metadata
     */
    async rememberCodeContext(context) {
        const {
            file,
            function: functionName,
            purpose,
            patterns = [],
            dependencies = [],
            linkedFiles = [],
            codeStyle,
            complexity,
            lastModified,
            author,
            reviewNotes
        } = context;
        
        try {
            // Ensure we're initialized
            if (!this.isInitialized || !this.contextualMemory) {
                throw new Error('CodingMemoryManager not properly initialized');
            }
            
            // Generate unique ID for this code context
            const contextId = this.generateCodeContextId(file, functionName);
            
            // Analyze code if content provided
            let analysis = {};
            if (context.content) {
                analysis = await this.analyzeCode(context.content);
            }
            
            // Prepare memory entry
            const memoryEntry = {
                id: contextId,
                type: 'code_context',
                file,
                function: functionName,
                purpose,
                patterns: [...new Set([...patterns, ...(analysis.patterns || [])])],
                dependencies: [...new Set([...dependencies, ...(analysis.dependencies || [])])],
                linkedFiles,
                codeStyle: codeStyle || analysis.style,
                complexity: complexity || analysis.complexity,
                lastModified: lastModified || new Date().toISOString(),
                author,
                reviewNotes,
                metadata: {
                    ...analysis.metadata,
                    timestamp: Date.now()
                }
            };
            
            // Store in mem0 for contextual memory
            await this.contextualMemory.addUserMemory(
                'system',
                `Code context for ${functionName} in ${file}: ${purpose}`,
                memoryEntry
            );
            
            // Store relations in graph if linkedFiles exist
            if (linkedFiles.length > 0 && this.structuralMemory) {
                for (const linkedFile of linkedFiles) {
                    await this.createCodeRelation({
                        source: { file, function: functionName },
                        target: { file: linkedFile },
                        relationship: 'references',
                        metadata: { purpose }
                    });
                }
            }
            
            this.logger.success(`✅ Remembered code context for ${functionName}`);
            return { success: true, contextId };
            
        } catch (error) {
            this.logger.error('Failed to remember code context:', error);
            throw error;
        }
    }
    
    /**
     * Create code relations in graph database
     */
    async createCodeRelation(relation) {
        const {
            type = 'function_calls',
            source,
            target,
            relationship,
            frequency,
            dataFlow = []
        } = relation;
        
        try {
            if (!this.structuralMemory) {
                this.logger.warn('Structural memory not available, skipping relation creation');
                return { success: true, relation: null };
            }
            
            const relationData = {
                id: this.generateRelationId(source, target),
                type,
                source,
                target,
                relationship,
                frequency,
                dataFlow,
                timestamp: Date.now()
            };
            
            // Store in graph database
            await this.structuralMemory.createRelation(
                source,
                target,
                relationship,
                relationData
            );
            
            this.logger.debug(`Created code relation: ${source.function} -> ${target.function}`);
            return { success: true, relation: relationData };
            
        } catch (error) {
            this.logger.error('Failed to create code relation:', error);
            throw error;
        }
    }
    
    /**
     * Intelligent search across code memory
     */
    async intelligentSearch(query, userId = 'system', context = {}) {
        const startTime = Date.now();
        this.metrics.searches++;
        
        this.logger.info(`Code search: "${query}" for user: ${userId}`);
        
        try {
            // Check ML cache first
            const cacheKey = `code:search:${userId}:${Buffer.from(query).toString('base64').slice(0, 20)}`;
            if (this.mlCache) {
                const mlCached = await this.mlCache.get(cacheKey, { userId, context });
                if (mlCached) {
                    this.metrics.cache_hits++;
                    this.logger.info('ML Cache hit for search query');
                    return mlCached;
                }
            }
            
            // Fallback to local cache
            const localCacheKey = `${query}_${userId}_${JSON.stringify(context)}`;
            const cached = this.getCachedResult(localCacheKey);
            if (cached) {
                this.metrics.cache_hits++;
                this.logger.info('Local cache hit for search query');
                return cached;
            }
            
            // Perform searches in parallel
            const searchPromises = [];
            
            // Contextual search
            if (this.contextualMemory) {
                searchPromises.push(
                    this.contextualMemory.searchMemory(query, userId, {
                        type: 'code_context',
                        ...context
                    }).catch(err => {
                        this.logger.error('Contextual search failed:', err);
                        return { memories: [] };
                    })
                );
            }
            
            // Structural search
            if (this.structuralMemory) {
                searchPromises.push(
                    this.structuralMemory.semanticSearch(query, 10).catch(err => {
                        this.logger.error('Structural search failed:', err);
                        return { results: [] };
                    })
                );
            }
            
            // Wait for all searches with timeout
            const [contextualResults, structuralResults] = await Promise.race([
                Promise.all(searchPromises),
                new Promise((_, reject) => 
                    setTimeout(() => reject(new Error('Search timeout')), this.searchTimeout)
                )
            ]);
            
            // Fuse results
            const fusedResults = await this.fuseSearchResults(
                contextualResults,
                structuralResults,
                query,
                context
            );
            
            // Cache results
            if (this.mlCache) {
                await this.mlCache.set(cacheKey, fusedResults, { userId, context });
            }
            this.setCachedResult(localCacheKey, fusedResults);
            
            const searchTime = Date.now() - startTime;
            this.metrics.search_times.push(searchTime);
            this.logger.success(`Code search completed in ${searchTime}ms`);
            
            return fusedResults;
            
        } catch (error) {
            this.metrics.errors++;
            this.logger.error('Intelligent search failed:', error);
            throw error;
        }
    }
    
    /**
     * Search code with enhanced context
     */
    async intelligentCodeSearch(query, context = {}) {
        try {
            const startTime = Date.now();
            
            // Use intelligent search
            const searchResults = await this.intelligentSearch(query, context.userId || 'system', context);
            
            // Enhance with code-specific context
            const codeContext = await this.analyzeCodeContext(query, context);
            const codeRelations = await this.findCodeRelations(query, context);
            
            // Fuse results
            const fusedResults = await this.fuseCodingResults(
                searchResults,
                codeContext,
                codeRelations
            );
            
            this.logger.info(`Code search completed in ${Date.now() - startTime}ms`);
            return fusedResults;
            
        } catch (error) {
            this.logger.error('Intelligent code search failed:', error);
            throw error;
        }
    }
    
    /**
     * Explain code context with rich information
     */
    async explainCodeContext({ file, line, functionName }) {
        try {
            // Search for existing context
            const query = functionName || `${file}:${line}`;
            const results = await this.intelligentCodeSearch(query, { file });
            
            if (!results.results || results.results.length === 0) {
                return {
                    error: 'No context found',
                    suggestion: 'Consider indexing this code first'
                };
            }
            
            const context = results.results[0];
            
            // Get relations
            const relations = await this.getCodeRelations(file, functionName);
            
            // Generate explanation
            return {
                purpose: context.purpose,
                usedBy: relations.filter(r => r.target.file === file).map(r => r.source.file),
                dependencies: context.dependencies,
                complexity: context.complexity,
                recentChanges: await this.getRecentChanges(file),
                similarPatterns: await this.findSimilarPatterns(context.patterns),
                suggestedImprovements: await this.suggestImprovements(context)
            };
            
        } catch (error) {
            this.logger.error('Failed to explain code context:', error);
            throw error;
        }
    }
    
    /**
     * Suggest refactoring based on patterns
     */
    async suggestRefactoring({ file, functionName, issues = [] }) {
        try {
            // Get current context
            const context = await this.getCodeContext(file, functionName);
            
            if (!context) {
                throw new Error('Code context not found');
            }
            
            // Analyze for refactoring opportunities
            const refactorAnalysis = await this.analyzeRefactoringOpportunities(context, issues);
            
            // Generate suggestions
            const suggestions = {
                strategy: refactorAnalysis.strategy,
                newFunctions: refactorAnalysis.extractedMethods,
                impactAnalysis: {
                    affectedFiles: await this.findAffectedFiles(file, functionName),
                    testUpdatesNeeded: refactorAnalysis.requiresTestUpdate,
                    breakingChanges: refactorAnalysis.hasBreakingChanges
                },
                estimatedComplexityReduction: refactorAnalysis.complexityReduction,
                codeExample: refactorAnalysis.example
            };
            
            return suggestions;
            
        } catch (error) {
            this.logger.error('Failed to suggest refactoring:', error);
            throw error;
        }
    }
    
    /**
     * Learn from code diffs
     */
    async learnFromCommit({ commit, changes, patterns }) {
        try {
            // Extract learning from changes
            const learning = {
                commitId: commit,
                timestamp: Date.now(),
                changes,
                patterns,
                metrics: await this.calculateChangeMetrics(changes)
            };
            
            // Store learning
            if (this.contextualMemory) {
                await this.contextualMemory.addUserMemory(
                    'system',
                    `Learned from commit ${commit}: ${Object.keys(patterns).join(', ')}`,
                    learning
                );
            }
            
            // Update pattern database
            for (const [patternType, description] of Object.entries(patterns)) {
                await this.updatePatternKnowledge(patternType, description);
            }
            
            this.logger.success(`✅ Learned from commit ${commit}`);
            return { success: true, learning };
            
        } catch (error) {
            this.logger.error('Failed to learn from commit:', error);
            throw error;
        }
    }
    
    /**
     * Learn code style from project
     */
    async learnCodeStyle({ project, files, aspects }) {
        try {
            const styleGuide = {
                project,
                aspects: {},
                examples: {},
                timestamp: Date.now()
            };
            
            // Analyze each aspect
            for (const aspect of aspects) {
                const analysis = await this.analyzeStyleAspect(files, aspect);
                styleGuide.aspects[aspect] = analysis.patterns;
                styleGuide.examples[aspect] = analysis.examples;
            }
            
            // Store style guide
            if (this.contextualMemory) {
                await this.contextualMemory.addUserMemory(
                    'system',
                    `Learned code style for ${project}`,
                    styleGuide
                );
            }
            
            this.logger.success(`✅ Learned code style for ${project}`);
            return styleGuide;
            
        } catch (error) {
            this.logger.error('Failed to learn code style:', error);
            throw error;
        }
    }
    
    /**
     * Predict next developer action
     */
    async predictNextAction({ currentFile, cursorPosition, recentActions, context }) {
        try {
            // Get file context
            const fileContext = await this.getCodeContext(currentFile);
            
            // Analyze recent patterns
            const patterns = await this.analyzeRecentPatterns(recentActions);
            
            // Generate predictions
            const predictions = {
                likely_next_actions: [],
                code_suggestions: [],
                confidence_scores: {}
            };
            
            // Use predictors
            const nextActionPredictor = this.predictors.get('nextAction');
            if (nextActionPredictor) {
                const actionPredictions = await nextActionPredictor.predict({
                    fileContext,
                    patterns,
                    context
                });
                
                predictions.likely_next_actions = actionPredictions.actions;
                predictions.confidence_scores = actionPredictions.confidence;
            }
            
            // Generate code suggestions
            predictions.code_suggestions = await this.generateCodeSuggestions(
                fileContext,
                cursorPosition,
                context
            );
            
            return predictions;
            
        } catch (error) {
            this.logger.error('Failed to predict next action:', error);
            throw error;
        }
    }
    
    /**
     * Get team analytics
     */
    async getTeamAnalytics({ period, metrics }) {
        try {
            const analytics = {
                period,
                complexityTrends: {},
                commonPatterns: [],
                recommendations: []
            };
            
            // Analyze complexity trends
            if (metrics.includes('complexity_trends')) {
                analytics.complexityTrends = await this.analyzeComplexityTrends(period);
            }
            
            // Find common patterns
            if (metrics.includes('refactoring_patterns')) {
                analytics.commonPatterns = await this.findCommonPatterns(period);
            }
            
            // Generate recommendations
            analytics.recommendations = await this.generateTeamRecommendations(analytics);
            
            return analytics;
            
        } catch (error) {
            this.logger.error('Failed to get team analytics:', error);
            throw error;
        }
    }
    
    // Helper methods
    
    generateCodeContextId(file, functionName) {
        return crypto.createHash('sha256')
            .update(`${file}:${functionName || 'global'}`)
            .digest('hex')
            .substring(0, 16);
    }
    
    generateRelationId(source, target) {
        const sourceStr = `${source.file}:${source.function || ''}`;
        const targetStr = `${target.file}:${target.function || ''}`;
        return crypto.createHash('sha256')
            .update(`${sourceStr}->${targetStr}`)
            .digest('hex')
            .substring(0, 16);
    }
    
    getCachedResult(key) {
        const cached = this.searchCache.get(key);
        if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
            return cached.data;
        }
        this.searchCache.delete(key);
        return null;
    }
    
    setCachedResult(key, data) {
        this.searchCache.set(key, {
            data,
            timestamp: Date.now()
        });
        
        // Cleanup old cache entries
        if (this.searchCache.size > 1000) {
            const oldest = Array.from(this.searchCache.entries())
                .sort((a, b) => a[1].timestamp - b[1].timestamp)
                .slice(0, 100);
            oldest.forEach(([k]) => this.searchCache.delete(k));
        }
    }
    
    async fuseSearchResults(contextualResults, structuralResults, query, context) {
        const fusedResults = {
            query,
            context,
            results: [],
            sources: {
                contextual: contextualResults?.memories?.length || 0,
                structural: structuralResults?.results?.length || 0
            },
            timestamp: Date.now()
        };
        
        // Combine and deduplicate results
        const resultMap = new Map();
        
        // Add contextual results
        if (contextualResults?.memories) {
            contextualResults.memories.forEach(memory => {
                const id = memory.id || crypto.randomBytes(8).toString('hex');
                resultMap.set(id, {
                    ...memory,
                    source: 'contextual',
                    score: memory.score || 0.8
                });
            });
        }
        
        // Add structural results
        if (structuralResults?.results) {
            structuralResults.results.forEach(result => {
                const id = result.id || crypto.randomBytes(8).toString('hex');
                if (!resultMap.has(id)) {
                    resultMap.set(id, {
                        ...result,
                        source: 'structural',
                        score: result.score || 0.7
                    });
                }
            });
        }
        
        // Sort by score and convert to array
        fusedResults.results = Array.from(resultMap.values())
            .sort((a, b) => (b.score || 0) - (a.score || 0));
        
        return fusedResults;
    }
    
    async analyzeCode(content) {
        // Check cache first
        const cacheKey = crypto.createHash('md5').update(content).digest('hex');
        if (this.analysisCache.has(cacheKey)) {
            return this.analysisCache.get(cacheKey);
        }
        
        const analysis = {
            patterns: this.detectPatterns(content),
            dependencies: this.extractDependencies(content),
            style: this.detectCodeStyle(content),
            complexity: this.calculateComplexity(content),
            metadata: {
                lines: content.split('\n').length,
                language: this.detectLanguage(content)
            }
        };
        
        // Cache the analysis
        this.analysisCache.set(cacheKey, analysis);
        
        // Cleanup cache if too large
        if (this.analysisCache.size > 100) {
            const keys = Array.from(this.analysisCache.keys());
            keys.slice(0, 20).forEach(k => this.analysisCache.delete(k));
        }
        
        return analysis;
    }
    
    detectPatterns(content) {
        const patterns = [];
        
        // Common patterns detection
        if (content.includes('async') || content.includes('await')) {
            patterns.push('async-await');
        }
        if (content.includes('class')) {
            patterns.push('object-oriented');
        }
        if (content.includes('=>')) {
            patterns.push('arrow-functions');
        }
        if (content.includes('function*')) {
            patterns.push('generators');
        }
        if (content.match(/\b(map|filter|reduce)\b/)) {
            patterns.push('functional-programming');
        }
        if (content.includes('try') && content.includes('catch')) {
            patterns.push('error-handling');
        }
        
        return patterns;
    }
    
    extractDependencies(content) {
        const dependencies = [];
        
        // Simple import/require detection
        const importRegex = /(?:import|require)\s*\(?\s*['"]([^'"]+)['"]\s*\)?/g;
        let match;
        
        while ((match = importRegex.exec(content)) !== null) {
            dependencies.push(match[1]);
        }
        
        return [...new Set(dependencies)];
    }
    
    detectCodeStyle(content) {
        // Simple style detection
        const style = {
            indentation: content.includes('\t') ? 'tabs' : 'spaces',
            quotes: content.includes('"') ? 'double' : 'single',
            semicolons: content.includes(';') ? 'yes' : 'no',
            paradigm: content.includes('class') ? 'oop' : 'functional'
        };
        
        return style;
    }
    
    calculateComplexity(content) {
        // Simplified cyclomatic complexity
        let complexity = 1;
        
        const complexityKeywords = ['if', 'else', 'for', 'while', 'case', 'catch'];
        for (const keyword of complexityKeywords) {
            const regex = new RegExp(`\\b${keyword}\\b`, 'g');
            const matches = content.match(regex);
            if (matches) {
                complexity += matches.length;
            }
        }
        
        return complexity < 5 ? 'low' : complexity < 10 ? 'medium' : 'high';
    }
    
    detectLanguage(content) {
        // Simple language detection
        if (content.includes('const') || content.includes('let')) return 'javascript';
        if (content.includes('def') && content.includes('import')) return 'python';
        if (content.includes('#include')) return 'cpp';
        if (content.includes('package') && content.includes('func')) return 'go';
        if (content.includes('fn') && content.includes('let')) return 'rust';
        return 'unknown';
    }
    
    async analyzeCodeContext(query, context) {
        // Analyze query for code-specific intent
        const intent = {
            searchingForFunction: query.includes('function') || query.includes('()'),
            searchingForClass: query.includes('class'),
            searchingForPattern: query.includes('pattern') || query.includes('example'),
            searchingForUsage: query.includes('usage') || query.includes('how to use')
        };
        
        return {
            intent,
            suggestedFilters: this.suggestSearchFilters(intent, context)
        };
    }
    
    async findCodeRelations(query, context) {
        if (!this.structuralMemory) {
            return [];
        }
        
        // For now, use semantic search for relations
        // In a full implementation, we would have a dedicated relation search
        try {
            const results = await this.structuralMemory.semanticSearch(query, 10);
            return results.results || [];
        } catch (error) {
            this.logger.debug('Code relations search failed:', error);
            return [];
        }
    }
    
    async fuseCodingResults(hybridResults, codeContext, codeRelations) {
        // Combine and rank results
        const fusedResults = {
            ...hybridResults,
            codeContext,
            relations: codeRelations,
            enhanced: true
        };
        
        // Re-rank based on code relevance
        if (fusedResults.results) {
            fusedResults.results = this.rankByCodeRelevance(
                fusedResults.results,
                codeContext.intent
            );
        }
        
        return fusedResults;
    }
    
    rankByCodeRelevance(results, intent) {
        // Apply code-specific ranking
        return results.map(result => {
            let score = result.score || 0;
            
            // Boost based on intent match
            if (intent.searchingForFunction && result.type === 'function') {
                score += 0.2;
            }
            if (intent.searchingForClass && result.type === 'class') {
                score += 0.2;
            }
            if (intent.searchingForPattern && result.patterns) {
                score += 0.15;
            }
            
            return { ...result, score };
        }).sort((a, b) => b.score - a.score);
    }
    
    suggestSearchFilters(intent, context) {
        const filters = [];
        
        if (intent.searchingForFunction) {
            filters.push({ type: 'function' });
        }
        if (intent.searchingForClass) {
            filters.push({ type: 'class' });
        }
        if (context.language) {
            filters.push({ language: context.language });
        }
        
        return filters;
    }
    
    async getCodeContext(file, functionName) {
        if (!this.contextualMemory) {
            return null;
        }
        
        const contextId = this.generateCodeContextId(file, functionName);
        const results = await this.contextualMemory.searchMemory(contextId, 'system');
        return results.memories?.[0];
    }
    
    async getCodeRelations(file, functionName) {
        if (!this.structuralMemory) {
            return [];
        }
        
        return this.structuralMemory.getRelations({
            source: { file, function: functionName }
        }).catch(() => []);
    }
    
    async getRecentChanges(file) {
        // This would integrate with git history
        return 'No recent changes tracked';
    }
    
    async findSimilarPatterns(patterns) {
        if (!patterns || patterns.length === 0 || !this.contextualMemory) {
            return [];
        }
        
        const results = await this.contextualMemory.searchMemory(
            patterns.join(' '),
            'system',
            { type: 'pattern' }
        ).catch(() => ({ memories: [] }));
        
        return results.memories?.map(m => m.content) || [];
    }
    
    async suggestImprovements(context) {
        const suggestions = [];
        
        if (context.complexity === 'high') {
            suggestions.push('Consider breaking down into smaller functions');
        }
        if (!context.tests) {
            suggestions.push('Add unit tests for better coverage');
        }
        if (context.dependencies?.length > 10) {
            suggestions.push('Review dependencies - possible over-coupling');
        }
        
        return suggestions;
    }
    
    async analyzeRefactoringOpportunities(context, issues) {
        // Simplified refactoring analysis
        return {
            strategy: 'extract_method',
            extractedMethods: [
                { name: 'extractedFunction1', purpose: 'Handle validation' },
                { name: 'extractedFunction2', purpose: 'Process data' }
            ],
            requiresTestUpdate: true,
            hasBreakingChanges: false,
            complexityReduction: '30%',
            example: '// Example refactored code here'
        };
    }
    
    async findAffectedFiles(file, functionName) {
        const relations = await this.getCodeRelations(file, functionName);
        return [...new Set(relations.map(r => r.target.file))];
    }
    
    async calculateChangeMetrics(changes) {
        return {
            filesChanged: Object.keys(changes).length,
            linesAdded: Object.values(changes).reduce((sum, c) => sum + (c.added || 0), 0),
            linesRemoved: Object.values(changes).reduce((sum, c) => sum + (c.removed || 0), 0)
        };
    }
    
    async updatePatternKnowledge(patternType, description) {
        if (!this.contextualMemory) {
            return;
        }
        
        await this.contextualMemory.addUserMemory(
            'system',
            `Pattern: ${patternType} - ${description}`,
            { type: 'pattern', patternType, description }
        );
    }
    
    async analyzeStyleAspect(files, aspect) {
        // Simplified style analysis
        return {
            patterns: {
                dominant: 'camelCase',
                frequency: 0.85
            },
            examples: ['exampleFunction', 'anotherExample']
        };
    }
    
    async analyzeRecentPatterns(recentActions) {
        // Pattern analysis from recent actions
        return {
            common_sequences: ['edit->test->commit', 'refactor->test'],
            frequent_files: ['src/index.js', 'tests/main.test.js']
        };
    }
    
    async generateCodeSuggestions(fileContext, cursorPosition, context) {
        // Generate contextual code suggestions
        return [
            "const result = await processData(input);",
            "if (error) throw new Error('Processing failed');"
        ];
    }
    
    async analyzeComplexityTrends(period) {
        return {
            increasing: ['auth module', 'payment processing'],
            stable: ['utility functions'],
            decreasing: ['user management']
        };
    }
    
    async findCommonPatterns(period) {
        return [
            'async/await for all IO operations',
            'functional programming in utilities',
            'dependency injection for services'
        ];
    }
    
    async generateTeamRecommendations(analytics) {
        const recommendations = [];
        
        if (analytics.complexityTrends.increasing?.length > 0) {
            recommendations.push('Review increasing complexity in: ' + 
                analytics.complexityTrends.increasing.join(', '));
        }
        
        recommendations.push('Standardize on common patterns found');
        recommendations.push('Consider team code review sessions');
        
        return recommendations;
    }
    
    // Prediction methods
    
    async analyzeCodeComplexity(code) {
        return this.calculateComplexity(code);
    }
    
    async analyzeCodeDependencies(code) {
        return this.extractDependencies(code);
    }
    
    async analyzeCodePatterns(code) {
        return this.detectPatterns(code);
    }
    
    async analyzeCodeStyle(code) {
        return this.detectCodeStyle(code);
    }
    
    async predictNextAction(context) {
        return {
            actions: [
                { action: 'add_test', confidence: 0.85 },
                { action: 'refactor', confidence: 0.65 },
                { action: 'add_documentation', confidence: 0.55 }
            ],
            confidence: { overall: 0.75 }
        };
    }
    
    async predictRefactoring(context) {
        return {
            needed: true,
            confidence: 0.8,
            suggestions: ['extract_method', 'simplify_conditions']
        };
    }
    
    async predictCodeQuality(context) {
        return {
            quality_score: 7.5,
            issues: ['high_complexity', 'missing_tests'],
            trend: 'improving'
        };
    }
}

module.exports = CodingMemoryManager;