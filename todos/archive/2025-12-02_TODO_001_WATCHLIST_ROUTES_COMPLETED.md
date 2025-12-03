# TODO 001: Fix Watchlist Routes Test Isolation

**Priority**: P0 - Critical
**File**: `server/__tests__/watchlist-routes.test.ts`
**Failures**: 32 tests
**Estimated Time**: 2-3 hours
**Status**: Not Started

## Problem Statement

All 32 tests in the watchlist routes test suite are failing due to database state leaking between tests. Tests expect specific data states but encounter data from previous tests.

## Failing Tests

1. ✗ should require authentication (GET /api/watchlists)
2. ✗ should return user watch lists
3. ✗ should return empty array when user has no lists
4. ✗ should require authentication (POST /api/watchlists)
5. ✗ should require CSRF token
6. ✗ should create watch list with valid data
7. ✗ should create watch list without description
8. ✗ should validate name is required
9. ✗ should validate name length (max 100 chars)
10. ✗ should require authentication (GET /api/watchlists/:id)
11. ✗ should return watch list with products
12. ✗ should return 404 for non-existent watch list
13. ✗ should not allow accessing other users watch lists
14. ✗ should require authentication (PATCH /api/watchlists/:id)
15. ✗ should require CSRF token
16. ✗ should update watch list name
17. ✗ should update watch list description
18. ✗ should require at least one field
19. ✗ should require authentication (DELETE /api/watchlists/:id)
20. ✗ should require CSRF token
21. ✗ should delete watch list and cascade delete products
22. ✗ should not allow deleting other users lists
23. ✗ should require authentication (POST /api/watchlists/:id/products)
24. ✗ should require CSRF token
25. ✗ should add product to watch list
26. ✗ should validate productId is a positive integer
27. ✗ should prevent duplicate products
28. ✗ should require authentication (DELETE /api/watchlists/:id/products/:productId)
29. ✗ should require CSRF token
30. ✗ should remove product from watch list
31. ✗ should require authentication (GET /api/watchlists/stats)
32. ✗ should return dashboard statistics

## Root Cause

**Database cleanup in `beforeEach` is not effective**, resulting in:
- Data persisting from previous tests
- Foreign key constraint violations during cleanup
- Tests seeing unexpected records (e.g., default watchlists)

## Implementation Checklist

### Phase 1: Investigate Current State

- [ ] Read current test file completely
  ```bash
  code server/__tests__/watchlist-routes.test.ts
  ```

- [ ] Document current `beforeEach` cleanup logic
  ```typescript
  // What tables are currently being cleaned?
  // What order are deletions happening?
  // Are there any TRUNCATE statements?
  ```

- [ ] Check for `afterEach` cleanup

- [ ] Identify all tables used by tests
  - [ ] watchLists
  - [ ] productWatches
  - [ ] products
  - [ ] users
  - [ ] retailers
  - [ ] productOffers
  - [ ] priceHistory
  - [ ] Other tables?

### Phase 2: Improve Database Cleanup

- [ ] Option A: Use TRUNCATE CASCADE (fastest)
  ```typescript
  beforeEach(async () => {
    // Truncate all related tables in correct order
    await db.execute(sql`TRUNCATE TABLE product_watches RESTART IDENTITY CASCADE`);
    await db.execute(sql`TRUNCATE TABLE price_history RESTART IDENTITY CASCADE`);
    await db.execute(sql`TRUNCATE TABLE product_offers RESTART IDENTITY CASCADE`);
    await db.execute(sql`TRUNCATE TABLE products RESTART IDENTITY CASCADE`);
    await db.execute(sql`TRUNCATE TABLE watch_lists RESTART IDENTITY CASCADE`);
    await db.execute(sql`TRUNCATE TABLE retailers RESTART IDENTITY CASCADE`);
    await db.execute(sql`TRUNCATE TABLE users RESTART IDENTITY CASCADE`);
  });
  ```

- [ ] Option B: Delete in correct foreign key order
  ```typescript
  beforeEach(async () => {
    // Delete children first, parents last
    await db.delete(productWatches);     // FK to watch_lists, products
    await db.delete(priceHistory);        // FK to product_offers
    await db.delete(productOffers);       // FK to products, retailers
    await db.delete(products);            // Parent table
    await db.delete(watchLists);          // FK to users
    await db.delete(retailers);           // Parent table
    await db.delete(users);               // Parent table
  });
  ```

- [ ] Test chosen cleanup approach
  ```bash
  npm test server/__tests__/watchlist-routes.test.ts -- --reporter=verbose
  ```

### Phase 3: Handle Default Watchlist

- [ ] Check if default watchlist is auto-created
  ```bash
  # Search codebase for default watchlist creation
  grep -rn "Default watch list" server/
  grep -rn "isDefault.*true" server/storage/
  ```

- [ ] If auto-created, choose fix approach:

  - [ ] **Option A**: Delete default watchlist in cleanup
    ```typescript
    await db.delete(watchLists).where(eq(watchLists.isDefault, true));
    ```

  - [ ] **Option B**: Disable in test environment
    ```typescript
    process.env.CREATE_DEFAULT_WATCHLIST = 'false';
    ```

  - [ ] **Option C**: Update test expectations
    ```typescript
    // Account for +1 default watchlist in assertions
    ```

### Phase 4: Add Cleanup Verification

- [ ] Add afterEach verification
  ```typescript
  afterEach(async () => {
    // Verify database is clean
    const watchListCount = await db.select({ count: sql<number>`count(*)` })
      .from(watchLists);

    if (parseInt(watchListCount[0].count as string) > 0) {
      console.error(`❌ Cleanup failed: ${watchListCount[0].count} watchlists remain`);
      // Log remaining records for debugging
      const remaining = await db.select().from(watchLists);
      console.error('Remaining watchlists:', remaining);
    }
  });
  ```

