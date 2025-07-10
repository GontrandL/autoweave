const chalk = require('chalk');

/**
 * Logger - Système de logging structuré pour AutoWeave
 * Fournit des niveaux de logging avec couleurs et formatage
 */
class Logger {
    constructor(component = 'AutoWeave') {
        this.component = component;
        this.level = process.env.LOG_LEVEL || 'info';
        this.levels = {
            error: 0,
            warn: 1,
            info: 2,
            debug: 3
        };
        
        // Configuration des couleurs
        this.colors = {
            error: chalk.red,
            warn: chalk.yellow,
            info: chalk.blue,
            debug: chalk.gray,
            success: chalk.green
        };
        
        // Initialize external services if configured
        this.initializeExternalServices();
    }

    /**
     * Initialize external services if configured
     */
    initializeExternalServices() {
        // Initialize Sentry if configured
        if (process.env.SENTRY_DSN) {
            try {
                const Sentry = require('@sentry/node');
                Sentry.init({
                    dsn: process.env.SENTRY_DSN,
                    environment: process.env.NODE_ENV || 'development',
                    tracesSampleRate: 1.0
                });
                this.sentryClient = Sentry;
                this.sentryEnabled = true;
                this.logger.info('Sentry error monitoring initialized');
            } catch (error) {
                console.warn('Failed to initialize Sentry:', error.message);
                this.sentryEnabled = false;
            }
        } else {
            this.sentryEnabled = false;
        }
        
        // Initialize security service if configured
        if (process.env.SECURITY_SERVICE_URL) {
            this.securityServiceUrl = process.env.SECURITY_SERVICE_URL;
            this.securityServiceToken = process.env.SECURITY_SERVICE_TOKEN;
            this.securityServiceEnabled = true;
            this.logger.info('Security service integration enabled');
        } else {
            this.securityServiceEnabled = false;
        }
    }

    /**
     * Capture exception with Sentry
     */
    captureException(error, context = {}) {
        if (this.sentryEnabled && this.sentryClient) {
            this.sentryClient.captureException(error, {
                extra: context,
                tags: {
                    component: this.component
                }
            });
        }
    }

