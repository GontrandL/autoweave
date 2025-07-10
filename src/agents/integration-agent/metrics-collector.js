const { Logger } = require('../../utils/logger');

/**
 * Metrics Collector
 * Handles Prometheus metrics collection for Integration Agent
 */
class MetricsCollector {
    constructor(config) {
        this.config = config;
        this.logger = new Logger('MetricsCollector');
        
        // Metrics storage
        this.metrics = {
            integrations: {
                total: 0,
                success: 0,
                failed: 0,
                in_progress: 0
            },
            performance: {
                total_duration: 0,
                avg_duration: 0,
                min_duration: Infinity,
                max_duration: 0
            },
            errors: new Map(), // error_type -> count
            api_calls: new Map(), // endpoint -> count
            resources: {
                memory_usage: 0,
                cpu_usage: 0
            }
        };
        
        // Current integrations
        this.currentIntegrations = new Set();
        
        // Initialize Prometheus client if available
        this.promClient = null;
        this.promMetrics = null;
        
        try {
            this.promClient = require('prom-client');
            this.initializePrometheusMetrics();
        } catch (error) {
            this.logger.warn('Prometheus client not available, using in-memory metrics only');
        }
    }

    async initialize() {
        this.logger.info('Initializing Metrics Collector...');
        
        try {
            // Start metrics collection interval
            this.startMetricsCollection();
            
            this.logger.success('Metrics Collector initialized successfully');
        } catch (error) {
            this.logger.error('Failed to initialize Metrics Collector:', error);
            throw error;
        }
    }

    /**
     * Initialize Prometheus metrics
     */
    initializePrometheusMetrics() {
        if (!this.promClient) return;
        
        const register = this.promClient.register;
        
        this.promMetrics = {
            integrations_total: new this.promClient.Counter({
                name: 'autoweave_integrations_total',
                help: 'Total number of integration attempts',
                labelNames: ['status', 'api_type']
            }),
            
            integration_duration_seconds: new this.promClient.Histogram({
                name: 'autoweave_integration_duration_seconds',
                help: 'Time spent on integration operations',
                labelNames: ['operation', 'status'],
                buckets: [0.1, 0.5, 1, 5, 10, 30, 60, 120, 300]
            }),
            
            api_requests_total: new this.promClient.Counter({
                name: 'autoweave_api_requests_total',
                help: 'Total number of API requests',
                labelNames: ['endpoint', 'method', 'status']
            }),
            
            openapi_specs_parsed: new this.promClient.Counter({
                name: 'autoweave_openapi_specs_parsed_total',
                help: 'Total number of OpenAPI specifications parsed',
                labelNames: ['status', 'version']
            }),
            
            kubernetes_manifests_generated: new this.promClient.Counter({
                name: 'autoweave_kubernetes_manifests_generated_total',
                help: 'Total number of Kubernetes manifests generated',
                labelNames: ['type', 'namespace']
            }),
            
            git_operations_total: new this.promClient.Counter({
                name: 'autoweave_git_operations_total',
                help: 'Total number of Git operations',
                labelNames: ['operation', 'status']
            }),
            
            active_integrations: new this.promClient.Gauge({
                name: 'autoweave_active_integrations',
                help: 'Number of currently active integrations'
            }),
            
            errors_total: new this.promClient.Counter({
                name: 'autoweave_errors_total',
                help: 'Total number of errors',
                labelNames: ['error_type', 'component']
            })
        };
        
        this.logger.debug('Prometheus metrics initialized');
    }

    /**
     * Start integration tracking
     * @param {string} integrationId - Integration ID
     * @param {Object} metadata - Integration metadata
     */
    startIntegration(integrationId, metadata = {}) {
        const integration = {
            id: integrationId || `integration-${Date.now()}`,
            startTime: Date.now(),
            metadata,
            status: 'in_progress'
        };
        
        this.currentIntegrations.add(integration.id);
        this.metrics.integrations.in_progress++;
        
        // Update Prometheus metrics
        if (this.promMetrics) {
            this.promMetrics.active_integrations.set(this.currentIntegrations.size);
        }
        
        this.logger.debug('Integration started:', integration.id);
        return integration.id;
    }

