const { Logger } = require('../utils/logger');
const fetch = require('node-fetch');

/**
 * DebuggingAgent - Agent intelligent pour le debugging avec OpenTelemetry
 * Analyse les traces, métriques et logs pour diagnostiquer les problèmes
 */
class DebuggingAgent {
    constructor(config, llm, memoryManager) {
        this.logger = new Logger('DebuggingAgent');
        this.config = {
            otel: {
                endpoint: config.otel?.endpoint || 'http://localhost:4317',
                headers: config.otel?.headers || {}
            },
            prometheus: {
                endpoint: config.prometheus?.endpoint || 'http://localhost:9090',
                queries: {
                    agentErrors: 'rate(agent_errors_total[5m])',
                    agentLatency: 'histogram_quantile(0.95, agent_request_duration_seconds_bucket)',
                    resourceUsage: 'container_memory_usage_bytes{pod=~".*agent.*"}'
                }
            },
            loki: {
                endpoint: config.loki?.endpoint || 'http://localhost:3100',
                queryLimit: 1000
            },
            ...config
        };
        
        this.llm = llm;
        this.memoryManager = memoryManager;
        
        // Patterns de problèmes connus
        this.knownPatterns = {
            'OOMKilled': {
                type: 'resource',
                severity: 'high',
                solution: 'Increase memory limits or optimize memory usage'
            },
            'CrashLoopBackOff': {
                type: 'startup',
                severity: 'high',
                solution: 'Check startup logs and configuration'
            },
            'ImagePullBackOff': {
                type: 'deployment',
                severity: 'medium',
                solution: 'Verify image name and registry credentials'
            },
            'connection refused': {
                type: 'network',
                severity: 'medium',
                solution: 'Check service endpoints and network policies'
            },
            'timeout': {
                type: 'performance',
                severity: 'medium',
                solution: 'Increase timeout values or optimize service response time'
            }
        };
    }

    /**
     * Diagnostique un agent ou une application
     */
    async diagnose(identifier, options = {}) {
        this.logger.info(`Starting diagnosis for: ${identifier}`);
        
        try {
            // 1. Collecter toutes les données de télémétrie
            const telemetryData = await this.collectTelemetryData(identifier, options);
            
            // 2. Analyser les patterns connus
            const knownIssues = this.detectKnownPatterns(telemetryData);
            
            // 3. Enrichir avec le contexte historique
            const historicalContext = await this.getHistoricalContext(identifier);
            
            // 4. Analyse approfondie avec LLM
            const diagnosis = await this.performDeepAnalysis({
                identifier,
                telemetryData,
                knownIssues,
                historicalContext,
                options
            });
            
            // 5. Générer des recommandations
            const recommendations = await this.generateRecommendations(diagnosis);
            
            // 6. Sauvegarder le diagnostic pour apprentissage
            await this.saveDiagnosis(identifier, diagnosis, recommendations);
            
            return {
                identifier,
                timestamp: new Date().toISOString(),
                status: this.determineSeverity(diagnosis),
                diagnosis,
                recommendations,
                telemetryData: options.includeTelemetry ? telemetryData : undefined
            };
            
        } catch (error) {
            this.logger.error('Diagnosis failed:', error);
            throw error;
        }
    }

    /**
     * Collecte les données de télémétrie
     */
    async collectTelemetryData(identifier, options) {
        const timeRange = options.timeRange || '1h';
        const data = {
            traces: [],
            metrics: {},
            logs: [],
            events: []
        };
        
        // Collecter en parallèle
        const promises = [
            this.getTraces(identifier, timeRange).then(t => data.traces = t),
            this.getMetrics(identifier, timeRange).then(m => data.metrics = m),
            this.getLogs(identifier, timeRange).then(l => data.logs = l),
            this.getKubernetesEvents(identifier).then(e => data.events = e)
        ];
        
        await Promise.allSettled(promises);
        
        return data;
    }

