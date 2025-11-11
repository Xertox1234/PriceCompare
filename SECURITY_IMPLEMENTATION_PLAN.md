# Security Implementation Plan - Phase 2

This document outlines the remaining security enhancements to be implemented in a future PR.

**Status:** Ready for implementation
**Estimated Total Effort:** 4-6 hours
**Priority:** Low to Medium
**Suggested PR:** Create new branch `security/phase-2-enhancements`

---

## Overview

Phase 1 (completed) addressed all medium-priority audit findings:
- ✅ Input validation consistency
- ✅ Enhanced CSRF protection
- ✅ Redis-based rate limiting
- ✅ Redis-based account lockout

Phase 2 will address remaining low-priority items and additional improvements:
1. Redis session store
2. Webhook authentication
3. Security event logging
4. (Optional) Password reset functionality
5. (Optional) Stricter environment validation

---

## Issue #1: Redis Session Store

### Priority: 🟡 Medium
**Effort:** 1 hour
**Impact:** High (required for production scalability)

### Current State
Sessions are stored in-memory, which doesn't work across multiple server instances:

```typescript
// server/index.ts (current)
app.use(session({
  secret: getRequiredEnv('SESSION_SECRET'),
  resave: false,
  saveUninitialized: false,
  // No store = in-memory
}));
```

### Implementation Plan

#### Step 1: Install connect-redis
```bash
npm install connect-redis --save
```

#### Step 2: Create session store configuration
**New File:** `server/config/session-store.ts`

```typescript
import { Redis } from 'ioredis';
import session from 'express-session';

/**
 * Create session store (Redis or in-memory fallback)
 */
export async function createSessionStore(
  redisClient: Redis | null
): Promise<session.Store | undefined> {
  if (!redisClient) {
    console.warn('⚠️  Using in-memory session store (not suitable for production)');
    return undefined; // express-session will use MemoryStore
  }

  try {
    const RedisStore = (await import('connect-redis')).default;

    const store = new RedisStore({
      client: redisClient,
      prefix: 'session:',
      ttl: 24 * 60 * 60, // 24 hours
    });

    console.log('✅ Using Redis session store');
    return store;
  } catch (error) {
    console.error('Failed to create Redis session store:', error);
    console.warn('⚠️  Falling back to in-memory session store');
    return undefined;
  }
}
```

#### Step 3: Update server/index.ts
**File:** `server/index.ts`

```typescript
import { initializeRedis } from './config/redis';
import { createSessionStore } from './config/session-store';

// After app initialization, before session setup
let redisClient: Redis | null = null;
let sessionStore: session.Store | undefined;

// Initialize Redis and session store
(async () => {
  redisClient = await initializeRedis();
  sessionStore = await createSessionStore(redisClient);

  // Session configuration (replace existing)
  app.use(session({
    store: sessionStore,
    secret: getRequiredEnv('SESSION_SECRET'),
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
    },
  }));

  // ... rest of middleware setup
  // ... route registration

  // Start server after Redis initialization
  server.listen({ port, host, reusePort }, () => {
    log(`serving on port ${port}`);
  });
})();
```

### Testing
```bash
# 1. Start Redis
redis-server

# 2. Start app and login
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password"}'

# 3. Check Redis for session
redis-cli KEYS "session:*"

# 4. Test session persistence across restarts
# - Login
# - Restart server
# - Access protected endpoint (should still be logged in)
```

### Rollback Plan
If issues occur, remove `store: sessionStore` from session config to fall back to in-memory.

---

## Issue #2: Webhook Authentication

### Priority: 🟢 Low
**Effort:** 30 minutes
**Impact:** Medium (prevents unauthorized webhook submissions)

### Current State
Discourse webhook endpoint lacks signature verification:

```typescript
// server/discourse-routes.ts
app.post('/discourse/webhook', async (req, res) => {
  // No authentication check!
  const event = req.body;
  // Process webhook...
});
```

### Implementation Plan

#### Step 1: Add webhook signature verification
**File:** `server/discourse-routes.ts`

