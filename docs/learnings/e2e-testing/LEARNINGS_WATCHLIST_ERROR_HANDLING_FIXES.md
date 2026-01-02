# Learnings: Watchlist Error Handling Fixes - ZodError and Constraint Violations

**Date**: 2025-12-02
**Context**: Bug fixes discovered during TODO 001 code review
**Status**: ✅ Completed - Proper error status codes now returned

## Problem Summary

During code review of the watchlist routes test fixes, two application bugs were discovered where validation/constraint errors were returning **500 (Server Error)** instead of proper **4xx (Client Error)** status codes:

1. **Empty name validation**: Returned 500 instead of 400
2. **Duplicate product constraint**: Returned 500 instead of 409

This violated the fundamental error handling principle: **Client errors (invalid input, duplicates, not found) must return 4xx, not 5xx**.

## Root Causes

### Bug #1: ZodError Not Recognized by sendErrorFromException

**Location**: `server/utils/api-response.ts`

**Problem**: The `sendErrorFromException` helper didn't recognize ZodError instances, treating them as generic errors (500).

```typescript
// ❌ BEFORE - ZodError treated as generic error
export function sendErrorFromException(
  res: Response,
  error: unknown,
  context: string
): void {
  // No ZodError detection - defaults to 500
  if (error instanceof Error) {
    const sanitized = sanitizeError(error, context);
    logError(context, error);
    res.status(sanitized.status).json({
      success: false,
      error: sanitized.error,
      ...(sanitized.details && { details: sanitized.details }),
    });
    return;
  }
  // ... fallback
}
```

**Test Evidence** (from `server/__tests__/watchlist-routes.test.ts:291-301`):
```typescript
it('should validate name is required', async () => {
  const response = await request(app)
    .post('/api/watchlists')
    .set('Cookie', authCookie)
    .set('X-CSRF-Token', csrfToken)
    .send({ name: '' });

  // BUG: Empty string passes to database, fails with 500
  expectErrorResponse(response, 500);  // ❌ WRONG - Should be 400
});
```

### Bug #2: Duplicate Product Constraint Not Caught

**Location**: `server/routes/watchlist-routes.ts` - POST /api/watchlists/:id/products

**Problem**: The route handler wasn't catching unique constraint violations from the storage layer.

**Storage Layer** (from `server/storage/domains/watchlist-storage.ts`):
```typescript
// Storage layer CORRECTLY catches PostgreSQL error 23505
async addProductToWatchList(watchListId: number, productId: number, userId: number) {
  try {
    const [productWatch] = await db.insert(productWatches).values({
      watchListId,
      productId,
      userId,
    }).returning();
    return productWatch;
  } catch (error: unknown) {
    // ✅ Storage layer catches unique constraint
    if (error instanceof Error && 'code' in error) {
      const dbError = error as { code?: string };
      if (dbError.code === '23505') {  // unique_violation
        throw new Error('Product already in watch list');
      }
    }
    throw error;
  }
}
```

**Route Handler** (BEFORE fix):
```typescript
// ❌ BEFORE - No error handling, just lets exception bubble up as 500
app.post('/api/watchlists/:id/products', csrfProtection, withAuth(async (req, res) => {
  // ... validation ...
  const productWatch = await storage.addProductToWatchList(watchListId, productId, userId);
  sendSuccess(res, productWatch, 201);
  // ❌ No catch block - storage errors become 500
}));
```

**Test Evidence** (from `server/__tests__/watchlist-routes.test.ts:550-569`):
```typescript
it('should prevent duplicate products', async () => {
  // Add product first time (success)
  await request(app)
    .post(`/api/watchlists/${watchListId}/products`)
    .send({ productId: testProductId });

  // Try to add again (should be 409 Conflict)
  const response = await request(app)
    .post(`/api/watchlists/${watchListId}/products`)
    .send({ productId: testProductId });

  // BUG: Unique constraint violation returns 500
  expectErrorResponse(response, 500);  // ❌ WRONG - Should be 409
});
```

## Solutions Implemented

