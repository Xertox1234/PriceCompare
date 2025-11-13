/**
 * Logging Utility
 *
 * Provides structured logging with different levels.
 * Replace console.log statements with these functions.
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
  metadata?: Record<string, any>;
}

/**
 * Format log entry for output
 */
function formatLog(entry: LogEntry): string {
  const { timestamp, level, message, metadata } = entry;

  if (process.env.NODE_ENV === 'production') {
    // JSON format for production (easier to parse by log aggregators)
    return JSON.stringify({ timestamp, level, message, ...metadata });
  }

  // Human-readable format for development
  const metadataStr = metadata ? `\n${JSON.stringify(metadata, null, 2)}` : '';
  return `[${timestamp}] ${level.toUpperCase()}: ${message}${metadataStr}`;
}

/**
 * Core logging function
 */
function log(level: LogLevel, message: string, metadata?: Record<string, any>) {
  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    metadata,
  };

  const formatted = formatLog(entry);

  switch (level) {
    case LogLevel.ERROR:
      logger.error(formatted);
      break;
    case LogLevel.WARN:
      logger.warn(formatted);
      break;
    case LogLevel.INFO:
      console.info(formatted);
      break;
    case LogLevel.DEBUG:
      if (process.env.NODE_ENV === 'development') {
        logger.info(formatted);
      }
      break;
  }

  // TODO: Send to external logging service in production
  // if (process.env.NODE_ENV === 'production') {
  //   sendToLogService(entry);
  // }
}

/**
 * Logger instance with convenience methods
 */
export const logger = {
  error(message: string, metadata?: Record<string, any>) {
    log(LogLevel.ERROR, message, metadata);
  },

  warn(message: string, metadata?: Record<string, any>) {
    log(LogLevel.WARN, message, metadata);
  },

  info(message: string, metadata?: Record<string, any>) {
    log(LogLevel.INFO, message, metadata);
  },

  debug(message: string, metadata?: Record<string, any>) {
    log(LogLevel.DEBUG, message, metadata);
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