```typescript
import crypto from 'crypto';
import { getRequiredEnv } from './config/env-validation';

/**
 * Verify Discourse webhook signature
 */
function verifyWebhookSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(payload);
  const expectedSignature = `sha256=${hmac.digest('hex')}`;

  try {
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  } catch {
    return false;
  }
}

/**
 * Middleware to verify webhook authentication
 */
function verifyWebhook(req: Request, res: Response, next: NextFunction) {
  const signature = req.headers['x-discourse-event-signature'] as string;

  if (!signature) {
    return res.status(401).json({ error: 'Missing webhook signature' });
  }

  const payload = JSON.stringify(req.body);
  const secret = getRequiredEnv('DISCOURSE_WEBHOOK_SECRET');

  if (!verifyWebhookSignature(payload, signature, secret)) {
    return res.status(401).json({ error: 'Invalid webhook signature' });
  }

  next();
}

// Apply to webhook endpoint
app.post('/discourse/webhook', verifyWebhook, async (req, res) => {
  // Now authenticated!
  const event = req.body;
  // Process webhook...
});
```

#### Step 2: Add environment variable
**File:** `.env.example`

```bash
# Add to existing file
DISCOURSE_WEBHOOK_SECRET=<32+ character secret>
```

**File:** `server/config/env-validation.ts`

```typescript
// Add to required variables
const requiredVars = [
  'SESSION_SECRET',
  'CSRF_SECRET',
  'DISCOURSE_SSO_SECRET',
  'DISCOURSE_WEBHOOK_SECRET', // Add this
];
```

#### Step 3: Configure in Discourse
1. Go to Discourse Admin → API → Webhooks
2. Create/edit webhook
3. Set "Secret" to match `DISCOURSE_WEBHOOK_SECRET`
4. Discourse will now send `X-Discourse-Event-Signature` header

### Testing
```bash
# Test with valid signature
curl -X POST http://localhost:5000/discourse/webhook \
  -H "Content-Type: application/json" \
  -H "X-Discourse-Event-Signature: sha256=<valid_hmac>" \
  -d '{"event":"user_created"}'

# Test with invalid signature (should return 401)
curl -X POST http://localhost:5000/discourse/webhook \
  -H "Content-Type: application/json" \
  -H "X-Discourse-Event-Signature: sha256=invalid" \
  -d '{"event":"user_created"}'

# Test without signature (should return 401)
curl -X POST http://localhost:5000/discourse/webhook \
  -H "Content-Type: application/json" \
  -d '{"event":"user_created"}'
```

---

## Issue #3: Security Event Logging

### Priority: 🟢 Low
**Effort:** 2-3 hours
**Impact:** Medium (important for security monitoring and compliance)

### Current State
Minimal security logging - only error logs, no audit trail.

### Implementation Plan

#### Step 1: Create security logger
**New File:** `server/utils/security-logger.ts`

```typescript
import { Request } from 'express';

export enum SecurityEventType {
  // Authentication
  LOGIN_SUCCESS = 'auth.login.success',
  LOGIN_FAILED = 'auth.login.failed',
  LOGOUT = 'auth.logout',
  REGISTER = 'auth.register',

  // Authorization
  ACCESS_DENIED = 'authz.access_denied',
  PRIVILEGE_ESCALATION_ATTEMPT = 'authz.privilege_escalation',

  // Account Security
  ACCOUNT_LOCKED = 'account.locked',
  ACCOUNT_UNLOCKED = 'account.unlocked',
  PASSWORD_CHANGED = 'account.password_changed',

  // Rate Limiting
  RATE_LIMIT_EXCEEDED = 'security.rate_limit_exceeded',

  // CSRF
  CSRF_VIOLATION = 'security.csrf_violation',

  // Session
  SESSION_CREATED = 'session.created',
  SESSION_DESTROYED = 'session.destroyed',
  CONCURRENT_SESSION_DETECTED = 'session.concurrent_detected',
}

export interface SecurityEvent {
  type: SecurityEventType;
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
 * Log security event
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
    metadata: options.metadata,
  };

  // For now, log to console (structured)
  // In production, send to logging service (e.g., Winston, Sentry, CloudWatch)
  console.log('[SECURITY]', JSON.stringify(event));

  // TODO: Send to monitoring service
  // - Sentry for error tracking
  // - CloudWatch/Datadog for metrics
  // - ELK stack for log aggregation
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
```

