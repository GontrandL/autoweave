import { EventEmitter } from 'eventemitter3';
import { Page, ConsoleMessage, Response } from 'playwright';
// import { getLogger } from '@autoweave/observability';
const getLogger = (_name: string) => ({
  info: console.log,
  warn: console.warn,
  error: console.error,
  debug: console.debug
});
import type { 
  DebugReport, 
  ErrorEntry, 
  NetworkIssue, 
  LogEntry,
  DebuggerConfig,
  FixSuggestion 
} from '../types';

/**
 * AutoDebugger - Automatic error detection and fix generation
 * Captures browser events, analyzes errors, and suggests corrections
 */
export class AutoDebugger extends EventEmitter {
  private logger = getLogger('AutoDebugger');
  private logs: LogEntry[] = [];
  private errors: ErrorEntry[] = [];
  private networkIssues: NetworkIssue[] = [];
  private page?: Page;
  private isActive = false;
  private config: DebuggerConfig;

  constructor(config: Partial<DebuggerConfig> = {}) {
    super();
    this.config = {
      captureConsole: true,
      captureErrors: true,
      captureNetwork: true,
      networkErrorThreshold: 400,
      maxLogSize: 1000,
      autoAnalyze: true,
      ...config
    };
  }

  /**
   * Attach debugger to a Playwright page
   */
  async attach(page: Page): Promise<void> {
    if (this.isActive) {
      await this.detach();
    }

    this.page = page;
    this.isActive = true;
    this.setupListeners();
    
    this.logger.info('AutoDebugger attached to page', {
      url: page.url()
    });
  }

  /**
   * Detach debugger from current page
   */
  async detach(): Promise<void> {
    if (!this.isActive || !this.page) {
      return;
    }

    // Remove all listeners
    this.page.removeAllListeners();
    this.isActive = false;
    this.page = undefined;
    
    this.logger.info('AutoDebugger detached');
  }

  /**
   * Setup event listeners on the page
   */
  private setupListeners(): void {
    if (!this.page) return;

    // Capture console logs
    if (this.config.captureConsole) {
      this.page.on('console', (msg: ConsoleMessage) => {
        const logEntry: LogEntry = {
          type: msg.type(),
          text: msg.text(),
          timestamp: Date.now(),
          location: msg.location(),
          args: []
        };

        this.logs.push(logEntry);
        this.trimLogs();

        // Emit for real-time monitoring
        this.emit('console', logEntry);

        // Check for error patterns in logs
        if (msg.type() === 'error') {
          this.analyzeConsoleError(logEntry);
        }
      });
    }

    // Capture page errors
    if (this.config.captureErrors) {
      this.page.on('pageerror', (error: Error) => {
        const errorEntry: ErrorEntry = {
          name: error.name,
          message: error.message,
          stack: error.stack || '',
          timestamp: Date.now(),
          url: this.page?.url() || ''
        };

        this.errors.push(errorEntry);
        this.emit('error', errorEntry);

        if (this.config.autoAnalyze) {
          this.analyzeError(errorEntry);
        }
      });
    }

    // Monitor network issues
    if (this.config.captureNetwork) {
      this.page.on('response', (response: Response) => {
        if (response.status() >= this.config.networkErrorThreshold) {
          const issue: NetworkIssue = {
            url: response.url(),
            status: response.status(),
            statusText: response.statusText(),
            timestamp: Date.now(),
            method: response.request().method(),
            headers: response.headers()
          };

          this.networkIssues.push(issue);
          this.emit('network-error', issue);

          if (this.config.autoAnalyze) {
            this.analyzeNetworkIssue(issue);
          }
        }
      });

      // Capture failed requests
      this.page.on('requestfailed', (request) => {
        const issue: NetworkIssue = {
          url: request.url(),
          status: 0,
          statusText: request.failure()?.errorText || 'Request failed',
          timestamp: Date.now(),
          method: request.method(),
          headers: request.headers()
        };

        this.networkIssues.push(issue);
        this.emit('request-failed', issue);
      });
    }
  }

