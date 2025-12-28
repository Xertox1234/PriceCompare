# TODO 014: Fix Remaining 26 Test Failures (Non-WebSocket)

**Priority**: P2
**File(s)**:
- `server/test/basic-auth.test.ts` (4 failures)
- `server/middleware/__tests__/redis-rate-limiter.integration.test.ts` (14 failures)
- `server/__tests__/watchlist-routes.test.ts` (3 failures)
- `server/__tests__/agents/coordinator-transaction.test.ts` (5 failures)

**Estimated Time**: 3-4 hours
**Status**: Not Started

## Problem Statement

After resolving 44 test failures in TODO 013, **26 failures remain** with different root causes:

**Current Test Status**:
- Test Files: 4 failed | 67 passed | 5 skipped (76)
- Tests: 26 failed | 1,656 passed | 58 skipped (1,742)
- **Pass Rate**: 98.5%

**Goal**: Achieve 99%+ pass rate (< 10 failures) by fixing these categorized failures.

## Root Causes (Categorized)

### 1. Basic Auth Tests (4 failures) - Quick Win 🟢

**File**: `server/test/basic-auth.test.ts`

**Failures**:
- `locks account after multiple failed attempts` - Expected 403, behavior unclear
- `allows Basic Auth in development over HTTP` - Expected 200, got 403
- `Authenticated request to status endpoint works` - Expected 200, got 403
- `returns correct response structure on success` - 403 Forbidden error

**Root Cause**: Basic auth functionality not working in test environment

**Likely Issues**:
- Test environment not properly configured for `/api/v1/scraping/*` routes
- Basic auth middleware not being applied to test routes
- Environment variable check (`NODE_ENV !== 'production'`) not working
- Test user creation/credentials mismatch

**Fix Complexity**: LOW (likely config/setup issue)

---

### 2. Redis Rate Limiter Tests (14 failures) - Moderate Fix 🟡

**File**: `server/middleware/__tests__/redis-rate-limiter.integration.test.ts`

**Failures**:
- `sets X-RateLimit-Limit header` - Expected '100', got '999999'
- `sets X-RateLimit-Remaining header` - Expected 99, got 999999
- `sets X-RateLimit-Reset header` - Timestamp issue
- `sets X-RateLimit-Tier header for anonymous users` - Expected 'free', got 'test'
- `sets X-RateLimit-Tier header for authenticated admin users` - Expected 'admin', got 'test'
- `blocks requests after limit exceeded` - Expected 429, got 200
- `gives authenticated users higher limits` - Not enforcing limits
- `gives premium users significantly higher limits` - Not enforcing limits
- `includes Retry-After header when limit exceeded` - No rate limiting
- `includes error message in response body` - No 429 response
- `includes tier information in headers when rate limited` - No rate limiting
- `uses default error message when none provided` - No rate limiting
- `uses custom key generator when provided` - Not tested properly
- `respects custom tier limits when provided` - Getting test tier override

**Root Cause**: Test environment detection overriding rate limiter behavior

**Likely Issues**:
- Rate limiter middleware detecting test environment (`NODE_ENV === 'test'`)
- Setting limits to 999999 to "disable" rate limiting in tests
- Tier defaulting to 'test' instead of using actual user tier
- Tests expecting production behavior but getting test overrides

**Evidence**:
```
Rate limit: 999999 instead of 100 (test env override)
Tier: 'test' instead of 'free'/'admin'
Requests not blocked (expected 429, got 200)
```

**Fix Complexity**: MODERATE (need to configure test environment properly)

---

### 3. Watchlist Routes Tests (3 failures) - Quick Win 🟢

**File**: `server/__tests__/watchlist-routes.test.ts`

**Failures**:
- `should return user watch lists` - Expected 2 watchlists, got 3
- `should return empty array when user has no lists` - Likely has leftover data
- `should return dashboard statistics` - Stats contaminated by extra watchlist

**Root Cause**: Test data contamination - data from previous tests persisting

**Likely Issues**:
- `afterEach` cleanup using `db.delete()` instead of `TRUNCATE CASCADE`
- Watchlists created in one test visible in subsequent tests
- Foreign key constraints causing incomplete cleanup
- Auto-increment IDs not resetting between tests

**Fix**: Use proper test cleanup pattern from `docs/02_DATABASE_PATTERNS.md`:

