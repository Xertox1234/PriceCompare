# Phase 0 Patterns - Quick Reference

**Use this guide when:** Implementing similar features or reviewing code for Phase 1+

---

## Pattern 1: NULL-Safe UNIQUE Constraints

**When:** UNIQUE constraint includes a nullable foreign key

**Problem:**
```sql
-- ❌ WRONG - Allows duplicates when fk IS NULL
UNIQUE(user_id, product_id, nullable_fk)
```

**Solution:**
```sql
-- ✅ CORRECT - Dual constraint approach
-- Partial index for NULL case
CREATE UNIQUE INDEX idx_name_no_fk
  ON table_name(user_id, product_id)
  WHERE nullable_fk IS NULL;

-- Standard constraint for non-NULL case
ALTER TABLE table_name
  ADD CONSTRAINT unique_with_fk
  UNIQUE(user_id, product_id, nullable_fk);
```

**Check:** `grep -r "UNIQUE.*nullable" migrations/`

---

## Pattern 2: Validation Layer Separation

**When:** Adding input validation to routes

**Storage Layer (Business Logic Only):**
```typescript
// ❌ WRONG - Don't validate format in storage
if (data.name.trim().length === 0) throw new Error('...');

// ✅ CORRECT - Assume validated data
async create(data: ValidatedData) {
  // Business logic only (max limits, ownership, etc.)
  if (count >= MAX_ITEMS) throw new Error('Limit reached');
  return await db.insert(...);
}
```

**Route Layer (Input Validation):**
```typescript
// ✅ CORRECT - Validate with Zod
const schema = z.object({
  name: z.string().trim().min(1).max(100)  // Transform → Validate
});

app.post('/route', async (req, res) => {
  const data = schema.parse(req.body);  // Throws on invalid
  await storage.create(data);
});
```

**Check:** `grep "trim()\|\.length" server/storage/` (should be minimal)

---

## Pattern 3: Zod Transform Ordering

**Critical Rule:** Transform BEFORE validate

```typescript
// ❌ WRONG - Validates then transforms
z.string().min(1).trim()  // "   " passes min(1), then becomes ""

// ✅ CORRECT - Transforms then validates
z.string().trim().min(1)  // "   " becomes "", fails min(1)
```

**Order of Operations:**
1. `.trim()` - Remove whitespace
2. `.min(1)` - Check minimum length
3. `.max(100)` - Check maximum length

**Check:** `grep "\.min.*\.trim\|\.max.*\.trim" server/routes/`

---

## Pattern 4: Configuration Centralization

**When:** Adding rate limits, timeouts, limits, or any magic number

**Anti-pattern:**
```typescript
// ❌ WRONG - Magic numbers in code
const limiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 10
});
```

**Correct Pattern:**
```typescript
// constants.ts
export const FEATURE_RATE_LIMITS = {
  CREATE: { windowMs: 60 * 1000, max: 10 },
  UPDATE: { windowMs: 60 * 1000, max: 30 }
} as const;

// routes.ts
import { FEATURE_RATE_LIMITS } from '../utils/constants';
const limiter = createRateLimiter(FEATURE_RATE_LIMITS.CREATE);
```

**Check:** `grep -E "windowMs|max.*:.*[0-9]" server/routes/` (should import from constants)

---

## Pattern 5: Database Error Classification

**When:** Catching database errors in storage layer

**Anti-pattern:**
```typescript
// ❌ WRONG - Generic 500 error for all DB errors
catch (error) {
  this.handleError(error, 'operation');  // Always 500
}
```

**Correct Pattern:**
```typescript
// ✅ CORRECT - Classify by error code
catch (error: unknown) {
  if (error instanceof Error && 'code' in error) {
    const dbError = error as { code?: string; constraint?: string };

    if (dbError.code === '23505') {  // Unique violation
      // Defensive: check multiple sources
      const constraint = (dbError.constraint || '').toLowerCase();
      const msg = error.message.toLowerCase();

      if (constraint.includes('unique_key') || msg.includes('unique_key')) {
        logger.warn('Duplicate detected', { context });
        throw new Error('Already exists');  // → 400 error
      }
    }

    if (dbError.code === '23503') {  // Foreign key violation
      throw new Error('Referenced record not found');  // → 400
    }
  }

  this.handleError(error, 'operation');  // Unknown → 500
}
```

**PostgreSQL Error Codes:**
- `23505` - Unique violation (duplicate) → 400
- `23503` - Foreign key violation (missing parent) → 400
- `23502` - Not null violation (required field) → 400
- `23514` - Check constraint (invalid value) → 400

**Check:** `grep "23505\|23503\|23502" server/storage/`

---

## Pattern 6: Middleware Ordering

**When:** Adding middleware to routes

**Correct Order:**
```typescript
app.post('/route',
  requireAuth,       // 1. Verify user exists (provides userId)
  rateLimiter,       // 2. Check rate limit (uses userId from step 1)
  csrfProtection,    // 3. Verify CSRF token (fast, fails early)
  async (req, res) => {}  // 4. Business logic
);
```

**Why This Order:**
1. **Auth first** - Provides user context for downstream middleware
2. **Rate limit second** - Uses authenticated user ID for per-user limits
3. **CSRF third** - Lightweight token check before heavy processing
4. **Handler last** - Only runs if all security checks pass

