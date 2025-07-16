import {
    AgentConfig,
    IDebuggingAgent,
    DebuggingContext,
    DebuggingAnalysis,
    DebuggingSuggestion
} from './types';
import { Logger } from './logger';

interface DebuggingAgentConfig extends AgentConfig {
    otel?: {
        endpoint?: string;
        headers?: Record<string, string>;
    };
    prometheus?: {
        endpoint?: string;
        queries?: Record<string, string>;
    };
    loki?: {
        endpoint?: string;
        queryLimit?: number;
    };
}

interface KnownPattern {
    type: string;
    severity: 'high' | 'medium' | 'low';
    solution: string;
}

/**
 * DebuggingAgent - Agent intelligent pour le debugging avec OpenTelemetry
 * Analyse les traces, métriques et logs pour diagnostiquer les problèmes
 */
export class DebuggingAgent implements IDebuggingAgent {
    private logger: Logger;
    private config: DebuggingAgentConfig;
    private llm?: any;
    private memoryManager?: any;
    private knownPatterns: Record<string, KnownPattern>;

    constructor(config: DebuggingAgentConfig, llm?: any, memoryManager?: any) {
        this.logger = config.logger || new Logger('DebuggingAgent');
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
            'ConnectionRefused': {
                type: 'network',
                severity: 'medium',
                solution: 'Check service endpoints and network policies'
            },
            'TimeoutError': {
                type: 'performance',
                severity: 'medium',
                solution: 'Increase timeout values or optimize slow operations'
            },
            'UnauthorizedError': {
                type: 'security',
                severity: 'high',
                solution: 'Verify API keys and authentication tokens'
            }
        };
    }

    /**
     * Analyse un contexte de débogage complet
     */
    async analyze(context: DebuggingContext): Promise<DebuggingAnalysis> {
        this.logger.info('Analyzing debugging context...');
        
        try {
            // Collecter les données de télémétrie
            const telemetryData = await this.collectTelemetryData(context);
            
            // Analyser les patterns connus
            const knownIssues = this.detectKnownPatterns(context);
            
            // Analyser avec l'IA si disponible
            let aiAnalysis = null;
            if (this.llm) {
                aiAnalysis = await this.analyzeWithAI(context, telemetryData);
            }
            
            // Construire l'analyse complète
            const analysis: DebuggingAnalysis = {
                errorType: this.classifyError(context),
                errorMessage: this.extractErrorMessage(context),
                possibleCauses: this.identifyPossibleCauses(context, telemetryData),
                suggestions: this.generateSuggestions(context, knownIssues, aiAnalysis),
                relatedErrors: await this.findRelatedErrors(context)
            };
            
            // Sauvegarder dans la mémoire si disponible
            if (this.memoryManager) {
                await this.saveToMemory(analysis, context);
            }
            
            return analysis;
        } catch (error) {
            this.logger.error('Failed to analyze debugging context:', error);
            throw error;
        }
    }

    /**
     * Suggère des solutions pour une erreur
     */
    async suggest(error: Error | string): Promise<DebuggingSuggestion[]> {
        const context: DebuggingContext = {
            error: error,
            stack: typeof error === 'object' ? error.stack : undefined
        };
        
        const analysis = await this.analyze(context);
        return analysis.suggestions;
    }

    /**
     * Diagnostique du code avec analyse d'erreur
     */
    async diagnose(code: string, error?: Error): Promise<DebuggingAnalysis> {
        const context: DebuggingContext = {
            code,
            error: error?.message,
            stack: error?.stack
        };
        
        return this.analyze(context);
    }

    /**
     * Obtient les problèmes connus et leurs solutions
     */
    async getKnownIssues(): Promise<Record<string, DebuggingSuggestion[]>> {
        const issues: Record<string, DebuggingSuggestion[]> = {};
        
        for (const [pattern, info] of Object.entries(this.knownPatterns)) {
            issues[pattern] = [{
                type: 'fix',
                description: info.solution,
                confidence: 0.9,
                references: []
            }];
        }
        
        return issues;
    }

    // Private methods

    private async collectTelemetryData(context: DebuggingContext): Promise<any> {
        const data: any = {
            traces: [],
            metrics: {},
            logs: []
        };
        
        // Collect traces from OTEL
        if (context.error) {
            try {
                const traces = await this.fetchTraces(context.error.toString());
                data.traces = traces;
            } catch (error) {
                this.logger.warn('Failed to fetch traces:', error);
            }
        }
        
        // Collect metrics from Prometheus
        try {
            data.metrics = await this.fetchMetrics();
        } catch (error) {
            this.logger.warn('Failed to fetch metrics:', error);
        }
        
        // Collect logs from Loki
        if (context.error || context.file) {
            try {
                const logs = await this.fetchLogs(context);
                data.logs = logs;
            } catch (error) {
                this.logger.warn('Failed to fetch logs:', error);
            }
        }
        
        return data;
    }

    private detectKnownPatterns(context: DebuggingContext): string[] {
        const detectedPatterns: string[] = [];
        const errorString = this.getErrorString(context);
        
        for (const pattern of Object.keys(this.knownPatterns)) {
            if (errorString.includes(pattern)) {
                detectedPatterns.push(pattern);
            }
        }
        
        return detectedPatterns;
    }

    private async analyzeWithAI(context: DebuggingContext, telemetryData: any): Promise<any> {
        if (!this.llm) return null;
        
        const prompt = `Analyze this debugging context:
Error: ${this.getErrorString(context)}
Stack: ${context.stack || 'N/A'}
Code: ${context.code ? context.code.substring(0, 500) + '...' : 'N/A'}
Telemetry Summary: ${JSON.stringify(this.summarizeTelemetry(telemetryData), null, 2)}

Provide:
1. Root cause analysis
2. Specific fix suggestions
3. Prevention strategies`;

        try {
            const response = await this.llm.complete(prompt);
            return response;
        } catch (error) {
            this.logger.warn('AI analysis failed:', error);
            return null;
        }
    }

    private classifyError(context: DebuggingContext): string {
        const errorString = this.getErrorString(context);
        
        if (errorString.includes('TypeError')) return 'TypeError';
        if (errorString.includes('ReferenceError')) return 'ReferenceError';
        if (errorString.includes('SyntaxError')) return 'SyntaxError';
        if (errorString.includes('NetworkError')) return 'NetworkError';
        if (errorString.includes('TimeoutError')) return 'TimeoutError';
        if (errorString.includes('AuthenticationError')) return 'AuthenticationError';
        
        return 'UnknownError';
    }

    private extractErrorMessage(context: DebuggingContext): string {
        if (typeof context.error === 'string') return context.error;
        if (context.error && typeof context.error === 'object' && 'message' in context.error) {
            return context.error.message;
        }
        return 'Unknown error';
    }

    private identifyPossibleCauses(context: DebuggingContext, telemetryData: any): string[] {
        const causes: string[] = [];
        const errorString = this.getErrorString(context);
        
        // Common error patterns
        if (errorString.includes('undefined')) {
            causes.push('Variable or property is undefined');
            causes.push('Missing initialization');
        }
        
        if (errorString.includes('null')) {
            causes.push('Null pointer exception');
            causes.push('Missing data validation');
        }
        
        if (errorString.includes('timeout')) {
            causes.push('Operation took too long');
            causes.push('Network connectivity issues');
        }
        
        // Add causes from telemetry
        if (telemetryData.metrics?.errorRate > 0.1) {
            causes.push('High error rate detected in metrics');
        }
        
        return causes;
    }

    private generateSuggestions(
        context: DebuggingContext,
        knownIssues: string[],
        aiAnalysis: any
    ): DebuggingSuggestion[] {
        const suggestions: DebuggingSuggestion[] = [];
        
        // Add suggestions from known patterns
        for (const issue of knownIssues) {
            const pattern = this.knownPatterns[issue];
            suggestions.push({
                type: 'fix',
                description: pattern.solution,
                confidence: 0.9,
                references: [`Known issue: ${issue}`]
            });
        }
        
        // Add generic suggestions based on error type
        const errorType = this.classifyError(context);
        suggestions.push(...this.getGenericSuggestions(errorType));
        
        // Add AI suggestions if available
        if (aiAnalysis?.suggestions) {
            suggestions.push(...aiAnalysis.suggestions);
        }
        
        return suggestions;
    }

    private async findRelatedErrors(context: DebuggingContext): Promise<string[]> {
        if (!this.memoryManager) return [];
        
        try {
            const similar = await this.memoryManager.search(
                this.getErrorString(context),
                { limit: 5 }
            );
            
            return similar.map((item: any) => item.content);
        } catch {
            return [];
        }
    }

    private async saveToMemory(analysis: DebuggingAnalysis, context: DebuggingContext): Promise<void> {
        if (!this.memoryManager) return;
        
        try {
            await this.memoryManager.add({
                content: JSON.stringify(analysis),
                metadata: {
                    type: 'debugging_analysis',
                    errorType: analysis.errorType,
                    timestamp: new Date().toISOString(),
                    context: this.sanitizeContext(context)
                }
            });
        } catch (error) {
            this.logger.warn('Failed to save to memory:', error);
        }
    }

    private getErrorString(context: DebuggingContext): string {
        if (typeof context.error === 'string') return context.error;
        if (context.error && typeof context.error === 'object') {
            return context.error.toString();
        }
        return '';
    }

    private summarizeTelemetry(data: any): any {
        return {
            traceCount: data.traces?.length || 0,
            hasMetrics: Object.keys(data.metrics || {}).length > 0,
            logCount: data.logs?.length || 0
        };
    }

    private sanitizeContext(context: DebuggingContext): any {
        return {
            hasError: !!context.error,
            hasCode: !!context.code,
            hasStack: !!context.stack,
            file: context.file,
            line: context.line
        };
    }

    private getGenericSuggestions(errorType: string): DebuggingSuggestion[] {
        const suggestions: DebuggingSuggestion[] = [];
        
        switch (errorType) {
            case 'TypeError':
                suggestions.push({
                    type: 'fix',
                    description: 'Check variable types and add type validation',
                    confidence: 0.7,
                    references: []
                });
                break;
            case 'NetworkError':
                suggestions.push({
                    type: 'fix',
                    description: 'Verify network connectivity and API endpoints',
                    confidence: 0.7,
                    references: []
                });
                break;
        }
        
        return suggestions;
    }

    // Telemetry fetching methods (stubs for now)
    private async fetchTraces(_error: string): Promise<any[]> {
        // TODO: Implement OTEL trace fetching
        return [];
    }

    private async fetchMetrics(): Promise<any> {
        // TODO: Implement Prometheus metrics fetching
        return {};
    }

    private async fetchLogs(_context: DebuggingContext): Promise<any[]> {
        // TODO: Implement Loki log fetching
        return [];
    }
}

export default DebuggingAgent;