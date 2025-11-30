# Middleware API Response Patterns

**Status:** Mandatory for all middleware error responses
**Last Updated:** 2025-11-28
**Enforcement:** Pre-commit hooks + Code review

## Overview

All middleware error responses MUST use standardized response helpers from `server/utils/api-response.ts` to ensure consistent error handling across routes and middleware layers.

## Mandatory Pattern

### ✅ CORRECT - Use sendError() Helper

```typescript
import { sendError } from './utils/api-response';

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (!req.user) {
    sendError(res, 'Authentication required', 401);
    return;
  }
  next();
}
```

### ❌ WRONG - Manual JSON Response

```typescript
// DON'T DO THIS
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }
  next();
}
```

## Response Format

All middleware error responses follow this standardized format:

```typescript
{
  success: false,
  error: "Human-readable error message",
  details?: "Additional context (optional)"
}
```

## Common Middleware Patterns

### 1. Authentication Middleware

**File:** `server/auth.ts`

```typescript
import { sendError } from './utils/api-response';

// ✅ Require authentication
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (!req.user) {
    sendError(res, 'Authentication required', 401);
    return;
  }
  next();
}

// ✅ Require admin role
export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  if (!req.user) {
    sendError(res, 'Authentication required', 401);
    return;
  }

  if (req.user.role !== 'admin') {
    sendError(res, 'Admin access required', 403);
    return;
  }

  next();
}
```

### 2. Validation Middleware

**File:** `server/validation.ts`

```typescript
import { sendError } from './utils/api-response';

export function validateRequest(schema: z.ZodSchema) {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      const result = schema.safeParse(req.body);

      if (!result.success) {
        const errors = result.error.issues.map(err => ({
          path: err.path.join('.'),
          message: err.message,
        }));

        // ✅ Use sendError with details
        sendError(res, 'Validation failed', 400, JSON.stringify(errors));
        return;
      }

      next();
    } catch (error) {
      // ✅ Use sendError for unexpected errors
      sendError(
        res,
        'Validation error',
        500,
        error instanceof Error ? error.message : 'Unknown error'
      );
    }
  };
}
```

### 3. Rate Limiting Middleware

**File:** `server/middleware/redis-rate-limiter.ts`

```typescript
// ✅ Already compliant - rate limit response
if (info.remaining <= 0) {
  res.status(429).json({
    success: false,
    error: 'Too many requests, please try again later',
    retryAfter: Math.ceil((info.reset - Date.now()) / 1000),
  });
  return;
}
```

### 4. CSRF Protection Middleware

**File:** `server/middleware/security.ts`

```typescript
// ✅ Already compliant - CSRF error response
if (!token || !sessionToken) {
  res.status(403).json({
    success: false,
    error: 'CSRF token missing',
    message: 'CSRF token is required for this request'
  });
  return;
}
```

### 5. Account Lockout Middleware

**File:** `server/middleware/account-lockout.ts`

```typescript
// ✅ Already compliant - lockout response
if (lockStatus.locked) {
  res.setHeader('Retry-After', retryAfterSeconds);

  return res.status(429).json({
    success: false,
    error: 'Account temporarily locked due to too many failed login attempts',
    locked: true,
    remainingTime: lockStatus.remainingTime,
    retryAfter: retryAfterSeconds
  });
}
```

### 6. Request Size Limits Middleware

**File:** `server/middleware/request-limits.ts`

```typescript
// ✅ Already compliant - payload size error
if (sizeInBytes > limitInBytes) {
  return res.status(413).json({
    success: false,
    error: 'Request payload too large',
    maxSize: limit,
    receivedSize: formatBytes(sizeInBytes)
  });
}
```

## Error Handler Patterns

### Central Error Handler

**File:** `server/middleware/error-handler.ts`

```typescript
// ✅ Already compliant - standardized error responses
export function errorHandler(err: Error, req: Request, res: Response, next: NextFunction) {
  // Validation errors
  if (err.name === 'ZodError') {
    return res.status(400).json({
      success: false,
      error: 'Validation failed',
      code: 'VALIDATION_ERROR',
      details: zodError.errors,
    });
  }

  // Database errors
  if (isDatabaseError(err)) {
    return res.status(500).json({
      success: false,
      error: 'Database error occurred',
      code: 'DATABASE_ERROR',
      ...(isDev && { details: err.message }),
    });
  }

  // Unknown errors
  return res.status(statusCode).json({
    success: false,
    error: isDev ? err.message : 'Internal server error',
    code: 'INTERNAL_ERROR',
    ...(isDev && { stack: err.stack }),
  });
}
```