#### Step 2: Add logging to authentication
**File:** `server/auth.ts`

```typescript
import { logSecurityEvent, SecurityEventType, getUserInfo } from './utils/security-logger';

// In passport strategy (line ~46)
const isValid = await bcrypt.compare(password, user.passwordHash);

if (!isValid) {
  // Add logging
  logSecurityEvent(SecurityEventType.LOGIN_FAILED, {
    path: '/api/auth/login',
    method: 'POST'
  } as any, {
    email,
    success: false,
    message: 'Invalid password',
  });

  await recordFailedLogin(email);
  // ... rest of code
}

// On successful login (line ~68)
logSecurityEvent(SecurityEventType.LOGIN_SUCCESS, {
  path: '/api/auth/login',
  method: 'POST'
} as any, {
  userId: user.id,
  username: user.username,
  email: user.email,
  success: true,
});
```

#### Step 3: Add logging to routes
**File:** `server/routes.ts`

```typescript
import { logSecurityEvent, SecurityEventType, getUserInfo } from './utils/security-logger';

// Logout endpoint (line ~210)
app.post("/api/auth/logout", (req, res) => {
  const userInfo = getUserInfo(req);

  req.logout((err) => {
    if (err) {
      return res.status(500).json({ error: 'Logout failed' });
    }

    logSecurityEvent(SecurityEventType.LOGOUT, req, {
      ...userInfo,
      success: true,
    });

    res.json({ success: true });
  });
});

// Register endpoint (add after successful registration, line ~175)
logSecurityEvent(SecurityEventType.REGISTER, req, {
  userId: newUser.id,
  username: newUser.username,
  email: newUser.email,
  success: true,
});
```

#### Step 4: Add logging to CSRF middleware
**File:** `server/middleware/security.ts`

```typescript
import { logSecurityEvent, SecurityEventType } from '../utils/security-logger';

// In csrfProtection function (line ~159)
if (!token || !sessionToken) {
  logSecurityEvent(SecurityEventType.CSRF_VIOLATION, req, {
    success: false,
    message: 'CSRF token missing',
    metadata: { hasToken: !!token, hasSessionToken: !!sessionToken },
  });

  res.status(403).json({
    error: 'CSRF token missing',
    message: 'CSRF token is required for this request'
  });
  return;
}

// After invalid token check (line ~175)
if (!isValid) {
  logSecurityEvent(SecurityEventType.CSRF_VIOLATION, req, {
    success: false,
    message: 'Invalid CSRF token',
  });

  res.status(403).json({ error: 'Invalid CSRF token' });
  return;
}
```

#### Step 5: Add logging to rate limiter
**File:** `server/middleware/redis-rate-limiter.ts`

```typescript
import { logSecurityEvent, SecurityEventType } from '../utils/security-logger';

// In createRateLimiter function (line ~168)
if (!allowed) {
  logSecurityEvent(SecurityEventType.RATE_LIMIT_EXCEEDED, req, {
    success: false,
    message: `Rate limit exceeded: ${message}`,
    metadata: {
      limit: info.total,
      remaining: info.remaining,
      reset: info.reset,
    },
  });

  res.status(429).json({
    error: message,
    retryAfter: Math.ceil((info.reset - Date.now()) / 1000),
  });
  return;
}
```

#### Step 6: Add logging to account lockout
**File:** `server/middleware/redis-account-lockout.ts`

```typescript
import { logSecurityEvent, SecurityEventType } from '../utils/security-logger';

// In checkAccountLockout function (line ~330)
if (lockStatus.locked) {
  logSecurityEvent(SecurityEventType.ACCOUNT_LOCKED, req, {
    email,
    success: false,
    message: 'Account locked due to failed login attempts',
    metadata: {
      attempts: lockStatus.attempts,
      remainingTime: lockStatus.remainingTime,
    },
  });

  // ... rest of response
}
```

