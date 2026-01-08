/**
 * Centralized Logging Utility
 * 
 * Provides structured JSON logging with:
 * - Log levels (debug, info, warn, error)
 * - Request tracing with correlation IDs
 * - Service context (service name, environment)
 * - Performance metrics
 * - Error stack traces
 * 
 * Usage:
 *   import { logger, createServiceLogger } from '../utils/logger.js';
 *   
 *   const log = createServiceLogger('witness');
 *   log.info('Processing batch', { batchId: 123, eventCount: 5 });
 *   log.error('Failed to anchor', { error: err, batchId: 123 });
 */

import 'dotenv/config';

// Log levels with numeric priority
export enum LogLevel {
    DEBUG = 0,
    INFO = 1,
    WARN = 2,
    ERROR = 3
}

// Structured log entry
export interface LogEntry {
    timestamp: string;
    level: string;
    service: string;
    message: string;
    traceId?: string;
    spanId?: string;
    duration?: number;
    data?: Record<string, unknown>;
    error?: {
        name: string;
        message: string;
        stack?: string;
    };
}

// Logger configuration
interface LoggerConfig {
    level: LogLevel;
    format: 'json' | 'pretty';
    serviceName: string;
    enableTracing: boolean;
}

// Parse log level from env
function parseLogLevel(level?: string): LogLevel {
    switch (level?.toLowerCase()) {
        case 'debug': return LogLevel.DEBUG;
        case 'info': return LogLevel.INFO;
        case 'warn': return LogLevel.WARN;
        case 'error': return LogLevel.ERROR;
        default: return LogLevel.INFO;
    }
}

// Generate unique trace ID
function generateTraceId(): string {
    return `${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 10)}`;
}

// Generate span ID
function generateSpanId(): string {
    return Math.random().toString(36).substring(2, 10);
}

// Format error for logging
function formatError(error: unknown): LogEntry['error'] | undefined {
    if (!error) return undefined;
    
    if (error instanceof Error) {
        return {
            name: error.name,
            message: error.message,
            stack: error.stack
        };
    }
    
    return {
        name: 'UnknownError',
        message: String(error)
    };
}

// Pretty format for development
function prettyFormat(entry: LogEntry): string {
    const levelColors: Record<string, string> = {
        DEBUG: '\x1b[36m', // Cyan
        INFO: '\x1b[32m',  // Green
        WARN: '\x1b[33m',  // Yellow
        ERROR: '\x1b[31m'  // Red
    };
    const reset = '\x1b[0m';
    const dim = '\x1b[2m';
    
    const color = levelColors[entry.level] || '';
    const time = new Date(entry.timestamp).toLocaleTimeString();
    
    let output = `${dim}${time}${reset} ${color}[${entry.level}]${reset} ${dim}[${entry.service}]${reset} ${entry.message}`;
    
    if (entry.duration !== undefined) {
        output += ` ${dim}(${entry.duration}ms)${reset}`;
    }
    
    if (entry.traceId) {
        output += ` ${dim}trace=${entry.traceId}${reset}`;
    }
    
    if (entry.data && Object.keys(entry.data).length > 0) {
        output += `\n  ${dim}${JSON.stringify(entry.data, null, 2).replace(/\n/g, '\n  ')}${reset}`;
    }
    
    if (entry.error) {
        output += `\n  ${color}Error: ${entry.error.message}${reset}`;
        if (entry.error.stack) {
            output += `\n${dim}${entry.error.stack}${reset}`;
        }
    }
    
    return output;
}

// Main Logger class
class Logger {
    private config: LoggerConfig;
    private traceId?: string;
    private spanId?: string;
    private service: string;

