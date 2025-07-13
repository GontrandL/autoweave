const express = require('express');
const router = express.Router();
const { Logger } = require('@autoweave/shared');
const { spawn } = require('child_process');

const logger = new Logger('SearchRoutes');

/**
 * Routes pour les fonctions de recherche
 * Inclut recherche web, code, et documentation
 */

/**
 * POST /api/search/web
 * Recherche web avec fallback DuckDuckGo
 */
router.post('/web', async (req, res) => {
    try {
        const { query, domains, limit = 5 } = req.body;
        
        if (!query) {
            return res.status(400).json({
                success: false,
                error: 'Query parameter is required'
            });
        }
        
        logger.info(`Web search: ${query}`);
        
        // Utiliser DuckDuckGo API comme fallback
        const results = await performWebSearch(query, { domains, limit });
        
        res.json({
            success: true,
            query,
            results,
            source: 'duckduckgo-api'
        });
        
    } catch (error) {
        logger.error('Web search failed:', error);
        res.status(500).json({
            success: false,
            error: 'Web search failed',
            details: error.message
        });
    }
});

/**
 * POST /api/search/code
 * Recherche dans le code du projet
 */
router.post('/code', async (req, res) => {
    try {
        const { pattern, include = "*", context_lines = 3 } = req.body;
        
        if (!pattern) {
            return res.status(400).json({
                success: false,
                error: 'Pattern parameter is required'
            });
        }
        
        logger.info(`Code search: ${pattern}`);
        
        const results = await performCodeSearch(pattern, { include, context_lines });
        
        res.json({
            success: true,
            pattern,
            results
        });
        
    } catch (error) {
        logger.error('Code search failed:', error);
        res.status(500).json({
            success: false,
            error: 'Code search failed',
            details: error.message
        });
    }
});

/**
 * POST /api/search/documentation
 * Recherche dans la documentation
 */
router.post('/documentation', async (req, res) => {
    try {
        const { query, format = 'markdown' } = req.body;
        
        if (!query) {
            return res.status(400).json({
                success: false,
                error: 'Query parameter is required'
            });
        }
        
        logger.info(`Documentation search: ${query}`);
        
        const results = await searchDocumentation(query, format);
        
        res.json({
            success: true,
            query,
            results,
            format
        });
        
    } catch (error) {
        logger.error('Documentation search failed:', error);
        res.status(500).json({
            success: false,
            error: 'Documentation search failed',
            details: error.message
        });
    }
});

/**
 * GET /api/search/capabilities
 * Obtenir les capacités de recherche disponibles
 */
router.get('/capabilities', (req, res) => {
    res.json({
        success: true,
        capabilities: {
            web_search: {
                available: true,
                providers: ['duckduckgo-api'],
                features: ['query', 'domain_filtering', 'result_limiting']
            },
            code_search: {
                available: true,
                tools: ['ripgrep'],
                features: ['regex_patterns', 'file_filtering', 'context_lines']
            },
            documentation_search: {
                available: true,
                formats: ['markdown', 'text'],
                sources: ['local_files', 'generated_docs']
            }
        }
    });
});

// Helper Functions

async function performWebSearch(query, options = {}) {
    return new Promise((resolve, reject) => {
        const encodedQuery = encodeURIComponent(query);
        const url = `https://api.duckduckgo.com/?q=${encodedQuery}&format=json&no_html=1&skip_disambig=1`;
        
        const process = spawn('curl', ['-s', url]);
        
        let stdout = '';
        let stderr = '';
        
        process.stdout.on('data', (data) => {
            stdout += data.toString();
        });
        
        process.stderr.on('data', (data) => {
            stderr += data.toString();
        });
        
        process.on('close', (code) => {
            if (code === 0) {
                try {
                    const data = JSON.parse(stdout);
                    const results = [];
                    
                    // Extract main result
                    if (data.AbstractText) {
                        results.push({
                            title: data.Heading || 'DuckDuckGo Result',
                            content: data.AbstractText,
                            url: data.AbstractURL,
                            type: 'abstract'
                        });
                    }
                    
                    // Extract related topics
                    if (data.RelatedTopics && Array.isArray(data.RelatedTopics)) {
                        data.RelatedTopics.slice(0, options.limit - results.length).forEach(topic => {
                            if (topic.Text && topic.FirstURL) {
                                results.push({
                                    title: topic.Text.split(' - ')[0] || 'Related Topic',
                                    content: topic.Text,
                                    url: topic.FirstURL,
                                    type: 'related'
                                });
                            }
                        });
                    }
                    
                    resolve(results);
                } catch (parseError) {
                    reject(new Error(`Failed to parse search results: ${parseError.message}`));
                }
            } else {
                reject(new Error(`Web search failed: ${stderr}`));
            }
        });
        
        process.on('error', (error) => {
            reject(new Error(`Failed to execute web search: ${error.message}`));
        });
    });
}

async function performCodeSearch(pattern, options = {}) {
    return new Promise((resolve, reject) => {
        const args = [
            pattern,
            '--type-add', `include:${options.include}`,
            '-n', // Show line numbers
            '-C', options.context_lines.toString(), // Context lines
            '--json' // JSON output
        ];
        
        const process = spawn('rg', args, { cwd: process.cwd() });
        
        let stdout = '';
        let stderr = '';
        
        process.stdout.on('data', (data) => {
            stdout += data.toString();
        });
        
        process.stderr.on('data', (data) => {
            stderr += data.toString();
        });
        
        process.on('close', (code) => {
            if (code === 0 || code === 1) { // 0 = found, 1 = not found
                try {
                    const lines = stdout.trim().split('\n').filter(line => line.trim());
                    const results = lines.map(line => {
                        try {
                            return JSON.parse(line);
                        } catch (e) {
                            return null;
                        }
                    }).filter(Boolean);
                    
                    resolve(results);
                } catch (parseError) {
                    // Fallback to simple text parsing
                    const results = stdout.split('\n')
                        .filter(line => line.trim())
                        .map(line => ({ line, type: 'text' }));
                    resolve(results);
                }
            } else {
                reject(new Error(`Code search failed: ${stderr}`));
            }
        });
        
        process.on('error', (error) => {
            reject(new Error(`Failed to execute code search: ${error.message}`));
        });
    });
}

async function searchDocumentation(query, format) {
    return new Promise((resolve, reject) => {
        // Search in documentation files
        const args = [
            query,
            '--type', 'md',
            '--type', 'txt',
            '-i', // Case insensitive
            '-n', // Line numbers
            '-C', '2' // Context lines
        ];
        
        const process = spawn('rg', args, { cwd: process.cwd() });
        
        let stdout = '';
        let stderr = '';
        
        process.stdout.on('data', (data) => {
            stdout += data.toString();
        });
        
        process.stderr.on('data', (data) => {
            stderr += data.toString();
        });
        
        process.on('close', (code) => {
            if (code === 0 || code === 1) {
                const results = stdout.split('\n')
                    .filter(line => line.trim())
                    .map(line => {
                        const parts = line.split(':');
                        if (parts.length >= 3) {
                            return {
                                file: parts[0],
                                line: parseInt(parts[1]),
                                content: parts.slice(2).join(':').trim(),
                                type: 'documentation'
                            };
                        }
                        return { content: line, type: 'text' };
                    });
                
                resolve(results);
            } else {
                reject(new Error(`Documentation search failed: ${stderr}`));
            }
        });
        
        process.on('error', (error) => {
            reject(new Error(`Failed to execute documentation search: ${error.message}`));
        });
    });
}

module.exports = router;