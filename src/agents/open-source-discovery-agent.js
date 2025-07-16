const { Logger } = require('../utils/logger');
const { FreshSourcesService } = require('../services/fresh-sources-service');
const { ConfigurationIntelligence } = require('../core/config-intelligence');

/**
 * OpenSourceDiscoveryAgent - Agent spécialisé dans la découverte d'alternatives open source
 * Utilise le guide COMMUNICATION_HUMAN_AI.md comme base de connaissance
 */
class OpenSourceDiscoveryAgent {
    constructor(config, memoryManager) {
        this.logger = new Logger('OpenSourceDiscoveryAgent');
        this.config = config;
        this.memoryManager = memoryManager;
        this.freshSources = new FreshSourcesService(config.freshSources);
        this.configIntelligence = new ConfigurationIntelligence(config, null, memoryManager);
        
        // Base de connaissance des alternatives open source (du guide COMMUNICATION_HUMAN_AI.md)
        this.knowledgeBase = {
            orchestration: {
                'docker-swarm': { alternatives: ['kubernetes'], reason: 'Better ecosystem' },
                'nomad': { alternatives: ['kubernetes'], reason: 'CNCF standard' },
                'mesos': { alternatives: ['kubernetes'], reason: 'More active development' }
            },
            observability: {
                'datadog': { alternatives: ['prometheus', 'grafana', 'loki'], reason: 'Cost savings + flexibility' },
                'new-relic': { alternatives: ['prometheus', 'grafana', 'jaeger'], reason: 'Open source stack' },
                'splunk': { alternatives: ['grafana', 'loki', 'elasticsearch'], reason: 'No vendor lock-in' },
                'dynatrace': { alternatives: ['prometheus', 'grafana', 'jaeger'], reason: 'Community support' }
            },
            cicd: {
                'jenkins-enterprise': { alternatives: ['jenkins', 'tekton', 'argo-cd'], reason: 'Open source versions' },
                'github-actions': { alternatives: ['gitlab-ci', 'tekton', 'argo-workflows'], reason: 'GitOps ready' },
                'circle-ci': { alternatives: ['tekton', 'argo-workflows'], reason: 'Kubernetes native' },
                'travis-ci': { alternatives: ['gitlab-ci', 'tekton'], reason: 'Better integration' }
            },
            security: {
                'vault-enterprise': { alternatives: ['vault'], reason: 'Open source core features' },
                'consul-enterprise': { alternatives: ['consul'], reason: 'Community version sufficient' },
                'boundary-enterprise': { alternatives: ['boundary'], reason: 'Open source alternative' }
            },
            registry: {
                'docker-enterprise': { alternatives: ['harbor', 'docker-registry'], reason: 'Security + open source' },
                'jfrog-artifactory': { alternatives: ['harbor', 'verdaccio'], reason: 'Cost effective' },
                'aws-ecr': { alternatives: ['harbor', 'quay'], reason: 'Multi-cloud' },
                'azure-acr': { alternatives: ['harbor'], reason: 'Vendor independence' }
            },
            databases: {
                'mongodb-enterprise': { alternatives: ['mongodb'], reason: 'Community version' },
                'elastic-enterprise': { alternatives: ['elasticsearch', 'opensearch'], reason: 'Open source forks' },
                'redis-enterprise': { alternatives: ['redis'], reason: 'OSS version' }
            },
            'no-code': {
                'airtable': { alternatives: ['nocodb'], reason: 'Self-hosted + open source' },
                'retool': { alternatives: ['appsmith', 'tooljet'], reason: 'Open source alternatives' },
                'zapier': { alternatives: ['n8n', 'huginn'], reason: 'Self-hosted automation' }
            },
            testing: {
                'cypress-enterprise': { alternatives: ['cypress', 'playwright'], reason: 'Open source versions' },
                'sauce-labs': { alternatives: ['selenium-grid', 'playwright'], reason: 'Self-hosted testing' },
                'browserstack': { alternatives: ['selenium-grid', 'playwright'], reason: 'Cost savings' }
            }
        };
    }

