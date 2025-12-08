/**
 * Client-Side Logging Utility
 *
 * Provides structured logging for the browser with different levels and context support.
 * Replace console.log statements with these functions.
 *
 * Usage:
 *   import { logger } from '@/utils/logger';
 *   logger.info('User logged in', { userId: 123 });
 *
 *   // Or create a contextual logger:
 *   import { createLogger } from '@/utils/logger';
 *   const log = createLogger('WebSocket');
 *   log.info('Connected');  // Outputs: [WebSocket] Connected
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
 * Check if we're in development mode
 */
function isDevelopment(): boolean {
  return import.meta.env.DEV || import.meta.env.MODE === 'development';
}

/**
 * Format log entry for output
 */
function formatLog(entry: LogEntry): string {
  const { timestamp, level, message, context, metadata } = entry;

  // Human-readable format for browser
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

  // In production, only log errors and warnings
  if (!isDevelopment() && level !== LogLevel.ERROR && level !== LogLevel.WARN) {
    return;
  }

  switch (level) {
    case LogLevel.ERROR:
      console.error(formatted);
      // In production, you could send to error tracking service like Sentry
      if (!isDevelopment() && meta?.skipSentry !== true) {
        // Sentry is already configured in the React error boundary
        // Errors will be caught there or by window.onerror
      }
      break;
    case LogLevel.WARN:
      console.warn(formatted);
      break;
    case LogLevel.INFO:
      console.info(formatted);
      break;
    case LogLevel.DEBUG:
      console.log(formatted);
      break;
  }
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
 * @param context - The context/component name (e.g., 'WebSocket', 'ErrorBoundary', 'ChartExport')
 * @returns Logger instance with context pre-filled
 *
 * @example
 * const log = createLogger('WebSocket');
 * log.info('Connected');  // [2025-11-15T...] INFO: [WebSocket] Connected
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
