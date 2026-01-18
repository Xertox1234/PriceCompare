---
Pattern: Error Handling Patterns & Anti-Patterns
Version: 2.3
Last Updated: 2026-01-17
Maintainer: Claude Code / Development Team
Status: Active
Migrated From:
  - docs/ERROR_HANDLING_PATTERNS.md (v1.0)
  - docs/PHASE0_WATCHLIST_PATTERNS.md (PostgreSQL error code classification)
Related Patterns: [API_PATTERNS.md, SECURITY_PATTERNS.md, TYPESCRIPT_PATTERNS.md, SERVICE_INTEGRATION_PATTERNS.md, DATABASE_PATTERNS.md]
Changelog:
  - 2.3 (2026-01-17): Added Error Code Semantic Distinction pattern - RATE_LIMIT_EXCEEDED vs LIMIT_EXCEEDED (from error handler code review)
  - 2.2 (2026-01-07): Added Fire-and-Forget Pattern and Graceful Degradation patterns (from TODO_018 email notification implementation)
  - 2.1 (2025-12-09): Added "unique", "constraint", "duplicate" keywords to 409 status code inference
  - 2.0 (2025-11-29): Initial consolidated error handling patterns
---

# Error Handling Patterns & Anti-Patterns

This document codifies error handling patterns to ensure consistent, secure, and user-friendly error management in the PriceCompare codebase.