    /**
     * Send security event to security service
     */
    async sendSecurityEvent(event, details = null) {
        if (!this.securityServiceEnabled) return;
        
        try {
            const response = await fetch(this.securityServiceUrl + '/events', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.securityServiceToken}`
                },
                body: JSON.stringify({
                    event,
                    details,
                    timestamp: new Date().toISOString(),
                    component: this.component,
                    environment: process.env.NODE_ENV || 'development'
                })
            });
            
            if (!response.ok) {
                console.error('Failed to send security event:', response.statusText);
            }
        } catch (error) {
            console.error('Error sending security event:', error);
        }
    }

    /**
     * Définit le niveau de logging global
     */
    static setLevel(level) {
        process.env.LOG_LEVEL = level;
    }

    /**
     * Formate un message de log
     */
    formatMessage(level, message, data = null) {
        const timestamp = new Date().toISOString();
        const levelUpper = level.toUpperCase().padEnd(5);
        const componentPadded = this.component.padEnd(20);
        
        let formatted = `[${timestamp}] [${levelUpper}] [${componentPadded}] ${message}`;
        
        // Ajouter les données si présentes
        if (data) {
            if (typeof data === 'object') {
                formatted += '\n' + JSON.stringify(data, null, 2);
            } else {
                formatted += ` - ${data}`;
            }
        }
        
        return formatted;
    }

    /**
     * Vérifie si le niveau de log doit être affiché
     */
    shouldLog(level) {
        const currentLevel = this.levels[this.level] || 2;
        const messageLevel = this.levels[level] || 2;
        return messageLevel <= currentLevel;
    }

    /**
     * Log un message d'erreur
     */
    error(message, data = null) {
        if (!this.shouldLog('error')) return;
        
        const formatted = this.formatMessage('error', message, data);
        console.error(this.colors.error(formatted));
        
        // En production, envoyer les erreurs à un service de monitoring
        if (process.env.NODE_ENV === 'production' && this.sentryEnabled) {
            this.captureException(new Error(message), { extra: data });
        }
    }

    /**
     * Log un message d'avertissement
     */
    warn(message, data = null) {
        if (!this.shouldLog('warn')) return;
        
        const formatted = this.formatMessage('warn', message, data);
        console.warn(this.colors.warn(formatted));
    }

    /**
     * Log un message d'information
     */
    info(message, data = null) {
        if (!this.shouldLog('info')) return;
        
        const formatted = this.formatMessage('info', message, data);
        console.log(this.colors.info(formatted));
    }

    /**
     * Log un message de debug
     */
    debug(message, data = null) {
        if (!this.shouldLog('debug')) return;
        
        const formatted = this.formatMessage('debug', message, data);
        console.log(this.colors.debug(formatted));
    }

    /**
     * Log un message de succès
     */
    success(message, data = null) {
        if (!this.shouldLog('info')) return;
        
        const formatted = this.formatMessage('success', message, data);
        console.log(this.colors.success(formatted));
    }

    /**
     * Log une performance (temps d'exécution)
     */
    performance(operation, duration, data = null) {
        if (!this.shouldLog('info')) return;
        
        const message = `${operation} completed in ${duration}ms`;
        const formatted = this.formatMessage('perf', message, data);
        console.log(this.colors.info(formatted));
    }

    /**
     * Log un événement de démarrage
     */
    startup(message, data = null) {
        const formatted = this.formatMessage('startup', message, data);
        console.log(chalk.cyan.bold(formatted));
    }

    /**
     * Log un événement de fermeture
     */
    shutdown(message, data = null) {
        const formatted = this.formatMessage('shutdown', message, data);
        console.log(chalk.magenta.bold(formatted));
    }

    /**
     * Crée un logger pour un timing
     */
    createTimer(operation) {
        const startTime = Date.now();
        
        return {
            end: (data = null) => {
                const duration = Date.now() - startTime;
                this.performance(operation, duration, data);
                return duration;
            }
        };
    }

    /**
     * Log une table de données
     */
    table(title, data) {
        if (!this.shouldLog('info')) return;
        
        this.info(`${title}:`);
        console.table(data);
    }

    /**
     * Log des métriques
     */
    metrics(name, metrics) {
        if (!this.shouldLog('info')) return;
        
        const message = `Metrics for ${name}`;
        this.info(message, metrics);
    }

    /**
     * Log un événement d'API
     */
    apiCall(method, url, status, duration, data = null) {
        if (!this.shouldLog('info')) return;
        
        const statusColor = status >= 400 ? this.colors.error : 
                           status >= 300 ? this.colors.warn : 
                           this.colors.success;
        
        const message = `${method} ${url} ${status} (${duration}ms)`;
        const formatted = this.formatMessage('api', message, data);
        console.log(statusColor(formatted));
    }

    /**
     * Log un événement de base de données
     */
    database(operation, table, duration, data = null) {
        if (!this.shouldLog('debug')) return;
        
        const message = `DB ${operation} on ${table} (${duration}ms)`;
        const formatted = this.formatMessage('db', message, data);
        console.log(this.colors.debug(formatted));
    }

    /**
     * Log un événement de cache
     */
    cache(operation, key, hit = false, data = null) {
        if (!this.shouldLog('debug')) return;
        
        const hitStatus = hit ? 'HIT' : 'MISS';
        const message = `Cache ${operation} ${key} (${hitStatus})`;
        const formatted = this.formatMessage('cache', message, data);
        console.log(this.colors.debug(formatted));
    }

    /**
     * Log un événement de sécurité
     */
    security(event, details = null) {
        const formatted = this.formatMessage('security', event, details);
        console.log(chalk.red.bold(formatted));
        
        // En production, les événements de sécurité sont envoyés immédiatement
        if (process.env.NODE_ENV === 'production' && this.securityServiceEnabled) {
            this.sendSecurityEvent(event, details);
        }
    }

    /**
     * Log un événement de déploiement
     */
    deployment(event, details = null) {
        const formatted = this.formatMessage('deploy', event, details);
        console.log(chalk.blue.bold(formatted));
    }

    /**
     * Log un événement de santé du système
     */
    health(component, status, details = null) {
        const color = status === 'healthy' ? this.colors.success : this.colors.error;
        const message = `Health check: ${component} is ${status}`;
        const formatted = this.formatMessage('health', message, details);
        console.log(color(formatted));
    }

    /**
     * Crée un logger enfant avec un composant spécifique
     */
    child(childComponent) {
        const fullComponent = `${this.component}:${childComponent}`;
        return new Logger(fullComponent);
    }

    /**
     * Log avec un contexte de corrélation
     */
    withContext(correlationId, level, message, data = null) {
        const contextData = {
            correlationId,
            ...data
        };
        
        this[level](message, contextData);
    }

    /**
     * Log un événement de workflow
     */
    workflow(workflowId, step, status, data = null) {
        const message = `Workflow ${workflowId} - Step ${step}: ${status}`;
        const formatted = this.formatMessage('workflow', message, data);
        
        const color = status === 'completed' ? this.colors.success :
                     status === 'failed' ? this.colors.error :
                     this.colors.info;
        
        console.log(color(formatted));
    }

    /**
     * Log un événement d'agent
     */
    agent(agentId, event, data = null) {
        const message = `Agent ${agentId}: ${event}`;
        const formatted = this.formatMessage('agent', message, data);
        console.log(this.colors.info(formatted));
    }

    /**
     * Log un événement de mémoire
     */
    memory(operation, type, data = null) {
        if (!this.shouldLog('debug')) return;
        
        const message = `Memory ${operation} (${type})`;
        const formatted = this.formatMessage('memory', message, data);
        console.log(this.colors.debug(formatted));
    }

    /**
     * Log un événement de kagent
     */
    kagent(operation, data = null) {
        const message = `kagent: ${operation}`;
        const formatted = this.formatMessage('kagent', message, data);
        console.log(this.colors.info(formatted));
    }

    /**
     * Log un événement de test
     */
    test(testName, status, duration = null, data = null) {
        if (process.env.NODE_ENV !== 'test') return;
        
        const durationText = duration ? ` (${duration}ms)` : '';
        const message = `Test ${testName}: ${status}${durationText}`;
        const formatted = this.formatMessage('test', message, data);
        
        const color = status === 'passed' ? this.colors.success : this.colors.error;
        console.log(color(formatted));
    }

    /**
     * Configuration du logger pour les tests
     */
    static configureForTesting() {
        // Réduire le niveau de logging pour les tests
        Logger.setLevel('error');
    }

    /**
     * Configuration du logger pour la production
     */
    static configureForProduction() {
        Logger.setLevel('info');
        
        // En production, on pourrait configurer des transports additionnels
        // comme des fichiers de log, des services de monitoring, etc.
    }

    /**
     * Configuration du logger pour le développement
     */
    static configureForDevelopment() {
        Logger.setLevel('debug');
    }
}

// Configuration automatique basée sur l'environnement
switch (process.env.NODE_ENV) {
    case 'test':
        Logger.configureForTesting();
        break;
    case 'production':
        Logger.configureForProduction();
        break;
    case 'development':
    default:
        Logger.configureForDevelopment();
        break;
}

module.exports = { Logger };