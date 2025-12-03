# Test Fixes TODO - Comprehensive Plan

**Created**: 2025-12-02
**Status**: In Progress
**Priority**: High - Blocking Dependabot PRs

## Overview

Fix 68+ failing tests across 5 test suites. Root cause: Test isolation problems causing database state to leak between tests.

## Test Failure Summary

| Test Suite | Failures | Root Cause | Priority |
|------------|----------|------------|----------|
| `watchlist-routes.test.ts` | 32 | Database cleanup issues | P0 - Critical |
| `alert-routes.test.ts` | 29 | Database cleanup issues | P0 - Critical |
| `storage-watchlist.test.ts` | 3 | Test expectations don't account for default watchlist | P1 - High |
| `price-aggregation-service.test.ts` | 4 | Mock database method issues | P2 - Medium |
| `auth-routes.test.ts` | 1 | Token expiration timing | P2 - Medium |
| `product-routes.test.ts` | 2 | Discussion count missing from queries | P2 - Medium |

**Total**: 71 failing tests

## Root Cause Analysis

### 1. Test Isolation Problems (Primary Issue)

**Symptoms**:
- Tests expect specific counts but get different values
- Example: Expect 2 watch lists, receive 3
- Example: Expect empty array, receive 1 item
- Tests fail when run as suite but may pass individually

**Root Causes**:
- `beforeEach` database cleanup not running properly
- Foreign key constraints preventing proper cleanup
- Data persisting across test runs
- Possible test execution order dependencies

**Evidence from CI logs**:
```
AssertionError: expected [ { id: 1, userId: 1, … }, …(2) ] to have a length of 2 but got 3
AssertionError: expected [ { id: 1, userId: 1, … } ] to deeply equal []
```

### 2. Default Watchlist Auto-Creation

**Symptoms**:
- Users have 1 watchlist when tests expect 0
- Watchlist has `isDefault: true` and name "Default watch list"

**Evidence**:
```json
{
  "description": "Default watch list",
  "isDefault": true,
  "name": "My Watchlist",
  "userId": 1
}
```

**Investigation Needed**:
- [ ] Check if default watchlist is created on user registration
- [ ] Check if it's created on first `getUserWatchLists` call
- [ ] Review watchlist storage layer for auto-creation logic

### 3. Mock Database Issues

**Symptoms**:
- Error: `this.db.select(...).from(...).limit is not a function`
- Tests try to mock database but mock chain is incomplete

**Affected Tests**:
- `price-aggregation-service.test.ts`
- `price-snapshot-service.test.ts`

## Detailed Fix Plan

---

## TODO 001: Fix Watchlist Test Isolation (P0)

**File**: `server/__tests__/watchlist-routes.test.ts`
**Failures**: 32 tests
**Estimated Time**: 2-3 hours

### Issues

1. **Database Cleanup Not Effective**
   - Current `beforeEach` may not be deleting all data
   - Foreign key constraints may be blocking deletions
   - Cleanup order may be wrong

2. **Test Expectations Don't Match Reality**
   - Tests don't account for default watchlist
   - Tests expect empty state but get pre-existing data

### Fix Steps

- [ ] **Step 1**: Review current database cleanup in `beforeEach`
  ```typescript
  // Current cleanup (check if complete)
  await db.delete(productWatches);
  await db.delete(watchLists);
  // etc.
  ```

- [ ] **Step 2**: Improve cleanup strategy
  - Use `TRUNCATE ... CASCADE` for faster, more reliable cleanup
  - Or delete in correct foreign key order
  - Add watchLists cleanup if missing

  ```typescript
  // Option A: TRUNCATE (fastest)
  await db.execute(sql`TRUNCATE TABLE product_watches RESTART IDENTITY CASCADE`);
  await db.execute(sql`TRUNCATE TABLE watch_lists RESTART IDENTITY CASCADE`);

  // Option B: Delete in correct order
  await db.delete(productWatches);
  await db.delete(watchLists);
  ```

- [ ] **Step 3**: Handle default watchlist in tests
  - If default watchlist is auto-created, adjust test expectations
  - Or disable default watchlist creation in test environment
  - Filter out default watchlist in assertions

- [ ] **Step 4**: Add cleanup verification
  ```typescript
  afterEach(async () => {
    const watchListCount = await db.select().from(watchLists);
    if (watchListCount.length > 0) {
      console.warn(`Cleanup failed: ${watchListCount.length} watchlists remain`);
    }
  });
  ```

- [ ] **Step 5**: Run tests individually to verify isolation
  ```bash
  npm test server/__tests__/watchlist-routes.test.ts
  ```

