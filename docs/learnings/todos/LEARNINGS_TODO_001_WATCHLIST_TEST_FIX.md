# Learnings: TODO 001 - Watchlist Routes Test Isolation Fix

**Date**: 2025-12-02
**Issue**: All 32 tests in `server/__tests__/watchlist-routes.test.ts` failing due to database state leaking between tests
**Status**: ✅ Resolved - All 32 tests passing consistently

## Problem Summary

The watchlist routes test suite had **100% test failure rate** (32/32 tests failing) due to:
1. **Database cleanup ineffective** - Using `db.delete()` which doesn't reset auto-increment sequences
2. **ID collisions** - IDs incrementing across tests causing foreign key violations
3. **Missing Redis mock** - Tests failing to initialize because Redis client was required but not mocked
4. **Password validation** - Test setup failing because test password didn't meet validation requirements

## Root Causes

### 1. Incomplete Database Cleanup
```typescript
// ❌ WRONG - Old cleanup approach (lines 114-119, 179-184)
await db.delete(productWatches);
await db.delete(watchLists);
await db.delete(productOffers);
await db.delete(products);
await db.delete(retailers);
await db.execute(sql`TRUNCATE TABLE users RESTART IDENTITY CASCADE`);
```

**Issues**:
- `db.delete()` removes records but **doesn't reset auto-increment sequences**
- IDs continue from previous tests (e.g., user ID 1, 2, 3... across tests)
- Causes unpredictable state and foreign key violations
- Requires exact foreign key order or fails

### 2. Missing Redis Mock
```typescript
// Error: Redis client not available
// at AdvancedCacheService.getRedis server/services/advanced-cache.ts:250:13
```

The storage-cache service requires Redis, but tests didn't mock the Redis client.

### 3. Password Validation Requirements
```typescript
// ❌ WRONG - Password missing special character
password: 'SecurePass123'  // Fails: "Password must contain at least one special character"

// ✅ CORRECT
password: 'SecurePass123!'  // Has: uppercase, lowercase, number, special char
```

## Solution Implemented

### Fix 1: TRUNCATE CASCADE Cleanup Strategy

```typescript
/**
 * Database Cleanup Strategy:
 * - Use TRUNCATE CASCADE for fast, reliable cleanup
 * - RESTART IDENTITY resets auto-increment sequences to 1
 * - CASCADE automatically handles foreign key relationships
 * - Order: children → parents (respects foreign keys)
 */
await db.execute(sql`TRUNCATE TABLE product_watches RESTART IDENTITY CASCADE`);
await db.execute(sql`TRUNCATE TABLE watch_lists RESTART IDENTITY CASCADE`);
await db.execute(sql`TRUNCATE TABLE product_offers RESTART IDENTITY CASCADE`);
await db.execute(sql`TRUNCATE TABLE products RESTART IDENTITY CASCADE`);
await db.execute(sql`TRUNCATE TABLE retailers RESTART IDENTITY CASCADE`);
await db.execute(sql`TRUNCATE TABLE users RESTART IDENTITY CASCADE`);
```

**Benefits**:
- ✅ Resets auto-increment sequences (IDs always start at 1)
- ✅ Handles foreign keys automatically with CASCADE
- ✅ Atomic operation (all-or-nothing)
- ✅ Faster than DELETE for large datasets
- ✅ Predictable test state

### Fix 2: Mock Redis Client

```typescript
// Mock Redis client to avoid requiring Redis in test environment
vi.mock('../config/redis', () => ({
  redisClient: {
    get: vi.fn(),
    setex: vi.fn(),
    del: vi.fn(),
    keys: vi.fn(),
    scan: vi.fn(),
    publish: vi.fn(),
    duplicate: vi.fn(() => ({
      subscribe: vi.fn(),
      on: vi.fn(),
      quit: vi.fn(),
    })),
  },
}));
```

**Why this works**:
- Provides all Redis methods used by `AdvancedCacheService`
- Allows tests to run without actual Redis instance
- Follows pattern from `server/__tests__/advanced-cache.test.ts`

### Fix 3: Fix Password Validation

```typescript
password: 'SecurePass123!', // Must have special character for password validation
```

## Key Insights

### 1. TRUNCATE CASCADE vs DELETE

| Aspect | `db.delete()` | `TRUNCATE ... RESTART IDENTITY CASCADE` |
|--------|---------------|----------------------------------------|
| Resets sequences | ❌ No | ✅ Yes |
| Foreign keys | ❌ Manual order required | ✅ CASCADE handles automatically |
| Speed | 🐌 Slower | ⚡ Faster |
| Atomicity | ❌ Per-table | ✅ All-or-nothing |
| Test isolation | ❌ Poor (IDs increment) | ✅ Perfect (IDs reset) |

### 2. Test Isolation Anti-Patterns

