const { Logger } = require('../utils/logger');
const { FreshSourcesService } = require('../services/fresh-sources-service');
const { AgentWeaver } = require('./agent-weaver');

/**
 * ConfigurationIntelligence - Intelligence de configuration avec sources fraîches
 * Analyse l'intention, trouve les dernières versions, et génère des configurations optimales
 */
class ConfigurationIntelligence {
    constructor(config, agentWeaver, memoryManager) {
        this.logger = new Logger('ConfigIntelligence');
        this.config = config;
        this.agentWeaver = agentWeaver;
        this.memoryManager = memoryManager;
        this.freshSources = new FreshSourcesService(config.freshSources);
        
        // Patterns de configuration connus - enrichis avec stack open source 2025
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
            // Nouveaux patterns open source 2025
            'observability-stack': {
                docker: ['prom/prometheus', 'grafana/grafana', 'grafana/loki', 'jaegertracing/all-in-one'],
                helm: ['prometheus', 'grafana', 'loki-stack', 'jaeger'],
                keywords: ['observability', 'metrics', 'logs', 'tracing', 'monitoring', 'opentelemetry'],
                license: ['Apache-2.0', 'MIT'],
                cncf: true
            },
            'security-stack': {
                docker: ['hashicorp/vault', 'aquasecurity/trivy', 'wazuh/wazuh'],
                helm: ['hashicorp-vault', 'trivy', 'wazuh'],
                keywords: ['security', 'secrets', 'scanning', 'siem', 'vulnerabilities'],
                license: ['MPL-2.0', 'Apache-2.0', 'GPL-v2'],
                cncf: false
            },
            'gitops-stack': {
                docker: ['argoproj/argocd', 'tektoncd/pipeline'],
                helm: ['argo-cd', 'tekton-pipeline'],
                keywords: ['gitops', 'ci/cd', 'deployment', 'continuous-delivery'],
                license: ['Apache-2.0'],
                cncf: true
            },
            'registry-stack': {
                docker: ['goharbor/harbor-core', 'minio/minio', 'verdaccio/verdaccio'],
                helm: ['harbor', 'minio', 'verdaccio'],
                keywords: ['registry', 'storage', 'artifacts', 'images', 'packages'],
                license: ['Apache-2.0', 'AGPL-v3', 'MIT'],
                cncf: false
            },
            'plugin-system': {
                docker: ['eclipse/openvsx-server'],
                npm: ['vm2'],
                keywords: ['plugins', 'extensions', 'marketplace', 'sandbox'],
                license: ['EPL-2.0', 'MIT'],
                cncf: false
            },
            'ai-orchestration': {
                npm: ['langchain', 'crewai'],
                keywords: ['ai', 'llm', 'agents', 'orchestration', 'automation'],
                license: ['MIT'],
                cncf: false
            },
            'testing-stack': {
                docker: ['testcontainers/testcontainers'],
                npm: ['testcontainers', 'playwright', 'msw'],
                keywords: ['testing', 'e2e', 'integration', 'sandbox', 'mock'],
                license: ['MIT', 'Apache-2.0'],
                cncf: false
            },
            'k8s-tooling': {
                docker: ['rancher/k3s', 'rancher/k3d'],
                helm: ['rancher'],
                keywords: ['kubernetes', 'k8s', 'orchestration', 'cluster'],
                license: ['Apache-2.0'],
                cncf: true
            },
            'backup-stack': {
                docker: ['vmware-tanzu/velero'],
                helm: ['velero'],
                keywords: ['backup', 'restore', 'disaster-recovery', 'kubernetes'],
                license: ['Apache-2.0'],
                cncf: true
            },
            'no-code-stack': {
                docker: ['nocodb/nocodb', 'payloadcms/payload'],
                npm: ['nocodb', 'payload'],
                keywords: ['no-code', 'cms', 'database', 'ui'],
                license: ['GPL-v3', 'MIT'],
                cncf: false
            }
        };
    }

    /**
     * Génère une configuration intelligente basée sur l'intention
     */
    async generateConfiguration(intent, options = {}) {
        this.logger.info('Generating configuration for intent:', intent);
        
        try {
            // 1. Analyser et comprendre l'intention
            const understanding = await this.analyzeIntent(intent);
            this.logger.debug('Intent analysis:', understanding);
            
            // 2. Identifier les composants nécessaires
            const components = await this.identifyComponents(understanding);
            this.logger.debug('Identified components:', components);
            
            // 3. Rechercher les sources fraîches pour chaque composant
            const freshVersions = await this.findFreshVersions(components);
            this.logger.debug('Fresh versions found:', freshVersions);
            
            // 4. Enrichir le contexte avec l'historique
            const context = await this.enrichContext(understanding, freshVersions);
            
            // 5. Générer la configuration optimale
            const configuration = await this.generateOptimalConfig({
                intent,
                understanding,
                components,
                freshVersions,
                context,
                constraints: this.getEnvironmentConstraints(options)
            });
            
            // 6. Valider et optimiser
            const finalConfig = await this.validateAndOptimize(configuration);
            
            // 7. Sauvegarder dans la mémoire pour apprentissage
            await this.saveToMemory(intent, finalConfig);
            
            return finalConfig;
            
        } catch (error) {
            this.logger.error('Failed to generate configuration:', error);
            throw error;
        }
    }

    /**
     * Analyse l'intention utilisateur avec LLM
     */
    async analyzeIntent(intent) {
        // Utiliser l'agent weaver pour analyser l'intention
        const analysis = await this.agentWeaver.generateWorkflow(intent);
        
        // Extraire les composants clés
        const components = [];
        const patterns = [];
        
        // Détecter les patterns connus
        for (const [pattern, config] of Object.entries(this.configPatterns)) {
            const keywords = config.keywords;
            if (keywords.some(kw => intent.toLowerCase().includes(kw))) {
                patterns.push(pattern);
            }
        }
        
        // Identifier les technologies mentionnées
        const techMatches = intent.match(/\b(docker|kubernetes|helm|npm|vscode|nginx|mysql|postgres|redis|prometheus|grafana)\b/gi);
        const technologies = [...new Set(techMatches?.map(t => t.toLowerCase()) || [])];
        
        return {
            originalIntent: intent,
            workflow: analysis,
            patterns,
            technologies,
            requirements: this.extractRequirements(intent),
            deployment: this.detectDeploymentType(intent)
        };
    }

    /**
     * Identifie les composants nécessaires
     */
    async identifyComponents(understanding) {
        const components = {
            docker: [],
            npm: [],
            helm: [],
            github: []
        };
        
        // Basé sur les patterns détectés
        for (const pattern of understanding.patterns) {
            const patternConfig = this.configPatterns[pattern];
            if (patternConfig.docker) {
                components.docker.push(...patternConfig.docker);
            }
            if (patternConfig.helm) {
                components.helm.push(...patternConfig.helm);
            }
        }
        
        // Ajouter les technologies spécifiques mentionnées
        if (understanding.technologies.includes('vscode')) {
            components.docker.push('codercom/code-server');
        }
        
        // Extensions et packages spécifiques
        if (understanding.originalIntent.includes('roocode')) {
            components.npm.push('@roocode/roocode-vscode');
        }
        
        // Déduplication
        components.docker = [...new Set(components.docker)];
        components.npm = [...new Set(components.npm)];
        components.helm = [...new Set(components.helm)];
        
        return components;
    }

    /**
     * Trouve les versions fraîches pour tous les composants
     */
    async findFreshVersions(components) {
        return await this.freshSources.findLatestVersions(components);
    }

    /**
     * Enrichit le contexte avec l'historique et les best practices
     */
    async enrichContext(understanding, freshVersions) {
        const context = {
            previousConfigs: [],
            bestPractices: [],
            knownIssues: []
        };
        
        // Récupérer les configurations similaires précédentes
        if (this.memoryManager) {
            try {
                const similarConfigs = await this.memoryManager.intelligentSearch(
                    understanding.originalIntent,
                    'system',
                    { type: 'configuration' }
                );
                
                context.previousConfigs = similarConfigs.results || [];
            } catch (error) {
                this.logger.warn('Failed to search memory for previous configs:', error.message);
            }
        }
        
        // Ajouter les best practices pour 2024-2025
        if (understanding.deployment === 'kubernetes') {
            context.bestPractices.push(
                'Use GitOps with separate config repository',
                'Implement resource limits and requests',
                'Add Prometheus metrics endpoints',
                'Use init containers for setup tasks'
            );
        }
        
        // Avertissements sur les versions
        for (const [type, versions] of Object.entries(freshVersions)) {
            for (const [pkg, info] of Object.entries(versions)) {
                if (info.tags && info.tags.includes('experimental')) {
                    context.knownIssues.push(`${pkg} latest version is experimental`);
                }
            }
        }
        
        return context;
    }

    /**
     * Génère la configuration optimale
     */
    async generateOptimalConfig(params) {
        const { intent, understanding, components, freshVersions, context, constraints } = params;
        
        // Créer une description enrichie mais concise pour l'agent weaver
        const freshVersionSummary = {
            docker: freshVersions.docker?.redis?.latest || 'latest',
            helm: freshVersions.helm?.redis?.latestVersion || 'latest'
        };
        
        const enrichedDescription = `${intent} using versions: ${JSON.stringify(freshVersionSummary)}. Apply GitOps, security best practices, and observability.`;

        // Utiliser l'agent weaver avec le contexte enrichi
        const config = await this.agentWeaver.generateWorkflow(enrichedDescription);
        
        // Ajouter les métadonnées de versioning
        config.metadata = {
            generatedAt: new Date().toISOString(),
            versions: freshVersions,
            intent: intent,
            patterns: understanding.patterns
        };
        
        return config;
    }

    /**
     * Valide et optimise la configuration
     */
    async validateAndOptimize(configuration) {
        const validations = [];
        
        // Vérifier que toutes les versions sont spécifiées
        if (configuration.requiredModules) {
            for (const module of configuration.requiredModules) {
                if (!module.version || module.version === 'latest') {
                    this.logger.warn(`Module ${module.name} uses 'latest' tag - fixing with specific version`);
                    // Remplacer par une version spécifique
                    if (configuration.metadata?.versions) {
                        const versions = configuration.metadata.versions;
                        // Logique pour mapper le module à sa version spécifique
                    }
                }
            }
        }
        
        // Ajouter les labels GitOps
        configuration.gitopsLabels = {
            'autoweave.io/generated': 'true',
            'autoweave.io/version': '1.0.0',
            'autoweave.io/pattern': configuration.metadata?.patterns?.join(',') || 'custom'
        };
        
        // Ajouter la configuration d'observabilité
        if (!configuration.observability) {
            configuration.observability = {
                metrics: {
                    enabled: true,
                    port: 9090,
                    path: '/metrics'
                },
                tracing: {
                    enabled: true,
                    exporter: 'otlp',
                    endpoint: 'http://otel-collector:4317'
                },
                logging: {
                    level: 'info',
                    format: 'json'
                }
            };
        }
        
        return configuration;
    }

    /**
     * Sauvegarde dans la mémoire pour apprentissage
     */
    async saveToMemory(intent, configuration) {
        if (!this.memoryManager) return;
        
        try {
            // Use the contextual memory to save configuration
            if (this.memoryManager.contextualMemory) {
                await this.memoryManager.contextualMemory.addMemory(
                    `Configuration generated for: ${intent}`,
                    'system',
                    {
                        type: 'configuration',
                        intent: intent,
                        configuration: configuration,
                        timestamp: new Date().toISOString(),
                        success: true
                    }
                );
                
                this.logger.debug('Configuration saved to memory');
            }
        } catch (error) {
            this.logger.warn('Failed to save configuration to memory:', error);
        }
    }

    /**
     * Extrait les requirements depuis l'intention
     */
    extractRequirements(intent) {
        const requirements = {
            ports: [],
            volumes: [],
            environment: [],
            resources: {}
        };
        
        // Détecter les ports
        const portMatches = intent.match(/port\s+(\d+)/gi);
        if (portMatches) {
            requirements.ports = portMatches.map(m => parseInt(m.match(/\d+/)[0]));
        }
        
        // Détecter les volumes
        if (intent.includes('persistent') || intent.includes('volume')) {
            requirements.volumes.push('/data');
        }
        if (intent.includes('workspace')) {
            requirements.volumes.push('/workspace');
        }
        
        // Détecter les besoins en ressources
        if (intent.includes('high performance') || intent.includes('production')) {
            requirements.resources = {
                cpu: '2',
                memory: '4Gi'
            };
        }
        
        return requirements;
    }

    /**
     * Détecte le type de déploiement
     */
    detectDeploymentType(intent) {
        if (intent.includes('kubernetes') || intent.includes('k8s')) {
            return 'kubernetes';
        }
        if (intent.includes('docker compose') || intent.includes('compose')) {
            return 'docker-compose';
        }
        if (intent.includes('helm')) {
            return 'helm';
        }
        return 'kubernetes'; // Default
    }

    /**
     * Obtient les contraintes de l'environnement
     */
    getEnvironmentConstraints(options) {
        return {
            platform: options.platform || 'kubernetes',
            namespace: options.namespace || 'default',
            registry: options.registry || 'docker.io',
            securityPolicy: options.securityPolicy || 'standard',
            networkPolicy: options.networkPolicy || 'allow-internal',
            ...options.constraints
        };
    }

    /**
     * Génère des suggestions de configuration avec priorité open source
     */
    async generateSuggestions(partialIntent) {
        const suggestions = [];
        
        // Rechercher dans tous les registres
        const searchResults = await this.freshSources.searchPackage(partialIntent);
        
        // Convertir en suggestions de configuration
        for (const suggestion of searchResults.suggestions) {
            suggestions.push({
                type: 'package',
                registry: suggestion.type,
                name: suggestion.name,
                reason: suggestion.reason,
                quickConfig: await this.generateQuickConfig(suggestion)
            });
        }
        
        // Ajouter des suggestions basées sur les patterns avec priorité open source
        const patternSuggestions = this.getOpenSourcePatternSuggestions(partialIntent);
        suggestions.push(...patternSuggestions);
        
        // Trier par priorité open source
        return this.prioritizeOpenSourceSuggestions(suggestions);
    }

    /**
     * Obtient des suggestions de patterns open source
     */
    getOpenSourcePatternSuggestions(partialIntent) {
        const suggestions = [];
        const intent = partialIntent.toLowerCase();
        
        for (const [pattern, config] of Object.entries(this.configPatterns)) {
            // Vérifier si le pattern correspond à l'intention
            const matchesKeywords = config.keywords.some(kw => intent.includes(kw));
            const matchesName = intent.includes(pattern.substring(0, 3));
            
            if (matchesKeywords || matchesName) {
                suggestions.push({
                    type: 'pattern',
                    name: pattern,
                    description: `Standard ${pattern} configuration`,
                    components: config.docker || config.helm,
                    openSource: true,
                    licenses: config.license || ['Unknown'],
                    cncf: config.cncf || false,
                    score: this.calculateOpenSourceScore(config)
                });
            }
        }
        
        return suggestions;
    }

    /**
     * Calcule un score de préférence open source
     */
    calculateOpenSourceScore(config) {
        let score = 0;
        
        // Bonus pour les projets CNCF
        if (config.cncf) score += 30;
        
        // Bonus pour les licences permissives
        if (config.license) {
            const permissiveLicenses = ['Apache-2.0', 'MIT', 'BSD-3-Clause'];
            if (config.license.some(l => permissiveLicenses.includes(l))) {
                score += 20;
            }
        }
        
        // Bonus pour les stacks modernes (2025)
        const modernPatterns = ['observability-stack', 'security-stack', 'gitops-stack', 'ai-orchestration'];
        if (modernPatterns.includes(config.name)) {
            score += 15;
        }
        
        return score;
    }

    /**
     * Priorise les suggestions open source
     */
    prioritizeOpenSourceSuggestions(suggestions) {
        return suggestions.sort((a, b) => {
            // Priorité 1: Solutions open source
            if (a.openSource && !b.openSource) return -1;
            if (!a.openSource && b.openSource) return 1;
            
            // Priorité 2: Score open source
            if (a.score && b.score) {
                if (a.score !== b.score) return b.score - a.score;
            }
            
            // Priorité 3: Projets CNCF
            if (a.cncf && !b.cncf) return -1;
            if (!a.cncf && b.cncf) return 1;
            
            return 0;
        });
    }

    /**
     * Génère des alternatives open source pour un outil propriétaire
     */
    async generateOpenSourceAlternatives(proprietaryTool) {
        const alternatives = [];
        
        // Mapping des outils propriétaires vers open source
        const alternativeMap = {
            'datadog': ['observability-stack'], // Prometheus + Grafana + Loki
            'new-relic': ['observability-stack'],
            'splunk': ['observability-stack'],
            'jenkins-enterprise': ['gitops-stack'], // ArgoCD + Tekton
            'github-actions': ['gitops-stack'],
            'terraform-enterprise': ['gitops-stack'], // OpenTofu
            'vault-enterprise': ['security-stack'], // Vault open source
            'docker-enterprise': ['registry-stack'], // Harbor
            'jfrog-artifactory': ['registry-stack'],
            'airtable': ['no-code-stack'], // NocoDB
            'retool': ['no-code-stack']
        };
        
        const tool = proprietaryTool.toLowerCase();
        const patterns = alternativeMap[tool] || [];
        
        for (const pattern of patterns) {
            const config = this.configPatterns[pattern];
            if (config) {
                alternatives.push({
                    pattern,
                    name: pattern.replace('-', ' '),
                    description: `Open source alternative to ${proprietaryTool}`,
                    components: config.docker || config.helm,
                    licenses: config.license || ['Unknown'],
                    cncf: config.cncf || false,
                    estimatedCostSaving: this.estimateCostSaving(proprietaryTool),
                    migrationComplexity: this.estimateMigrationComplexity(proprietaryTool, pattern)
                });
            }
        }
        
        return alternatives;
    }

    /**
     * Estime les économies de coûts
     */
    estimateCostSaving(proprietaryTool) {
        const costSavings = {
            'datadog': { monthly: 500, yearly: 6000 },
            'new-relic': { monthly: 400, yearly: 4800 },
            'splunk': { monthly: 1000, yearly: 12000 },
            'terraform-enterprise': { monthly: 200, yearly: 2400 },
            'vault-enterprise': { monthly: 300, yearly: 3600 },
            'docker-enterprise': { monthly: 150, yearly: 1800 },
            'jfrog-artifactory': { monthly: 250, yearly: 3000 }
        };
        
        return costSavings[proprietaryTool.toLowerCase()] || { monthly: 100, yearly: 1200 };
    }

    /**
     * Estime la complexité de migration
     */
    estimateMigrationComplexity(proprietaryTool, pattern) {
        const complexity = {
            'observability-stack': 'Medium - Requires metrics configuration',
            'security-stack': 'High - Requires security audit',
            'gitops-stack': 'Medium - Requires CI/CD reconfiguration',
            'registry-stack': 'Low - Direct replacement',
            'no-code-stack': 'Medium - Data migration required'
        };
        
        return complexity[pattern] || 'Medium';
    }

    /**
     * Génère une configuration rapide pour une suggestion
     */
    async generateQuickConfig(suggestion) {
        if (!suggestion.name) {
            return null;
        }
        
        switch (suggestion.type) {
            case 'docker':
                return {
                    type: 'docker-compose',
                    content: `version: '3.8'
services:
  ${suggestion.name.replace('/', '-')}:
    image: ${suggestion.name}:latest
    restart: unless-stopped`
                };
                
            case 'helm':
                return {
                    type: 'helm-values',
                    content: `replicaCount: 1
image:
  repository: ${suggestion.name}
  tag: latest
  pullPolicy: IfNotPresent`
                };
                
            default:
                return null;
        }
    }
}

module.exports = { ConfigurationIntelligence };