  /**
   * Analyze console error for patterns
   */
  private analyzeConsoleError(log: LogEntry): void {
    const patterns = [
      {
        pattern: /ReferenceError: (\w+) is not defined/,
        type: 'undefined_variable',
        extract: (match: RegExpMatchArray) => match[1]
      },
      {
        pattern: /TypeError: Cannot read propert(?:y|ies) ['"]?(\w+)['"]? of (null|undefined)/,
        type: 'null_reference',
        extract: (match: RegExpMatchArray) => ({ property: match[1], value: match[2] })
      },
      {
        pattern: /SyntaxError: (.+)/,
        type: 'syntax_error',
        extract: (match: RegExpMatchArray) => match[1]
      }
    ];

    for (const { pattern, type, extract } of patterns) {
      const match = log.text.match(pattern);
      if (match) {
        this.emit('pattern-detected', {
          type,
          data: extract(match),
          log
        });
      }
    }
  }

  /**
   * Analyze JavaScript error and generate fix suggestions
   */
  private async analyzeError(error: ErrorEntry): Promise<FixSuggestion[]> {
    const suggestions: FixSuggestion[] = [];

    // Variable not defined
    if (error.message.includes('is not defined')) {
      const varName = error.message.match(/(\w+) is not defined/)?.[1];
      if (varName) {
        suggestions.push({
          type: 'variable_declaration',
          severity: 'error',
          message: `Variable '${varName}' is not defined`,
          fix: `let ${varName}; // Declare this variable with appropriate value`,
          location: this.extractLocationFromStack(error.stack)
        });
      }
    }

    // Null/undefined reference
    if (error.message.includes('Cannot read property') || error.message.includes('Cannot read properties')) {
      const match = error.message.match(/Cannot read propert(?:y|ies) ['"]?(\w+)['"]? of (null|undefined)/);
      if (match) {
        suggestions.push({
          type: 'null_check',
          severity: 'error',
          message: `Attempting to access '${match[1]}' on ${match[2]}`,
          fix: `// Add null check before accessing property\nif (object) {\n  object.${match[1]}\n}`,
          location: this.extractLocationFromStack(error.stack)
        });
      }
    }

    // Type errors
    if (error.name === 'TypeError') {
      suggestions.push({
        type: 'type_check',
        severity: 'error',
        message: error.message,
        fix: `// Add type validation before operation`,
        location: this.extractLocationFromStack(error.stack)
      });
    }

    this.emit('suggestions-generated', suggestions);
    return suggestions;
  }

  /**
   * Analyze network issue and suggest fixes
   */
  private async analyzeNetworkIssue(issue: NetworkIssue): Promise<FixSuggestion[]> {
    const suggestions: FixSuggestion[] = [];

    // 404 Not Found
    if (issue.status === 404) {
      suggestions.push({
        type: 'resource_missing',
        severity: 'warning',
        message: `Resource not found: ${issue.url}`,
        fix: `// Verify the URL is correct or implement fallback:\ntry {\n  await fetch('${issue.url}');\n} catch (e) {\n  // Handle missing resource\n}`
      });
    }

    // 5xx Server errors
    if (issue.status >= 500) {
      suggestions.push({
        type: 'server_error',
        severity: 'error',
        message: `Server error (${issue.status}) for ${issue.url}`,
        fix: `// Implement retry logic with exponential backoff:\nconst retryWithBackoff = async (url, retries = 3) => {\n  for (let i = 0; i < retries; i++) {\n    try {\n      return await fetch(url);\n    } catch (e) {\n      await new Promise(r => setTimeout(r, Math.pow(2, i) * 1000));\n    }\n  }\n  throw new Error('Max retries exceeded');\n};`
      });
    }

    // CORS errors
    if (issue.statusText.includes('CORS')) {
      suggestions.push({
        type: 'cors_error',
        severity: 'error',
        message: `CORS error for ${issue.url}`,
        fix: `// Configure CORS on server or use proxy:\n// Server: Add Access-Control-Allow-Origin header\n// Client: Use proxy configuration`
      });
    }

    return suggestions;
  }

  /**
   * Generate comprehensive debug report
   */
  async generateReport(): Promise<DebugReport> {
    const report: DebugReport = {
      timestamp: Date.now(),
      url: this.page?.url() || '',
      logs: [...this.logs],
      errors: [...this.errors],
      networkIssues: [...this.networkIssues],
      suggestions: [],
      summary: {
        totalLogs: this.logs.length,
        totalErrors: this.errors.length,
        totalNetworkIssues: this.networkIssues.length,
        errorTypes: this.categorizeErrors(),
        criticalIssues: this.identifyCriticalIssues()
      }
    };

    // Generate suggestions for all errors
    for (const error of this.errors) {
      const errorSuggestions = await this.analyzeError(error);
      report.suggestions.push(...errorSuggestions);
    }

    // Generate suggestions for network issues
    for (const issue of this.networkIssues) {
      const networkSuggestions = await this.analyzeNetworkIssue(issue);
      report.suggestions.push(...networkSuggestions);
    }

    return report;
  }

  /**
   * Clear all captured data
   */
  clear(): void {
    this.logs = [];
    this.errors = [];
    this.networkIssues = [];
  }

  /**
   * Get current statistics
   */
  getStats() {
    return {
      logs: this.logs.length,
      errors: this.errors.length,
      networkIssues: this.networkIssues.length,
      isActive: this.isActive,
      url: this.page?.url()
    };
  }

  /**
   * Helper: Extract location from error stack
   */
  private extractLocationFromStack(stack: string): string | undefined {
    const match = stack.match(/at\s+.+\s+\((.+:\d+:\d+)\)/);
    return match?.[1];
  }

  /**
   * Helper: Trim logs to prevent memory issues
   */
  private trimLogs(): void {
    if (this.logs.length > this.config.maxLogSize) {
      this.logs = this.logs.slice(-this.config.maxLogSize);
    }
  }

  /**
   * Helper: Categorize errors by type
   */
  private categorizeErrors() {
    const categories: Record<string, number> = {};
    
    for (const error of this.errors) {
      categories[error.name] = (categories[error.name] || 0) + 1;
    }
    
    return categories;
  }

  /**
   * Helper: Identify critical issues that need immediate attention
   */
  private identifyCriticalIssues(): string[] {
    const critical: string[] = [];
    
    // Check for repeated errors
    const errorCounts: Record<string, number> = {};
    for (const error of this.errors) {
      const key = `${error.name}:${error.message}`;
      errorCounts[key] = (errorCounts[key] || 0) + 1;
      
      if (errorCounts[key] > 5) {
        critical.push(`Repeated error (${errorCounts[key]}x): ${error.message}`);
      }
    }
    
    // Check for high error rate
    if (this.errors.length > 50) {
      critical.push(`High error count: ${this.errors.length} errors detected`);
    }
    
    // Check for server errors
    const serverErrors = this.networkIssues.filter(i => i.status >= 500);
    if (serverErrors.length > 0) {
      critical.push(`Server errors detected: ${serverErrors.length} endpoints failing`);
    }
    
    return [...new Set(critical)]; // Remove duplicates
  }
}