    constructor(service: string, config?: Partial<LoggerConfig>) {
        this.service = service;
        this.config = {
            level: config?.level ?? parseLogLevel(process.env.LOG_LEVEL),
            format: (config?.format ?? process.env.LOG_FORMAT ?? 'pretty') as 'json' | 'pretty',
            serviceName: config?.serviceName ?? process.env.SERVICE_NAME ?? 'dpp-trust-system',
            enableTracing: config?.enableTracing ?? process.env.ENABLE_TRACING === 'true'
        };

        if (this.config.enableTracing) {
            this.traceId = generateTraceId();
            this.spanId = generateSpanId();
        }
    }

    // Create a child logger with same trace context
    child(service: string): Logger {
        const child = new Logger(service, this.config);
        child.traceId = this.traceId;
        child.spanId = generateSpanId();
        return child;
    }

    // Start a new trace (e.g., for a new request)
    startTrace(): string {
        this.traceId = generateTraceId();
        this.spanId = generateSpanId();
        return this.traceId;
    }

    // Set trace from external source (e.g., request header)
    setTrace(traceId: string, spanId?: string): void {
        this.traceId = traceId;
        this.spanId = spanId ?? generateSpanId();
    }

    // Core log method
    private log(level: LogLevel, levelName: string, message: string, data?: Record<string, unknown>, error?: unknown): void {
        if (level < this.config.level) return;

        const entry: LogEntry = {
            timestamp: new Date().toISOString(),
            level: levelName,
            service: this.service,
            message
        };

        if (this.traceId) entry.traceId = this.traceId;
        if (this.spanId) entry.spanId = this.spanId;
        if (data && Object.keys(data).length > 0) entry.data = data;
        if (error) entry.error = formatError(error);

        const output = this.config.format === 'json' 
            ? JSON.stringify(entry) 
            : prettyFormat(entry);

        switch (level) {
            case LogLevel.ERROR:
                console.error(output);
                break;
            case LogLevel.WARN:
                console.warn(output);
                break;
            default:
                console.log(output);
        }
    }

    // Log level methods
    debug(message: string, data?: Record<string, unknown>): void {
        this.log(LogLevel.DEBUG, 'DEBUG', message, data);
    }

    info(message: string, data?: Record<string, unknown>): void {
        this.log(LogLevel.INFO, 'INFO', message, data);
    }

    warn(message: string, data?: Record<string, unknown>, error?: unknown): void {
        this.log(LogLevel.WARN, 'WARN', message, data, error);
    }

    error(message: string, error?: unknown, data?: Record<string, unknown>): void {
        this.log(LogLevel.ERROR, 'ERROR', message, data, error);
    }

    // Performance timing helper
    time(label: string): () => void {
        const start = Date.now();
        return () => {
            const duration = Date.now() - start;
            this.info(`${label} completed`, { duration });
        };
    }

    // Async operation timer
    async timed<T>(label: string, operation: () => Promise<T>): Promise<T> {
        const start = Date.now();
        try {
            const result = await operation();
            const duration = Date.now() - start;
            this.info(`${label} completed`, { duration, success: true });
            return result;
        } catch (err) {
            const duration = Date.now() - start;
            this.error(`${label} failed`, err, { duration });
            throw err;
        }
    }
}

// Factory function for creating service-specific loggers
export function createServiceLogger(service: string): Logger {
    return new Logger(service);
}

// Default logger instance
export const logger = new Logger('app');

// Express middleware for request logging
export function requestLogger(serviceName: string) {
    const log = createServiceLogger(serviceName);
    
    return (req: any, res: any, next: () => void) => {
        const start = Date.now();
        
        // Get or create trace ID from header
        const traceId = req.headers['x-trace-id'] || log.startTrace();
        req.traceId = traceId;
        res.setHeader('x-trace-id', traceId);

        // Log request
        log.setTrace(traceId);
        log.info('Request received', {
            method: req.method,
            path: req.path,
            query: req.query,
            ip: req.ip
        });

        // Log response
        res.on('finish', () => {
            const duration = Date.now() - start;
            const level = res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info';
            
            log[level]('Request completed', {
                method: req.method,
                path: req.path,
                statusCode: res.statusCode,
                duration
            });
        });

        next();
    };
}

// Types are already exported via interface declarations above