    /**
     * Record successful integration
     * @param {number} duration - Integration duration in milliseconds
     * @param {Object} metadata - Additional metadata
     */
    recordSuccess(duration, metadata = {}) {
        this.metrics.integrations.success++;
        this.metrics.integrations.total++;
        this.metrics.integrations.in_progress = Math.max(0, this.metrics.integrations.in_progress - 1);
        
        this.updateDurationMetrics(duration);
        
        // Update Prometheus metrics
        if (this.promMetrics) {
            this.promMetrics.integrations_total.labels('success', metadata.api_type || 'unknown').inc();
            this.promMetrics.integration_duration_seconds.labels('full_integration', 'success').observe(duration / 1000);
            this.promMetrics.active_integrations.set(this.metrics.integrations.in_progress);
        }
        
        this.logger.info('Integration success recorded:', { duration, metadata });
    }

    /**
     * Record failed integration
     * @param {number} duration - Integration duration in milliseconds
     * @param {Error} error - Error object
     * @param {Object} metadata - Additional metadata
     */
    recordFailure(duration, error, metadata = {}) {
        this.metrics.integrations.failed++;
        this.metrics.integrations.total++;
        this.metrics.integrations.in_progress = Math.max(0, this.metrics.integrations.in_progress - 1);
        
        this.updateDurationMetrics(duration);
        
        // Record error
        const errorType = error.constructor.name || 'UnknownError';
        this.metrics.errors.set(errorType, (this.metrics.errors.get(errorType) || 0) + 1);
        
        // Update Prometheus metrics
        if (this.promMetrics) {
            this.promMetrics.integrations_total.labels('failed', metadata.api_type || 'unknown').inc();
            this.promMetrics.integration_duration_seconds.labels('full_integration', 'failed').observe(duration / 1000);
            this.promMetrics.errors_total.labels(errorType, metadata.component || 'unknown').inc();
            this.promMetrics.active_integrations.set(this.metrics.integrations.in_progress);
        }
        
        this.logger.error('Integration failure recorded:', { duration, error: error.message, metadata });
    }

    /**
     * Record API request
     * @param {string} endpoint - API endpoint
     * @param {string} method - HTTP method
     * @param {number} statusCode - HTTP status code
     * @param {number} duration - Request duration
     */
    recordApiRequest(endpoint, method, statusCode, duration) {
        const key = `${method} ${endpoint}`;
        this.metrics.api_calls.set(key, (this.metrics.api_calls.get(key) || 0) + 1);
        
        // Update Prometheus metrics
        if (this.promMetrics) {
            const status = statusCode >= 200 && statusCode < 300 ? 'success' : 'error';
            this.promMetrics.api_requests_total.labels(endpoint, method, status).inc();
        }
        
        this.logger.debug('API request recorded:', { endpoint, method, statusCode, duration });
    }

    /**
     * Record OpenAPI spec parsing
     * @param {string} status - Parsing status (success/failed)
     * @param {string} version - OpenAPI version
     */
    recordOpenAPISpecParsing(status, version = 'unknown') {
        if (this.promMetrics) {
            this.promMetrics.openapi_specs_parsed.labels(status, version).inc();
        }
        
        this.logger.debug('OpenAPI spec parsing recorded:', { status, version });
    }

    /**
     * Record Kubernetes manifest generation
     * @param {string} type - Manifest type
     * @param {string} namespace - Target namespace
     */
    recordKubernetesManifestGeneration(type, namespace = 'default') {
        if (this.promMetrics) {
            this.promMetrics.kubernetes_manifests_generated.labels(type, namespace).inc();
        }
        
        this.logger.debug('Kubernetes manifest generation recorded:', { type, namespace });
    }