#### Step 7: Add authorization failure logging
**File:** `server/routes.ts`

```typescript
// In requireAdmin middleware (after existing withAdmin, add logging)
export function withAdminLogging<T>(
  handler: (req: AuthenticatedRequest, res: Response) => Promise<T>
) {
  return withAdmin(async (req, res) => {
    try {
      return await handler(req, res);
    } catch (error) {
      logSecurityEvent(SecurityEventType.ACCESS_DENIED, req, {
        ...getUserInfo(req),
        success: false,
        message: 'Admin access required',
      });
      throw error;
    }
  });
}
```

### Testing
```bash
# 1. Check logs for successful login
tail -f server.log | grep "LOGIN_SUCCESS"

# 2. Trigger failed login
curl -X POST http://localhost:5000/api/auth/login \
  -d '{"email":"test@example.com","password":"wrong"}'
# Should see LOGIN_FAILED event

# 3. Trigger CSRF violation
curl -X POST http://localhost:5000/api/products \
  -d '{"name":"test"}'
# Should see CSRF_VIOLATION event

# 4. Trigger rate limit
for i in {1..15}; do
  curl http://localhost:5000/api/products
done
# Should see RATE_LIMIT_EXCEEDED event

# 5. Check all security events
cat server.log | grep "\[SECURITY\]" | jq
```

### Production Integration

For production, integrate with a logging service:

```typescript
// server/utils/security-logger.ts

import winston from 'winston';

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.File({ filename: 'security.log' }),
    // Add CloudWatch, Datadog, or Sentry transport
  ],
});

export function logSecurityEvent(...) {
  logger.info('security_event', event);

  // Also send critical events to Sentry
  if (!event.success && criticalEvents.includes(event.type)) {
    Sentry.captureMessage(`Security event: ${event.type}`, {
      level: 'warning',
      extra: event,
    });
  }
}
```

---

## Issue #4: Password Reset (Optional)

### Priority: 🟢 Low
**Effort:** 4-6 hours
**Impact:** High (user convenience)

### Implementation Overview

This is a larger feature requiring:
1. Email service integration (SendGrid, AWS SES, etc.)
2. Reset token generation and storage
3. Email templates
4. Frontend forms

**Recommendation:** Create a separate epic/story for this feature rather than including it in a security patch.

### High-Level Steps
1. Add password reset token to schema
2. Create `/api/auth/forgot-password` endpoint
3. Create `/api/auth/reset-password/:token` endpoint
4. Integrate email service
5. Create email templates
6. Add rate limiting (5 requests/hour per email)
7. Create frontend forms

### Reference Implementation
See: [OWASP Password Reset Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html)

---

## Issue #5: Stricter Environment Validation (Optional)

### Priority: 🟢 Low
**Effort:** 15 minutes
**Impact:** Low (prevents dev mistakes)

### Current State
Weak secrets allowed in development mode with warnings.

### Implementation Plan

**File:** `server/config/env-validation.ts`

```typescript
// Change this (line ~113):
if (process.env.NODE_ENV !== 'production') {
  console.warn(`⚠️  ${key}: ${result.warning}`);
  continue; // Allow weak secrets in dev
}

// To this:
console.error(`❌ ${key}: ${result.warning}`);
if (process.env.NODE_ENV === 'production') {
  throw new Error(`Environment validation failed: ${key} ${result.warning}`);
}
// Still throw in development to enforce good practices
throw new Error(`${key}: ${result.warning}`);
```

**Note:** This will require developers to use strong secrets even in development. Document this in README.

---

## Implementation Order

### Quick Wins (Session 1: ~2 hours)
1. ✅ Redis Session Store (1 hour)
2. ✅ Webhook Authentication (30 minutes)
3. ✅ Basic Security Logging scaffolding (30 minutes)

### Extended Work (Session 2: ~2 hours)
4. ✅ Complete Security Logging integration (1.5 hours)
5. ✅ Environment Validation (15 minutes)
6. ✅ Testing and verification (30 minutes)