    /**
     * Récupère les traces OpenTelemetry
     */
    async getTraces(identifier, timeRange) {
        try {
            // Query traces via OTLP HTTP endpoint
            const query = {
                service: identifier,
                start: this.getTimeRangeStart(timeRange),
                end: new Date().toISOString(),
                limit: 100
            };
            
            // In production, this would query Jaeger/Tempo
            // For now, return mock structure
            return {
                traceCount: 0,
                errorTraces: [],
                slowTraces: [],
                summary: 'No traces available (OTLP endpoint not configured)'
            };
        } catch (error) {
            this.logger.warn('Failed to get traces:', error);
            return { error: error.message };
        }
    }

    /**
     * Récupère les métriques Prometheus
     */
    async getMetrics(identifier, timeRange) {
        const metrics = {};
        
        try {
            // Requêtes Prometheus pour différentes métriques
            for (const [name, query] of Object.entries(this.config.prometheus.queries)) {
                const promQuery = query.replace(/agent/g, identifier);
                const url = `${this.config.prometheus.endpoint}/api/v1/query?query=${encodeURIComponent(promQuery)}`;
                
                const response = await fetch(url);
                if (response.ok) {
                    const data = await response.json();
                    metrics[name] = this.parsePrometheusResult(data);
                }
            }
            
            // Ajouter des métriques spécifiques
            metrics.availability = await this.calculateAvailability(identifier, timeRange);
            metrics.errorRate = await this.calculateErrorRate(identifier, timeRange);
            
        } catch (error) {
            this.logger.warn('Failed to get metrics:', error);
            metrics.error = error.message;
        }
        
        return metrics;
    }

    /**
     * Récupère les logs via Loki
     */
    async getLogs(identifier, timeRange) {
        try {
            const query = `{app="${identifier}"} |= "error" or "ERROR" or "failed" or "Failed"`;
            const start = this.getTimeRangeStart(timeRange);
            const end = new Date().toISOString();
            
            const url = `${this.config.loki.endpoint}/loki/api/v1/query_range?` +
                `query=${encodeURIComponent(query)}&` +
                `start=${start}&end=${end}&limit=${this.config.loki.queryLimit}`;
            
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`Loki query failed: ${response.status}`);
            }
            
