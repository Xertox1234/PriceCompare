# TODO 224: Swallowed Errors in Catch Blocks

**Priority**: P1 - HIGH
**File(s)**: Multiple files across `server/`
**Estimated Time**: 1 hour
**Status**: Not Started
**Created Date**: 2026-01-14
**Source**: Security Audit (2026-01-14)

## Problem Statement

Several catch blocks don't properly log or propagate errors, causing silent failures that are extremely difficult to debug:

1. **Silent failures**: Operations fail without any indication
2. **No debugging information**: When issues occur, no logs to investigate
3. **Inconsistent state**: Partial operations may succeed without notification
4. **Missed alerts**: Sentry doesn't capture swallowed errors

**Operational Impact**: Production issues go undetected, debugging is nearly impossible, user complaints without actionable data.

## Root Cause

Empty catch blocks or catch blocks that only set a variable without logging, often from copy-paste or "quick fixes" during development.

## Solution Approach

1. Audit all catch blocks in the codebase
2. Add proper logging to all catch blocks
3. Report errors to Sentry where appropriate
4. Re-throw or handle errors appropriately

## Implementation Steps

### Step 1: Audit Catch Blocks

- [ ] Search for empty or minimal catch blocks
- [ ] Document each instance and its purpose
- [ ] Categorize: needs logging, needs propagation, intentionally silent

### Step 2: Fix Cache/Non-Critical Operations

- [ ] Add logging for debugging
- [ ] Add Sentry reporting for patterns
- [ ] Allow graceful degradation but with visibility

### Step 3: Fix Critical Operations

- [ ] Add logging AND propagation
- [ ] Ensure user gets appropriate error response
- [ ] Add Sentry reporting

### Step 4: Create Logging Standards

- [ ] Document error handling patterns
- [ ] Add ESLint rule for empty catch blocks
- [ ] Create helper functions for common patterns

## Technical Details

**Current Implementation (SWALLOWED ERRORS):**
```typescript
// ❌ Empty catch - error completely lost
try {
  await redisClient.set(key, value);
} catch (error) {
  // Error swallowed - no logging, no fallback
}

// ❌ Catch with only console.log in dev
try {
  await sendEmail(user.email, subject, body);
} catch (e) {
  if (process.env.NODE_ENV === 'development') {
    console.log(e); // Lost in production!
  }
}

// ❌ Catch that returns default without logging
async function getUser(id: number) {
  try {
    return await storage.getUserById(id);
  } catch {
    return null; // Why did it fail? Unknown!
  }
}
```

**Fixed Implementation:**
```typescript
import { logger } from './utils/logger';
import * as Sentry from '@sentry/node';

// ✅ Cache operation - log and continue (graceful degradation)
try {
  await redisClient.set(key, value, { EX: ttl });
} catch (error) {
  // Log for debugging
  logger.error({ 
    error, 
    key, 
    operation: 'redis_set' 
  }, 'Redis SET failed, continuing without cache');
  
  // Report to Sentry for monitoring patterns
  Sentry.captureException(error, {
    tags: { operation: 'redis_set', severity: 'warning' },
    extra: { key, ttl },
  });
  
  // Continue without cache - graceful degradation
}

// ✅ Critical operation - log, report, and propagate
try {
  await sendEmail(user.email, subject, body);
} catch (error) {
  logger.error({
    error,
    userId: user.id,
    email: maskEmail(user.email),
    subject,
  }, 'Failed to send email');
  
  Sentry.captureException(error, {
    tags: { operation: 'send_email', severity: 'error' },
    user: { id: user.id },
  });
  
  // Re-throw so caller knows operation failed
  throw new EmailError('Failed to send email', { cause: error });
}

// ✅ Query with fallback - log and return default
async function getUser(id: number): Promise<User | null> {
  try {
    return await storage.getUserById(id);
  } catch (error) {
    logger.error({
      error,
      userId: id,
      operation: 'get_user',
    }, 'Failed to fetch user');
    
    Sentry.captureException(error, {
      tags: { operation: 'get_user' },
      extra: { userId: id },
    });
    
    return null; // Explicit fallback with logged reason
  }
}
```