### Success Criteria

- [ ] All 32 tests pass when run individually
- [ ] All 32 tests pass when run as full suite
- [ ] Tests can run multiple times without failures
- [ ] Database is empty after each test

---

## TODO 002: Fix Alert Routes Test Isolation (P0)

**File**: `server/__tests__/alert-routes.test.ts`
**Failures**: 29 tests
**Estimated Time**: 2-3 hours

### Issues

Same isolation problems as watchlist tests:
- Database cleanup incomplete
- Data persisting between tests
- Foreign key constraint issues

### Fix Steps

- [ ] **Step 1**: Audit current database cleanup
  ```bash
  # Check what tables alert tests use
  grep -n "db.delete\|db.insert" server/__tests__/alert-routes.test.ts
  ```

- [ ] **Step 2**: Ensure all related tables are cleaned
  - Price alerts table
  - Users table
  - Products table
  - Any notification tables
  - Any related join tables

- [ ] **Step 3**: Fix cleanup order for foreign keys
  ```typescript
  // Delete children before parents
  await db.delete(priceAlerts);      // Has FK to users, products
  await db.delete(productOffers);     // Has FK to products
  await db.delete(products);          // Parent table
  await db.delete(users);             // Parent table
  ```

- [ ] **Step 4**: Use transactions for test isolation
  ```typescript
  // Wrap each test in transaction and rollback
  let testTransaction;

  beforeEach(async () => {
    testTransaction = await db.transaction();
  });

  afterEach(async () => {
    await testTransaction.rollback();
  });
  ```

- [ ] **Step 5**: Verify cleanup with count queries
  ```typescript
  afterEach(async () => {
    const alertCount = await db.select().from(priceAlerts);
    expect(alertCount).toHaveLength(0);
  });
  ```

### Success Criteria

- [ ] All 29 tests pass individually
- [ ] All 29 tests pass as suite
- [ ] No foreign key errors during cleanup
- [ ] Tests are repeatable

---

## TODO 003: Fix Storage Watchlist Tests (P1)

**File**: `server/__tests__/storage-watchlist.test.ts`
**Failures**: 3 tests
**Estimated Time**: 1 hour

### Failing Tests

1. ✗ `should return all watch lists for user with product counts`
   - Expected: 2 watch lists
   - Received: 3 watch lists

2. ✗ `should return empty array for user with no lists`
   - Expected: empty array `[]`
   - Received: 1 watch list (default watchlist)

3. ✗ `should not return other users watch lists`
   - Expected: 1 watch list
   - Received: 2 watch lists

### Root Cause

Tests don't account for automatically created default watchlist.

### Fix Steps

- [ ] **Step 1**: Investigate default watchlist creation
  ```bash
  # Search for where default watchlist is created
  grep -rn "Default watch list\|isDefault.*true" server/storage/
  grep -rn "createDefaultWatchList\|ensureDefault" server/
  ```

- [ ] **Step 2**: Determine when default watchlist is created
  - On user registration?
  - On first `getUserWatchLists` call?
  - In storage layer initialization?

- [ ] **Step 3**: Choose fix approach

  **Option A**: Disable default watchlist in tests
  ```typescript
  // Mock or configure storage to skip default creation
  process.env.DISABLE_DEFAULT_WATCHLIST = 'true';
  ```

  **Option B**: Update test expectations
  ```typescript
  // Test 1: Expect 3 instead of 2 (includes default)
  expect(watchListsResult).toHaveLength(3);

  // Test 2: Filter out default watchlist
  const nonDefaultLists = watchListsResult.filter(list => !list.isDefault);
  expect(nonDefaultLists).toHaveLength(0);
  ```

  **Option C**: Delete default watchlist in beforeEach
  ```typescript
  beforeEach(async () => {
    // After creating test user
    await db.delete(watchLists).where(eq(watchLists.isDefault, true));
  });
  ```

- [ ] **Step 4**: Apply chosen fix consistently across all tests

- [ ] **Step 5**: Verify fix
  ```bash
  npm test server/__tests__/storage-watchlist.test.ts
  ```

### Success Criteria

- [ ] All 3 tests pass
- [ ] Tests accurately reflect actual system behavior
- [ ] Default watchlist behavior is documented

---

## TODO 004: Fix Price Aggregation Service Tests (P2)

**File**: `server/services/__tests__/price-aggregation-service.test.ts`
**Failures**: 4 tests
**Estimated Time**: 1-2 hours

### Failing Tests