**Anti-pattern:**
```typescript
// ❌ WRONG - CSRF before rate limiting
app.post('/route', requireAuth, csrfProtection, rateLimiter, handler);

// ❌ WRONG - Rate limiting before auth
app.post('/route', rateLimiter, requireAuth, csrfProtection, handler);
```

**Check:** Middleware should be in this exact order on all mutating routes

---

## Pattern 7: Defensive Constraint Detection

**When:** Detecting constraint violations from database errors

**Why Needed:** Different PostgreSQL drivers provide constraint info differently

**Anti-pattern:**
```typescript
// ❌ WRONG - Single source check
if (dbError.constraint === 'unique_constraint_name') {
  // What if driver doesn't provide .constraint field?
}
```

**Correct Pattern:**
```typescript
// ✅ CORRECT - Check multiple sources
const constraintName = (dbError.constraint || '').toLowerCase();
const errorMsg = error.message.toLowerCase();

if (constraintName.includes('unique_key') ||
    errorMsg.includes('unique_key') ||
    constraintName.includes('table_name')) {
  // Handle constraint violation
}
```

**Benefits:**
- Works across different PostgreSQL drivers (pg, neon, etc.)
- Handles cases where `.constraint` field is undefined
- More resilient to driver implementation changes

**Check:** Constraint violation handlers should check multiple sources

---

## Quick Checklist for New Features

Use this before committing:

- [ ] Nullable columns in UNIQUE constraints? → Use partial index
- [ ] Validation in storage layer? → Move to route layer (Zod)
- [ ] Zod `.trim()` after `.min()`? → Fix order (trim first)
- [ ] Magic numbers in routes? → Move to constants.ts
- [ ] Database errors returning 500? → Classify by error code
- [ ] Middleware not in order? → auth → rate → CSRF → handler
- [ ] Single-source constraint check? → Check multiple sources
- [ ] Rate limiting on creation endpoints? → Add limiters
- [ ] CSRF protection on mutations? → Add csrfProtection
- [ ] Using standardized responses? → sendSuccess/sendError

---

## Common Mistakes to Avoid

### ❌ Mistake 1: Wrong Zod Order
```typescript
z.string().min(1).trim()  // Validates before trimming
```
**Fix:** `z.string().trim().min(1)`

### ❌ Mistake 2: Validation in Storage
```typescript
// In storage layer
if (!data.name || data.name.trim().length === 0) throw new Error(...);
```
**Fix:** Move to route layer Zod schema

### ❌ Mistake 3: Magic Numbers
```typescript
const limiter = createRateLimiter({ max: 10 });
```
**Fix:** Import from constants.ts

### ❌ Mistake 4: Generic Database Errors
```typescript
catch (error) { return 500; }
```
**Fix:** Check error.code and return appropriate 400/500

### ❌ Mistake 5: Wrong Middleware Order
```typescript
app.post('/route', rateLimiter, requireAuth, ...);
```
**Fix:** requireAuth → rateLimiter → csrfProtection

---

## Testing Patterns

### Test Validation at Route Level
```typescript
// ✅ Test Zod schemas via HTTP requests
it('should reject empty name', async () => {
  const res = await request(app)
    .post('/api/resource')
    .send({ name: '   ' });  // Spaces only

  expect(res.status).toBe(400);
  expect(res.body.error).toContain('required');
});
```

### Test Business Logic at Storage Level
```typescript
// ✅ Test business rules directly
it('should enforce max limit', async () => {
  await expect(
    storage.create(userId, validData)  // After 20 items
  ).rejects.toThrow('Maximum limit');
});
```

### Test Database Constraints
```typescript
// ✅ Test constraint enforcement
it('should prevent duplicates', async () => {
  await storage.create(userId, { productId: 1 });

  await expect(
    storage.create(userId, { productId: 1 })  // Same product
  ).rejects.toThrow('already added');
});
```

---

## Reference Files

**Read these before implementing:**
- `docs/PHASE0_WATCHLIST_PATTERNS.md` - Full pattern documentation
- `docs/DATABASE_PATTERNS.md` - NULL-safe constraints
- `docs/VALIDATION_PATTERNS.md` - Layer separation
- `docs/ERROR_HANDLING_PATTERNS.md` - PostgreSQL error codes

**Review checklist:**
- `.claude/agents/code-review-specialist.md` - Auto-checks these patterns

**Example implementation:**
- `server/routes/watchlist-routes.ts` - Reference route implementation
- `server/storage/domains/watchlist-storage.ts` - Reference storage implementation
- `migrations/0019_fix_product_watches_unique_constraint.sql` - Reference migration

---

## Questions?

**Check pattern files first:**
1. Is my question about constraints? → `docs/DATABASE_PATTERNS.md`
2. About validation? → `docs/VALIDATION_PATTERNS.md`
3. About error handling? → `docs/ERROR_HANDLING_PATTERNS.md`
4. About all Phase 0 patterns? → `docs/PHASE0_WATCHLIST_PATTERNS.md`

**Still stuck?** Review the reference implementation files listed above.

---

**Last Updated:** 2025-11-28
**Phase:** 0 (Critical Bug Fixes)
**Status:** Complete ✅