### Fix #1: Enhanced sendErrorFromException to Handle ZodError

**File**: `server/utils/api-response.ts`

**Change**: Added ZodError detection BEFORE generic Error handling:

```typescript
import { ZodError } from 'zod';

export function sendErrorFromException(
  res: Response,
  error: unknown,
  context: string
): void {
  // ✅ NEW - Detect ZodError and return 400
  if (error instanceof ZodError) {
    const firstError = error.issues[0];
    const message = firstError?.message || 'Validation failed';

    logError(context, error);

    res.status(400).json({
      success: false,
      error: message,
      ...(process.env.NODE_ENV === 'development' && {
        details: error.issues,
      }),
    });
    return;
  }

  // Existing generic Error handling...
  if (error instanceof Error) {
    const sanitized = sanitizeError(error, context);
    logError(context, error);
    res.status(sanitized.status).json({
      success: false,
      error: sanitized.error,
      ...(sanitized.details && { details: sanitized.details }),
    });
    return;
  }

  // Fallback for unknown errors
  logError(context, error);
  res.status(500).json({
    success: false,
    error: 'An unexpected error occurred',
  });
}
```

**Why This Works**:
1. **Order matters**: ZodError check BEFORE generic Error check (ZodError extends Error)
2. **Extracts first error**: `error.issues[0].message` provides user-friendly message
3. **Development details**: Full `error.issues` array in dev mode for debugging
4. **Automatic 400**: All Zod validation failures now return 400, not 500

**Impact**: This fix applies to **ALL routes** using Zod validation + `sendErrorFromException`:
- Empty string validation (watchlists)
- Invalid email format (auth)
- Missing required fields (all routes)
- Type mismatches (string instead of number, etc.)

### Fix #2: Route Handler Error Catching for Duplicates

**File**: `server/routes/watchlist-routes.ts`

**Change**: Added try-catch with duplicate detection:

```typescript
app.post(
  '/api/watchlists/:id/products',
  csrfProtection,
  withAuth(async (req, res) => {
    try {
      const { id } = req.params;
      const watchListId = parseIntSafe(id, 'watchListId', { min: 1 });

      const { productId } = addProductToWatchListSchema.parse(req.body);
      const userId = req.user!.id;

      const productWatch = await storage.addProductToWatchList(
        watchListId,
        productId,
        userId
      );

      sendSuccess(res, productWatch, 201);
    } catch (error: unknown) {
      // ✅ NEW - Catch duplicate product errors
      if (error instanceof Error && error.message.toLowerCase().includes('already')) {
        sendError(res, 'Product already in this watch list', 409);
        return;
      }
      sendErrorFromException(res, error, 'AddProductToWatchList');
    }
  })
);
```

**Why This Works**:
1. **Storage layer throws descriptive error**: "Product already in watch list"
2. **Route layer detects pattern**: Checks for "already" keyword in error message
3. **Returns 409 Conflict**: Proper HTTP status for duplicate resource
4. **Falls back gracefully**: Other errors still handled by `sendErrorFromException`

**Alternative Pattern** (more explicit):
```typescript
// If storage layer throws a custom error class:
class DuplicateResourceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DuplicateResourceError';
  }
}

// Route handler can catch explicitly:
catch (error: unknown) {
  if (error instanceof DuplicateResourceError) {
    sendError(res, error.message, 409);
    return;
  }
  sendErrorFromException(res, error, 'AddProductToWatchList');
}
```

### Fix #3: Updated Test Expectations

**File**: `server/__tests__/watchlist-routes.test.ts`

**Changes**:
```typescript
// Line 298-300: Empty name validation
it('should validate name is required', async () => {
  const response = await request(app)
    .post('/api/watchlists')
    .send({ name: '' });

  // ✅ FIXED: Now returns 400 (Bad Request)
  expectErrorResponse(response, 400);
});

// Line 591-593: Duplicate product constraint
it('should prevent duplicate products', async () => {
  // Add product twice...

  // ✅ FIXED: Now returns 409 (Conflict)
  expectErrorResponse(response, 409);
});
```