    /**
     * Découvre des alternatives open source pour un outil donné
     */
    async discoverAlternatives(tool, options = {}) {
        this.logger.info(`Discovering open source alternatives for: ${tool}`);

        try {
            // 1. Vérifier dans la base de connaissance
            const knownAlternatives = this.findKnownAlternatives(tool);
            
            // 2. Rechercher avec FreshSourcesService
            const freshAlternatives = await this.searchFreshAlternatives(tool, options);
            
            // 3. Utiliser ConfigurationIntelligence
            const configAlternatives = await this.configIntelligence.generateOpenSourceAlternatives(tool);
            
            // 4. Rechercher dans la mémoire
            const memoryAlternatives = await this.searchMemoryAlternatives(tool);
            
            // 5. Combiner et scorer les résultats
            const alternatives = this.combineAndScoreAlternatives({
                known: knownAlternatives,
                fresh: freshAlternatives,
                config: configAlternatives,
                memory: memoryAlternatives
            });
            
            // 6. Enrichir avec des métriques
            const enrichedAlternatives = await this.enrichAlternatives(alternatives, tool);
            
            // 7. Sauvegarder dans la mémoire
            await this.saveDiscoveryResults(tool, enrichedAlternatives);
            
            return {
                originalTool: tool,
                alternatives: enrichedAlternatives,
                metadata: {
                    discoveredAt: new Date().toISOString(),
                    totalAlternatives: enrichedAlternatives.length,
                    recommendedAlternative: enrichedAlternatives[0]
                }
            };
            
        } catch (error) {
            this.logger.error(`Failed to discover alternatives for ${tool}:`, error);
            throw error;
        }
    }

    /**
     * Trouve les alternatives connues dans la base de connaissance
     */
    findKnownAlternatives(tool) {
        const alternatives = [];
        const normalizedTool = tool.toLowerCase().replace(/[-_\s]/g, '');
        
        for (const [category, tools] of Object.entries(this.knowledgeBase)) {
            for (const [knownTool, info] of Object.entries(tools)) {
                const normalizedKnownTool = knownTool.toLowerCase().replace(/[-_\s]/g, '');
                
                if (normalizedKnownTool.includes(normalizedTool) || 
                    normalizedTool.includes(normalizedKnownTool)) {
                    
                    alternatives.push({
                        category,
                        alternatives: info.alternatives,
                        reason: info.reason,
                        source: 'knowledge-base',
                        confidence: 0.9
                    });
                }
            }
        }
        
        return alternatives;
    }

    /**
     * Recherche des alternatives fraîches avec FreshSourcesService
     */
    async searchFreshAlternatives(tool, options) {
        const alternatives = [];
        
        try {
            // Recherche de packages open source similaires
            const searchTerms = [
                tool,
                `${tool} alternative`,
                `${tool} replacement`,
                `open source ${tool}`
            ];
            
            for (const term of searchTerms) {
                const results = await this.freshSources.searchOpenSourcePackages(term, options);
                
                if (results.suggestions.length > 0) {
                    alternatives.push({
                        searchTerm: term,
                        suggestions: results.suggestions,
                        source: 'fresh-sources',
                        confidence: 0.7
                    });
                }
            }
            
        } catch (error) {
            this.logger.warn(`Failed to search fresh alternatives for ${tool}:`, error);
        }
        
        return alternatives;
    }

    /**
     * Recherche dans la mémoire pour des alternatives précédentes
     */
    async searchMemoryAlternatives(tool) {
        const alternatives = [];
        
        if (!this.memoryManager) {
            return alternatives;
        }
        
        try {
            const searchQuery = `alternatives to ${tool} open source`;
            const memoryResults = await this.memoryManager.intelligentSearch(
                searchQuery,
                'system',
                { type: 'alternative-discovery' }
            );
            
            if (memoryResults.results && memoryResults.results.length > 0) {
                alternatives.push({
                    results: memoryResults.results,
                    source: 'memory',
                    confidence: 0.6
                });
            }
            
        } catch (error) {
            this.logger.warn(`Failed to search memory alternatives for ${tool}:`, error);
        }
        
        return alternatives;
    }

