const { Logger } = require('../../utils/logger');
const { spawn } = require('child_process');
const fs = require('fs').promises;
const path = require('path');

/**
 * Pydantic Generator
 * Generates Pydantic models from OpenAPI specifications
 */
class PydanticGenerator {
    constructor(config) {
        this.config = config;
        this.logger = new Logger('PydanticGenerator');
        this.pythonBridge = process.env.AUTOWEAVE_PYTHON_BRIDGE || 
                           path.join(__dirname, 'python-bridge.py');
        this.outputDir = path.join(__dirname, 'generated-models');
    }

    async initialize() {
        this.logger.info('Initializing Pydantic Generator...');
        
        try {
            // Create output directory
            await fs.mkdir(this.outputDir, { recursive: true });
            
            // Verify Python bridge is available
            await this.verifyPythonBridge();
            
            this.logger.success('Pydantic Generator initialized successfully');
        } catch (error) {
            this.logger.error('Failed to initialize Pydantic Generator:', error);
            throw error;
        }
    }

    /**
     * Verify Python bridge is available
     */
    async verifyPythonBridge() {
        try {
            await fs.access(this.pythonBridge);
            this.logger.debug('Python bridge verified');
        } catch (error) {
            throw new Error(`Python bridge not available at ${this.pythonBridge}`);
        }
    }

    /**
     * Generate Pydantic models from OpenAPI specification
     * @param {Object} openAPISpec - OpenAPI specification object
     * @returns {Promise<Object>} Generated models information
     */
    async generateModels(openAPISpec) {
        this.logger.info('Generating Pydantic models...');
        
        try {
            // Create temporary spec file
            const tempSpecFile = path.join('/tmp', `openapi-spec-${Date.now()}.json`);
            await fs.writeFile(tempSpecFile, JSON.stringify(openAPISpec, null, 2));
            
            // Generate model name based on API title
            const apiTitle = openAPISpec.info?.title || 'API';
            const modelName = this.sanitizeModelName(apiTitle);
            const outputFile = path.join(this.outputDir, `${modelName}_models.py`);
            
            // Execute Python bridge to generate models
            const result = await this.executePythonBridge([
                'generate',
                '--spec', tempSpecFile,
                '--output', outputFile
            ]);
            
            const generationResult = JSON.parse(result);
            
            if (!generationResult.success) {
                throw new Error(`Failed to generate models: ${generationResult.error}`);
            }
            
            // Read generated models
            const modelsCode = await fs.readFile(outputFile, 'utf8');
            
            // Clean up temporary file
            await fs.unlink(tempSpecFile);
            
            // Parse models to extract information
            const modelsInfo = this.parseModelsCode(modelsCode);
            
            const result_data = {
                success: true,
                outputFile,
                modelsCode,
                modelsInfo,
                apiTitle,
                modelName,
                generatedAt: new Date().toISOString()
            };
            
            this.logger.success('Pydantic models generated successfully:', {
                modelName,
                outputFile,
                modelsCount: modelsInfo.models.length
            });
            
            return result_data;
            
        } catch (error) {
            this.logger.error('Failed to generate Pydantic models:', error);
            throw error;
        }
    }

    /**
     * Parse generated models code to extract information
     * @param {string} modelsCode - Generated models code
     * @returns {Object} Parsed models information
     */
    parseModelsCode(modelsCode) {
        const modelsInfo = {
            models: [],
            imports: [],
            enums: [],
            totalLines: modelsCode.split('\n').length
        };
        
        const lines = modelsCode.split('\n');
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            
            // Extract imports
            if (line.startsWith('from ') || line.startsWith('import ')) {
                modelsInfo.imports.push(line);
            }
            
            // Extract class definitions
            if (line.startsWith('class ')) {
                const classMatch = line.match(/class (\w+)/);
                if (classMatch) {
                    const className = classMatch[1];
                    
                    // Determine if it's a model or enum
                    if (line.includes('BaseModel')) {
                        modelsInfo.models.push({
                            name: className,
                            type: 'model',
                            line: i + 1
                        });
                    } else if (line.includes('Enum')) {
                        modelsInfo.enums.push({
                            name: className,
                            type: 'enum',
                            line: i + 1
                        });
                    }
                }
            }
        }
        