## Key Insights

### 1. ZodError Detection Order Matters

```typescript
// ❌ WRONG - ZodError never caught (Error check catches it first)
if (error instanceof Error) {
  // ZodError extends Error, so this catches ZodError too
}
if (error instanceof ZodError) {
  // Never reached!
}

// ✅ CORRECT - Most specific check first
if (error instanceof ZodError) {
  return 400;  // Validation error
}
if (error instanceof Error) {
  return sanitized.status;  // Other errors
}
```

**Why**: JavaScript's `instanceof` checks the prototype chain. ZodError extends Error, so `error instanceof Error` is true for ZodError instances. **Always check subclasses before base classes**.

### 2. Error Status Code Hierarchy

| Error Type | Status Code | When to Use | Example |
|------------|-------------|-------------|---------|
| **Validation Error** | 400 | Invalid input format, missing required fields | Empty name, invalid email |
| **Unauthorized** | 401 | No authentication provided | Missing auth cookie |
| **Forbidden** | 403 | Authenticated but insufficient permissions | Non-admin accessing admin route |
| **Not Found** | 404 | Resource doesn't exist | Watch list ID 99999 |
| **Conflict** | 409 | Duplicate resource, concurrent modification | Adding same product twice |
| **Unprocessable Entity** | 422 | Valid format but business rule violation | Negative price, future date |
| **Server Error** | 500 | Unexpected errors, database down | Connection timeout, null pointer |

**Rule**: If the **client can fix it by changing their request**, use 4xx. If the **server needs to be fixed**, use 5xx.

### 3. Layered Error Handling Architecture

```
┌─────────────────────────────────────────┐
│ Route Layer (watchlist-routes.ts)      │
│ - Catches storage errors               │
│ - Maps to HTTP status codes            │
│ - Returns client-friendly messages     │
└────────────┬────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────┐
│ Storage Layer (watchlist-storage.ts)   │
│ - Catches PostgreSQL errors            │
│ - Converts DB codes to descriptions    │
│ - Throws descriptive Error objects     │
└────────────┬────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────┐
│ Database Layer (PostgreSQL)            │
│ - Returns error codes (23505, etc.)    │
│ - Enforces constraints                 │
└─────────────────────────────────────────┘
```

**Each layer has a responsibility**:
1. **Database**: Enforces data integrity, returns error codes
2. **Storage**: Translates DB codes to domain errors (Error objects)
3. **Route**: Maps domain errors to HTTP status codes and messages

### 4. PostgreSQL Error Code Reference

| Code | Name | Meaning | Suggested HTTP Status |
|------|------|---------|----------------------|
| `23505` | unique_violation | Duplicate key | 409 Conflict |
| `23503` | foreign_key_violation | Referenced record doesn't exist | 400 Bad Request |
| `23502` | not_null_violation | Required field is null | 400 Bad Request |
| `23514` | check_violation | CHECK constraint failed | 400 Bad Request |
| `42P01` | undefined_table | Table doesn't exist | 500 Server Error |
| `08006` | connection_failure | Connection lost | 503 Service Unavailable |

**Pattern for Storage Layer**:
```typescript
async function createResource(data: ResourceData) {
  try {
    return await db.insert(resources).values(data).returning();
  } catch (error: unknown) {
    if (error instanceof Error && 'code' in error) {
      const dbError = error as { code?: string; constraint?: string };

      switch (dbError.code) {
        case '23505':  // unique_violation
          throw new Error(`${dbError.constraint || 'Resource'} already exists`);
        case '23503':  // foreign_key_violation
          throw new Error('Referenced resource not found');
        case '23502':  // not_null_violation
          throw new Error('Required field is missing');
        default:
          throw error;  // Let route layer handle
      }
    }
    throw error;
  }
}
```

### 5. When to Use sendError vs sendErrorFromException