    /**
     * Combine et score les alternatives
     */
    combineAndScoreAlternatives(sources) {
        const combinedAlternatives = new Map();
        
        // Traiter les sources connues
        for (const known of sources.known) {
            for (const alt of known.alternatives) {
                const key = alt.toLowerCase();
                if (!combinedAlternatives.has(key)) {
                    combinedAlternatives.set(key, {
                        name: alt,
                        category: known.category,
                        reason: known.reason,
                        sources: ['knowledge-base'],
                        confidence: known.confidence,
                        score: 90 // Score élevé pour les alternatives connues
                    });
                }
            }
        }
        
        // Traiter les sources fraîches
        for (const fresh of sources.fresh) {
            for (const suggestion of fresh.suggestions) {
                const key = suggestion.name.toLowerCase();
                if (combinedAlternatives.has(key)) {
                    const existing = combinedAlternatives.get(key);
                    existing.sources.push('fresh-sources');
                    existing.confidence = Math.max(existing.confidence, fresh.confidence);
                    existing.score += 20; // Bonus pour confirmation
                } else {
                    combinedAlternatives.set(key, {
                        name: suggestion.name,
                        type: suggestion.type,
                        reason: suggestion.reason,
                        sources: ['fresh-sources'],
                        confidence: fresh.confidence,
                        score: 70,
                        openSource: suggestion.openSource,
                        cncf: suggestion.cncf
                    });
                }
            }
        }
        
        // Traiter les alternatives de configuration
        for (const config of sources.config) {
            const key = config.name.toLowerCase();
            if (combinedAlternatives.has(key)) {
                const existing = combinedAlternatives.get(key);
                existing.sources.push('config-intelligence');
                existing.estimatedCostSaving = config.estimatedCostSaving;
                existing.migrationComplexity = config.migrationComplexity;
                existing.score += 15;
            } else {
                combinedAlternatives.set(key, {
                    name: config.name,
                    pattern: config.pattern,
                    description: config.description,
                    components: config.components,
                    licenses: config.licenses,
                    cncf: config.cncf,
                    estimatedCostSaving: config.estimatedCostSaving,
                    migrationComplexity: config.migrationComplexity,
                    sources: ['config-intelligence'],
                    confidence: 0.8,
                    score: 80
                });
            }
        }
        
        // Convertir en array et trier par score
        return Array.from(combinedAlternatives.values())
            .sort((a, b) => b.score - a.score)
            .slice(0, 10); // Limiter à 10 alternatives
    }

    /**
     * Enrichit les alternatives avec des métriques
     */
    async enrichAlternatives(alternatives, originalTool) {
        const enrichedAlternatives = [];
        
        for (const alt of alternatives) {
            const enriched = { ...alt };
            
            // Ajouter des métriques de popularité
            try {
                if (alt.name) {
                    const licenseInfo = await this.freshSources.checkLicense('npm', alt.name);
                    enriched.license = licenseInfo.license;
                    enriched.openSource = licenseInfo.openSource;
                }
            } catch (error) {
                this.logger.debug(`Failed to check license for ${alt.name}:`, error);
            }
            
            // Calcul du score de compatibilité
            enriched.compatibilityScore = this.calculateCompatibilityScore(alt, originalTool);
            
            // Niveau de recommandation
            enriched.recommendationLevel = this.calculateRecommendationLevel(enriched);
            
            // Tags
            enriched.tags = this.generateTags(enriched);
            
            enrichedAlternatives.push(enriched);
        }
        
        return enrichedAlternatives;
    }

    /**
     * Calcule le score de compatibilité
     */
    calculateCompatibilityScore(alternative, originalTool) {
        let score = 50; // Score de base
        
        // Bonus pour les projets CNCF
        if (alternative.cncf) score += 20;
        
        // Bonus pour les licences permissives
        if (alternative.licenses) {
            const permissiveLicenses = ['MIT', 'Apache-2.0', 'BSD-3-Clause'];
            if (alternative.licenses.some(l => permissiveLicenses.includes(l))) {
                score += 15;
            }
        }
        
        // Bonus pour les sources multiples
        if (alternative.sources && alternative.sources.length > 1) {
            score += 10;
        }
        
        // Bonus pour la confiance élevée
        if (alternative.confidence > 0.8) {
            score += 10;
        }
        
        return Math.min(score, 100);
    }

    /**
     * Calcule le niveau de recommandation
     */
    calculateRecommendationLevel(alternative) {
        const score = alternative.compatibilityScore;
        
        if (score >= 80) return 'highly-recommended';
        if (score >= 60) return 'recommended';
        if (score >= 40) return 'consider';
        return 'investigate';
    }

    /**
     * Génère des tags pour l'alternative
     */
    generateTags(alternative) {
        const tags = [];
        
        if (alternative.openSource) tags.push('open-source');
        if (alternative.cncf) tags.push('cncf');
        if (alternative.category) tags.push(alternative.category);
        if (alternative.estimatedCostSaving) tags.push('cost-saving');
        if (alternative.migrationComplexity === 'Low') tags.push('easy-migration');
        
        return tags;
    }

