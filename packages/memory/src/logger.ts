/**
 * Simple logger implementation for @autoweave/memory
 */

export class Logger {
    private name: string;
    private level: string;

    constructor(name: string, level: string = 'info') {
        this.name = name;
        this.level = level;
    }

    private log(level: string, message: string, ...args: any[]): void {
        const timestamp = new Date().toISOString();
        const prefix = `[${timestamp}] [${level.toUpperCase()}] [${this.name}]`;
        
        switch (level) {
            case 'error':
                console.error(prefix, message, ...args);
                break;
            case 'warn':
                console.warn(prefix, message, ...args);
                break;
            case 'info':
                console.info(prefix, message, ...args);
                break;
            case 'debug':
                if (this.level === 'debug') {
                    console.debug(prefix, message, ...args);
                }
                break;
            default:
                console.log(prefix, message, ...args);
        }
    }

    error(message: string, ...args: any[]): void {
        this.log('error', message, ...args);
    }

    warn(message: string, ...args: any[]): void {
        this.log('warn', message, ...args);
    }

    info(message: string, ...args: any[]): void {
        this.log('info', message, ...args);
    }

    debug(message: string, ...args: any[]): void {
        this.log('debug', message, ...args);
    }

    verbose(message: string, ...args: any[]): void {
        this.log('verbose', message, ...args);
    }
}

export default Logger;