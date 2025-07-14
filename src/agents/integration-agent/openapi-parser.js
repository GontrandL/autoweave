const { Logger } = require('../../utils/logger');
const { RetryHelper } = require('../../utils/retry');
const { spawn } = require('child_process');
const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');

/**
 * OpenAPI Parser
 * Handles parsing and validation of OpenAPI specifications
 */
class OpenAPIParser {
    constructor(config) {
        this.config = config;
        this.logger = new Logger('OpenAPIParser');
        this.retryHelper = new RetryHelper();
        this.pythonBridge = process.env.AUTOWEAVE_PYTHON_BRIDGE || 
                           path.join(__dirname, 'python-bridge.py');
    }

    async initialize() {
        this.logger.info('Initializing OpenAPI Parser...');
        
        try {
            // Verify Python bridge is available
            await this.verifyPythonBridge();
            
            this.logger.success('OpenAPI Parser initialized successfully');
        } catch (error) {
            this.logger.error('Failed to initialize OpenAPI Parser:', error);
            throw error;
        }
    }

    /**
     * Verify Python bridge is available and working
     */
    async verifyPythonBridge() {
        try {
            // Check if Python bridge file exists
            await fs.access(this.pythonBridge);
            
            // Test Python bridge execution with health check
            const result = await this.executePythonBridge(['health']);
            this.logger.debug('Python bridge verification successful');
            
        } catch (error) {
            this.logger.error('Python bridge verification failed:', error);
            
            // In test environment, allow graceful degradation
            if (process.env.NODE_ENV === 'test') {
                this.logger.warn('Running in test mode, Python bridge verification skipped');
                return;
            }
            
            throw new Error(`Python bridge not available at ${this.pythonBridge}. Run setup script first.`);
        }
    }

    /**
     * Parse OpenAPI specification from URL or file
     * @param {string} specSource - URL or file path to OpenAPI spec
     * @returns {Promise<Object>} Parsed and validated OpenAPI specification
     */
    async parseSpecification(specSource) {
        this.logger.info('Parsing OpenAPI specification:', specSource);
        
        try {
            // Execute Python bridge with retry logic
            const result = await this.executePythonBridge(['parse', '--spec-url', specSource]);

            const parsedResult = JSON.parse(result);
            
            if (!parsedResult.success) {
                throw new Error(`Failed to parse OpenAPI spec: ${parsedResult.error}`);
            }

            this.logger.success('OpenAPI specification parsed successfully:', {
                title: parsedResult.metadata?.title || 'Unknown',
                version: parsedResult.metadata?.version || 'Unknown',
                endpoints: parsedResult.metadata?.endpoints || 0
            });

            return parsedResult.spec;

        } catch (error) {
            this.logger.error('Failed to parse OpenAPI specification:', error);
            throw error;
        }
    }

    /**
     * Validate OpenAPI specification
     * @param {string} specSource - URL or file path to OpenAPI spec
     * @returns {Promise<Object>} Validation result
     */
    async validateSpecification(specSource) {
        this.logger.info('Validating OpenAPI specification:', specSource);
        
        try {
            const result = await this.executePythonBridge(['validate', '--spec', specSource]);
            const validationResult = JSON.parse(result);
            
            if (!validationResult.success) {
                throw new Error(`Validation failed: ${validationResult.error}`);
            }

            this.logger.success('OpenAPI specification validation passed:', validationResult.spec_info);
            return validationResult;

        } catch (error) {
            this.logger.error('OpenAPI specification validation failed:', error);
            throw error;
        }
    }

    /**
     * Extract metadata from OpenAPI specification
     * @param {Object} spec - OpenAPI specification object
     * @returns {Object} Extracted metadata
     */
    extractMetadata(spec) {
        const metadata = {
            title: spec.info?.title || 'Unknown API',
            version: spec.info?.version || '1.0.0',
            description: spec.info?.description || '',
            servers: spec.servers || [],
            paths: Object.keys(spec.paths || {}),
            components: Object.keys(spec.components?.schemas || {}),
            security: spec.security || [],
            tags: spec.tags || []
        };

        // Extract endpoint information
        metadata.endpoints = [];
        if (spec.paths) {
            for (const [path, pathItem] of Object.entries(spec.paths)) {
                const methods = Object.keys(pathItem).filter(key => 
                    ['get', 'post', 'put', 'patch', 'delete', 'head', 'options'].includes(key)
                );
                
                for (const method of methods) {
                    const operation = pathItem[method];
                    metadata.endpoints.push({
                        path,
                        method: method.toUpperCase(),
                        operationId: operation.operationId,
                        summary: operation.summary,
                        description: operation.description,
                        tags: operation.tags || []
                    });
                }
            }
        }

        // Extract authentication information
        metadata.authentication = [];
        if (spec.components?.securitySchemes) {
            for (const [name, scheme] of Object.entries(spec.components.securitySchemes)) {
                metadata.authentication.push({
                    name,
                    type: scheme.type,
                    scheme: scheme.scheme,
                    bearerFormat: scheme.bearerFormat,
                    description: scheme.description
                });
            }
        }

        return metadata;
    }

