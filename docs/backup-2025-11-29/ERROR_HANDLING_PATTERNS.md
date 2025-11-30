---
Pattern: Error Handling Patterns & Anti-Patterns
Version: 1.0
Last Updated: 2025-11-26
Maintainer: Claude Code / Development Team
Status: Active
Related Patterns: [API_PATTERNS.md, SECURITY_PATTERNS.md, TYPESCRIPT_PATTERNS.md, SERVICE_INTEGRATION_PATTERNS.md]
---

# Error Handling Patterns & Anti-Patterns

This document codifies error handling patterns to ensure consistent, secure, and user-friendly error management in the PriceCompare codebase.

## Table of Contents
- [Critical Anti-Patterns](#critical-anti-patterns)
- [Error Response Patterns](#error-response-patterns)
- [Validation Error Handling](#validation-error-handling)
- [Database Error Handling](#database-error-handling)
- [API Client Error Handling](#api-client-error-handling)
- [Async Error Patterns](#async-error-patterns)
- [Logging Patterns](#logging-patterns)
- [User-Facing Error Messages](#user-facing-error-messages)
- [Error Recovery Strategies](#error-recovery-strategies)

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

#### ✅ CORRECT - Use Error Sanitizer (MANDATORY)
```typescript
import { createErrorResponse } from '../utils/error-sanitizer';

try {
  await db.insert(users).values(userData);
} catch (error) {
  // ALWAYS log full error server-side for debugging
  console.error('User creation failed:', error);

  // Send sanitized response to client
  const errorResponse = createErrorResponse(error, 'UserCreation');
  res.status(errorResponse.status).json({
    error: errorResponse.error, // Generic message in production
    details: errorResponse.details, // Only in development
  });
}
```

#### Detection Rule
```bash
# Find routes that expose raw error messages
# This will catch most violations
grep -r "error\.message" server/routes/ server/*-routes.ts | grep -v "createErrorResponse" | grep -v "log\."

# Find direct error object responses
grep -r "res\..*json.*error" server/routes/ | grep -v "createErrorResponse"
```

#### Pre-Commit Hook Check
The pre-commit hook automatically detects:
- `error.message` in response bodies
- Raw `error` objects passed to `res.json()`
- Missing `createErrorResponse` in catch blocks

**To pass the hook**, ensure ALL error responses use `createErrorResponse()`.

#### Common Violations and Fixes

**Violation 1: Direct error.message**
```typescript
// ❌ WRONG
catch (error) {
  res.status(500).json({ error: error.message });
}

// ✅ FIXED
catch (error) {
  const errorResponse = createErrorResponse(error, 'OperationName');
  res.status(errorResponse.status).json(errorResponse);
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
  const errorResponse = createErrorResponse(error, 'ValidationError');
  res.status(errorResponse.status).json(errorResponse);
  // createErrorResponse handles Zod errors properly
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
  // Returns: "This item already exists" (production) or detailed error (dev)
  const errorResponse = createErrorResponse(error, 'CreateUser');
  res.status(errorResponse.status).json(errorResponse);
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
  // Always log errors
  log.error('Product update failed:', error);

  // Inform user appropriately
  const errorResponse = createErrorResponse(error, 'ProductUpdate');
  return res.status(errorResponse.status).json(errorResponse);
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

#### ✅ CORRECT - Consistent Error Format
```typescript
// types/errors.ts
interface ErrorResponse {
  error: string; // User-facing message
  code?: string; // Machine-readable error code
  details?: any; // Additional details (dev only)
  timestamp: string;
  requestId?: string; // For tracking
}

// utils/error-sanitizer.ts
export function createErrorResponse(
  error: unknown,
  operation: string
): ErrorResponse & { status: number } {
  const timestamp = new Date().toISOString();
  const requestId = generateRequestId();

  // Log with request ID for tracking
  log.error(`[${requestId}] ${operation} failed:`, error);

  // Development mode - include details
  if (process.env.NODE_ENV === 'development') {
    if (error instanceof z.ZodError) {
      return {
        status: 400,
        error: 'Validation failed',
        code: 'VALIDATION_ERROR',
        details: error.errors,
        timestamp,
        requestId,
      };
    }

    if (error instanceof Error) {
      return {
        status: 500,
        error: error.message,
        code: 'INTERNAL_ERROR',
        details: { stack: error.stack },
        timestamp,
        requestId,
      };
    }
  }

  // Production mode - generic messages
  if (error instanceof z.ZodError) {
    return {
      status: 400,
      error: 'Invalid input provided',
      code: 'VALIDATION_ERROR',
      timestamp,
      requestId,
    };
  }

  // Map known errors to user-friendly messages
  if (error instanceof Error) {
    const errorMap: Record<string, { status: number; message: string; code: string }> = {
      'unique constraint': {
        status: 409,
        message: 'This item already exists',
        code: 'DUPLICATE_ENTRY',
      },
      'foreign key': {
        status: 400,
        message: 'Referenced item not found',
        code: 'REFERENCE_ERROR',
      },
      'not found': {
        status: 404,
        message: 'Requested item not found',
        code: 'NOT_FOUND',
      },
      'unauthorized': {
        status: 401,
        message: 'Authentication required',
        code: 'UNAUTHORIZED',
      },
      'forbidden': {
        status: 403,
        message: 'You do not have permission to perform this action',
        code: 'FORBIDDEN',
      },
    };

    for (const [key, value] of Object.entries(errorMap)) {
      if (error.message.toLowerCase().includes(key)) {
        return {
          status: value.status,
          error: value.message,
          code: value.code,
          timestamp,
          requestId,
        };
      }
    }
  }

  // Generic fallback
  return {
    status: 500,
    error: 'An unexpected error occurred. Please try again later.',
    code: 'INTERNAL_ERROR',
    timestamp,
    requestId,
  };
}
```

### Custom Error Classes

#### ✅ CORRECT - Domain-Specific Errors
```typescript
// errors/custom-errors.ts
export class AppError extends Error {
  constructor(
    message: string,
    public statusCode: number = 500,
    public code: string = 'INTERNAL_ERROR',
    public isOperational: boolean = true
  ) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends AppError {
  constructor(message: string, public fields: Record<string, string>) {
    super(message, 400, 'VALIDATION_ERROR');
    this.fields = fields;
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string, id?: string | number) {
    const message = id
      ? `${resource} with ID ${id} not found`
      : `${resource} not found`;
    super(message, 404, 'NOT_FOUND');
  }
}

export class AuthenticationError extends AppError {
  constructor(message = 'Authentication required') {
    super(message, 401, 'UNAUTHORIZED');
  }
}

export class AuthorizationError extends AppError {
  constructor(message = 'Insufficient permissions') {
    super(message, 403, 'FORBIDDEN');
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(message, 409, 'CONFLICT');
  }
}

export class RateLimitError extends AppError {
  constructor(retryAfter?: number) {
    super('Too many requests', 429, 'RATE_LIMIT_EXCEEDED');
    this.retryAfter = retryAfter;
  }

  retryAfter?: number;
}
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
    const errorResponse = createErrorResponse(error, 'CreateProduct');
    res.status(errorResponse.status).json(errorResponse);
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

### PostgreSQL Error Code Classification (Phase 0 Pattern)

**CRITICAL**: Database constraint violations should return 400-level errors, not 500s.

#### PostgreSQL Error Codes Reference

| Code | Name | User Message | HTTP Status |
|------|------|--------------|-------------|
| `23505` | unique_violation | "This item already exists" | 400 or 409 |
| `23503` | foreign_key_violation | "Referenced item not found" | 400 |
| `23502` | not_null_violation | "Required field missing" | 400 |
| `23514` | check_violation | "Invalid value provided" | 400 |
| `40001` | serialization_failure | (Retry internally) | - |
| `40P01` | deadlock_detected | (Retry internally) | - |

#### Implementation Pattern

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

#### Why Multi-Source Detection

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

#### Anti-Pattern: Returning 500 for Constraint Violations

```typescript
// WRONG - Returns 500 for all database errors
catch (error) {
  console.error('Database error:', error);
  res.status(500).json({ error: 'Internal server error' });
}
// Result: User sees "Internal server error" when trying to add duplicate

// CORRECT - Classify error and return appropriate status
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
  const errorResponse = createErrorResponse(error, req.path);
  res.status(errorResponse.status).json(errorResponse);
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

- [ ] **No raw error exposure** - Use createErrorResponse()
- [ ] **No silent failures** - Always log errors
- [ ] **Consistent error format** - Standard ErrorResponse type
- [ ] **Custom error classes** - Domain-specific errors
- [ ] **Validation feedback** - Field-specific error messages
- [ ] **Transaction rollback** - Automatic on error
- [ ] **Graceful degradation** - Fallbacks for non-critical services
- [ ] **API timeout handling** - Abort controllers with timeouts
- [ ] **Promise error handling** - No unhandled rejections
- [ ] **Structured logging** - Consistent log format
- [ ] **User-friendly messages** - Technical → human translation
- [ ] **Retry logic** - Exponential backoff for transient failures
- [ ] **Circuit breakers** - Prevent cascading failures

---

## Related Documentation

- [CLAUDE.md](../CLAUDE.md) - Main project guidelines
- [SECURITY_PATTERNS.md](SECURITY_PATTERNS.md) - Security error handling
- [Pre-commit Hook](.git/hooks/pre-commit) - Error handling checks
- [Error Sanitizer](../server/utils/error-sanitizer.ts) - Implementation