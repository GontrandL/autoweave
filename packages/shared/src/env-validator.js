/**
 * Environment Configuration Validator
 * Ensures all required environment variables are set
 */

class EnvironmentValidator {
    constructor() {
        this.requiredVars = {
            // Core
            'NODE_ENV': { default: 'development', description: 'Environment mode' },
            'PORT': { default: '3000', description: 'Server port' },
            
            // AI Providers
            'OPENAI_API_KEY': { required: true, description: 'OpenAI API key' },
            
            // Memory Systems
            'MEM0_API_KEY': { required: false, description: 'mem0 API key' },
            'QDRANT_HOST': { default: 'localhost', description: 'Qdrant host' },
            'MEMGRAPH_HOST': { default: 'localhost', description: 'Memgraph host' },
            'REDIS_HOST': { default: 'localhost', description: 'Redis host' },
            
            // Mock Settings
            'ENABLE_MOCKS': { default: 'false', description: 'Enable mock mode globally' },
            'MOCK_MEM0': { default: 'false', description: 'Mock mem0 service' },
            'MOCK_MEMGRAPH': { default: 'false', description: 'Mock Memgraph service' },
            'MOCK_REDIS': { default: 'false', description: 'Mock Redis service' }
        };
    }
    
    validate() {
        const errors = [];
        const warnings = [];
        
        for (const [varName, config] of Object.entries(this.requiredVars)) {
            const value = process.env[varName];
            
            if (!value && config.required) {
                errors.push(`Missing required environment variable: ${varName} - ${config.description}`);
            } else if (!value && config.default) {
                process.env[varName] = config.default;
                warnings.push(`Using default value for ${varName}: ${config.default}`);
            }
        }
        
        return { errors, warnings };
    }
    
    generateEnvTemplate() {
        const lines = ['# AutoWeave Environment Configuration\n'];
        
        for (const [varName, config] of Object.entries(this.requiredVars)) {
            lines.push(`# ${config.description}`);
            if (config.required) {
                lines.push(`# REQUIRED`);
            }
            lines.push(`${varName}=${config.default || ''}`);
            lines.push('');
        }
        
        return lines.join('\n');
    }
}

module.exports = EnvironmentValidator;