**Anti-Pattern**: Using `db.delete()` in integration tests
- IDs increment across tests
- Foreign key order dependencies
- Unpredictable state

**Best Practice**: Use `TRUNCATE ... RESTART IDENTITY CASCADE`
- Clean slate every test
- Predictable IDs
- No foreign key order issues

### 3. Password Validation Requirements

The `validatePassword()` function requires:
- ✅ Minimum 8 characters
- ✅ At least one uppercase letter
- ✅ At least one lowercase letter
- ✅ At least one number
- ✅ At least one special character (!@#$%^&*(),.?":{}|<>)

**Always check validation errors in test setup** - registration failures manifest as undefined response properties.

## Testing Results

### Before Fix
```
❌ 32 tests failing (100% failure rate)
❌ Error: Cannot read properties of undefined (reading 'user')
❌ Error: Redis client not available
❌ Error: Password must contain at least one special character
```

### After Fix
```
✅ Run 1: 32/32 tests passed (14.51s)
✅ Run 2: 32/32 tests passed (13.38s)
✅ Run 3: 32/32 tests passed (13.60s)
✅ Consistent results across runs
✅ No database state leaking
✅ No foreign key violations
```

## Files Modified

1. **server/__tests__/watchlist-routes.test.ts**:
   - Added Redis client mock (lines 30-45)
   - Replaced `db.delete()` with `TRUNCATE CASCADE` in `beforeEach` (lines 120-125)
   - Replaced `db.delete()` with `TRUNCATE CASCADE` in `afterEach` (lines 188-193)
   - Fixed test password to include special character (line 151)

## Applying This Pattern to Other Tests

### Checklist for Integration Test Cleanup

- [ ] **Use TRUNCATE CASCADE** for all database cleanup
  ```typescript
  await db.execute(sql`TRUNCATE TABLE table_name RESTART IDENTITY CASCADE`);
  ```

- [ ] **Mock Redis** if using storage-cache or advanced-cache
  ```typescript
  vi.mock('../config/redis', () => ({
    redisClient: { /* mock methods */ }
  }));
  ```

- [ ] **Use valid test passwords** that meet validation requirements
  ```typescript
  password: 'SecurePass123!', // uppercase + lowercase + number + special
  ```

- [ ] **Add cleanup comments** explaining the strategy
  ```typescript
  /**
   * Database Cleanup Strategy:
   * - TRUNCATE CASCADE resets sequences and handles foreign keys
   * - Ensures clean state between tests
   */
  ```

- [ ] **Test consistency** - Run suite 3+ times to verify no flakiness

### Order for TRUNCATE CASCADE

Always truncate in child → parent order to respect foreign keys:
1. Join tables (product_watches, price_alerts, etc.)
2. Child tables with foreign keys (product_offers, price_history, etc.)
3. Parent tables (products, retailers, users)

## Related Patterns

- **Database Patterns**: See `docs/02_DATABASE_PATTERNS.md` for transaction boundaries and N+1 prevention
- **Test Patterns**: See `docs/03_API_PATTERNS.md` for API testing patterns
- **Security Patterns**: See `docs/04_SECURITY_PATTERNS.md` for password validation requirements

## Future Improvements

1. **Shared test utilities**: Extract TRUNCATE CASCADE cleanup into reusable helper
2. **Test database seeding**: Create shared fixtures for common test data
3. **Parallel test execution**: Ensure tests can run in parallel without conflicts
4. **Performance**: Consider using transactions with rollback for faster cleanup

## Lessons Learned

1. **Always reset sequences** - Use `RESTART IDENTITY` to ensure predictable test state
2. **Mock external dependencies** - Redis, email services, etc. should be mocked in tests
3. **Check validation requirements** - Test data must meet production validation rules
4. **Test consistency** - Run multiple times to catch intermittent failures
5. **Document cleanup strategy** - Future developers need to understand the approach

---

## Follow-Up: Application Bug Fixes

After completing the test isolation fixes, code review discovered **two application bugs** where validation/constraint errors were returning 500 instead of proper 4xx status codes:

1. **Empty name validation** - Returned 500, now returns 400
2. **Duplicate product constraint** - Returned 500, now returns 409

**See**: `docs/LEARNINGS_WATCHLIST_ERROR_HANDLING_FIXES.md` for complete details on:
- ZodError detection in `sendErrorFromException` (global fix)
- PostgreSQL constraint error handling patterns
- HTTP status code hierarchy (4xx vs 5xx)
- Layered error handling architecture

**Impact**: These fixes improved error handling consistency across the entire application, not just watchlist routes.

---

**Completion Time**: ~45 minutes (investigation + fixes + verification)
**Original Estimate**: 2-3 hours
**Test Success Rate**: 0% → 100% ✅
**Bonus**: Fixed 2 application bugs discovered during code review