    /**
     * Record Git operation
     * @param {string} operation - Git operation (clone, commit, push)
     * @param {string} status - Operation status (success/failed)
     */
    recordGitOperation(operation, status) {
        if (this.promMetrics) {
            this.promMetrics.git_operations_total.labels(operation, status).inc();
        }
        
        this.logger.debug('Git operation recorded:', { operation, status });
    }

    /**
     * Update duration metrics
     * @param {number} duration - Duration in milliseconds
     */
    updateDurationMetrics(duration) {
        this.metrics.performance.total_duration += duration;
        this.metrics.performance.min_duration = Math.min(this.metrics.performance.min_duration, duration);
        this.metrics.performance.max_duration = Math.max(this.metrics.performance.max_duration, duration);
        
        // Calculate average
        if (this.metrics.integrations.total > 0) {
            this.metrics.performance.avg_duration = this.metrics.performance.total_duration / this.metrics.integrations.total;
        }
    }

    /**
     * Start metrics collection interval
     */
    startMetricsCollection() {
        // Update resource metrics every 30 seconds
        setInterval(() => {
            this.collectResourceMetrics();
        }, 30000);
        
        this.logger.debug('Metrics collection interval started');
    }

    /**
     * Collect resource metrics
     */
    collectResourceMetrics() {
        if (typeof process !== 'undefined') {
            const memUsage = process.memoryUsage();
            this.metrics.resources.memory_usage = memUsage.heapUsed;
            
            // CPU usage would require additional libraries
            // For now, we'll skip it
        }
    }

    /**
     * Get current metrics
     * @returns {Object} Current metrics
     */
    getMetrics() {
        return {
            ...this.metrics,
            timestamp: new Date().toISOString(),
            uptime: process.uptime?.() || 0
        };
    }

    /**
     * Get Prometheus metrics
     * @returns {Promise<string>} Prometheus metrics in text format
     */
    async getPrometheusMetrics() {
        if (!this.promClient) {
            return '# Prometheus client not available\n';
        }
        
        return await this.promClient.register.metrics();
    }

    /**
     * Reset metrics
     */
    reset() {
        this.metrics = {
            integrations: {
                total: 0,
                success: 0,
                failed: 0,
                in_progress: 0
            },
            performance: {
                total_duration: 0,
                avg_duration: 0,
                min_duration: Infinity,
                max_duration: 0
            },
            errors: new Map(),
            api_calls: new Map(),
            resources: {
                memory_usage: 0,
                cpu_usage: 0
            }
        };
        
        this.currentIntegrations.clear();
        
        if (this.promClient) {
            this.promClient.register.clear();
            this.initializePrometheusMetrics();
        }
        
        this.logger.info('Metrics reset');
    }

    /**
     * Get metrics summary
     * @returns {Object} Metrics summary
     */
    getSummary() {
        const totalRequests = this.metrics.integrations.total;
        const successRate = totalRequests > 0 ? (this.metrics.integrations.success / totalRequests) * 100 : 0;
        
        return {
            totalIntegrations: totalRequests,
            successfulIntegrations: this.metrics.integrations.success,
            failedIntegrations: this.metrics.integrations.failed,
            activeIntegrations: this.metrics.integrations.in_progress,
            successRate: Math.round(successRate * 100) / 100,
            averageDuration: Math.round(this.metrics.performance.avg_duration),
            minDuration: this.metrics.performance.min_duration === Infinity ? 0 : this.metrics.performance.min_duration,
            maxDuration: this.metrics.performance.max_duration,
            totalErrors: Array.from(this.metrics.errors.values()).reduce((sum, count) => sum + count, 0),
            topErrors: Array.from(this.metrics.errors.entries())
                .sort(([,a], [,b]) => b - a)
                .slice(0, 5)
                .map(([type, count]) => ({ type, count })),
            totalApiCalls: Array.from(this.metrics.api_calls.values()).reduce((sum, count) => sum + count, 0),
            memoryUsage: this.metrics.resources.memory_usage,
            timestamp: new Date().toISOString()
        };
    }
}

module.exports = { MetricsCollector };