```typescript
afterEach(async () => {
  await db.execute(sql`TRUNCATE TABLE watch_lists RESTART IDENTITY CASCADE`);
  await db.execute(sql`TRUNCATE TABLE users RESTART IDENTITY CASCADE`);
});
```

**Fix Complexity**: LOW (standard test cleanup pattern)

---

### 4. Agent Coordinator Tests (5 failures) - Complex Fix 🔴

**File**: `server/__tests__/agents/coordinator-transaction.test.ts`

**Failures**:
- `creates product and links to trending product atomically`
- `handles null product data gracefully in transaction`
- `independent transactions do not interfere`
- `rolls back product creation if trending update fails`
- `transaction with multiple updates commits all or none`

**Root Cause**: Transaction atomicity issues

**Likely Issues**:
- Transactions not properly isolated
- Race conditions between test transactions
- Transaction rollback not working as expected
- Database connection pooling issues in tests
- SERIALIZABLE isolation level not applied where needed

**Fix Complexity**: HIGH (requires transaction debugging)

---

## Implementation Plan

### Phase 1: Quick Wins (1-1.5 hours)

Fix the easy issues first to improve pass rate quickly.

#### Step 1: Fix Watchlist Routes Test Cleanup (30 min)

```bash
# Run specific test to see current failures
npm test -- server/__tests__/watchlist-routes.test.ts --reporter=verbose
```

**Fix**:
- [ ] Read `server/__tests__/watchlist-routes.test.ts`
- [ ] Replace `db.delete()` cleanup with `TRUNCATE CASCADE`
- [ ] Add proper cleanup order (child tables before parent tables)
- [ ] Verify tests pass

**Expected Pattern**:
```typescript
afterEach(async () => {
  // Order: child tables first, then parent tables
  await db.execute(sql`TRUNCATE TABLE watch_list_products RESTART IDENTITY CASCADE`);
  await db.execute(sql`TRUNCATE TABLE watch_lists RESTART IDENTITY CASCADE`);
  await db.execute(sql`TRUNCATE TABLE users RESTART IDENTITY CASCADE`);
  await db.execute(sql`TRUNCATE TABLE products RESTART IDENTITY CASCADE`);
});
```

#### Step 2: Fix Basic Auth Tests (30-45 min)

```bash
# Run specific test to see actual errors
npm test -- server/test/basic-auth.test.ts --reporter=verbose
```

**Investigation**:
- [ ] Check if `/api/v1/scraping/*` routes exist and are registered
- [ ] Verify basic auth middleware is applied to these routes
- [ ] Check test user credentials match what auth expects
- [ ] Verify `NODE_ENV` is set correctly in tests
- [ ] Check if route requires additional middleware (session, CSRF, etc.)

**Likely Fix Options**:
1. **Missing route registration**: Routes not mounted in test app
2. **Middleware not applied**: Basic auth middleware not on route chain
3. **Credential mismatch**: Test password hashing issue
4. **Additional middleware required**: Session or other middleware blocking

---

### Phase 2: Rate Limiter Configuration (1-1.5 hours)

#### Step 3: Configure Rate Limiter for Test Environment (1-1.5 hours)

```bash
# Run rate limiter tests to see behavior
npm test -- server/middleware/__tests__/redis-rate-limiter.integration.test.ts --reporter=verbose
```

**Investigation**:
- [ ] Read `server/middleware/redis-rate-limiter.ts`
- [ ] Find where test environment is detected
- [ ] Identify where 999999 limit is set
- [ ] Determine where 'test' tier is assigned

**Likely Issue Location**:
```typescript
// Somewhere in redis-rate-limiter.ts
if (process.env.NODE_ENV === 'test') {
  return {
    limit: 999999, // ← This disables rate limiting
    tier: 'test',  // ← This overrides user tier
  };
}
```

**Fix Options**:

**Option A**: Use environment variable to control test behavior
```typescript
// In test file beforeAll
process.env.ENABLE_RATE_LIMITING_IN_TESTS = 'true';

// In middleware
if (process.env.NODE_ENV === 'test' && !process.env.ENABLE_RATE_LIMITING_IN_TESTS) {
  return { limit: 999999, tier: 'test' };
}
```

**Option B**: Remove test environment override entirely
```typescript
// Delete the test environment check - let tests use real limits
// Tests should configure limits explicitly via options
```

**Option C**: Make tests use middleware options to override
```typescript
// In test
const limiter = createRateLimiter({
  limits: { free: 100, authenticated: 500, admin: 5000 },
  skipEnvCheck: true, // ← Force real limits even in test env
});
```