- [ ] Add similar verification for other tables

### Phase 5: Fix Test Implementation Issues

- [ ] Ensure CSRF tokens are set correctly
  ```typescript
  const response = await request(app)
    .post('/api/watchlists')
    .set('x-csrf-token', csrfToken)  // ← Verify this header
    .send({ name: 'Test List' });
  ```

- [ ] Verify authentication cookies are passed
  ```typescript
  const response = await request(app)
    .get('/api/watchlists')
    .set('Cookie', authCookie);  // ← Verify cookie format
  ```

- [ ] Check test data setup is complete
  - All required retailers exist
  - All required products exist
  - User authentication is properly set up

### Phase 6: Run and Verify

- [ ] Run single test file
  ```bash
  npm test server/__tests__/watchlist-routes.test.ts
  ```

- [ ] Check for specific error messages
  - [ ] No "CSRF token missing" errors
  - [ ] No "Unauthorized" errors on authenticated routes
  - [ ] No foreign key constraint violations
  - [ ] No "record not found" errors

- [ ] Run test file 3 times to verify consistency
  ```bash
  npm test server/__tests__/watchlist-routes.test.ts
  npm test server/__tests__/watchlist-routes.test.ts
  npm test server/__tests__/watchlist-routes.test.ts
  ```

- [ ] Verify tests pass when run individually
  ```bash
  npm test server/__tests__/watchlist-routes.test.ts -- -t "should create watch list with valid data"
  ```

### Phase 7: Document and Clean Up

- [ ] Add comments explaining cleanup strategy
  ```typescript
  beforeEach(async () => {
    /**
     * Database Cleanup Strategy:
     * - Use TRUNCATE CASCADE for fast, reliable cleanup
     * - Restart identity sequences to ensure predictable IDs
     * - Order: children → parents (respects foreign keys)
     */
    // ...
  });
  ```

- [ ] Remove any debugging console.log statements

- [ ] Update test descriptions if needed

## Testing Commands

```bash
# Run just this test file
npm test server/__tests__/watchlist-routes.test.ts

# Run with verbose output
npm test server/__tests__/watchlist-routes.test.ts -- --reporter=verbose

# Run specific test
npm test server/__tests__/watchlist-routes.test.ts -- -t "should create watch list"

# Run 3 times to check for flakiness
for i in {1..3}; do npm test server/__tests__/watchlist-routes.test.ts; done
```

## Success Criteria

- [ ] All 32 tests pass
- [ ] Tests pass when run individually
- [ ] Tests pass when run as full suite
- [ ] Tests pass consistently across 3+ runs
- [ ] No database cleanup errors
- [ ] No foreign key constraint violations
- [ ] Database is empty after each test
- [ ] Tests complete in reasonable time (<5 seconds)

## Common Pitfalls

1. **Foreign Key Order**: Must delete child records before parents
2. **Identity Sequences**: Use `RESTART IDENTITY` to reset ID counters
3. **CASCADE**: May delete more than expected - verify cleanup
4. **Default Watchlists**: Auto-creation can interfere with tests
5. **Session State**: Authentication state must be reset between tests

## Related Files

- `server/__tests__/watchlist-routes.test.ts` - Main test file
- `server/routes/watchlist-routes.ts` - Routes being tested
- `server/storage/domains/watchlist-storage.ts` - Storage layer
- `shared/schema.ts` - Database schema with foreign keys
- `server/test/setup.ts` - Global test setup

## Notes

- Tests use supertest for HTTP request testing
- CSRF protection is mocked in test environment
- Authentication uses session cookies
- Database is real PostgreSQL (not in-memory)

## Estimated Timeline

- Phase 1 (Investigation): 30 minutes
- Phase 2-3 (Cleanup fixes): 60 minutes
- Phase 4-5 (Verification & fixes): 30-60 minutes
- Phase 6 (Testing): 30 minutes
- Phase 7 (Documentation): 15 minutes

**Total**: 2-3 hours

---

## ✅ COMPLETION SUMMARY

**Completed**: 2025-12-02
**Actual Time**: ~45 minutes (vs 2-3 hour estimate)
**Test Results**: 32/32 tests passing consistently across 3 runs

### Fixes Implemented

1. **Database Cleanup**: Replaced `db.delete()` with `TRUNCATE ... RESTART IDENTITY CASCADE`
2. **Redis Mock**: Added Redis client mock following `advanced-cache.test.ts` pattern
3. **Password Validation**: Fixed test password to include special character (`SecurePass123!`)

### Bonus: Application Bugs Fixed (Code Review)

After completing test fixes, code review discovered 2 application bugs:
1. **Empty name validation** - Returned 500, now returns 400
2. **Duplicate product constraint** - Returned 500, now returns 409

**See Documentation**:
- `docs/LEARNINGS_TODO_001_WATCHLIST_TEST_FIX.md` - Test isolation patterns
- `docs/LEARNINGS_WATCHLIST_ERROR_HANDLING_FIXES.md` - Error handling patterns

### Files Modified

- `server/__tests__/watchlist-routes.test.ts` - Test isolation + error expectations
- `server/utils/api-response.ts` - ZodError detection (global fix)
- `server/routes/watchlist-routes.ts` - Duplicate constraint handling

### Impact

**Local**: All 32 watchlist route tests passing with proper error codes
**Global**: ZodError detection now works across entire application

---

**Status**: ✅ COMPLETED AND CODIFIED
