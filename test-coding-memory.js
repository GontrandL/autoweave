/**
 * Test script for Coding Memory functionality
 */

const fetch = require('node-fetch');

const BASE_URL = 'http://localhost:3000';

async function testCodingMemory() {
    console.log('🧪 Testing Coding Memory Module...\n');
    
    // Test 1: Remember code context
    console.log('1. Testing remember code context...');
    try {
        const contextResponse = await fetch(`${BASE_URL}/api/memory/code/context`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                file: 'src/services/auth.js',
                function: 'validateToken',
                purpose: 'JWT validation with refresh logic',
                patterns: ['authentication', 'security', 'middleware'],
                dependencies: ['jsonwebtoken', 'crypto'],
                linkedFiles: ['middleware/auth.js', 'models/user.js'],
                codeStyle: 'functional',
                complexity: 'medium',
                content: `
async function validateToken(token) {
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        if (decoded.exp < Date.now() / 1000) {
            return refreshToken(token);
        }
        return { valid: true, decoded };
    } catch (error) {
        return { valid: false, error };
    }
}`
            })
        });
        
        const contextResult = await contextResponse.json();
        console.log('✅ Code context remembered:', contextResult);
    } catch (error) {
        console.error('❌ Failed to remember code context:', error.message);
    }
    
    // Test 2: Create code relation
    console.log('\n2. Testing create code relation...');
    try {
        const relationResponse = await fetch(`${BASE_URL}/api/memory/code/relations`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                type: 'function_calls',
                source: { file: 'src/services/auth.js', function: 'validateToken' },
                target: { file: 'middleware/auth.js', function: 'authorize' },
                relationship: 'calls',
                frequency: 'high',
                dataFlow: ['token', 'user', 'permissions']
            })
        });
        
        const relationResult = await relationResponse.json();
        console.log('✅ Code relation created:', relationResult);
    } catch (error) {
        console.error('❌ Failed to create code relation:', error.message);
    }
    
    // Test 3: Search code context
    console.log('\n3. Testing search code context...');
    try {
        const searchResponse = await fetch(`${BASE_URL}/api/memory/code/search-similar`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                query: 'JWT validation',
                context: {
                    language: 'javascript',
                    includeRelations: true
                }
            })
        });
        
        const searchResult = await searchResponse.json();
        console.log('✅ Code search results:', searchResult);
    } catch (error) {
        console.error('❌ Failed to search code context:', error.message);
    }
    
    // Test 4: Explain code
    console.log('\n4. Testing explain code...');
    try {
        const explainResponse = await fetch(`${BASE_URL}/api/memory/code/explain`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                file: 'src/services/auth.js',
                functionName: 'validateToken'
            })
        });
        
        const explainResult = await explainResponse.json();
        console.log('✅ Code explanation:', explainResult);
    } catch (error) {
        console.error('❌ Failed to explain code:', error.message);
    }
    
    // Test 5: Suggest refactoring
    console.log('\n5. Testing suggest refactoring...');
    try {
        const refactorResponse = await fetch(`${BASE_URL}/api/memory/code/suggest-refactor`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                file: 'src/services/auth.js',
                functionName: 'validateToken',
                issues: ['high_complexity', 'multiple_responsibilities']
            })
        });
        
        const refactorResult = await refactorResponse.json();
        console.log('✅ Refactoring suggestions:', refactorResult);
    } catch (error) {
        console.error('❌ Failed to suggest refactoring:', error.message);
    }
    
    // Test 6: Health check
    console.log('\n6. Testing coding memory health...');
    try {
        const healthResponse = await fetch(`${BASE_URL}/api/memory/code/health`);
        const healthResult = await healthResponse.json();
        console.log('✅ Coding memory health:', healthResult);
    } catch (error) {
        console.error('❌ Failed to check health:', error.message);
    }
    
    // Test 7: MCP Tool - Remember code context
    console.log('\n7. Testing MCP tool - remember code context...');
    try {
        const mcpResponse = await fetch(`http://localhost:3002/mcp/v1/tools/autoweave-coding-memory-remember-code-context`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                file: 'src/utils/logger.js',
                function: 'logError',
                purpose: 'Centralized error logging with stack traces',
                patterns: ['logging', 'error-handling'],
                complexity: 'low'
            })
        });
        
        const mcpResult = await mcpResponse.json();
        console.log('✅ MCP tool result:', mcpResult);
    } catch (error) {
        console.error('❌ Failed to use MCP tool:', error.message);
    }
    
    console.log('\n✨ Coding Memory tests completed!');
}

// Run tests
testCodingMemory().catch(console.error);