### 404 Not Found Handler

```typescript
// ✅ Already compliant
export function notFoundHandler(req: Request, res: Response, next: NextFunction) {
  res.status(404).json({
    success: false,
    error: 'Route not found',
    code: 'NOT_FOUND',
    path: req.originalUrl,
    method: req.method,
  });
}
```

## SSO Integration Patterns

**File:** `server/discourse-sso.ts`

```typescript
import { sendError } from './utils/api-response';

export async function handleDiscourseSSO(req: Request, res: Response) {
  try {
    const { sso, sig } = req.query;

    // ✅ Missing parameters
    if (!sso || !sig) {
      sendError(res, 'Missing SSO parameters', 400);
      return;
    }

    // ✅ Invalid signature
    if (!verifySSO(sso as string, sig as string)) {
      sendError(res, 'Invalid SSO signature', 403);
      return;
    }

    // ✅ Missing required SSO parameters
    if (!nonce || !returnUrl) {
      sendError(res, 'Missing required SSO parameters', 400);
      return;
    }

    // Success - redirect
    res.redirect(redirectUrl);

  } catch (error) {
    // ✅ Unexpected error
    sendError(res, 'SSO authentication failed', 500);
  }
}
```

## Migration Checklist

When creating or updating middleware:

- [ ] Import `sendError` from `./utils/api-response`
- [ ] Replace all `res.status().json({ error: ... })` with `sendError(res, message, status)`
- [ ] Ensure all error responses include `success: false` field
- [ ] Add optional `details` parameter for additional context
- [ ] Test error responses match expected format
- [ ] Verify TypeScript types are correct
- [ ] Run ESLint to catch issues

## Anti-Patterns to Avoid

### ❌ Manual Error Response Construction

```typescript
// DON'T DO THIS
res.status(400).json({ error: 'Invalid input' });

// DO THIS INSTEAD
sendError(res, 'Invalid input', 400);
```

### ❌ Inconsistent Error Format

```typescript
// DON'T DO THIS - missing success field
res.status(500).json({
  message: 'Error occurred',
  code: 'ERROR'
});

// DO THIS INSTEAD
sendError(res, 'Error occurred', 500);
// Results in: { success: false, error: 'Error occurred' }
```

### ❌ Manual Return Statement Handling

```typescript
// DON'T DO THIS
if (!req.user) {
  return res.status(401).json({ error: 'Unauthorized' });
}

// DO THIS INSTEAD
if (!req.user) {
  sendError(res, 'Authentication required', 401);
  return;
}
```

## Testing Middleware Responses

```typescript
import { describe, it, expect } from 'vitest';
import request from 'supertest';

describe('Auth Middleware', () => {
  it('should return standardized error for unauthenticated requests', async () => {
    const response = await request(app)
      .get('/api/protected-route')
      .expect(401);

    // ✅ Verify standardized format
    expect(response.body).toEqual({
      success: false,
      error: 'Authentication required'
    });
  });
});
```

## Code Review Checklist

When reviewing middleware code:

- [ ] All error responses use `sendError()` helper
- [ ] No manual `res.json()` calls for errors
- [ ] All responses include `success: false` field
- [ ] HTTP status codes are appropriate (401, 403, 400, 500, etc.)
- [ ] Error messages are user-friendly and descriptive
- [ ] No sensitive information leaked in error messages
- [ ] TypeScript types are correct
- [ ] Tests verify error response format

## Related Documentation

- `server/utils/api-response.ts` - Response helper implementations
- `docs/API_PATTERNS.md` - General API design patterns
- `docs/SECURITY_PATTERNS.md` - Security best practices
- `docs/API_STANDARDIZATION_SUMMARY.md` - Migration completion summary

## Enforcement

**Pre-commit hooks** check for:
- Manual `res.json()` calls in middleware
- Missing `success` field in error responses
- Incorrect HTTP status codes

**Code review** verifies:
- Consistent use of `sendError()` helper
- Proper error message formatting
- Complete migration to standardized format

---

**Last Migration:** November 28, 2025
**Coverage:** 100% (All routes and middleware)
**Status:** ✅ Complete