### Future Epic (Separate PR)
7. ⏭️ Password Reset Feature (4-6 hours)

---

## Testing Checklist

After implementation, verify:

- [ ] Sessions persist across server restarts
- [ ] Sessions work with multiple server instances
- [ ] Webhook requests without signature are rejected (401)
- [ ] Webhook requests with invalid signature are rejected (401)
- [ ] Webhook requests with valid signature succeed (200)
- [ ] Login success events are logged
- [ ] Login failure events are logged
- [ ] CSRF violations are logged
- [ ] Rate limit violations are logged
- [ ] Account lockout events are logged
- [ ] Logout events are logged
- [ ] Registration events are logged
- [ ] All logged events include required fields
- [ ] No sensitive data (passwords, tokens) in logs

---

## Files to Create/Modify

### New Files
- [ ] `server/config/session-store.ts` (~40 lines)
- [ ] `server/utils/security-logger.ts` (~150 lines)

### Files to Modify
- [ ] `server/index.ts` (session configuration)
- [ ] `server/discourse-routes.ts` (webhook auth)
- [ ] `server/config/env-validation.ts` (webhook secret)
- [ ] `server/auth.ts` (login/logout logging)
- [ ] `server/routes.ts` (register/logout logging)
- [ ] `server/middleware/security.ts` (CSRF logging)
- [ ] `server/middleware/redis-rate-limiter.ts` (rate limit logging)
- [ ] `server/middleware/redis-account-lockout.ts` (lockout logging)
- [ ] `.env.example` (webhook secret)

### Dependencies to Add
- [ ] `connect-redis` (for session store)
- [ ] Optional: `winston` (for production logging)
- [ ] Optional: `@sentry/node` (for error tracking)

---

## Rollout Strategy

### Development
1. Test locally with Redis
2. Test locally without Redis (verify fallback)
3. Verify all security events are logged
4. Review logs for sensitive data leaks

### Staging
1. Deploy to staging with Redis
2. Run load tests
3. Verify session persistence across deployments
4. Monitor security logs

### Production
1. Deploy Redis first (no downtime)
2. Deploy application with new features
3. Monitor error rates
4. Monitor security event volume
5. Set up alerts for critical events

---

## Success Metrics

After implementation, track:
- **Session Store:** 0 session loss complaints, sessions persist across deploys
- **Webhook Auth:** 0 unauthorized webhook submissions
- **Security Logging:**
  - All login attempts logged
  - All security violations logged
  - Security events available for audit
  - Average 5-10 security events per user per day

---

## Documentation Updates

After implementation, update:
- [ ] README.md - Add Redis requirement for sessions
- [ ] SECURITY_ENHANCEMENTS.md - Document new features
- [ ] .env.example - Add DISCOURSE_WEBHOOK_SECRET
- [ ] DEPLOYMENT.md - Add session store setup steps

---

## Estimated Timeline

**Phase 2A (Quick Wins):**
- Setup: 15 minutes
- Implementation: 2 hours
- Testing: 30 minutes
- Documentation: 15 minutes
- **Total: 3 hours**

**Phase 2B (Extended):**
- Implementation: 2 hours
- Testing: 30 minutes
- Documentation: 30 minutes
- **Total: 3 hours**

**Grand Total: 6 hours** (excluding password reset)

---

## Questions/Decisions

Before starting implementation:

1. **Email Service:** Which email provider for password reset? (SendGrid, AWS SES, Mailgun)
2. **Logging Service:** Which service for production logs? (CloudWatch, Datadog, ELK, Sentry)
3. **Session TTL:** Keep 24 hours or adjust?
4. **Log Retention:** How long to keep security logs? (30 days, 90 days, 1 year)
5. **Alerting:** Which events should trigger immediate alerts?

---

## Related Documentation

- SECURITY_ENHANCEMENTS.md - Previous security work
- SECURITY_GUIDELINES.md - Coding standards
- SECURITY_AUDIT_REPORT.md - Original audit findings

---

**Created:** 2025-11-11
**Status:** Ready for implementation
**Assignee:** TBD
**Target PR:** `security/phase-2-enhancements`