            const data = await response.json();
            return this.parseLokiLogs(data);
            
        } catch (error) {
            this.logger.warn('Failed to get logs:', error);
            return {
                error: error.message,
                logs: []
            };
        }
    }

    /**
     * Récupère les événements Kubernetes
     */
    async getKubernetesEvents(identifier) {
        try {
            // Utiliser kubectl via exec ou l'API Kubernetes
            // Pour l'instant, retourner une structure mock
            return {
                events: [],
                summary: 'Kubernetes events not available'
            };
        } catch (error) {
            this.logger.warn('Failed to get Kubernetes events:', error);
            return { error: error.message };
        }
    }

    /**
     * Détecte les patterns connus dans les données
     */
    detectKnownPatterns(telemetryData) {
        const detectedIssues = [];
        
        // Vérifier dans les logs
        if (telemetryData.logs?.logs) {
            for (const log of telemetryData.logs.logs) {
                for (const [pattern, info] of Object.entries(this.knownPatterns)) {
                    if (log.message?.includes(pattern)) {
                        detectedIssues.push({
                            pattern,
                            ...info,
                            source: 'logs',
                            evidence: log.message.substring(0, 200)
                        });
                    }
                }
            }
        }
        
        // Vérifier dans les événements
        if (telemetryData.events?.events) {
            for (const event of telemetryData.events.events) {
                for (const [pattern, info] of Object.entries(this.knownPatterns)) {
                    if (event.reason === pattern || event.message?.includes(pattern)) {
                        detectedIssues.push({
                            pattern,
                            ...info,
                            source: 'k8s-events',
                            evidence: event.message
                        });
                    }
                }
            }
        }
        
        // Vérifier les métriques
        if (telemetryData.metrics?.errorRate > 0.1) {
            detectedIssues.push({
                pattern: 'high-error-rate',
                type: 'reliability',
                severity: 'high',
                solution: 'Investigate error logs and add proper error handling',
                source: 'metrics',
                evidence: `Error rate: ${(telemetryData.metrics.errorRate * 100).toFixed(2)}%`
            });
        }
        
        return detectedIssues;
    }

    /**
     * Récupère le contexte historique
     */
    async getHistoricalContext(identifier) {
        if (!this.memoryManager) {
            return { previousIssues: [], solutions: [] };
        }
        
        try {
            const history = await this.memoryManager.searchMemory({
                query: `debugging ${identifier}`,
                filter: { type: 'diagnosis' },
                limit: 10
            });
            
            return {
                previousIssues: history.results?.filter(r => r.metadata?.type === 'issue') || [],
                solutions: history.results?.filter(r => r.metadata?.type === 'solution') || [],
                patterns: this.extractPatterns(history.results)
            };
        } catch (error) {
            this.logger.warn('Failed to get historical context:', error);
            return { previousIssues: [], solutions: [] };
        }
    }

    /**
     * Analyse approfondie avec LLM
     */
    async performDeepAnalysis(context) {
        const { identifier, telemetryData, knownIssues, historicalContext } = context;
        
        // Préparer le prompt pour le LLM
        const prompt = `
Analyze the following debugging information for ${identifier}:

Known Issues Detected:
${JSON.stringify(knownIssues, null, 2)}

Telemetry Summary:
- Traces: ${telemetryData.traces?.traceCount || 0} total, ${telemetryData.traces?.errorTraces?.length || 0} errors
- Error Rate: ${(telemetryData.metrics?.errorRate * 100 || 0).toFixed(2)}%
- Recent Logs: ${telemetryData.logs?.logs?.length || 0} error logs found
- Kubernetes Events: ${telemetryData.events?.events?.length || 0} events

Historical Context:
- Previous similar issues: ${historicalContext.previousIssues?.length || 0}
- Known working solutions: ${historicalContext.solutions?.length || 0}

Please provide:
1. Root cause analysis
2. Impact assessment
3. Correlation between different signals
4. Likelihood of recurrence
`;

        try {
            if (this.llm) {
                const analysis = await this.llm.analyze(prompt);
                return analysis;
            } else {
                // Fallback analysis sans LLM
                return this.performBasicAnalysis(context);
            }
        } catch (error) {
            this.logger.error('LLM analysis failed:', error);
            return this.performBasicAnalysis(context);
        }
    }

    /**
     * Analyse basique sans LLM
     */
    performBasicAnalysis(context) {
        const { knownIssues, telemetryData } = context;
        
        return {
            rootCause: knownIssues.length > 0 
                ? `Detected ${knownIssues.length} known issues: ${knownIssues.map(i => i.pattern).join(', ')}`
                : 'No known patterns detected - requires manual investigation',
            impact: this.assessImpact(telemetryData),
            correlations: this.findCorrelations(telemetryData),
            likelihood: knownIssues.some(i => i.severity === 'high') ? 'high' : 'medium'
        };
    }

    /**
     * Génère des recommandations
     */
    async generateRecommendations(diagnosis) {
        const recommendations = [];
        
        // Recommandations basées sur le diagnostic
        if (diagnosis.rootCause?.includes('memory')) {
            recommendations.push({
                priority: 'high',
                action: 'Increase memory limits',
                command: 'kubectl set resources deployment/{{name}} --limits=memory=2Gi',
                rationale: 'Current memory usage exceeds limits'
            });
        }
        
        if (diagnosis.rootCause?.includes('timeout')) {
            recommendations.push({
                priority: 'medium',
                action: 'Increase timeout values',
                config: {
                    timeoutSeconds: 30,
                    initialDelaySeconds: 10
                },
                rationale: 'Service startup or response time exceeds current timeout'
            });
        }
        
        // Recommandations d'observabilité
        if (!diagnosis.telemetryData?.traces || diagnosis.telemetryData.traces.traceCount === 0) {
            recommendations.push({
                priority: 'medium',
                action: 'Enable OpenTelemetry instrumentation',
                implementation: {
                    java: 'Add -javaagent:opentelemetry-javaagent.jar',
                    nodejs: 'npm install @opentelemetry/auto-instrumentations-node',
                    python: 'pip install opentelemetry-distro'
                },
                rationale: 'No traces available for detailed analysis'
            });
        }
        
        // Recommandations de configuration
        recommendations.push({
            priority: 'low',
            action: 'Implement health checks',
            config: {
                livenessProbe: {
                    httpGet: { path: '/health', port: 8080 },
                    periodSeconds: 10
                },
                readinessProbe: {
                    httpGet: { path: '/ready', port: 8080 },
                    initialDelaySeconds: 5
                }
            },
            rationale: 'Improve Kubernetes failure detection'
        });
        
        return recommendations;
    }

    /**
     * Sauvegarde le diagnostic
     */
    async saveDiagnosis(identifier, diagnosis, recommendations) {
        if (!this.memoryManager) return;
        
        try {
            await this.memoryManager.addMemory({
                type: 'diagnosis',
                identifier,
                diagnosis,
                recommendations,
                timestamp: new Date().toISOString(),
                success: recommendations.length > 0
            });
            
            this.logger.debug('Diagnosis saved to memory');
        } catch (error) {
            this.logger.warn('Failed to save diagnosis:', error);
        }
    }

    // Méthodes utilitaires

    getTimeRangeStart(timeRange) {
        const now = new Date();
        const match = timeRange.match(/(\d+)([hmd])/);
        if (!match) return new Date(now - 3600000).toISOString(); // Default 1h
        
        const [_, value, unit] = match;
        const multipliers = { h: 3600000, m: 60000, d: 86400000 };
        
        return new Date(now - (parseInt(value) * multipliers[unit])).toISOString();
    }

    parsePrometheusResult(data) {
        if (data.status !== 'success' || !data.data?.result?.length) {
            return null;
        }
        
        const result = data.data.result[0];
        return {
            value: parseFloat(result.value[1]),
            timestamp: new Date(result.value[0] * 1000).toISOString(),
            labels: result.metric
        };
    }

    parseLokiLogs(data) {
        const logs = [];
        
        if (data.status === 'success' && data.data?.result) {
            for (const stream of data.data.result) {
                for (const [timestamp, message] of stream.values) {
                    logs.push({
                        timestamp: new Date(parseInt(timestamp) / 1000000).toISOString(),
                        message,
                        labels: stream.stream
                    });
                }
            }
        }
        
        return {
            logs: logs.slice(0, 100), // Limit to 100 most recent
            totalCount: logs.length
        };
    }

    async calculateAvailability(identifier, timeRange) {
        // Simplified calculation - in production would use real metrics
        return 0.99; // 99% availability
    }

    async calculateErrorRate(identifier, timeRange) {
        // Simplified calculation - in production would use real metrics
        return 0.02; // 2% error rate
    }

    assessImpact(telemetryData) {
        const errorRate = telemetryData.metrics?.errorRate || 0;
        
        if (errorRate > 0.5) return 'critical';
        if (errorRate > 0.1) return 'high';
        if (errorRate > 0.05) return 'medium';
        return 'low';
    }

    findCorrelations(telemetryData) {
        const correlations = [];
        
        // Exemple simple de corrélation
        if (telemetryData.metrics?.errorRate > 0.1 && telemetryData.logs?.logs?.length > 50) {
            correlations.push('High error rate correlates with increased log volume');
        }
        
        return correlations;
    }

    extractPatterns(results) {
        // Extraire des patterns depuis l'historique
        const patterns = {};
        
        for (const result of results || []) {
            if (result.metadata?.pattern) {
                patterns[result.metadata.pattern] = (patterns[result.metadata.pattern] || 0) + 1;
            }
        }
        
        return patterns;
    }

    determineSeverity(diagnosis) {
        if (diagnosis.likelihood === 'high' || diagnosis.impact === 'critical') {
            return 'critical';
        }
        if (diagnosis.impact === 'high') {
            return 'warning';
        }
        return 'info';
    }
}

module.exports = { DebuggingAgent };