**Error Handling Helper Functions:**
```typescript
// server/utils/error-helpers.ts

import { logger } from './logger';
import * as Sentry from '@sentry/node';

interface ErrorContext {
  operation: string;
  severity?: 'info' | 'warning' | 'error' | 'fatal';
  extra?: Record<string, unknown>;
  tags?: Record<string, string>;
}

/**
 * Log error and report to Sentry
 * Use for errors that should be tracked but may not stop execution
 */
export function captureError(error: unknown, context: ErrorContext): void {
  const { operation, severity = 'error', extra = {}, tags = {} } = context;
  
  logger.error({ error, ...extra, operation }, `${operation} failed`);
  
  Sentry.captureException(error, {
    tags: { operation, severity, ...tags },
    extra,
  });
}

/**
 * Wrap async function with error handling
 * Logs, reports, and re-throws errors
 */
export function withErrorHandling<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  context: Omit<ErrorContext, 'extra'>
): T {
  return (async (...args: Parameters<T>) => {
    try {
      return await fn(...args);
    } catch (error) {
      captureError(error, { ...context, extra: { args } });
      throw error;
    }
  }) as T;
}

/**
 * Wrap async function with error handling and fallback
 * Logs, reports, and returns fallback value
 */
export function withFallback<T, F>(
  fn: () => Promise<T>,
  fallback: F,
  context: ErrorContext
): Promise<T | F> {
  return fn().catch((error) => {
    captureError(error, context);
    return fallback;
  });
}
```

**Usage Examples:**
```typescript
// Using helper for graceful degradation
const cachedValue = await withFallback(
  () => redisClient.get(key),
  null,
  { operation: 'redis_get', severity: 'warning', extra: { key } }
);

// Using wrapper for consistent error handling
const sendNotification = withErrorHandling(
  async (userId: number, message: string) => {
    await notificationService.send(userId, message);
  },
  { operation: 'send_notification' }
);
```

**ESLint Rule for Empty Catch:**
```javascript
// eslint.config.mjs
export default [
  {
    rules: {
      'no-empty': ['error', { allowEmptyCatch: false }],
      // Or use @typescript-eslint/no-empty-function
      '@typescript-eslint/no-empty-function': ['error', {
        allow: [] // Don't allow empty catch handlers
      }],
    },
  },
];
```

**Audit Command:**
```bash
# Find empty or minimal catch blocks
grep -rn "catch.*{" server/ --include="*.ts" -A 2 | grep -E "catch|^[[:space:]]*}$|^--$"

# Find catch blocks without console.error or logger
grep -rn "catch" server/ --include="*.ts" -A 5 | grep -v "console.error\|logger\|Sentry" | grep -B 3 "}"
```

## Checklist

- [ ] All catch blocks audited
- [ ] Empty catch blocks fixed with logging
- [ ] Critical operations log and propagate errors
- [ ] Non-critical operations log and degrade gracefully
- [ ] Sentry integration for error patterns
- [ ] ESLint rule added for empty catch

## Success Criteria

- [ ] No empty catch blocks in production code
- [ ] All errors logged with context
- [ ] Critical errors reported to Sentry
- [ ] Error patterns visible in monitoring
- [ ] All tests pass

## Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Log volume increase | Medium | Low | Use appropriate log levels |
| Performance impact | Low | Low | Async logging, batched Sentry |
| Sensitive data in logs | Medium | High | Use data masking helpers |

---

## ✅ PRE-CLOSE VERIFICATION CHECKLIST (MANDATORY)

**Before marking this TODO as complete, verify ALL of the following:**

### Code Verification
- [ ] **Grep verification**: Audit catch blocks
  ```bash
  # Find remaining empty catch blocks (should be none or justified)
  grep -rn "catch.*{" server/ --include="*.ts" -A 1 | grep -E "catch.*\{$" -A 1 | grep "^[[:space:]]*}$"
  # Should return minimal/no results
  
  # Verify logging exists in catch blocks
  grep -rn "catch" server/ --include="*.ts" -A 5 | grep -E "logger|console.error|Sentry" | wc -l
  # Should be similar to number of catch blocks
  ```

- [ ] **File inspection**: Review error handling patterns
  ```bash
  # Sample catch blocks to verify logging
  grep -B 2 -A 10 "catch" server/services/scraper-service.ts | head -40
  ```

### Testing
- [ ] **Run affected tests**: Execute error handling tests
  ```bash
  npm test
  ```

- [ ] **Error logging test**: Trigger an error and verify logging
  ```bash
  # Check application logs for error entries
  grep -i "error\|failed" logs/app.log | tail -10
  ```

### Build & Type Safety
- [ ] **TypeScript compilation**: Ensure no type errors
  ```bash
  npm run check
  ```

- [ ] **ESLint check**: Verify no empty catch blocks
  ```bash
  npm run lint
  ```

---

## ✅ RESOLUTION (YYYY-MM-DD)

**Decision**: [To be completed]

### Summary

[To be completed upon resolution]

### Changes Made

[To be completed upon resolution]

### Verification Results

[To be completed upon resolution]

---

**Created by**: Claude Code (Security Audit)
**Completion Date**: TBD
**Actual Time**: TBD