```typescript
// ✅ Use sendError for KNOWN error conditions
if (!watchList) {
  sendError(res, 'Watch list not found', 404);
  return;
}

if (watchList.userId !== req.user!.id) {
  sendError(res, 'Unauthorized', 403);
  return;
}

// ✅ Use sendErrorFromException for CAUGHT exceptions
try {
  const result = await storage.createWatchList(data);
  sendSuccess(res, result, 201);
} catch (error) {
  sendErrorFromException(res, error, 'CreateWatchList');
}
```

**Rule**:
- `sendError`: You control the condition (null check, permission check, explicit validation)
- `sendErrorFromException`: External code threw an error (Zod, database, storage layer)

## Testing Patterns

### Pattern 1: Test Both Success and Failure Paths

```typescript
describe('POST /api/watchlists', () => {
  it('should create watch list with valid data', async () => {
    const response = await request(app)
      .post('/api/watchlists')
      .set('Cookie', authCookie)
      .set('X-CSRF-Token', csrfToken)
      .send({ name: 'Valid Name' });

    expectSuccessResponse(response, 201);
  });

  it('should validate name is required', async () => {
    const response = await request(app)
      .post('/api/watchlists')
      .set('Cookie', authCookie)
      .set('X-CSRF-Token', csrfToken)
      .send({ name: '' });

    expectErrorResponse(response, 400);  // ✅ Client error
  });

  it('should prevent duplicate names', async () => {
    // Create first watchlist
    await request(app)
      .post('/api/watchlists')
      .send({ name: 'My List' });

    // Try to create duplicate
    const response = await request(app)
      .post('/api/watchlists')
      .send({ name: 'My List' });

    expectErrorResponse(response, 409);  // ✅ Conflict
  });
});
```

### Pattern 2: Test Error Status Codes, Not Just Error Presence

```typescript
// ❌ BAD - Only checks that error occurred
it('should fail with empty name', async () => {
  const response = await request(app)
    .post('/api/watchlists')
    .send({ name: '' });

  expect(response.body.success).toBe(false);  // Could be any error!
});

// ✅ GOOD - Verifies specific status code
it('should validate name is required', async () => {
  const response = await request(app)
    .post('/api/watchlists')
    .send({ name: '' });

  expectErrorResponse(response, 400);  // Explicit 400 validation error
  expect(response.body.error).toContain('required');  // Error message check
});
```

### Pattern 3: Document Why Tests Expect Specific Status Codes

```typescript
it('should prevent duplicate products', async () => {
  // Add product first time
  await request(app)
    .post(`/api/watchlists/${watchListId}/products`)
    .send({ productId: testProductId });

  // Try to add again
  const response = await request(app)
    .post(`/api/watchlists/${watchListId}/products`)
    .send({ productId: testProductId });

  // FIXED: Storage layer catches unique constraint violation (PostgreSQL error code 23505)
  // Returns 409 (Conflict) instead of 500 (Server Error)
  expectErrorResponse(response, 409);
});
```

**Why comment**: Future developers understand the fix and won't change status code back to 500.

## Applying This Pattern to Other Routes

### Checklist for Error Handling Review

1. **Validate all routes use sendErrorFromException for caught exceptions** ✓
   - ZodError handling is now automatic (returns 400)
   - No need to manually handle Zod validation errors

2. **Check storage layer catches PostgreSQL errors** ✓
   ```bash
   grep -rn "23505" server/storage/
   grep -rn "unique_violation" server/storage/
   ```

3. **Verify route handlers catch storage errors** ✓
   ```typescript
   try {
     await storage.someOperation();
   } catch (error) {
     // ✓ Check for known error patterns
     if (error instanceof Error && error.message.includes('already')) {
       sendError(res, 'Resource already exists', 409);
       return;
     }
     sendErrorFromException(res, error, 'Context');
   }
   ```

4. **Update tests to expect correct status codes** ✓
   - Validation errors: 400
   - Duplicates: 409
   - Not found: 404
   - Unauthorized: 401/403
   - Server errors: 500

### Common Error Patterns to Look For