    /**
     * Sauvegarde les résultats de découverte dans la mémoire
     */
    async saveDiscoveryResults(tool, alternatives) {
        if (!this.memoryManager) return;
        
        try {
            const discoveryResult = {
                tool,
                alternatives: alternatives.slice(0, 3), // Top 3 alternatives
                discoveredAt: new Date().toISOString(),
                type: 'alternative-discovery'
            };
            
            await this.memoryManager.contextualMemory.addMemory(
                `Open source alternatives discovered for ${tool}`,
                'system',
                discoveryResult
            );
            
            this.logger.debug(`Discovery results saved for ${tool}`);
        } catch (error) {
            this.logger.warn(`Failed to save discovery results for ${tool}:`, error);
        }
    }

    /**
     * Génère un rapport de migration
     */
    async generateMigrationReport(tool, selectedAlternative) {
        this.logger.info(`Generating migration report from ${tool} to ${selectedAlternative.name}`);
        
        const report = {
            from: tool,
            to: selectedAlternative.name,
            migrationPlan: {
                complexity: selectedAlternative.migrationComplexity || 'Medium',
                estimatedTime: this.estimateMigrationTime(selectedAlternative),
                prerequisites: this.generatePrerequisites(selectedAlternative),
                steps: this.generateMigrationSteps(tool, selectedAlternative),
                risks: this.identifyMigrationRisks(tool, selectedAlternative),
                rollbackPlan: this.generateRollbackPlan(tool, selectedAlternative)
            },
            benefits: {
                costSavings: selectedAlternative.estimatedCostSaving,
                technicalBenefits: this.identifyTechnicalBenefits(selectedAlternative),
                strategicBenefits: this.identifyStrategicBenefits(selectedAlternative)
            },
            generatedAt: new Date().toISOString()
        };
        
        return report;
    }

    /**
     * Estime le temps de migration
     */
    estimateMigrationTime(alternative) {
        const complexityTimeMap = {
            'Low': '1-2 weeks',
            'Medium': '3-6 weeks',
            'High': '2-3 months'
        };
        
        return complexityTimeMap[alternative.migrationComplexity] || '4-8 weeks';
    }

    /**
     * Génère les prérequis
     */
    generatePrerequisites(alternative) {
        const prerequisites = [
            'Kubernetes cluster access',
            'Helm 3.x installed',
            'kubectl configured'
        ];
        
        if (alternative.cncf) {
            prerequisites.push('CNCF project documentation review');
        }
        
        return prerequisites;
    }

    /**
     * Génère les étapes de migration
     */
    generateMigrationSteps(from, to) {
        return [
            `Audit current ${from} configuration`,
            `Setup ${to.name} in staging environment`,
            'Configure data migration pipeline',
            'Run parallel testing',
            'Gradual traffic migration',
            'Decommission old system',
            'Post-migration monitoring'
        ];
    }

    /**
     * Identifie les risques de migration
     */
    identifyMigrationRisks(from, to) {
        return [
            'Potential data loss during migration',
            'Learning curve for new tool',
            'Integration compatibility issues',
            'Temporary performance impact'
        ];
    }

    /**
     * Génère le plan de rollback
     */
    generateRollbackPlan(from, to) {
        return [
            `Keep ${from} configuration backup`,
            'Maintain data synchronization',
            'Prepare traffic routing rollback',
            'Document rollback procedures',
            'Test rollback scenario'
        ];
    }

    /**
     * Identifie les bénéfices techniques
     */
    identifyTechnicalBenefits(alternative) {
        const benefits = [];
        
        if (alternative.openSource) {
            benefits.push('Full control over source code');
            benefits.push('Community-driven development');
        }
        
        if (alternative.cncf) {
            benefits.push('Cloud-native architecture');
            benefits.push('Kubernetes integration');
        }
        
        return benefits;
    }

    /**
     * Identifie les bénéfices stratégiques
     */
    identifyStrategicBenefits(alternative) {
        return [
            'Vendor independence',
            'Cost predictability',
            'Enhanced security through transparency',
            'Faster innovation cycles'
        ];
    }
}

module.exports = { OpenSourceDiscoveryAgent };