    /**
     * Analyze OpenAPI specification for integration patterns
     * @param {Object} spec - OpenAPI specification object
     * @returns {Object} Analysis result
     */
    analyzeSpecification(spec) {
        const analysis = {
            complexity: 'low',
            patterns: [],
            recommendations: [],
            warnings: []
        };

        const metadata = this.extractMetadata(spec);
        
        // Analyze complexity
        const endpointCount = metadata.endpoints.length;
        const schemaCount = metadata.components.length;
        
        if (endpointCount > 50 || schemaCount > 20) {
            analysis.complexity = 'high';
            analysis.recommendations.push('Consider creating multiple integration agents for different API sections');
        } else if (endpointCount > 20 || schemaCount > 10) {
            analysis.complexity = 'medium';
        }

        // Identify patterns
        const methods = metadata.endpoints.map(e => e.method);
        const hasREST = methods.includes('GET') && methods.includes('POST');
        const hasWebhooks = metadata.endpoints.some(e => e.path.includes('webhook'));
        const hasAuth = metadata.authentication.length > 0;
        
        if (hasREST) analysis.patterns.push('REST API');
        if (hasWebhooks) analysis.patterns.push('Webhooks');
        if (hasAuth) analysis.patterns.push('Authentication Required');

        // Generate recommendations
        if (hasAuth && !metadata.authentication.some(auth => auth.type === 'oauth2')) {
            analysis.recommendations.push('Consider implementing OAuth 2.0 for enhanced security');
        }

        if (endpointCount > 10 && !metadata.endpoints.some(e => e.path.includes('health'))) {
            analysis.recommendations.push('Add health check endpoints for better monitoring');
        }

        // Check for warnings
        if (metadata.servers.length === 0) {
            analysis.warnings.push('No servers defined in specification');
        }

        if (metadata.endpoints.some(e => !e.operationId)) {
            analysis.warnings.push('Some operations are missing operationId');
        }

        return analysis;
    }

    /**
     * Execute Python bridge command
     * @param {Array} args - Command arguments
     * @returns {Promise<string>} Command output
     */
    async executePythonBridge(args) {
        return new Promise((resolve, reject) => {
            // Use the virtual environment Python
            const virtualEnvPath = path.join(process.cwd(), 'scripts', 'integration-agent-env', 'bin', 'python');
            const pythonExec = process.env.INTEGRATION_AGENT_PYTHON || virtualEnvPath;
            
            const child = spawn(pythonExec, [this.pythonBridge, ...args]);
            let stdout = '';
            let stderr = '';

            child.stdout.on('data', (data) => {
                stdout += data.toString();
            });

            child.stderr.on('data', (data) => {
                stderr += data.toString();
            });

            child.on('close', (code) => {
                if (code === 0) {
                    resolve(stdout);
                } else {
                    reject(new Error(`Python bridge failed with code ${code}: ${stderr}`));
                }
            });

            child.on('error', (error) => {
                reject(error);
            });
        });
    }

    /**
     * Download OpenAPI specification from URL
     * @param {string} url - URL to download from
     * @returns {Promise<Object>} Downloaded specification
     */
    async downloadSpecification(url) {
        this.logger.info('Downloading OpenAPI specification from:', url);
        
        try {
            const response = await axios.get(url, {
                timeout: 30000,
                headers: {
                    'Accept': 'application/json, application/yaml, text/yaml',
                    'User-Agent': 'AutoWeave-Integration-Agent/1.0'
                }
            });

            let spec;
            if (typeof response.data === 'string') {
                // Try to parse as YAML first, then JSON
                try {
                    const yaml = require('yaml');
                    spec = yaml.parse(response.data);
                } catch (yamlError) {
                    spec = JSON.parse(response.data);
                }
            } else {
                spec = response.data;
            }

            this.logger.success('OpenAPI specification downloaded successfully');
            return spec;

        } catch (error) {
            this.logger.error('Failed to download OpenAPI specification:', error);
            throw error;
        }
    }
}

module.exports = { OpenAPIParser };