**Pattern**: Empty/whitespace validation
```typescript
// ❌ Problem: Empty string reaches database
const schema = z.object({
  name: z.string().max(100)  // Allows empty string!
});

// ✅ Solution: Add .trim().min(1)
const schema = z.object({
  name: z.string().trim().min(1).max(100)
});
```

**Pattern**: Duplicate detection
```typescript
// ❌ Problem: Unique constraint returns 500
await storage.createResource(data);

// ✅ Solution: Catch "already" errors
try {
  await storage.createResource(data);
} catch (error) {
  if (error instanceof Error && error.message.includes('already')) {
    sendError(res, 'Resource already exists', 409);
    return;
  }
  sendErrorFromException(res, error, 'CreateResource');
}
```

**Pattern**: Foreign key validation
```typescript
// ❌ Problem: Invalid foreign key returns 500
await storage.createChild({ parentId: 99999 });

// ✅ Solution: Validate parent exists first
const parent = await storage.getParent(parentId);
if (!parent) {
  sendError(res, 'Parent resource not found', 404);
  return;
}
await storage.createChild({ parentId });
```

## Files Modified

### 1. server/utils/api-response.ts
**What changed**: Added ZodError detection to `sendErrorFromException`
**Why**: Ensures all Zod validation errors return 400, not 500
**Impact**: Global - affects all routes using Zod + sendErrorFromException

### 2. server/routes/watchlist-routes.ts
**What changed**: Added duplicate error catching in POST /api/watchlists/:id/products
**Why**: Catches "already exists" errors from storage layer
**Impact**: Local - only affects add product to watchlist endpoint

### 3. server/__tests__/watchlist-routes.test.ts
**What changed**: Updated test expectations (500 → 400/409)
**Why**: Tests now verify correct HTTP status codes
**Impact**: Test accuracy - ensures bugs don't regress

## Related Patterns

- **API Error Handling**: See `docs/06_ERROR_HANDLING_PATTERNS.md` for complete guide
- **Zod Validation**: See `docs/04_SECURITY_PATTERNS.md` for input validation patterns
- **PostgreSQL Errors**: See `docs/02_DATABASE_PATTERNS.md` for constraint handling
- **Storage Layer**: See `docs/02_DATABASE_PATTERNS.md` for storage abstraction patterns

## Future Improvements

1. **Custom Error Classes** (Optional):
   ```typescript
   class ValidationError extends Error { status = 400; }
   class ConflictError extends Error { status = 409; }
   class NotFoundError extends Error { status = 404; }

   // Throw specific errors:
   throw new ConflictError('Resource already exists');

   // Route handler auto-detects:
   if (error instanceof ConflictError) {
     sendError(res, error.message, error.status);
   }
   ```

2. **Centralized Error Code Mapping** (Optional):
   ```typescript
   // server/utils/db-error-mapper.ts
   export function mapDbError(error: unknown): { message: string; status: number } {
     if (error instanceof Error && 'code' in error) {
       const dbError = error as { code?: string };
       switch (dbError.code) {
         case '23505': return { message: 'Resource already exists', status: 409 };
         case '23503': return { message: 'Referenced resource not found', status: 400 };
         // ...
       }
     }
     return { message: 'Database error', status: 500 };
   }
   ```

3. **Error Monitoring** (Already implemented):
   - Sentry integration captures all errors
   - `logError()` logs to console + Sentry
   - Production gets sanitized messages

## Lessons Learned

1. **ZodError extends Error** - Always check subclasses before base classes in instanceof chains
2. **Status codes matter** - 4xx vs 5xx affects client retry logic and error tracking
3. **Layer responsibilities** - Database enforces, storage translates, routes map to HTTP
4. **Test status codes explicitly** - Don't just check for errors, verify the exact status
5. **Comments prevent regressions** - Document WHY tests expect specific status codes
6. **Global fixes are powerful** - One fix to `sendErrorFromException` fixed all Zod errors project-wide

---

**Completion Date**: 2025-12-02
**Test Results**: ✅ All 32 watchlist tests passing with correct status codes
**Impact**: System-wide improvement to error handling consistency