## Table of Contents
- [Critical Anti-Patterns](#critical-anti-patterns)
- [Error Response Patterns](#error-response-patterns)
- [PostgreSQL Error Code Classification](#postgresql-error-code-classification)
- [Validation Error Handling](#validation-error-handling)
- [Database Error Handling](#database-error-handling)
- [API Client Error Handling](#api-client-error-handling)
- [Async Error Patterns](#async-error-patterns)
- [Logging Patterns](#logging-patterns)
- [User-Facing Error Messages](#user-facing-error-messages)
- [Error Recovery Strategies](#error-recovery-strategies)
- [Error Handling Checklist](#error-handling-checklist)

---

## Critical Anti-Patterns

These patterns will trigger warnings or fail pre-commit hooks.

### 1. Exposing Internal Error Details (PRE-COMMIT WARNING)

#### ❌ NEVER DO THIS - Raw Error Exposure
```typescript
// THIS WILL TRIGGER PRE-COMMIT WARNING!
try {
  await db.insert(users).values(userData);
} catch (error) {
  // Exposes database schema, table names, constraints
  res.status(500).json({ error: error.message });
}

// Also bad - exposing stack traces
catch (error) {
  res.status(500).json({
    error: error.message,
    stack: error.stack, // NEVER in production!
    sql: error.sql, // Exposes queries!
  });
}
```

**Why this is dangerous:**
- Database errors reveal table names, column names, constraints
- Stack traces expose file paths and internal code structure
- Error messages may contain sensitive data or SQL queries
- Attackers use this information to craft targeted attacks

#### ✅ CORRECT - Use Standardized Error Response (MANDATORY)
```typescript
import { sendErrorFromException } from '../utils/api-response';

try {
  await db.insert(users).values(userData);
} catch (error) {
  // sendErrorFromException handles:
  // - Server-side logging
  // - Error sanitization (generic messages in production)
  // - Status code inference
  // - Sentry alerting for non-operational errors
  sendErrorFromException(res, error, 'UserCreation');
}
```

#### Detection Rule
```bash
# Find routes that expose raw error messages
# This will catch most violations
grep -r "error\.message" server/routes/ server/*-routes.ts | grep -v "sendErrorFromException" | grep -v "log\."

# Find direct error object responses
grep -r "res\..*json.*error" server/routes/ | grep -v "sendErrorFromException" | grep -v "sendError"
```

#### Pre-Commit Hook Check
The pre-commit hook automatically detects:
- `error.message` in response bodies
- Raw `error` objects passed to `res.json()`
- Missing standardized error response helpers in catch blocks

**To pass the hook**, ensure ALL error responses use `sendErrorFromException()` or `sendError()`.

#### Common Violations and Fixes

**Violation 1: Direct error.message**
```typescript
// ❌ WRONG
catch (error) {
  res.status(500).json({ error: error.message });
}

// ✅ FIXED
catch (error) {
  sendErrorFromException(res, error, 'OperationName');
}
```

**Violation 2: Validation errors without sanitization**
```typescript
// ❌ WRONG
catch (error) {
  if (error instanceof z.ZodError) {
    res.status(400).json({ error: error.errors }); // Exposes internal validation structure
  }
}

// ✅ FIXED
catch (error) {
  // sendErrorFromException handles Zod errors properly
  sendErrorFromException(res, error, 'ValidationError');
}
```

**Violation 3: Database errors**
```typescript
// ❌ WRONG
catch (error) {
  // Exposes: "duplicate key value violates unique constraint users_email_key"
  res.status(400).json({ error: error.message });
}

// ✅ FIXED
catch (error) {
  // Automatically infers 409 status for duplicate errors
  sendErrorFromException(res, error, 'CreateUser');
}
```

### 2. Silent Error Swallowing

#### ❌ NEVER DO THIS - Ignoring Errors
```typescript
// Silent failure - user has no idea what happened
try {
  await updateProduct(data);
} catch (error) {
  // Error swallowed silently!
}

// Also bad - empty catch
try {
  await riskyOperation();
} catch {} // Never do this!

// Bad - generic success despite failure
try {
  await sendEmail(user.email);
} catch (error) {
  return res.json({ success: true }); // Lying to client!
}
```

#### ✅ CORRECT - Always Handle Errors
```typescript
// Log and handle appropriately
try {
  await updateProduct(data);
} catch (error) {
  // sendErrorFromException handles logging automatically
  sendErrorFromException(res, error, 'ProductUpdate');
  return;
}

// Non-critical failures - degrade gracefully
try {
  await sendEmailNotification(user.email);
} catch (error) {
  // Log but don't fail the main operation
  log.warn('Email notification failed:', error);
  // Continue with main flow
}
```

---

## Error Response Patterns

### Standardized Error Response Structure

All API responses follow the standardized envelope format from `server/utils/api-response.ts`:

#### ✅ CORRECT - Use Standardized Response Helpers
```typescript
import { sendSuccess, sendError, sendErrorFromException } from '../utils/api-response';

// Success response
app.get('/api/products/:id', async (req, res) => {
  try {
    const product = await storage.getProductById(id);
    sendSuccess(res, product); // { success: true, data: product }
  } catch (error) {
    sendErrorFromException(res, error, 'GetProduct');
    // { success: false, error: "message", details?: "..." }
  }
});

// Explicit error with status code
app.post('/api/products', csrfProtection, withAuth(async (req, res) => {
  try {
    const data = insertProductSchema.parse(req.body);
    const product = await storage.createProduct(data);
    sendSuccess(res, product, 201); // 201 Created
  } catch (error) {
    sendErrorFromException(res, error, 'CreateProduct');
    // Automatically handles:
    // - Zod validation errors (400)
    // - Status code inference from error message
    // - Logging and Sentry alerting
    // - Environment-based details
  }
}));

// Known error conditions
if (!user) {
  sendError(res, 'User not found', 404);
  return;
}
```

### Error Status Code Inference

The `sendErrorFromException()` helper automatically infers HTTP status codes from error messages:

| Error Message Contains | HTTP Status | Use Case |
|------------------------|-------------|----------|
| "not found" | 404 | Resource not found |
| "unauthorized", "authentication required" | 401 | Authentication required |
| "forbidden", "admin access required" | 403 | Permission denied |
| "already exists", "conflict", "unique", "constraint", "duplicate" | 409 | Duplicate resource / constraint violation |
| "invalid", "must be", "is required" | 400 | Validation error |
| (default) | 500 | Internal server error |

```typescript
// Status code is automatically inferred from error message
throw new Error('Product not found');  // → 404
throw new Error('Email is required');  // → 400
throw new Error('User already exists'); // → 409
throw new Error('Unique constraint violation'); // → 409
throw new Error('Duplicate key value'); // → 409
```

### Error Code Semantic Distinction: RATE_LIMIT_EXCEEDED vs. LIMIT_EXCEEDED (NEW - 2026-01-17)

**Context:** Error codes serve as machine-readable identifiers for client-side error handling. Similar-sounding codes may have DISTINCT semantic meanings.

**Problem:** Conflating `RATE_LIMIT_EXCEEDED` and `LIMIT_EXCEEDED` creates ambiguity in client error handling and user messaging.

**Key Insight:** Error codes communicate the TYPE of limit exceeded, not just that a limit exists:
- **RATE_LIMIT_EXCEEDED**: Too many requests per time window (temporal limit)
- **LIMIT_EXCEEDED**: Reached a resource/quantity limit (capacity limit)

#### Error Code Semantic Table

| Error Code | Meaning | Example Scenarios | HTTP Status | Client Action |
|-----------|---------|------------------|-------------|---------------|
| `RATE_LIMIT_EXCEEDED` | Too many requests per time window | "5 login attempts in 1 minute", "100 API calls per hour" | 429 | Retry with exponential backoff, show countdown timer |
| `LIMIT_EXCEEDED` | Reached resource/quantity limit | "Maximum 10 watch lists", "Daily notification limit reached" | 400 or 409 | Don't retry, show upgrade prompt or "delete existing items" |

#### ✅ CORRECT - Use Distinct Error Codes

```typescript
// server/utils/error-handler.ts (error code inference)
function inferErrorCode(error: Error, statusCode: number): string {
  const lowerMessage = error.message.toLowerCase();

  // RATE_LIMIT_EXCEEDED - Temporal rate limiting
  if (lowerMessage.includes('rate limit')) {
    return 'RATE_LIMIT_EXCEEDED';
  }

  // LIMIT_EXCEEDED - Generic resource/quantity limit
  if (error.message.includes('limit')) {
    return 'LIMIT_EXCEEDED';
  }

  // Other error codes...
  return 'INTERNAL_SERVER_ERROR';
}
```

**Implementation Examples:**

```typescript
// Rate limiting (temporal)
if (requestCount > rateLimit) {
  throw new Error('Rate limit exceeded');
  // Inferred: RATE_LIMIT_EXCEEDED
  // Client shows: "Too many requests. Please wait 30 seconds."
}

// Resource limit (capacity)
if (watchLists.length >= MAX_WATCH_LISTS) {
  throw new Error('Maximum watch list limit reached');
  // Inferred: LIMIT_EXCEEDED
  // Client shows: "You've reached the 10 watch list limit. Delete one to create another."
}
```

#### Client-Side Handling Examples

```typescript
// client/src/lib/api-client.ts
async function handleApiError(error: ApiError) {
  switch (error.code) {
    case 'RATE_LIMIT_EXCEEDED':
      // Show countdown timer
      const retryAfter = error.details?.retryAfter || 60;
      showToast(`Too many requests. Please wait ${retryAfter} seconds.`, {
        duration: retryAfter * 1000,
        icon: '⏱️',
      });
      // Implement exponential backoff
      return { shouldRetry: true, retryAfter };

    case 'LIMIT_EXCEEDED':
      // Show actionable message
      if (error.message.includes('watch list')) {
        showToast('Maximum 10 watch lists. Delete one to create another.', {
          action: { label: 'Manage Lists', onClick: () => navigate('/watchlists') },
        });
      } else {
        showToast('Limit reached. Please upgrade or delete items.', {
          action: { label: 'Upgrade', onClick: () => navigate('/pricing') },
        });
      }
      // Don't retry
      return { shouldRetry: false };

    default:
      showToast('An error occurred. Please try again.');
      return { shouldRetry: false };
  }
}
```

#### Why These Are NOT Interchangeable

**RATE_LIMIT_EXCEEDED (429)**:
- **Meaning**: "You're doing this too fast"
- **Solution**: Wait and retry
- **User action**: Passive waiting
- **Example**: Login attempts, API calls, search requests

**LIMIT_EXCEEDED (400/409)**:
- **Meaning**: "You've hit a capacity/quota"
- **Solution**: Delete existing items or upgrade plan
- **User action**: Active management
- **Example**: Watch list limit, daily notification quota, storage quota

#### ❌ ANTI-PATTERN - Conflating Error Codes

```typescript
// WRONG - Using RATE_LIMIT_EXCEEDED for capacity limits
if (watchLists.length >= MAX_WATCH_LISTS) {
  throw new Error('Rate limit exceeded'); // ❌ Wrong semantic!
  // Inferred: RATE_LIMIT_EXCEEDED
  // Client shows countdown timer (incorrect UX!)
}

// WRONG - Using LIMIT_EXCEEDED for rate limiting
if (requestCount > rateLimit) {
  throw new Error('Limit exceeded'); // ❌ Missing "rate" keyword!
  // Inferred: LIMIT_EXCEEDED
  // Client shows "delete items" (incorrect UX!)
}
```

#### Error Message Keywords for Inference

**For RATE_LIMIT_EXCEEDED** (include "rate"):
- ✅ "Rate limit exceeded"
- ✅ "Too many requests per minute"
- ✅ "Rate limiting applied"

**For LIMIT_EXCEEDED** (generic "limit" without "rate"):
- ✅ "Maximum limit reached"
- ✅ "Watch list limit exceeded"
- ✅ "Daily notification limit reached"

#### Rationale

- **Clear semantics**: Error code explicitly communicates limit type
- **Client-side routing**: Different error codes trigger different UX
- **User expectations**: Users understand temporal vs. capacity limits differently
- **Retry logic**: Rate limits auto-resolve with time; capacity limits require action
- **Monitoring**: Distinguish rate limiting issues from capacity planning needs

#### Related Patterns

- **Error Status Code Inference (above)**: How error messages map to codes
- **Rate Limiting Patterns (04_SECURITY_PATTERNS.md)**: When to use 429 vs. 400
- **User-Facing Error Messages (below)**: How to communicate limits to users

**Real-World Review:**
- **File:** `server/utils/error-handler.ts` (error code inference logic)
- **Context:** Code review questioned RATE_LIMIT_EXCEEDED vs. LIMIT_EXCEEDED difference
- **Decision:** Keep both codes - they serve distinct purposes

*Source: Error handler code review session*
*Added: 2026-01-17*

---

### Custom Error Classes

The codebase includes minimal custom error classes for structured error handling:

#### ✅ Current Implementation (server/utils/errors.ts)
```typescript
// Base error class with metadata support
export class AppError extends Error {
  constructor(
    message: string,
    public statusCode = 500,
    public code?: string,
    public metadata?: Record<string, unknown>,
    public isOperational = true
  ) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }

  toJSON() {
    return {
      success: false,
      error: this.message,
      code: this.code,
      statusCode: this.statusCode,
      ...(process.env.NODE_ENV === 'development' && {
        stack: this.stack,
        metadata: this.metadata,
      }),
    };
  }
}

// Validation errors (used in aggregation services)
export class ValidationError extends AppError {
  constructor(message: string, metadata?: Record<string, unknown>) {
    super(message, 400, 'VALIDATION_ERROR', metadata);
  }
}
```

**Note**: Previous versions included many custom error classes (AuthenticationError, AuthorizationError, etc.) but these were rarely used. The consolidated approach uses message-based status code inference instead, which is simpler and sufficient for most use cases.

---

## PostgreSQL Error Code Classification

**CRITICAL**: Database constraint violations should return 400-level errors, not 500s. This section codifies patterns from Phase 0 watchlist bug fixes.

### PostgreSQL Error Codes Reference

| Code | Name | User Message | HTTP Status |
|------|------|--------------|-------------|
| `23505` | unique_violation | "This item already exists" | 400 or 409 |
| `23503` | foreign_key_violation | "Referenced item not found" | 400 |
| `23502` | not_null_violation | "Required field missing" | 400 |
| `23514` | check_violation | "Invalid value provided" | 400 |
| `40001` | serialization_failure | (Retry internally) | - |
| `40P01` | deadlock_detected | (Retry internally) | - |

### Implementation Pattern (Defensive Multi-Source Detection)

```typescript
catch (error: unknown) {
  // Check if this is a database error with PostgreSQL error code
  if (error instanceof Error && 'code' in error) {
    const dbError = error as { code?: string; constraint?: string };

    // Unique violation (23505)
    if (dbError.code === '23505') {
      // DEFENSIVE: Check multiple sources for constraint info
      // Different drivers may provide info differently
      const constraintName = (dbError.constraint || '').toLowerCase();
      const errorMsg = error.message.toLowerCase();

      // Check BOTH constraint name AND error message
      if (constraintName.includes('unique_user_product') ||
          errorMsg.includes('unique_user_product') ||
          constraintName.includes('product_watch')) {

        // Log with context for debugging
        logger.warn('Duplicate detected', {
          userId,
          productId,
          constraint: dbError.constraint,
          code: dbError.code
        });

        // Return user-friendly 400 error (not 500!)
        throw new Error('Product already added to this watch list');
      }
    }

    // Foreign key violation (23503)
    if (dbError.code === '23503') {
      logger.warn('Foreign key violation', { constraint: dbError.constraint });
      throw new Error('Referenced item not found');
    }
  }

  // Unknown error - use standard handler
  this.handleError(error, 'operation');
}
```

### Why Multi-Source Detection

```typescript
// Different database drivers provide constraint info differently:

// pg driver
{ code: '23505', constraint: 'unique_user_product_list' }

// Drizzle-wrapped errors
{ code: '23505', message: 'duplicate key...unique_user_product_list...' }

// Some drivers
{ code: '23505' }  // No constraint field!

// Solution: Check ALL sources
const constraintName = (dbError.constraint || '').toLowerCase();
const errorMsg = error.message.toLowerCase();
const matches = ['unique_user_product', 'product_watch'];

if (matches.some(m => constraintName.includes(m) || errorMsg.includes(m))) {
  // Handle constraint violation
}
```

### Helper Function for Constraint Detection

```typescript
// Helper function for constraint detection
function isConstraintViolation(
  error: unknown,
  constraintNames: string[]
): boolean {
  if (!(error instanceof Error) || !('code' in error)) {
    return false;
  }

  const dbError = error as { code?: string; constraint?: string };

  if (dbError.code !== '23505') {
    return false;
  }

  const constraintName = (dbError.constraint || '').toLowerCase();
  const errorMsg = error.message.toLowerCase();

  return constraintNames.some(name =>
    constraintName.includes(name) || errorMsg.includes(name)
  );
}

// Usage
if (isConstraintViolation(error, ['unique_user_product', 'product_watch'])) {
  throw new Error('Product already added');
}
```

### Anti-Pattern: Returning 500 for Constraint Violations

```typescript
// ❌ WRONG - Returns 500 for all database errors
catch (error) {
  console.error('Database error:', error);
  res.status(500).json({ error: 'Internal server error' });
}
// Result: User sees "Internal server error" when trying to add duplicate

// ✅ CORRECT - Classify error and return appropriate status
catch (error) {
  if (error instanceof Error && 'code' in error) {
    const dbError = error as { code?: string };
    if (dbError.code === '23505') {
      sendError(res, 'Product already added', 400);
      return;
    }
  }
  sendErrorFromException(res, error, 'Operation');
}
```

### Detection Rule for Code Review

```bash
# Find catch blocks without error classification
grep -A 5 "catch (error" server/storage*.ts | grep -v "code.*23505\|handleError"
```

---

## Validation Error Handling

### Zod Validation Errors

#### ✅ CORRECT - Detailed Validation Feedback
```typescript
// Route handler with validation
router.post('/api/products', async (req, res) => {
  try {
    const validatedData = productSchema.parse(req.body);
    const product = await storage.createProduct(validatedData);
    res.json(product);
  } catch (error) {
    if (error instanceof z.ZodError) {
      // Format Zod errors for client
      const formattedErrors = error.errors.reduce((acc, err) => {
        const path = err.path.join('.');
        acc[path] = err.message;
        return acc;
      }, {} as Record<string, string>);

      return res.status(400).json({
        error: 'Validation failed',
        code: 'VALIDATION_ERROR',
        fields: formattedErrors,
      });
    }

    // Handle other errors
    sendErrorFromException(res, error, 'CreateProduct');
  }
});

// Client-side handling
async function createProduct(data: ProductInput) {
  try {
    const response = await apiRequest('/api/products', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return response;
  } catch (error) {
    if (error.code === 'VALIDATION_ERROR' && error.fields) {
      // Show field-specific errors in form
      Object.entries(error.fields).forEach(([field, message]) => {
        showFieldError(field, message);
      });
    } else {
      // Show general error
      showToast(error.error || 'Failed to create product');
    }
    throw error;
  }
}
```

---

## Database Error Handling

### Transaction Error Handling

#### ✅ CORRECT - Rollback on Error
```typescript
async function createTopicWithPost(data: CreateTopicData) {
  let topic: Topic | null = null;

  try {
    topic = await db.transaction(async (tx) => {
      // Create topic
      const [newTopic] = await tx.insert(forumTopics)
        .values(data.topic)
        .returning();

      // Create first post
      await tx.insert(forumPosts)
        .values({
          topicId: newTopic.id,
          content: data.firstPost,
        });

      return newTopic;
    });

    // Transaction succeeded
    return topic;
  } catch (error) {
    // Transaction automatically rolled back
    log.error('Topic creation failed:', error);

    // Determine error type
    if (error instanceof Error) {
      if (error.message.includes('unique constraint')) {
        throw new ConflictError('A topic with this title already exists');
      }
      if (error.message.includes('foreign key')) {
        throw new ValidationError('Invalid category selected', {
          categoryId: 'Category does not exist',
        });
      }
    }

    // Generic database error
    throw new AppError('Failed to create topic', 500, 'DATABASE_ERROR');
  }
}
```

### Connection Error Handling

#### ✅ CORRECT - Graceful Degradation
```typescript
// Redis connection with fallback
class CacheService {
  private redis: Redis | null = null;

  constructor() {
    this.initRedis();
  }

  private async initRedis() {
    try {
      this.redis = new Redis(process.env.REDIS_URL);

      this.redis.on('error', (error) => {
        log.error('Redis error:', error);
        // Don't crash the app
      });

      this.redis.on('connect', () => {
        log.info('Redis connected');
      });
    } catch (error) {
      log.warn('Redis initialization failed, using fallback:', error);
      this.redis = null;
    }
  }

  async get(key: string): Promise<string | null> {
    if (!this.redis) {
      // Fallback to in-memory cache or skip caching
      return null;
    }

    try {
      return await this.redis.get(key);
    } catch (error) {
      log.error('Cache get failed:', error);
      // Don't fail the main operation
      return null;
    }
  }

  async set(key: string, value: string, ttl?: number): Promise<void> {
    if (!this.redis) {
      // Skip caching if Redis unavailable
      return;
    }

    try {
      if (ttl) {
        await this.redis.setex(key, ttl, value);
      } else {
        await this.redis.set(key, value);
      }
    } catch (error) {
      log.error('Cache set failed:', error);
      // Don't fail the main operation
    }
  }
}
```

---

## API Client Error Handling

### Fetch Error Handling

#### ✅ CORRECT - Comprehensive API Client
```typescript
// lib/api-client.ts
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string,
    public details?: any
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export async function apiRequest<T>(
  url: string,
  options: RequestInit = {}
): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000); // 30s timeout

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      credentials: 'include',
    });

    clearTimeout(timeout);

    // Handle non-JSON responses
    const contentType = response.headers.get('content-type');
    if (!contentType?.includes('application/json')) {
      throw new ApiError(
        'Invalid response format',
        response.status,
        'INVALID_RESPONSE'
      );
    }

    const data = await response.json();

    // Handle error responses
    if (!response.ok) {
      throw new ApiError(
        data.error || `HTTP ${response.status}`,
        response.status,
        data.code,
        data.details
      );
    }

    return data as T;
  } catch (error) {
    clearTimeout(timeout);

    // Handle network errors
    if (error instanceof TypeError && error.message === 'Failed to fetch') {
      throw new ApiError(
        'Network error. Please check your connection.',
        0,
        'NETWORK_ERROR'
      );
    }

    // Handle timeout
    if (error instanceof Error && error.name === 'AbortError') {
      throw new ApiError(
        'Request timeout. Please try again.',
        0,
        'TIMEOUT'
      );
    }

    // Re-throw ApiError
    if (error instanceof ApiError) {
      throw error;
    }

    // Unknown error
    throw new ApiError(
      'An unexpected error occurred',
      0,
      'UNKNOWN_ERROR'
    );
  }
}
```

### React Query Error Handling

#### ✅ CORRECT - Query Error Boundaries
```typescript
// hooks/useProduct.ts
export function useProduct(id: number) {
  return useQuery({
    queryKey: ['product', id],
    queryFn: () => apiRequest<Product>(`/api/products/${id}`),
    retry: (failureCount, error) => {
      // Don't retry on 4xx errors
      if (error instanceof ApiError && error.status >= 400 && error.status < 500) {
        return false;
      }
      // Retry up to 3 times for other errors
      return failureCount < 3;
    },
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });
}

// components/ProductView.tsx
export function ProductView({ id }: { id: number }) {
  const { data, error, isLoading, refetch } = useProduct(id);

  if (isLoading) {
    return <Spinner />;
  }

  if (error) {
    if (error instanceof ApiError) {
      if (error.status === 404) {
        return <NotFound message="Product not found" />;
      }
      if (error.status === 403) {
        return <AccessDenied />;
      }
    }

    return (
      <ErrorDisplay
        message={error.message || 'Failed to load product'}
        onRetry={refetch}
      />
    );
  }

  return <ProductDetails product={data} />;
}
```

---

## Async Error Patterns

### Promise Error Handling

#### ❌ WRONG - Unhandled Promise Rejection
```typescript
// Unhandled rejection - app might crash
async function processItems() {
  items.forEach(async (item) => {
    await processItem(item); // Unhandled if fails!
  });
}

// Also bad - fire and forget
someAsyncOperation(); // No error handling!
```

#### ✅ CORRECT - Always Handle Promises
```typescript
// Handle all promises
async function processItems() {
  // Sequential with error handling
  for (const item of items) {
    try {
      await processItem(item);
    } catch (error) {
      log.error(`Failed to process item ${item.id}:`, error);
      // Decide: continue or throw?
    }
  }

  // Or parallel with error handling
  const results = await Promise.allSettled(
    items.map(item => processItem(item))
  );

  results.forEach((result, index) => {
    if (result.status === 'rejected') {
      log.error(`Failed to process item ${items[index].id}:`, result.reason);
    }
  });
}

// Fire-and-forget with error handling
someAsyncOperation().catch(error => {
  log.error('Background operation failed:', error);
});
```

### Express Async Route Handlers

#### ✅ CORRECT - Async Handler Wrapper
```typescript
// utils/async-handler.ts
export function asyncHandler<T>(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<T>
) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

// Usage in routes
router.get('/api/products/:id', asyncHandler(async (req, res) => {
  const id = parseIntSafe(req.params.id, 'productId');
  const product = await storage.getProductById(id);

  if (!product) {
    throw new NotFoundError('Product', id);
  }

  res.json(product);
}));

// Global error handler catches all
app.use((error: Error, req: Request, res: Response, next: NextFunction) => {
  sendErrorFromException(res, error, req.path);
});
```

---

## Logging Patterns

### Structured Logging

#### ✅ CORRECT - Consistent Log Format
```typescript
// utils/logger.ts
import winston from 'winston';

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: {
    service: 'pricecompare',
    environment: process.env.NODE_ENV,
  },
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      ),
    }),
    // In production, also log to file/cloud
    ...(process.env.NODE_ENV === 'production'
      ? [new winston.transports.File({ filename: 'error.log', level: 'error' })]
      : []),
  ],
});

// Convenience methods
export const log = {
  error: (message: string, error?: unknown, meta?: any) => {
    logger.error(message, {
      error: error instanceof Error ? {
        message: error.message,
        stack: error.stack,
        name: error.name,
      } : error,
      ...meta,
    });
  },

  warn: (message: string, meta?: any) => {
    logger.warn(message, meta);
  },

  info: (message: string, meta?: any) => {
    logger.info(message, meta);
  },

  debug: (message: string, meta?: any) => {
    logger.debug(message, meta);
  },
};

// Usage
log.error('Database query failed', error, {
  query: 'SELECT * FROM products',
  userId: req.session?.userId,
});
```

---

## User-Facing Error Messages

### Friendly Error Messages

#### ✅ CORRECT - User-Friendly Language
```typescript
// Map technical errors to user-friendly messages
const USER_FRIENDLY_MESSAGES: Record<string, string> = {
  NETWORK_ERROR: 'Unable to connect. Please check your internet connection.',
  TIMEOUT: 'The request took too long. Please try again.',
  VALIDATION_ERROR: 'Please check your input and try again.',
  UNAUTHORIZED: 'Please log in to continue.',
  FORBIDDEN: 'You don\'t have permission to do that.',
  NOT_FOUND: 'We couldn\'t find what you\'re looking for.',
  CONFLICT: 'This item already exists.',
  RATE_LIMIT_EXCEEDED: 'Too many attempts. Please wait a moment.',
  SERVER_ERROR: 'Something went wrong on our end. Please try again later.',
};

// Toast/notification component
export function showErrorToast(error: ApiError) {
  const message = USER_FRIENDLY_MESSAGES[error.code || ''] ||
                  error.message ||
                  'An unexpected error occurred';

  toast.error(message, {
    duration: 5000,
    action: error.status >= 500 ? {
      label: 'Retry',
      onClick: () => window.location.reload(),
    } : undefined,
  });
}
```

---

## Error Recovery Strategies

### Fire-and-Forget Pattern for Non-Critical Operations (NEW - 2026-01-07)

**Context:** When optional enhancements (like email notifications) should not block or break core functionality (like in-app notifications).

**Problem:** If optional operations throw errors, they can cause the entire operation to fail, breaking critical features that should succeed independently.

**Source:** `server/services/price-drop-detection.ts` from TODO_018 email notification implementation.

#### ❌ WRONG - Blocking on Optional Operation

```typescript
async function createNotification(data: NotificationData) {
  // Create critical in-app notification
  const notification = await db.insert(notifications).values(data);

  // Send optional email - BLOCKS if it fails!
  if (userPreferences.emailEnabled) {
    await emailService.sendPriceAlertEmail({ ... }); // Throws on SMTP error
  }

  // PROBLEM: If email fails, notification creation appears to fail
  // User doesn't receive in-app notification either!
  return notification;
}
```

**Bug scenario:**
- SMTP server down
- Email send throws error
- In-app notification creation rolls back (transaction)
- User receives nothing (both notification types lost)

#### ✅ CORRECT - Fire-and-Forget with Void Operator

```typescript
async function createNotification(data: NotificationData) {
  // ALWAYS create critical notification first (must succeed)
  const notification = await db.insert(notifications).values(data).returning();

  // Send optional email (fire-and-forget, non-blocking)
  void (async () => {
    try {
      if (userPreferences.emailEnabled) {
        await emailService.sendPriceAlertEmail({ ... });
      }
    } catch (error) {
      // Log error but don't fail the operation
      logger.error('Email failed, but notification created', {
        error,
        notificationId: notification[0].id,
        userId: data.userId,
      });
    }
  })();

  // Continue immediately - don't wait for email
  return notification;
}
```

**Key Pattern Elements:**

1. **void operator**: Satisfies ESLint no-floating-promises rule
2. **IIFE async function**: Separate error boundary
3. **try/catch inside**: Errors don't propagate to caller
4. **Core operation first**: Critical functionality completes before optional
5. **Comprehensive logging**: Track failures without breaking flow

#### Rationale

- **Resilience**: Core functionality works even if enhancement fails
- **User experience**: Users get critical notification even if email fails
- **Fail gracefully**: Degrade to in-app only, not complete failure
- **ESLint compliance**: `void` operator prevents floating promise warnings
- **Debugging**: Errors still logged for investigation

#### When to Use

✅ **Use for:**
- Email notifications (in-app notification is primary)
- Analytics tracking (app functionality is primary)
- Audit logging (business operation is primary)
- Cache updates (source of truth is database)
- Optional third-party integrations

❌ **NEVER use for:**
- Payment processing (must confirm success)
- Database writes (data integrity critical)
- Authentication (security critical)
- Data validation (correctness critical)

#### Alternative Pattern - Promise.allSettled

```typescript
async function createNotificationWithEmail(data: NotificationData) {
  // Run both operations concurrently
  const [notificationResult, emailResult] = await Promise.allSettled([
    db.insert(notifications).values(data).returning(),
    userPreferences.emailEnabled
      ? emailService.sendPriceAlertEmail({ ... })
      : Promise.resolve(null),
  ]);

  // Check critical operation
  if (notificationResult.status === 'rejected') {
    throw new Error('Notification creation failed');
  }

  // Log optional operation failure
  if (emailResult.status === 'rejected') {
    logger.error('Email failed, but notification created', {
      error: emailResult.reason,
    });
  }

  return notificationResult.value;
}
```

**When to use allSettled:**
- Need both operations to run concurrently (performance)
- Want to log failures after all operations complete
- Multiple optional operations (analytics + email + webhook)

#### Detection Rule

```bash
# Find critical operations followed by await on optional operations
grep -A 10 "await db\.insert.*notifications" server/ | \
  grep -A 5 "await emailService\|await analytics"
```

#### Quality Checklist

- [ ] Core functionality completes first (before optional operations)
- [ ] void operator used for fire-and-forget (ESLint compliant)
- [ ] try/catch inside IIFE (errors don't propagate)
- [ ] Error logging includes context (userId, notificationId, etc.)
- [ ] Tests verify core succeeds even when optional fails
- [ ] Documentation explains which operations are optional

**Bug prevented:** Email SMTP failures breaking in-app notification delivery

*Source: TODO_018 price drop detection service*
*Added: 2026-01-07*

---

### Graceful Degradation for Optional Infrastructure (NEW - 2026-01-07)

**Context:** Services that enhance functionality (like email) should work when configured, but degrade gracefully when unavailable.

**Problem:** Throwing errors when optional infrastructure is missing breaks core app functionality that doesn't require it.

**Source:** `server/services/email-service.ts` from TODO_018 - Email notification implementation.

#### ❌ WRONG - Throw Error When Unavailable

```typescript
class EmailService {
  private transporter: Transporter;

  constructor() {
    // Throws if SMTP not configured - breaks app startup!
    if (!process.env.SMTP_HOST) {
      throw new Error('SMTP_HOST required');
    }

    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      // ...
    });
  }

  async sendEmail(options: EmailOptions): Promise<boolean> {
    // Assumes transporter exists
    await this.transporter.sendMail(options);
    return true;
  }
}
```

**Problems:**
- App won't start without SMTP configuration
- All features break, not just email
- Forces production credentials in development
- No way to test non-email features locally

#### ✅ CORRECT - Check Config, Log Info, Degrade Gracefully

```typescript
class EmailService {
  private transporter: Transporter | null = null;
  private isConfigured = false;

  constructor() {
    const smtpHost = process.env.SMTP_HOST;
    const smtpPort = process.env.SMTP_PORT;
    const smtpUser = process.env.SMTP_USERNAME;
    const smtpPass = process.env.SMTP_PASSWORD;

    // Check configuration (don't throw!)
    if (!smtpHost || !smtpPort || !smtpUser || !smtpPass) {
      // INFO level - not an error if optional
      logger.info(
        'Email service not configured. Set SMTP_HOST, SMTP_PORT, SMTP_USERNAME, and SMTP_PASSWORD environment variables.'
      );
      this.isConfigured = false;
      return; // Early return, app continues
    }

    // Initialize if configured
    try {
      this.transporter = nodemailer.createTransport({
        host: smtpHost,
        port: parseInt(smtpPort, 10),
        auth: { user: smtpUser, pass: smtpPass },
      });
      this.isConfigured = true;
      logger.info('Email service initialized successfully');
    } catch (error) {
      logger.error(`Failed to initialize email service: ${error}`);
      this.isConfigured = false;
    }
  }

  async sendEmail(options: EmailOptions): Promise<boolean> {
    // Check if configured (don't throw - return false)
    if (!this.isConfigured || !this.transporter) {
      logger.error('Email service is not configured. Cannot send email.');
      return false; // Caller decides how to handle
    }

    try {
      await this.transporter.sendMail(options);
      logger.info(`Email sent successfully to ${options.to}`);
      return true;
    } catch (error) {
      logger.error(`Failed to send email to ${options.to}: ${error}`);
      return false; // Fail gracefully
    }
  }

  isReady(): boolean {
    return this.isConfigured;
  }
}
```

#### Key Patterns

**1. Check config once at initialization:**
```typescript
constructor() {
  if (!requiredEnvVars) {
    logger.info('Service not configured');  // Not ERROR
    this.isConfigured = false;
    return;  // Early return, don't throw
  }
}
```

**2. Return boolean success (don't throw):**
```typescript
async sendEmail(): Promise<boolean> {
  if (!this.isConfigured) {
    return false;  // Let caller decide
  }
  // Send...
}
```

**3. Provide ready check:**
```typescript
isReady(): boolean {
  return this.isConfigured;
}
```

#### Rationale

- **App starts**: Core features work without optional services
- **Development-friendly**: No SMTP needed for local development
- **Production flexibility**: Can deploy without email, add later
- **Graceful failure**: Log errors but don't break
- **Caller control**: Return false, let caller decide how to handle

#### Logging Levels

**INFO** (not ERROR) when optional service not configured:
```typescript
logger.info('Email service not configured. Emails will be skipped.');
```

**ERROR** when trying to send without configuration:
```typescript
logger.error('Email service not configured. Cannot send email.');
```

**Why?** Missing configuration is expected (not an error), but attempting to send is unexpected (error).

#### When to Use

✅ **Use for:**
- Email services (app works without email)
- Analytics services (app works without tracking)
- Optional third-party integrations (Stripe, Twilio, etc.)
- Enhancement services (search, recommendations)

❌ **NEVER use for:**
- Database connection (app can't work without DB)
- Authentication secret keys (security critical)
- Required business logic services

#### Alternative Pattern - Lazy Initialization

```typescript
class EmailService {
  private transporter: Transporter | null = null;

  private async ensureInitialized(): Promise<boolean> {
    if (this.transporter) return true;

    // Try to initialize on first use
    if (!process.env.SMTP_HOST) {
      logger.warn('Email service not configured');
      return false;
    }

    try {
      this.transporter = nodemailer.createTransport({ ... });
      return true;
    } catch (error) {
      logger.error('Email initialization failed', error);
      return false;
    }
  }

  async sendEmail(options: EmailOptions): Promise<boolean> {
    if (!(await this.ensureInitialized())) {
      return false;
    }

    // Send email...
  }
}
```

#### Quality Checklist

- [ ] Check config at initialization (don't throw)
- [ ] Log INFO (not ERROR) for missing config
- [ ] Return boolean success (don't throw on send failure)
- [ ] Provide `isReady()` or `isConfigured()` check
- [ ] Handle both missing config and runtime failures gracefully
- [ ] Document which env vars are required
- [ ] Tests verify app works without optional service

**Experience improvement:** App works locally without SMTP configuration

*Source: TODO_018 email service implementation*
*Added: 2026-01-07*

---

### Retry Logic

#### ✅ CORRECT - Exponential Backoff
```typescript
// utils/retry.ts
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: {
    maxAttempts?: number;
    delay?: number;
    maxDelay?: number;
    backoff?: number;
    shouldRetry?: (error: unknown, attempt: number) => boolean;
  } = {}
): Promise<T> {
  const {
    maxAttempts = 3,
    delay = 1000,
    maxDelay = 30000,
    backoff = 2,
    shouldRetry = () => true,
  } = options;

  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      if (attempt === maxAttempts || !shouldRetry(error, attempt)) {
        throw error;
      }

      const waitTime = Math.min(delay * Math.pow(backoff, attempt - 1), maxDelay);
      log.warn(`Attempt ${attempt} failed, retrying in ${waitTime}ms`, { error });

      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
  }

  throw lastError;
}

// Usage
const data = await withRetry(
  () => apiRequest('/api/products'),
  {
    shouldRetry: (error) => {
      // Don't retry client errors
      if (error instanceof ApiError && error.status >= 400 && error.status < 500) {
        return false;
      }
      return true;
    },
  }
);
```

### Circuit Breaker Pattern

#### ✅ CORRECT - Prevent Cascading Failures
```typescript
// utils/circuit-breaker.ts
export class CircuitBreaker {
  private failures = 0;
  private lastFailureTime = 0;
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';

  constructor(
    private threshold = 5,
    private timeout = 60000, // 1 minute
    private resetTimeout = 30000 // 30 seconds
  ) {}

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'OPEN') {
      if (Date.now() - this.lastFailureTime > this.timeout) {
        this.state = 'HALF_OPEN';
      } else {
        throw new Error('Circuit breaker is OPEN');
      }
    }

    try {
      const result = await fn();

      if (this.state === 'HALF_OPEN') {
        this.state = 'CLOSED';
        this.failures = 0;
      }

      return result;
    } catch (error) {
      this.failures++;
      this.lastFailureTime = Date.now();

      if (this.failures >= this.threshold) {
        this.state = 'OPEN';
        log.error('Circuit breaker opened', { failures: this.failures });
      }

      throw error;
    }
  }
}

// Usage
const scraperCircuit = new CircuitBreaker();

async function scrapePrices(url: string) {
  try {
    return await scraperCircuit.execute(() => scrapeWebsite(url));
  } catch (error) {
    if (error.message === 'Circuit breaker is OPEN') {
      // Use fallback
      return getCachedPrices(url);
    }
    throw error;
  }
}
```

---

## Error Handling Checklist

- [ ] **No raw error exposure** - Use sendErrorFromException() or sendError()
- [ ] **No silent failures** - Always log errors
- [ ] **Consistent error format** - Standard ErrorResponse type
- [ ] **Custom error classes** - Domain-specific errors
- [ ] **PostgreSQL error classification** - Detect 23505, 23503 codes
- [ ] **Multi-source constraint detection** - Check both constraint field and message
- [ ] **400-level errors for constraints** - Not 500 for duplicate/FK violations
- [ ] **Validation feedback** - Field-specific error messages
- [ ] **Transaction rollback** - Automatic on error
- [ ] **Graceful degradation** - Fallbacks for non-critical services
- [ ] **API timeout handling** - Abort controllers with timeouts
- [ ] **Promise error handling** - No unhandled rejections
- [ ] **Structured logging** - Consistent log format with context
- [ ] **User-friendly messages** - Technical → human translation
- [ ] **Retry logic** - Exponential backoff for transient failures
- [ ] **Circuit breakers** - Prevent cascading failures

---

## Related Documentation

- [CLAUDE.md](../CLAUDE.md) - Main project guidelines
- [SECURITY_PATTERNS.md](SECURITY_PATTERNS.md) - Security error handling
- [DATABASE_PATTERNS.md](DATABASE_PATTERNS.md) - Database query patterns, transactions
- [PHASE0_WATCHLIST_PATTERNS.md](PHASE0_WATCHLIST_PATTERNS.md) - Source of PostgreSQL error patterns
- [Pre-commit Hook](.git/hooks/pre-commit) - Error handling checks
- [Error Utilities](../server/utils/errors.ts) - Consolidated error handling implementation
- [API Response Helpers](../server/utils/api-response.ts) - Response formatting with error handling