        return modelsInfo;
    }

    /**
     * Sanitize model name for file naming
     * @param {string} title - API title
     * @returns {string} Sanitized model name
     */
    sanitizeModelName(title) {
        return title
            .toLowerCase()
            .replace(/[^a-z0-9]/g, '_')
            .replace(/_{2,}/g, '_')
            .replace(/^_|_$/g, '');
    }

    /**
     * Generate Python integration code
     * @param {Object} openAPISpec - OpenAPI specification
     * @param {Object} modelsInfo - Generated models information
     * @returns {Promise<string>} Integration code
     */
    async generateIntegrationCode(openAPISpec, modelsInfo) {
        this.logger.info('Generating integration code...');
        
        const apiTitle = openAPISpec.info?.title || 'API';
        const modelName = this.sanitizeModelName(apiTitle);
        const className = this.toPascalCase(modelName);
        
        const integrationCode = `#!/usr/bin/env python3
"""
${apiTitle} Integration Agent
Generated by AutoWeave Integration Agent
"""

import asyncio
import logging
from typing import Dict, Any, Optional, List
from datetime import datetime
import httpx
from prometheus_client import Counter, Histogram, start_http_server
from pydantic import BaseModel, Field

# Import generated models
from ${modelName}_models import *

# Metrics
REQUEST_COUNT = Counter('integration_requests_total', 'Total integration requests', ['method', 'endpoint'])
REQUEST_DURATION = Histogram('integration_request_duration_seconds', 'Request duration')
ERROR_COUNT = Counter('integration_errors_total', 'Total integration errors', ['error_type'])

class ${className}Integration:
    """Integration class for ${apiTitle}"""
    
    def __init__(self, base_url: str, api_key: Optional[str] = None):
        self.base_url = base_url.rstrip('/')
        self.api_key = api_key
        self.client = httpx.AsyncClient(
            base_url=self.base_url,
            timeout=30.0,
            headers=self._get_headers()
        )
        self.logger = logging.getLogger(__name__)
    
    def _get_headers(self) -> Dict[str, str]:
        """Get request headers"""
        headers = {
            'Content-Type': 'application/json',
            'User-Agent': 'AutoWeave-Integration-Agent/1.0'
        }
        
        if self.api_key:
            headers['Authorization'] = f'Bearer {self.api_key}'
        
        return headers
    
    async def health_check(self) -> Dict[str, Any]:
        """Perform health check"""
        try:
            response = await self.client.get('/health')
            return {
                'status': 'healthy' if response.status_code == 200 else 'unhealthy',
                'status_code': response.status_code,
                'timestamp': datetime.utcnow().isoformat()
            }
        except Exception as e:
            ERROR_COUNT.labels(error_type='health_check').inc()
            return {
                'status': 'unhealthy',
                'error': str(e),
                'timestamp': datetime.utcnow().isoformat()
            }
    
    async def make_request(self, method: str, endpoint: str, data: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """Make HTTP request to API"""
        with REQUEST_DURATION.time():
            REQUEST_COUNT.labels(method=method, endpoint=endpoint).inc()
            
            try:
                response = await self.client.request(
                    method=method,
                    url=endpoint,
                    json=data if data else None
                )
                
                response.raise_for_status()
                return response.json()
                
            except httpx.HTTPError as e:
                ERROR_COUNT.labels(error_type='http_error').inc()
                self.logger.error(f"HTTP error: {e}")
                raise
            except Exception as e:
                ERROR_COUNT.labels(error_type='unknown').inc()
                self.logger.error(f"Unexpected error: {e}")
                raise
    
    async def close(self):
        """Close HTTP client"""
        await self.client.aclose()

# Generated endpoint methods
${this.generateEndpointMethods(openAPISpec)}

async def main():
    """Main function for standalone execution"""
    import os
    
    # Setup logging
    logging.basicConfig(level=logging.INFO)
    
    # Start metrics server
    start_http_server(9090)
    
    # Initialize integration
    base_url = os.getenv('${modelName.toUpperCase()}_BASE_URL', '${openAPISpec.servers?.[0]?.url || 'https://api.example.com'}')
    api_key = os.getenv('${modelName.toUpperCase()}_API_KEY')
    
    integration = ${className}Integration(base_url, api_key)
    
    try:
        # Perform health check
        health = await integration.health_check()
        print(f"Health check: {health}")
        
        # Keep running
        while True:
            await asyncio.sleep(60)
            
    except KeyboardInterrupt:
        print("Shutting down...")
    finally:
        await integration.close()

if __name__ == "__main__":
    asyncio.run(main())
`;
        
        // Write integration code to file
        const integrationFile = path.join(this.outputDir, `${modelName}_integration.py`);
        await fs.writeFile(integrationFile, integrationCode);
        
        this.logger.success('Integration code generated:', integrationFile);
        
        return integrationCode;
    }

    /**
     * Generate endpoint methods from OpenAPI spec
     * @param {Object} openAPISpec - OpenAPI specification
     * @returns {string} Generated endpoint methods
     */
    generateEndpointMethods(openAPISpec) {
        let methods = '';
        
        if (openAPISpec.paths) {
            for (const [path, pathItem] of Object.entries(openAPISpec.paths)) {
                const httpMethods = Object.keys(pathItem).filter(key => 
                    ['get', 'post', 'put', 'patch', 'delete'].includes(key)
                );
                
                for (const method of httpMethods) {
                    const operation = pathItem[method];
                    const methodName = this.generateMethodName(method, path, operation);
                    
                    methods += `
    async def ${methodName}(self, **kwargs) -> Dict[str, Any]:
        """${operation.summary || `${method.toUpperCase()} ${path}`}"""
        return await self.make_request('${method.toUpperCase()}', '${path}', kwargs.get('data'))
`;
                }
            }
        }
        
        return methods;
    }

    /**
     * Generate method name from HTTP method and path
     * @param {string} method - HTTP method
     * @param {string} path - API path
     * @param {Object} operation - OpenAPI operation
     * @returns {string} Generated method name
     */
    generateMethodName(method, path, operation) {
        if (operation.operationId) {
            return this.toSnakeCase(operation.operationId);
        }
        
        // Generate from method and path
        const pathParts = path.split('/').filter(part => part && !part.startsWith('{'));
        const methodPrefix = method === 'get' ? 'get' : method === 'post' ? 'create' : 
                           method === 'put' ? 'update' : method === 'patch' ? 'patch' : 'delete';
        
        const pathSuffix = pathParts.join('_');
        return `${methodPrefix}_${pathSuffix}`.replace(/[^a-z0-9_]/g, '');
    }

    /**
     * Convert string to PascalCase
     * @param {string} str - Input string
     * @returns {string} PascalCase string
     */
    toPascalCase(str) {
        return str.replace(/(?:^|_)([a-z])/g, (_, char) => char.toUpperCase());
    }

    /**
     * Convert string to snake_case
     * @param {string} str - Input string
     * @returns {string} snake_case string
     */
    toSnakeCase(str) {
        return str.replace(/([A-Z])/g, '_$1').toLowerCase().replace(/^_/, '');
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
     * List generated models
     * @returns {Promise<Array>} List of generated model files
     */
    async listGeneratedModels() {
        try {
            const files = await fs.readdir(this.outputDir);
            const modelFiles = files.filter(file => file.endsWith('.py'));
            
            const models = [];
            for (const file of modelFiles) {
                const filePath = path.join(this.outputDir, file);
                const stats = await fs.stat(filePath);
                
                models.push({
                    name: file,
                    path: filePath,
                    size: stats.size,
                    modified: stats.mtime
                });
            }
            
            return models;
        } catch (error) {
            this.logger.error('Failed to list generated models:', error);
            return [];
        }
    }

    /**
     * Clean up generated models
     * @returns {Promise<void>}
     */
    async cleanup() {
        try {
            const files = await fs.readdir(this.outputDir);
            for (const file of files) {
                await fs.unlink(path.join(this.outputDir, file));
            }
            this.logger.info('Generated models cleaned up');
        } catch (error) {
            this.logger.error('Failed to cleanup generated models:', error);
        }
    }
}

module.exports = { PydanticGenerator };