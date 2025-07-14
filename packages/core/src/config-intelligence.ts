import OpenAI from 'openai';
import {
    ConfigIntelligenceConfig,
    IntentUnderstanding,
    ComponentsMap,
    FreshVersions,
    EnvironmentConstraints,
    GenerateConfigParams,
    GenerateConfigOptions,
    ConfigSuggestion,
    QuickConfig
} from './types';

import { Logger } from './logger';

/**
 * ConfigurationIntelligence - Intelligence de configuration avec sources fraîches
 * Analyse l'intention, trouve les dernières versions, et génère des configurations optimales
 */
export class ConfigurationIntelligence {
    private logger: any;
    private config: ConfigIntelligenceConfig;
    private openai?: OpenAI;
    private configPatterns: Record<string, {
        docker?: string[];
        npm?: string[];
        helm?: string[];
        keywords: string[];
    }>;

    constructor(config: ConfigIntelligenceConfig) {
        this.logger = config.logger || new Logger('ConfigIntelligence');
        this.config = config;
        
        if (config.openaiApiKey) {
            this.openai = new OpenAI({
                apiKey: config.openaiApiKey
            });
        }
        
        // Patterns de configuration connus
        this.configPatterns = {
            'vscode': {
                docker: ['codercom/code-server'],
                npm: ['code-server'],
                keywords: ['ide', 'editor', 'development']
            },
            'database': {
                docker: ['postgres', 'mysql', 'mongodb', 'redis'],
                helm: ['postgresql', 'mysql', 'mongodb', 'redis'],
                keywords: ['db', 'storage', 'persistence']
            },
            'monitoring': {
                docker: ['prom/prometheus', 'grafana/grafana', 'grafana/loki'],
                helm: ['prometheus', 'grafana', 'loki-stack'],
                keywords: ['metrics', 'logs', 'observability', 'telemetry']
            },
            'web-server': {
                docker: ['nginx', 'httpd', 'traefik'],
                helm: ['nginx', 'apache', 'traefik'],
                keywords: ['proxy', 'ingress', 'load-balancer']
            },
            'ai-ml': {
                docker: ['tensorflow/tensorflow', 'pytorch/pytorch', 'jupyter/base-notebook'],
                npm: ['@tensorflow/tfjs', 'brain.js', 'ml.js'],
                keywords: ['machine-learning', 'ai', 'neural-network', 'deep-learning']
            },
            'message-queue': {
                docker: ['rabbitmq', 'apache/kafka', 'redis'],
                helm: ['rabbitmq', 'kafka', 'redis'],
                keywords: ['queue', 'messaging', 'pubsub', 'events']
            }
        };
    }

    async understandIntent(description: string): Promise<IntentUnderstanding> {
        this.logger.info('Understanding intent from description:', description);
        
        const intent: IntentUnderstanding = {
            type: 'configuration',
            domain: 'general',
            technologies: [],
            requirements: {
                functional: [],
                technical: [],
                constraints: []
            },
            confidence: 0
        };
        
        // Analyze with pattern matching
        const lowerDesc = description.toLowerCase();
        const detectedPatterns: string[] = [];
        
        for (const [pattern, config] of Object.entries(this.configPatterns)) {
            if (config.keywords.some(keyword => lowerDesc.includes(keyword))) {
                detectedPatterns.push(pattern);
                intent.technologies.push(...(config.docker || []));
            }
        }
        
        // Determine type based on keywords
        if (lowerDesc.includes('agent') || lowerDesc.includes('bot')) {
            intent.type = 'agent';
        } else if (lowerDesc.includes('integrate') || lowerDesc.includes('connect')) {
            intent.type = 'integration';
        } else if (lowerDesc.includes('deploy') || lowerDesc.includes('kubernetes')) {
            intent.type = 'deployment';
        }
        
        // Set domain
        if (detectedPatterns.includes('database')) {
            intent.domain = 'data';
        } else if (detectedPatterns.includes('monitoring')) {
            intent.domain = 'observability';
        } else if (detectedPatterns.includes('ai-ml')) {
            intent.domain = 'ai';
        }
        
        // Use AI for deeper understanding if available
        if (this.openai) {
            try {
                const completion = await this.openai.chat.completions.create({
                    model: this.config.model || 'gpt-3.5-turbo',
                    messages: [
                        {
                            role: 'system',
                            content: 'Analyze the user intent and extract requirements. Respond in JSON format.'
                        },
                        {
                            role: 'user',
                            content: `Analyze this requirement: "${description}"\n\nExtract:\n1. Functional requirements\n2. Technical requirements\n3. Constraints`
                        }
                    ],
                    response_format: { type: 'json_object' },
                    temperature: 0.3,
                    max_tokens: 500,
                    stream: false
                });
                
                const analysis = JSON.parse(completion.choices[0].message.content || '{}');
                if (analysis.functional) intent.requirements.functional = analysis.functional;
                if (analysis.technical) intent.requirements.technical = analysis.technical;
                if (analysis.constraints) intent.requirements.constraints = analysis.constraints;
                
                intent.confidence = 0.9;
            } catch (error) {
                this.logger.warn('AI analysis failed, using pattern matching only:', error);
                intent.confidence = 0.6;
            }
        } else {
            intent.confidence = detectedPatterns.length > 0 ? 0.7 : 0.4;
        }
        
        return intent;
    }