1. ✗ `should aggregate a date range correctly`
2. ✗ `should continue on failure for individual dates`
3. ✗ `should return correct count of aggregates created`
4. ✗ `should handle invalid date ranges gracefully`

### Error

```
Error: this.db.select(...).from(...).limit is not a function
```

### Root Cause

Mock database object doesn't implement full query chain. Tests mock `db` but the mock is incomplete.

### Fix Steps

- [ ] **Step 1**: Review current mocking approach
  ```typescript
  // Find how db is mocked in the test
  grep -A 20 "vi.mock.*db\|mockDb\|jest.mock.*db" server/services/__tests__/price-aggregation-service.test.ts
  ```

- [ ] **Step 2**: Fix mock chain to include all methods
  ```typescript
  // Complete mock chain example
  const mockDb = {
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([/* mock data */])
        })
      })
    }),
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([/* mock data */])
      })
    })
  };
  ```

- [ ] **Step 3**: Consider using real database instead of mocks
  ```typescript
  // Option B: Use test database (more reliable)
  import { db } from '../../db';

  beforeEach(async () => {
    // Clean database
    await db.delete(priceAggregates);
    await db.delete(priceHistory);
    // Insert test data
  });
  ```

- [ ] **Step 4**: Update test assertions to match actual behavior

- [ ] **Step 5**: Run tests
  ```bash
  npm test server/services/__tests__/price-aggregation-service.test.ts
  ```

### Success Criteria

- [ ] All 4 tests pass
- [ ] Mocks properly implement full Drizzle query chain
- [ ] Or tests use real test database for reliability

---

## TODO 005: Fix Auth Routes Expired Token Test (P2)

**File**: `server/routes/__tests__/auth-routes.test.ts`
**Failures**: 1 test
**Estimated Time**: 30 minutes

### Failing Test

✗ `should reject expired token`

### Likely Issue

Token expiration test has timing issues:
- Token expires at exact time boundary
- Test timing isn't reliable
- Token may not be expired when checked

### Fix Steps

- [ ] **Step 1**: Review test implementation
  ```bash
  # Find the failing test
  grep -A 30 "should reject expired token" server/routes/__tests__/auth-routes.test.ts
  ```

- [ ] **Step 2**: Check token expiration logic
  - How is token expiration set?
  - How is expiration checked?
  - Is there a grace period?

- [ ] **Step 3**: Fix timing issues

  **Option A**: Use fake timers
  ```typescript
  import { vi } from 'vitest';

  it('should reject expired token', async () => {
    vi.useFakeTimers();

    // Create token
    const token = createResetToken(user.id);

    // Fast-forward time past expiration
    vi.advanceTimersByTime(1000 * 60 * 60 + 1); // 1 hour + 1ms

    // Test token rejection
    const response = await request(app)
      .post('/api/auth/reset-password')
      .send({ token, password: 'newpass' });

    expect(response.status).toBe(400);
    expect(response.body.error).toContain('expired');

    vi.useRealTimers();
  });
  ```

  **Option B**: Set explicit expiration time
  ```typescript
  // Create token that expired 1 hour ago
  const expiredToken = createResetToken(user.id, {
    expiresAt: new Date(Date.now() - 1000 * 60 * 60)
  });
  ```

- [ ] **Step 4**: Verify fix
  ```bash
  npm test server/routes/__tests__/auth-routes.test.ts
  ```

### Success Criteria

- [ ] Test passes reliably
- [ ] Test doesn't depend on real time passage
- [ ] Test accurately verifies expired token rejection

---

## TODO 006: Fix Product Routes Discussion Count Tests (P2)

**File**: `server/routes/__tests__/product-routes.test.ts`
**Failures**: 2 tests
**Estimated Time**: 1 hour

### Failing Tests

1. ✗ `should include discussion count in results`
2. ✗ `should include discussion count`

### Likely Issue

Product queries don't include discussion/comment count:
- Storage layer method missing join to comments/discussions
- Response schema doesn't include `discussionCount` field
- Tests expect field that isn't being returned

### Fix Steps

- [ ] **Step 1**: Check what tests expect
  ```bash
  # Find the assertions
  grep -B 5 -A 10 "discussionCount\|discussion.*count" server/routes/__tests__/product-routes.test.ts
  ```

- [ ] **Step 2**: Check storage layer implementation
  ```bash
  # Find product query methods
  grep -n "getProduct\|searchProducts" server/storage.ts
  grep -n "getProduct\|searchProducts" server/storage/domains/product-storage.ts
  ```