**Recommended**: Option B (remove test override, tests should configure explicitly)

---

### Phase 3: Transaction Issues (1-2 hours)

#### Step 4: Debug Agent Coordinator Transactions (1-2 hours)

```bash
# Run coordinator tests with verbose output
npm test -- server/__tests__/agents/coordinator-transaction.test.ts --reporter=verbose
```

**Investigation**:
- [ ] Read test file to understand what's being tested
- [ ] Check if transactions use `SERIALIZABLE` isolation where needed
- [ ] Verify transaction boundaries (all DB operations inside `db.transaction()`)
- [ ] Check for race conditions (parallel transactions interfering)
- [ ] Verify rollback behavior (errors should rollback all changes)

**Common Transaction Issues**:

1. **Missing SERIALIZABLE isolation**:
```typescript
// ❌ BAD - default isolation might allow race conditions
await db.transaction(async (tx) => {
  const product = await tx.select().from(products).where(...);
  await tx.insert(trendingProducts).values({ productId: product.id });
});

// ✅ GOOD - SERIALIZABLE prevents race conditions
await db.transaction(async (tx) => {
  const product = await tx.select().from(products).where(...);
  await tx.insert(trendingProducts).values({ productId: product.id });
}, { isolationLevel: 'serializable' });
```

2. **Operations outside transaction**:
```typescript
// ❌ BAD - product insert not atomic with trending insert
const product = await db.insert(products).values(...);
await db.transaction(async (tx) => {
  await tx.insert(trendingProducts).values({ productId: product.id });
});

// ✅ GOOD - both operations in same transaction
await db.transaction(async (tx) => {
  const product = await tx.insert(products).values(...);
  await tx.insert(trendingProducts).values({ productId: product.id });
});
```

3. **Test isolation issues**:
```typescript
// Need proper cleanup between tests
afterEach(async () => {
  await db.execute(sql`TRUNCATE TABLE trending_products RESTART IDENTITY CASCADE`);
  await db.execute(sql`TRUNCATE TABLE products RESTART IDENTITY CASCADE`);
});
```

**Fix Steps**:
- [ ] Ensure all DB operations are inside transaction
- [ ] Add `isolationLevel: 'serializable'` for check-then-act patterns
- [ ] Add proper test cleanup with TRUNCATE CASCADE
- [ ] Verify rollback behavior with intentional errors

---

## Success Criteria

### Primary Goals
- [ ] **Watchlist routes tests**: 3/3 passing (data cleanup fixed)
- [ ] **Basic auth tests**: 4/4 passing (auth setup fixed)
- [ ] **Rate limiter tests**: 14/14 passing (test env config fixed)
- [ ] **Agent coordinator tests**: 5/5 passing (transactions fixed)

### Target Metrics
- [ ] **Test Pass Rate**: 99%+ (< 10 failures out of 1,742 tests)
- [ ] **Test Files**: 70+ passing out of 76
- [ ] **No Regressions**: All previously passing tests still pass

### Exit Criteria
- ✅ All 26 targeted failures resolved
- ✅ Full test suite runs clean (< 10 failures)
- ✅ CI workflow passes on PR
- ✅ Patterns documented if new issues discovered

---

## Context

**Related TODOs**:
- TODO 013 - Resolved 44/70 failures (WebSocket auth + client hook issues)

**Why These Were Separated**:
These 26 failures have completely different root causes from TODO 013:
- Different files (non-WebSocket tests)
- Different issues (auth, rate limiting, test cleanup, transactions)
- Different complexity levels (quick wins vs complex debugging)

**Business Impact**:
- Low urgency - doesn't block feature development
- Medium importance - improves CI reliability
- Target: 99%+ pass rate for confidence in test suite

---

## Notes

### Failure Breakdown by Complexity

**Quick Wins** (7 failures, 1-1.5 hours):
- ✅ Watchlist routes: 3 failures (test cleanup)
- ✅ Basic auth: 4 failures (config/setup)

**Moderate** (14 failures, 1-1.5 hours):
- 🟡 Rate limiter: 14 failures (test env config)

**Complex** (5 failures, 1-2 hours):
- 🔴 Agent coordinator: 5 failures (transaction debugging)

### Investigation Log

_Add notes as you investigate_

**2025-12-28**: Created TODO after TODO 013 resolved 44/70 failures
- Remaining failures categorized by root cause
- Complexity estimated for each category
- Implementation plan prioritizes quick wins
