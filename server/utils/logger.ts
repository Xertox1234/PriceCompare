/**
 * Logging Utility
 *
 * Provides structured logging with different levels and context support.
 * Replace console.log statements with these functions.
 *
 * Usage:
 *   import { logger } from './utils/logger';
 *   logger.info('Server started', { port: 3000 });
 *
 *   // Or create a contextual logger:
 *   import { createLogger } from './utils/logger';
 *   const log = createLogger('Redis');
 *   log.info('Connected successfully');  // Outputs: [Redis] Connected successfully
 */

export enum LogLevel {
  ERROR = 'error',
  WARN = 'warn',
  INFO = 'info',
  DEBUG = 'debug',
}

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Format log entry for output
 */
function formatLog(entry: LogEntry): string {
  const { timestamp, level, message, context, metadata } = entry;

  if (process.env.NODE_ENV === 'production') {
    // JSON format for production (easier to parse by log aggregators)
    return JSON.stringify({ timestamp, level, message, context, ...metadata });
  }

  // Human-readable format for development
  const contextStr = context ? `[${context}] ` : '';
  const metadataStr =
    metadata && Object.keys(metadata).length > 0 ? `\n${JSON.stringify(metadata, null, 2)}` : '';
  return `[${timestamp}] ${level.toUpperCase()}: ${contextStr}${message}${metadataStr}`;
}

/**
 * Core logging function
 */
function log(
  level: LogLevel,
  message: string,
  contextOrMetadata?: string | Record<string, unknown>,
  metadata?: Record<string, unknown>
) {
  // Handle overloaded parameters
  let context: string | undefined;
  let meta: Record<string, unknown> | undefined;

  if (typeof contextOrMetadata === 'string') {
    context = contextOrMetadata;
    meta = metadata;
  } else {
    meta = contextOrMetadata;
  }

  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    context,
    metadata: meta,
  };

  const formatted = formatLog(entry);

  switch (level) {
    case LogLevel.ERROR:
      console.error(formatted);
      break;
    case LogLevel.WARN:
      console.warn(formatted);
      break;
    case LogLevel.INFO:
      console.info(formatted);
      break;
    case LogLevel.DEBUG:
      if (process.env.NODE_ENV === 'development') {
        console.log(formatted);
      }
      break;
  }

  // Note: External logging service integration (e.g., Winston, Datadog)
  // can be added here if needed in the future
}

/**
 * Logger instance with convenience methods
 */
export const logger = {
  error(
    message: string,
    contextOrMetadata?: string | Record<string, unknown>,
    metadata?: Record<string, unknown>
  ) {
    log(LogLevel.ERROR, message, contextOrMetadata, metadata);
  },

  warn(
    message: string,
    contextOrMetadata?: string | Record<string, unknown>,
    metadata?: Record<string, unknown>
  ) {
    log(LogLevel.WARN, message, contextOrMetadata, metadata);
  },

  info(
    message: string,
    contextOrMetadata?: string | Record<string, unknown>,
    metadata?: Record<string, unknown>
  ) {
    log(LogLevel.INFO, message, contextOrMetadata, metadata);
  },

  debug(
    message: string,
    contextOrMetadata?: string | Record<string, unknown>,
    metadata?: Record<string, unknown>
  ) {
    log(LogLevel.DEBUG, message, contextOrMetadata, metadata);
  },

  /**
   * Log HTTP request
   */
  http(method: string, path: string, statusCode: number, duration: number) {
    this.info(`${method} ${path}`, {
      statusCode,
      duration: `${duration}ms`,
    });
  },

  /**
   * Log database query
   */
  query(query: string, duration: number) {
    this.debug('Database query', {
      query: query.substring(0, 100) + (query.length > 100 ? '...' : ''),
      duration: `${duration}ms`,
    });
  },
};

/**
 * Logger interface for contextual loggers
 */
export interface Logger {
  error(message: string, metadata?: Record<string, unknown>): void;
  warn(message: string, metadata?: Record<string, unknown>): void;
  info(message: string, metadata?: Record<string, unknown>): void;
  debug(message: string, metadata?: Record<string, unknown>): void;
}

/**
 * Create a contextual logger
 *
 * @param context - The context/module name (e.g., 'Redis', 'Sentry', 'API')
 * @returns Logger instance with context pre-filled
 *
 * @example
 * const log = createLogger('Redis');
 * log.info('Connected successfully');  // [2025-11-15T...] INFO: [Redis] Connected successfully
 */
export function createLogger(context: string): Logger {
  return {
    error(message: string, metadata?: Record<string, unknown>) {
      log(LogLevel.ERROR, message, context, metadata);
    },

    warn(message: string, metadata?: Record<string, unknown>) {
      log(LogLevel.WARN, message, context, metadata);
    },

    info(message: string, metadata?: Record<string, unknown>) {
      log(LogLevel.INFO, message, context, metadata);
    },

    debug(message: string, metadata?: Record<string, unknown>) {
      log(LogLevel.DEBUG, message, context, metadata);
    },
  };
}