- [ ] **Step 3**: Add discussion count to query

  **If using storage layer:**
  ```typescript
  // In product-storage.ts
  const productsWithDiscussions = await this.db
    .select({
      ...products,
      discussionCount: sql<number>`
        COUNT(DISTINCT ${discussions.id})::int
      `.as('discussion_count')
    })
    .from(products)
    .leftJoin(discussions, eq(discussions.productId, products.id))
    .groupBy(products.id);
  ```

  **If using direct query in route:**
  ```typescript
  // In product-routes.ts
  import { discussions } from '@shared/schema';

  const result = await db
    .select({
      ...products,
      discussionCount: sql<number>`COUNT(${discussions.id})::int`
    })
    .from(products)
    .leftJoin(discussions, eq(discussions.productId, products.id))
    .groupBy(products.id);
  ```

- [ ] **Step 4**: Update response type if needed
  ```typescript
  // In schema.ts or types
  export interface ProductWithDiscussions extends Product {
    discussionCount: number;
  }
  ```

- [ ] **Step 5**: Verify fix
  ```bash
  npm test server/routes/__tests__/product-routes.test.ts
  ```

### Success Criteria

- [ ] Both tests pass
- [ ] `discussionCount` included in product responses
- [ ] Query performance is acceptable (indexed if needed)

---

## Testing Strategy

### Phase 1: Fix Critical Test Isolation (P0)

1. Fix watchlist-routes.test.ts (32 tests)
2. Fix alert-routes.test.ts (29 tests)

**Verify after each fix:**
```bash
# Run specific test file 3 times
npm test server/__tests__/watchlist-routes.test.ts
npm test server/__tests__/watchlist-routes.test.ts
npm test server/__tests__/watchlist-routes.test.ts
```

### Phase 2: Fix Storage and Service Tests (P1-P2)

3. Fix storage-watchlist.test.ts (3 tests)
4. Fix price-aggregation-service.test.ts (4 tests)
5. Fix auth-routes.test.ts (1 test)
6. Fix product-routes.test.ts (2 tests)

### Phase 3: Full Test Suite Verification

```bash
# Run entire test suite
npm test

# Run tests multiple times to verify stability
npm test
npm test
npm test

# Check for any remaining flaky tests
npm test -- --reporter=verbose
```

### Phase 4: CI/CD Verification

```bash
# Commit fixes
git add .
git commit -m "fix: resolve test isolation issues across test suites

- Fix database cleanup in watchlist and alert test suites
- Handle default watchlist creation in storage tests
- Fix mock database chains in aggregation service tests
- Fix token expiration timing in auth tests
- Add discussion count to product queries

Fixes 71 failing tests across 6 test suites"

# Push and verify CI passes
git push
```

---

## Implementation Order

1. **TODO 001** - Watchlist routes (P0, 32 tests)
2. **TODO 002** - Alert routes (P0, 29 tests)
3. **TODO 003** - Storage watchlist (P1, 3 tests)
4. **TODO 004** - Price aggregation (P2, 4 tests)
5. **TODO 005** - Auth expired token (P2, 1 test)
6. **TODO 006** - Product discussion count (P2, 2 tests)

---

## Success Criteria - Overall

- [ ] All 71 failing tests now pass
- [ ] Tests pass when run individually
- [ ] Tests pass when run as full suite
- [ ] Tests pass consistently across multiple runs
- [ ] No test isolation issues remain
- [ ] CI/CD pipeline passes all tests
- [ ] Dependabot PRs can be merged safely

---

## Timeline Estimate

- **TODO 001-002** (Critical): 4-6 hours
- **TODO 003-006** (High/Medium): 3-4 hours
- **Testing & Verification**: 1-2 hours
- **Buffer for unexpected issues**: 2-3 hours

**Total**: ~10-15 hours of focused work

---

## Related Documentation

- `docs/02_DATABASE_PATTERNS.md` - Database cleanup patterns
- `docs/TYPESCRIPT_PATTERNS.md` - Testing best practices
- `server/test/setup.ts` - Global test configuration
- `vitest.config.ts` - Test runner configuration

---

## Notes

- All tests are using Vitest as the test runner
- Tests use real PostgreSQL database (test_db)
- `fileParallelism: false` is already set to prevent database deadlocks
- Consider adding test database seeding/teardown utilities
- May want to create shared test fixtures for common scenarios

---

## Post-Fix Actions

After all tests pass:

1. [ ] Merge Dependabot PRs (5 PRs)
2. [ ] Document test isolation best practices
3. [ ] Add pre-commit hook to run tests
4. [ ] Consider CI optimization (parallel test execution)
5. [ ] Review test coverage gaps
