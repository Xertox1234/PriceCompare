/**
 * Security Event Logger
 *
 * Provides comprehensive security event logging for audit trails and monitoring.
 * Logs authentication attempts, authorization failures, CSRF violations, and more.
 */

import { Request } from 'express';

/**
 * Security event types
 * Categorized by domain for easier filtering and alerting
 */
export enum SecurityEventType {
  // Authentication Events
  LOGIN_SUCCESS = 'auth.login.success',
  LOGIN_FAILED = 'auth.login.failed',
  LOGOUT = 'auth.logout',
  REGISTER = 'auth.register',
  SESSION_EXPIRED = 'auth.session.expired',

  // Authorization Events
  ACCESS_DENIED = 'authz.access_denied',
  ADMIN_ACCESS_DENIED = 'authz.admin_access_denied',
  PRIVILEGE_ESCALATION_ATTEMPT = 'authz.privilege_escalation',

  // Account Security Events
  ACCOUNT_LOCKED = 'account.locked',
  ACCOUNT_UNLOCKED = 'account.unlocked',
  PASSWORD_CHANGED = 'account.password_changed',
  PASSWORD_RESET_REQUESTED = 'account.password_reset_requested',
  PASSWORD_RESET_COMPLETED = 'account.password_reset_completed',

  // Rate Limiting Events
  RATE_LIMIT_EXCEEDED = 'security.rate_limit_exceeded',
  RATE_LIMIT_WARNING = 'security.rate_limit_warning', // 80% threshold

  // CSRF Events
  CSRF_VIOLATION = 'security.csrf_violation',
  CSRF_TOKEN_MISSING = 'security.csrf_token_missing',
  CSRF_TOKEN_INVALID = 'security.csrf_token_invalid',

  // Session Events
  SESSION_CREATED = 'session.created',
  SESSION_DESTROYED = 'session.destroyed',
  CONCURRENT_SESSION_DETECTED = 'session.concurrent',
  SESSION_HIJACK_ATTEMPT = 'session.hijack_attempt',

  // Webhook Events
  WEBHOOK_RECEIVED = 'webhook.received',
  WEBHOOK_SIGNATURE_INVALID = 'webhook.signature_invalid',
  WEBHOOK_SIGNATURE_MISSING = 'webhook.signature_missing',

  // Input Validation Events
  VALIDATION_ERROR = 'validation.error',
  SUSPICIOUS_INPUT = 'validation.suspicious',
}

/**
 * Security event severity levels
 */
export enum SecurityEventSeverity {
  INFO = 'info',
  WARNING = 'warning',
  ERROR = 'error',
  CRITICAL = 'critical',
}

/**
 * Security event interface
 */
export interface SecurityEvent {
  type: SecurityEventType;
  severity: SecurityEventSeverity;
  timestamp: Date;
  userId?: number;
  username?: string;
  email?: string;
  ipAddress: string;
  userAgent: string;
  path: string;
  method: string;
  success: boolean;
  message?: string;
  metadata?: Record<string, any>;
}

/**
 * Determine severity based on event type
 */
function getSeverityForEventType(type: SecurityEventType): SecurityEventSeverity {
  const criticalEvents = [
    SecurityEventType.PRIVILEGE_ESCALATION_ATTEMPT,
    SecurityEventType.SESSION_HIJACK_ATTEMPT,
    SecurityEventType.ACCOUNT_LOCKED,
  ];

  const errorEvents = [
    SecurityEventType.LOGIN_FAILED,
    SecurityEventType.ACCESS_DENIED,
    SecurityEventType.ADMIN_ACCESS_DENIED,
    SecurityEventType.CSRF_VIOLATION,
    SecurityEventType.WEBHOOK_SIGNATURE_INVALID,
  ];

  const warningEvents = [
    SecurityEventType.RATE_LIMIT_EXCEEDED,
    SecurityEventType.RATE_LIMIT_WARNING,
    SecurityEventType.CSRF_TOKEN_MISSING,
    SecurityEventType.WEBHOOK_SIGNATURE_MISSING,
    SecurityEventType.CONCURRENT_SESSION_DETECTED,
  ];

  if (criticalEvents.includes(type)) return SecurityEventSeverity.CRITICAL;
  if (errorEvents.includes(type)) return SecurityEventSeverity.ERROR;
  if (warningEvents.includes(type)) return SecurityEventSeverity.WARNING;
  return SecurityEventSeverity.INFO;
}

/**
 * Sanitize metadata to prevent logging sensitive information
 */
function sanitizeMetadata(metadata?: Record<string, any>): Record<string, any> | undefined {
  if (!metadata) return undefined;

  const sensitiveKeys = ['password', 'token', 'secret', 'apiKey', 'creditCard', 'ssn'];
  const sanitized: Record<string, any> = {};

  for (const [key, value] of Object.entries(metadata)) {
    const keyLower = key.toLowerCase();
    if (sensitiveKeys.some(sensitive => keyLower.includes(sensitive))) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeMetadata(value);
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

/**
 * Log security event
 *
 * @param type Event type
 * @param req Express request object
 * @param options Event options
 */
export function logSecurityEvent(
  type: SecurityEventType,
  req: Request,
  options: {
    userId?: number;
    username?: string;
    email?: string;
    success: boolean;
    message?: string;
    metadata?: Record<string, any>;
  }
): void {
  const event: SecurityEvent = {
    type,
    severity: getSeverityForEventType(type),
    timestamp: new Date(),
    userId: options.userId,
    username: options.username,
    email: options.email,
    ipAddress: req.ip || req.socket.remoteAddress || 'unknown',
    userAgent: req.headers['user-agent'] || 'unknown',
    path: req.path,
    method: req.method,
    success: options.success,
    message: options.message,
    metadata: sanitizeMetadata(options.metadata),
  };

  // Log to console in structured format
  const logLevel = event.severity === SecurityEventSeverity.CRITICAL ? 'error' :
    event.severity === SecurityEventSeverity.ERROR ? 'error' :
    event.severity === SecurityEventSeverity.WARNING ? 'warn' : 'info';

  console[logLevel]('[SECURITY]', JSON.stringify(event, null, 2));

  // TODO: In production, integrate with logging service
  // Examples:
  // - Winston for file/stream logging
  // - Sentry for error tracking
  // - CloudWatch/Datadog for metrics
  // - ELK stack for log aggregation
  //
  // if (loggingService) {
  //   loggingService.logSecurityEvent(event);
  // }
  //
  // if (event.severity === SecurityEventSeverity.CRITICAL) {
  //   alertingService.sendAlert(event);
  // }
}

/**
 * Helper to extract user info from request
 */
export function getUserInfo(req: Request): {
  userId?: number;
  username?: string;
  email?: string;
} {
  const user = (req as any).user;
  if (!user) return {};

  return {
    userId: user.id,
    username: user.username,
    email: user.email,
  };
}

/**
 * Create a security event logger middleware wrapper
 * This can be used to wrap route handlers and automatically log events
 */
export function withSecurityLogging(
  eventType: SecurityEventType,
  handler: (req: Request, ...args: any[]) => Promise<any>
) {
  return async (req: Request, ...args: any[]) => {
    try {
      const result = await handler(req, ...args);
      logSecurityEvent(eventType, req, {
        ...getUserInfo(req),
        success: true,
      });
      return result;
    } catch (error) {
      logSecurityEvent(eventType, req, {
        ...getUserInfo(req),
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  };
}