    async findFreshVersions(components: ComponentsMap): Promise<FreshVersions> {
        this.logger.info('Finding fresh versions for components');
        
        const versions: FreshVersions = {
            npm: {},
            docker: {},
            helm: {},
            github: {}
        };
        
        // In a real implementation, this would query:
        // - npm registry for latest versions
        // - Docker Hub for latest tags
        // - Helm repositories for chart versions
        // - GitHub releases API
        
        // For now, return mock data
        for (const [pkg] of Object.entries(components.npm || {})) {
            versions.npm[pkg] = 'latest';
        }
        
        for (const [image] of Object.entries(components.docker || {})) {
            versions.docker[image] = 'latest';
        }
        
        return versions;
    }

    async generateConfiguration(
        params: GenerateConfigParams,
        options: GenerateConfigOptions = {}
    ): Promise<ConfigSuggestion> {
        this.logger.info('Generating configuration for:', params.description);
        
        // Understand intent if not provided
        const intent = params.intent || await this.understandIntent(params.description);
        
        // Determine components based on intent
        const components = this.selectComponents(intent);
        
        // Get fresh versions
        const versions = params.versions || await this.findFreshVersions(components);
        
        // Generate config based on format
        let config: any;
        switch (options.format) {
            case 'dockerfile':
                config = this.generateDockerfile(components, versions);
                break;
            case 'helm':
                config = this.generateHelmValues(components, versions);
                break;
            case 'yaml':
                config = this.generateKubernetesYaml(components, versions);
                break;
            default:
                config = this.generateQuickConfig(components, versions);
        }
        
        const suggestion: ConfigSuggestion = {
            name: this.generateConfigName(params.description),
            description: `Configuration for: ${params.description}`,
            confidence: intent.confidence,
            config
        };
        
        // Validate if requested
        if (options.validate) {
            await this.validateConfiguration(config, options.format);
        }
        
        // Optimize if requested
        if (options.optimize) {
            config = await this.optimizeConfiguration(config, params.environment);
        }
        
        return suggestion;
    }

    private selectComponents(intent: IntentUnderstanding): ComponentsMap {
        const components: ComponentsMap = {
            npm: {},
            docker: {},
            helm: {},
            github: {}
        };
        
        // Select based on intent domain
        switch (intent.domain) {
            case 'data':
                components.docker['postgres'] = { required: true };
                components.helm['postgresql'] = { required: true };
                break;
            case 'observability':
                components.docker['grafana/grafana'] = { required: true };
                components.docker['prom/prometheus'] = { required: true };
                break;
            case 'ai':
                components.docker['jupyter/base-notebook'] = { required: true };
                components.npm['@tensorflow/tfjs'] = { version: '^4.0.0' };
                break;
        }
        
        // Add from detected technologies
        intent.technologies.forEach(tech => {
            if (tech.includes('/')) {
                components.docker[tech] = { required: true };
            } else {
                components.npm[tech] = { required: true };
            }
        });
        
        return components;
    }

