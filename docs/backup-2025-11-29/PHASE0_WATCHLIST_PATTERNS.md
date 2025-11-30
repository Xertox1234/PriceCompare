---
Pattern: Phase 0 Watchlist Bug Fixes - Codified Patterns
Version: 1.0
Last Updated: 2025-11-28
Maintainer: Claude Code / Development Team
Status: Active
Source: Watchlist Feature Enhancement - Phase 0 Critical Bug Fixes
Related Patterns: [DATABASE_PATTERNS.md, VALIDATION_PATTERNS.md, ERROR_HANDLING_PATTERNS.md, API_PATTERNS.md]
---

# Phase 0 Watchlist Patterns

This document codifies patterns learned from the Phase 0 critical bug fixes for the watchlist feature enhancement. These patterns should be applied to all future implementations and reviews.

## Table of Contents
- [Pattern 1: NULL-Safe Database Constraints](#pattern-1-null-safe-database-constraints)
- [Pattern 2: Validation Layer Separation](#pattern-2-validation-layer-separation)
- [Pattern 3: Configuration Centralization](#pattern-3-configuration-centralization)
- [Pattern 4: Database Error Classification](#pattern-4-database-error-classification)
- [Pattern 5: Middleware Ordering](#pattern-5-middleware-ordering)
- [Pattern 6: Defensive Constraint Detection](#pattern-6-defensive-constraint-detection)
- [Review Checklist](#review-checklist)

---

## Pattern 1: NULL-Safe Database Constraints

### Problem Statement

PostgreSQL's UNIQUE constraints treat NULL values as distinct. This means a constraint like `UNIQUE(user_id, product_id, watch_list_id)` allows multiple rows with the same `user_id` and `product_id` as long as `watch_list_id` is NULL.

```sql
-- These are considered DIFFERENT by PostgreSQL:
INSERT INTO product_watches (user_id, product_id, watch_list_id) VALUES (1, 100, NULL);
INSERT INTO product_watches (user_id, product_id, watch_list_id) VALUES (1, 100, NULL);
-- Both INSERT succeed! This is a data integrity bug.
```

### Solution: Dual Constraint Architecture

Use a **partial unique index** for the NULL case combined with a **standard unique constraint** for the non-NULL case.

```sql
-- Drop the flawed three-column constraint
ALTER TABLE product_watches DROP CONSTRAINT IF EXISTS unique_user_product_list;

-- Create partial unique index for NULL watch_list_id case
-- This prevents duplicate (user_id, product_id) when watch_list_id IS NULL
CREATE UNIQUE INDEX unique_user_product_no_list
  ON product_watches(user_id, product_id)
  WHERE watch_list_id IS NULL;

-- Create standard unique constraint for non-NULL watch_list_id
-- This prevents duplicate (user_id, product_id, watch_list_id) when watch_list_id is set
ALTER TABLE product_watches
  ADD CONSTRAINT unique_user_product_list
  UNIQUE(user_id, product_id, watch_list_id);

-- Document the purpose
COMMENT ON INDEX unique_user_product_no_list IS
  'Prevents duplicate products in user watches when not assigned to a list';
COMMENT ON CONSTRAINT unique_user_product_list ON product_watches IS
  'Prevents duplicate products within the same watch list';
```

### When to Apply

Apply this pattern whenever:
- A UNIQUE constraint includes nullable foreign keys
- Optional relationships need uniqueness enforcement
- A parent record is optional but duplicates should still be prevented

### Detection Rule for Code Review

```bash
# Find tables with nullable columns in unique constraints
grep -rn "UNIQUE.*NULL\|unique.*null" shared/schema.ts
```

Look for patterns like:
```typescript
// REVIEW FLAG: Nullable column in unique constraint
watchListId: integer("watch_list_id")
  .references(() => watchLists.id, { onDelete: 'set null' })
  // This is nullable - check if unique constraint handles NULL case
```

### Anti-Pattern

```typescript
// WRONG - Simple unique constraint doesn't handle NULL
unique: ["userId", "productId", "watchListId"]

// WRONG - Database migration without partial index
ALTER TABLE product_watches ADD CONSTRAINT unique_watch
  UNIQUE(user_id, product_id, watch_list_id);
```

---

## Pattern 2: Validation Layer Separation

### Problem Statement

When validation logic lives in the storage layer, it runs AFTER data has been processed/transformed at earlier layers. This leads to:
1. Validation checking already-processed data
2. Order-of-operations bugs (e.g., checking length before trimming)
3. Duplicated validation logic across routes
4. Inconsistent error handling

### Solution: Route-Layer Validation with Zod

All input validation should happen at the route layer using Zod schemas. The storage layer should assume data is already valid.

#### Before (Anti-Pattern)

```typescript
// storage.ts - WRONG: Storage doing validation
async createWatchList(userId: number, data: { name: string; description?: string }) {
  // Storage layer checks name after it may have been transformed
  if (!data.name || data.name.trim().length === 0) {
    throw new Error('Name is required');
  }
  // ... insert
}

// routes.ts - No schema validation
app.post('/api/watchlists', async (req, res) => {
  const result = await storage.createWatchList(userId, req.body);
  // ...
});
```

#### After (Correct Pattern)

```typescript
// routes.ts - Zod schema handles ALL input validation
const createWatchListSchema = z.object({
  name: z.string()
    .trim()      // Transform FIRST (order matters!)
    .min(1, "Name is required")
    .max(100, "Name must be 100 characters or less"),
  description: z.string()
    .max(500, "Description must be 500 characters or less")
    .optional()
});

app.post("/api/watchlists", requireAuth, csrfProtection, async (req, res) => {
  try {
    // Validate and transform at route layer
    const data = createWatchListSchema.parse(req.body);

    // Storage receives guaranteed-valid data
    const watchList = await storage.createWatchList(userId, data);
    sendSuccess(res, watchList, 201);
  } catch (error) {
    sendErrorFromException(res, error, 'CreateWatchList');
  }
});

// storage.ts - Assumes data is valid, focuses on DB operations
async createWatchList(userId: number, data: { name: string; description?: string }) {
  // Input validation only for IDs (defensive)
  this.validateUserId(userId);

  // Business rule validation (max lists per user)
  const countResult = await this.db.select({ count: count() })...;
  if (countResult.count >= 20) {
    throw new Error('Maximum watch list limit reached (20 lists per user)');
  }

  // Data already validated by Zod - proceed with insert
  return await this.db.insert(watchLists).values({
    userId,
    name: data.name,  // Already trimmed by Zod
    description: data.description || null,
  }).returning();
}
```

### Key Insight: Transform Order Matters

```typescript
// WRONG - Validates THEN transforms
name: z.string().min(1).trim()
// Input: "   "
// Step 1: min(1) sees "   " (length 3) -> PASSES
// Step 2: trim() produces "" -> User gets empty name saved!

// CORRECT - Transforms THEN validates
name: z.string().trim().min(1)
// Input: "   "
// Step 1: trim() produces ""
// Step 2: min(1) sees "" (length 0) -> FAILS with validation error
```

### Where Validation Should Live

| Layer | Validates | Examples |
|-------|-----------|----------|
| **Route (Zod)** | Input format, types, lengths, required fields | `z.string().trim().min(1).max(100)` |
| **Storage** | IDs are positive integers, defensive checks | `validateUserId(userId)` |
| **Storage** | Business rules involving DB state | Max 20 lists per user, no duplicates |

### Detection Rule for Code Review

```bash
# Find validation in storage layer that should be in routes
grep -rn "\.trim()\|\.length === 0\|\.length < " server/storage*.ts
```

---

## Pattern 3: Configuration Centralization

### Problem Statement

Magic numbers scattered throughout the codebase lead to:
1. Inconsistent values for the same concept
2. Difficult-to-change configuration
3. No documentation of what values mean
4. Harder code review (is "10" correct?)

### Solution: Centralize in constants.ts

All magic numbers MUST be in `server/utils/constants.ts` with clear naming and grouping.

#### Before (Anti-Pattern)

```typescript
// routes.ts - WRONG: Magic numbers in code
const limiter = createRateLimiter({
  windowMs: 60 * 1000,  // What does this mean? Why 60?
  max: 10,              // Is 10 too low? Too high?
  message: 'Too many requests'
});

// another-file.ts - Different values for same concept!
const anotherLimiter = createRateLimiter({
  windowMs: 120 * 1000,
  max: 15,
  message: 'Rate limit exceeded'
});
```

#### After (Correct Pattern)

```typescript
// constants.ts
/**
 * Watchlist-specific rate limiting configuration
 * Applied per-user (based on authenticated userId)
 */
export const WATCHLIST_RATE_LIMITS = {
  CREATE: {
    windowMs: 60 * 1000,  // 1 minute
    max: 10,
    message: 'Too many watch list creation attempts. Please try again later.'
  },
  PRODUCT_ADD: {
    windowMs: 60 * 1000,  // 1 minute
    max: 30,
    message: 'Too many product add attempts. Please try again later.'
  }
} as const;

// routes.ts
import { WATCHLIST_RATE_LIMITS } from "../utils/constants";

const watchlistCreateLimiter = createRateLimiter(WATCHLIST_RATE_LIMITS.CREATE);
const productAddLimiter = createRateLimiter(WATCHLIST_RATE_LIMITS.PRODUCT_ADD);
```

### Naming Conventions

```typescript
// Domain-specific constants
export const WATCHLIST_RATE_LIMITS = { ... } as const;
export const PRODUCT_CONSTANTS = { ... } as const;
export const USER_CONSTANTS = { ... } as const;

// Cross-cutting constants
export const CACHE_DURATION = { ... } as const;
export const PAGINATION = { ... } as const;
export const RATE_LIMIT = { ... } as const;
```

### Detection Rule for Code Review

```bash
# Find magic numbers in route files
grep -rn "windowMs:\|max:\|limit:\|timeout:" server/routes/ | grep -v constants
```

---

## Pattern 4: Database Error Classification

### Problem Statement

Database constraint violations (unique violations, foreign key errors) return generic 500 errors to users. This is:
1. Poor UX (user sees "Internal Server Error")
2. Information leakage (may expose constraint names)
3. Missing opportunity for helpful guidance

### Solution: Error Classification with PostgreSQL Codes

Detect specific PostgreSQL error codes and transform them into user-friendly 400-level errors.

```typescript
catch (error: unknown) {
  // Check if this is a database error with error code
  if (error instanceof Error && 'code' in error) {
    const dbError = error as { code?: string; constraint?: string };

    // PostgreSQL error code 23505 = unique_violation
    if (dbError.code === '23505') {
      // Defensive: Check multiple ways constraint info might be provided
      const constraintName = (dbError.constraint || '').toLowerCase();
      const errorMsg = error.message.toLowerCase();

      // Check both constraint name and error message (driver compatibility)
      if (constraintName.includes('unique_user_product') ||
          errorMsg.includes('unique_user_product') ||
          constraintName.includes('product_watch')) {

        // Log for debugging (includes constraint details)
        logger.warn('Duplicate product watch detected', {
          userId,
          watchListId,
          productId,
          constraint: dbError.constraint
        });

        // Return user-friendly error (400, not 500)
        throw new Error('Product already added to this watch list');
      }
    }
  }

  // Unknown error - let standard handler process it
  this.handleError(error, 'addProductToWatchList');
}
```

### PostgreSQL Error Codes Reference

| Code | Name | User Message | HTTP Status |
|------|------|--------------|-------------|
| `23505` | unique_violation | "This item already exists" | 400 |
| `23503` | foreign_key_violation | "Referenced item not found" | 400 |
| `23502` | not_null_violation | "Required field missing" | 400 |
| `23514` | check_violation | "Invalid value provided" | 400 |
| `40001` | serialization_failure | (Retry internally) | - |
| `40P01` | deadlock_detected | (Retry internally) | - |

### Detection Rule for Code Review

```bash
# Find catch blocks without error classification
grep -A 5 "catch (error" server/storage*.ts | grep -v "code.*23505\|handleError"
```

---

## Pattern 5: Middleware Ordering

### Problem Statement

Incorrect middleware ordering can cause:
1. Rate limiting without user context
2. CSRF checks after expensive operations
3. Authentication checks after data processing

### Solution: Security-First, Fast-Fail Ordering

```typescript
// CORRECT ORDER
app.post('/api/watchlists/:id/products',
  requireAuth,        // 1. Verify user exists (provides userId for rate limit)
  productAddLimiter,  // 2. Check rate limit (uses userId, fast rejection)
  csrfProtection,     // 3. Verify CSRF token (last security check)
  async (req, res) => {
    // 4. Business logic (only runs if all checks pass)
  }
);
```

### Why This Order

1. **Auth First**: Provides user context needed by rate limiter
2. **Rate Limit Second**: Fast rejection before expensive operations
3. **CSRF Third**: Final security check before processing
4. **Handler Last**: Business logic only when security is verified

### Anti-Pattern

```typescript
// WRONG - CSRF checked before we know who the user is
app.post('/api/watchlists',
  csrfProtection,     // Runs without knowing if user is authenticated
  requireAuth,        // Too late - CSRF already checked
  async (req, res) => {}
);

// WRONG - Rate limit can't use user context
app.post('/api/watchlists',
  productAddLimiter,  // Rate limits by IP only (less precise)
  requireAuth,        // User identified too late
  async (req, res) => {}
);
```

### Route Middleware Checklist

| Endpoint Type | Required Middleware Order |
|---------------|--------------------------|
| Public GET | (none or cache) |
| Authenticated GET | `requireAuth` |
| Authenticated POST/PUT/DELETE | `requireAuth, rateLimiter, csrfProtection` |
| High-risk mutation | `requireAuth, strictRateLimiter, csrfProtection` |

---

## Pattern 6: Defensive Constraint Detection

### Problem Statement

Different database drivers and Drizzle versions may provide constraint violation information differently. Checking only one source can miss violations.

### Solution: Multi-Source Constraint Detection

```typescript
if (dbError.code === '23505') {
  // Check MULTIPLE sources of constraint information
  const constraintName = (dbError.constraint || '').toLowerCase();
  const errorMsg = error.message.toLowerCase();

  // Pattern: Check constraint name AND error message
  if (constraintName.includes('unique_user_product') ||
      errorMsg.includes('unique_user_product') ||
      constraintName.includes('product_watch')) {
    // Handle the specific constraint violation
    throw new Error('Product already added');
  }
}
```

### Why Multiple Checks

1. **Driver Differences**: Some drivers populate `constraint`, others don't
2. **Drizzle Abstraction**: Error wrapping may lose properties
3. **Future Compatibility**: New drivers may change behavior
4. **Robustness**: Multiple checks are more reliable than single check

### Implementation Pattern

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

---

## Review Checklist

When reviewing code, check for these Phase 0 patterns:

### Database Constraints
- [ ] Nullable columns in UNIQUE constraints have partial index for NULL case
- [ ] Migration comments explain constraint purpose
- [ ] Constraint error handling returns 400, not 500

### Validation
- [ ] Input validation happens at route layer (Zod schemas)
- [ ] Zod transforms (`.trim()`) come BEFORE validators (`.min()`)
- [ ] Storage layer only validates IDs and business rules
- [ ] No duplicate validation between layers

### Configuration
- [ ] No magic numbers in route files
- [ ] Rate limits defined in `WATCHLIST_RATE_LIMITS` or domain-specific constant
- [ ] Constant names are descriptive and grouped logically

### Error Handling
- [ ] PostgreSQL error codes (23505, 23503) are classified
- [ ] Constraint violations return user-friendly messages
- [ ] Errors are logged with context before transformation
- [ ] Multiple constraint detection methods used (defensive)

### Middleware
- [ ] Order is: `requireAuth -> rateLimiter -> csrfProtection -> handler`
- [ ] Auth provides context for rate limiting
- [ ] Fast-fail checks (rate limit) before expensive operations

### Code Quality
- [ ] Comments explain WHY, not WHAT
- [ ] Error messages are user-friendly
- [ ] Logging includes context (userId, watchListId, etc.)
- [ ] WebSocket events don't fail the operation if emit fails

---

## Related Documentation

- [DATABASE_PATTERNS.md](DATABASE_PATTERNS.md) - Query patterns, transactions
- [VALIDATION_PATTERNS.md](VALIDATION_PATTERNS.md) - Storage layer validation
- [ERROR_HANDLING_PATTERNS.md](ERROR_HANDLING_PATTERNS.md) - Error response patterns
- [API_PATTERNS.md](API_PATTERNS.md) - Route organization, middleware
- [SECURITY_PATTERNS.md](SECURITY_PATTERNS.md) - CSRF, authentication

---

## Implementation Reference

**Migration**: `migrations/0019_fix_product_watches_unique_constraint.sql`
**Routes**: `server/routes/watchlist-routes.ts`
**Storage**: `server/storage/domains/watchlist-storage.ts`
**Constants**: `server/utils/constants.ts`
