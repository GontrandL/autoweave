const { CodingMemoryManager } = require('../../src/memory/coding/coding-memory-manager');

describe('CodingMemoryManager', () => {
    let codingMemory;
    
    beforeEach(async () => {
        codingMemory = new CodingMemoryManager({
            mem0: { mock: true },
            graph: { mock: true },
            redis: { mock: true }
        });
        await codingMemory.initialize();
    });
    
    afterEach(async () => {
        // Cleanup if needed
    });
    
    describe('Code Context Memory', () => {
        test('should remember code context', async () => {
            const context = {
                file: 'test.js',
                function: 'testFunction',
                purpose: 'Test function for unit tests',
                patterns: ['testing'],
                dependencies: ['jest'],
                content: 'function testFunction() { return true; }'
            };
            
            const result = await codingMemory.rememberCodeContext(context);
            
            expect(result).toBeDefined();
            expect(result.success).toBe(true);
            expect(result.contextId).toBeDefined();
        });
        
        test('should analyze code patterns', async () => {
            const content = `
                async function fetchData() {
                    const result = await api.get('/data');
                    return result.data;
                }
            `;
            
            const analysis = await codingMemory.analyzeCode(content);
            
            expect(analysis.patterns).toContain('async-await');
            expect(analysis.complexity).toBe('low');
        });
        
        test('should detect code style', async () => {
            const content = `
                const myFunction = () => {
                    return "test";
                };
            `;
            
            const analysis = await codingMemory.analyzeCode(content);
            
            expect(analysis.style.quotes).toBe('double');
            expect(analysis.style.paradigm).toBe('functional');
        });
    });
    
    describe('Code Relations', () => {
        test('should create code relations', async () => {
            const relation = {
                source: { file: 'a.js', function: 'funcA' },
                target: { file: 'b.js', function: 'funcB' },
                relationship: 'calls',
                frequency: 'high'
            };
            
            const result = await codingMemory.createCodeRelation(relation);
            
            expect(result).toBeDefined();
            expect(result.success).toBe(true);
            expect(result.relation).toBeDefined();
        });
    });
    
    describe('Code Search', () => {
        test('should search code context', async () => {
            // First add some context
            await codingMemory.rememberCodeContext({
                file: 'auth.js',
                function: 'validateToken',
                purpose: 'JWT token validation',
                patterns: ['authentication', 'security']
            });
            
            const results = await codingMemory.intelligentCodeSearch('JWT validation', {});
            
            expect(results).toBeDefined();
            expect(results.results).toBeDefined();
        });
    });
    
    describe('Refactoring Suggestions', () => {
        test('should suggest refactoring for complex code', async () => {
            const context = {
                file: 'complex.js',
                function: 'complexFunction',
                purpose: 'Complex logic',
                complexity: 'high'
            };
            
            await codingMemory.rememberCodeContext(context);
            
            const suggestions = await codingMemory.suggestRefactoring({
                file: 'complex.js',
                functionName: 'complexFunction',
                issues: ['high_complexity']
            });
            
            expect(suggestions).toBeDefined();
            expect(suggestions.strategy).toBeDefined();
            expect(suggestions.impactAnalysis).toBeDefined();
        });
    });
    
    describe('Learning from Commits', () => {
        test('should learn from commit patterns', async () => {
            const commitData = {
                commit: 'abc123',
                changes: {
                    added: ['new-feature.js'],
                    modified: ['existing.js'],
                    deleted: []
                },
                patterns: {
                    'feature_addition': 'Added new authentication feature',
                    'test_coverage': 'Added unit tests'
                }
            };
            
            const result = await codingMemory.learnFromCommit(commitData);
            
            expect(result).toBeDefined();
            expect(result.success).toBe(true);
            expect(result.learning).toBeDefined();
        });
    });
    
    describe('Code Style Learning', () => {
        test('should learn code style from files', async () => {
            const styleData = {
                project: 'test-project',
                files: ['file1.js', 'file2.js'],
                aspects: ['naming_conventions', 'function_structure']
            };
            
            const result = await codingMemory.learnCodeStyle(styleData);
            
            expect(result).toBeDefined();
            expect(result.aspects).toBeDefined();
            expect(result.timestamp).toBeDefined();
        });
    });
    
    describe('Predictive Features', () => {
        test('should predict next developer action', async () => {
            const context = {
                currentFile: 'test.js',
                cursorPosition: { line: 10, column: 20 },
                recentActions: ['added_import', 'created_function'],
                context: 'implementing_feature'
            };
            
            const predictions = await codingMemory.predictNextAction(context);
            
            expect(predictions).toBeDefined();
            expect(predictions.likely_next_actions).toBeDefined();
            expect(predictions.code_suggestions).toBeDefined();
        });
    });
    
    describe('Team Analytics', () => {
        test('should generate team analytics', async () => {
            const analyticsRequest = {
                period: '7days',
                metrics: ['complexity_trends', 'refactoring_patterns']
            };
            
            const analytics = await codingMemory.getTeamAnalytics(analyticsRequest);
            
            expect(analytics).toBeDefined();
            expect(analytics.complexityTrends).toBeDefined();
            expect(analytics.recommendations).toBeDefined();
        });
    });
    
    describe('Edge Cases', () => {
        test('should handle empty code content', async () => {
            const analysis = await codingMemory.analyzeCode('');
            
            expect(analysis).toBeDefined();
            expect(analysis.patterns).toEqual([]);
            expect(analysis.dependencies).toEqual([]);
        });
        
        test('should handle missing function name', async () => {
            const context = {
                file: 'test.js',
                // function name missing
                purpose: 'Test without function name'
            };
            
            const result = await codingMemory.rememberCodeContext(context);
            
            expect(result).toBeDefined();
            // Should still work with generated ID
        });
        
        test('should handle search with no results', async () => {
            const results = await codingMemory.intelligentCodeSearch('nonexistent query xyz123', {});
            
            expect(results).toBeDefined();
            expect(results.results).toBeDefined();
            expect(Array.isArray(results.results)).toBe(true);
        });
    });
});

// Export for Jest
module.exports = {
    CodingMemoryManager
};