    private generateDockerfile(components: ComponentsMap, versions: FreshVersions): string {
        const dockerImages = Object.keys(components.docker || {});
        if (dockerImages.length === 0) {
            return 'FROM node:18-alpine\nWORKDIR /app\nCMD ["node", "index.js"]';
        }
        
        const baseImage = dockerImages[0];
        const tag = versions.docker[baseImage] || 'latest';
        
        return `FROM ${baseImage}:${tag}
WORKDIR /app
COPY . .
RUN npm install --production
EXPOSE 3000
CMD ["npm", "start"]`;
    }

    private generateHelmValues(components: ComponentsMap, _versions: FreshVersions): any {
        return {
            replicaCount: 1,
            image: {
                repository: Object.keys(components.docker || {})[0] || 'nginx',
                tag: 'latest',
                pullPolicy: 'IfNotPresent'
            },
            service: {
                type: 'ClusterIP',
                port: 80
            },
            resources: {
                limits: {
                    cpu: '500m',
                    memory: '512Mi'
                },
                requests: {
                    cpu: '250m',
                    memory: '256Mi'
                }
            }
        };
    }

    private generateKubernetesYaml(components: ComponentsMap, versions: FreshVersions): any {
        const image = Object.keys(components.docker || {})[0] || 'nginx';
        const tag = versions.docker[image] || 'latest';
        
        return {
            apiVersion: 'apps/v1',
            kind: 'Deployment',
            metadata: {
                name: 'app-deployment'
            },
            spec: {
                replicas: 1,
                selector: {
                    matchLabels: {
                        app: 'app'
                    }
                },
                template: {
                    metadata: {
                        labels: {
                            app: 'app'
                        }
                    },
                    spec: {
                        containers: [{
                            name: 'app',
                            image: `${image}:${tag}`,
                            ports: [{
                                containerPort: 3000
                            }]
                        }]
                    }
                }
            }
        };
    }

    private generateQuickConfig(components: ComponentsMap, versions: FreshVersions): QuickConfig {
        const config: QuickConfig = {
            environment: {}
        };
        
        // Add Docker Compose if Docker components exist
        if (Object.keys(components.docker || {}).length > 0) {
            config.docker_compose = {
                version: '3.8',
                services: {}
            };
            
            for (const [image, _opts] of Object.entries(components.docker || {})) {
                const serviceName = image.split('/').pop() || 'service';
                config.docker_compose.services[serviceName] = {
                    image: `${image}:${versions.docker[image] || 'latest'}`,
                    ports: ['3000:3000']
                };
            }
        }
        
        return config;
    }

    private async validateConfiguration(_config: any, format?: string): Promise<boolean> {
        // Basic validation logic
        this.logger.info(`Validating ${format || 'generic'} configuration`);
        return true;
    }

    private async optimizeConfiguration(
        config: any, 
        environment?: EnvironmentConstraints
    ): Promise<any> {
        // Apply optimizations based on environment
        if (environment?.memory) {
            // Adjust memory limits
        }
        if (environment?.cpu) {
            // Adjust CPU limits
        }
        return config;
    }

    private generateConfigName(description: string): string {
        return description
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-|-$/g, '')
            .substring(0, 30) + '-config';
    }

    async suggestEnhancements(
        currentConfig: any,
        intent: IntentUnderstanding
    ): Promise<string[]> {
        const suggestions: string[] = [];
        
        // Analyze current config and suggest improvements
        if (!currentConfig.monitoring) {
            suggestions.push('Add monitoring with Prometheus and Grafana');
        }
        
        if (!currentConfig.security) {
            suggestions.push('Implement security scanning with Trivy');
        }
        
        if (intent.domain === 'ai' && !currentConfig.gpu) {
            suggestions.push('Enable GPU support for AI workloads');
        }
        
        return suggestions;
    }
}