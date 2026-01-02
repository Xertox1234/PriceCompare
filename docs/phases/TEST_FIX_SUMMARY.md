# Test Fix Summary - Quick Start Guide

**Created**: 2025-12-02
**Total Failures**: 71 tests across 6 files
**Estimated Total Time**: 10-15 hours

## 📋 Complete Documentation

All detailed TODO files have been created in `/todos/`:

1. **[TODO_TEST_FIXES.md](../todos/TODO_TEST_FIXES.md)** - Master plan with all details
2. **[TODO_001_WATCHLIST_ROUTES.md](../todos/TODO_001_WATCHLIST_ROUTES.md)** - 32 failing tests (P0)
3. **[TODO_002_ALERT_ROUTES.md](../todos/TODO_002_ALERT_ROUTES.md)** - 29 failing tests (P0)
4. **[TODO_003_STORAGE_WATCHLIST.md](../todos/TODO_003_STORAGE_WATCHLIST.md)** - 3 failing tests (P1)
5. **[TODO_004_PRICE_AGGREGATION.md](../todos/TODO_004_PRICE_AGGREGATION.md)** - 4 failing tests (P2)
6. **[TODO_005_AUTH_EXPIRED_TOKEN.md](../todos/TODO_005_AUTH_EXPIRED_TOKEN.md)** - 1 failing test (P2)
7. **[TODO_006_PRODUCT_DISCUSSION_COUNT.md](../todos/TODO_006_PRODUCT_DISCUSSION_COUNT.md)** - 2 failing tests (P2)

## 🎯 Quick Start - Implementation Order

### Phase 1: Critical Test Isolation (P0) - **6-8 hours**

#### TODO 001: Watchlist Routes (32 tests)
**Time**: 2-3 hours | **File**: `server/__tests__/watchlist-routes.test.ts`

**Quick Fix**:
```typescript
// In beforeEach(), replace manual deletes with TRUNCATE CASCADE
beforeEach(async () => {
  await db.execute(sql`TRUNCATE TABLE product_watches RESTART IDENTITY CASCADE`);
  await db.execute(sql`TRUNCATE TABLE watch_lists RESTART IDENTITY CASCADE`);
  await db.execute(sql`TRUNCATE TABLE price_history RESTART IDENTITY CASCADE`);
  await db.execute(sql`TRUNCATE TABLE product_offers RESTART IDENTITY CASCADE`);
  await db.execute(sql`TRUNCATE TABLE products RESTART IDENTITY CASCADE`);
  await db.execute(sql`TRUNCATE TABLE retailers RESTART IDENTITY CASCADE`);
  await db.execute(sql`TRUNCATE TABLE users RESTART IDENTITY CASCADE`);

  // ... rest of setup
});
```

**Run**: `npm test server/__tests__/watchlist-routes.test.ts`

---

#### TODO 002: Alert Routes (29 tests)
**Time**: 2-3 hours | **File**: `server/__tests__/alert-routes.test.ts`

**Quick Fix**: Same TRUNCATE CASCADE approach + mock services

```typescript
// Add to top of file
vi.mock('../services/email-service', () => ({
  emailService: {
    sendPriceAlert: vi.fn().mockResolvedValue(undefined),
    isReady: vi.fn().mockReturnValue(true),
  }
}));

vi.mock('../services/notification-service', () => ({
  createNotification: vi.fn().mockResolvedValue({ id: 1 }),
}));

// Then same TRUNCATE CASCADE in beforeEach
```

**Run**: `npm test server/__tests__/alert-routes.test.ts`

---

### Phase 2: Storage & Service Tests (P1-P2) - **3-4 hours**

#### TODO 003: Storage Watchlist (3 tests)
**Time**: 1 hour | **File**: `server/__tests__/storage-watchlist.test.ts`

**Quick Fix**: Delete default watchlists after user creation

```typescript
beforeEach(async () => {
  // ... existing cleanup and user creation ...

  // Remove any auto-created default watchlists
  await db.delete(watchLists).where(eq(watchLists.isDefault, true));
});
```

**Run**: `npm test server/__tests__/storage-watchlist.test.ts`

---

#### TODO 004: Price Aggregation (4 tests)
**Time**: 1-2 hours | **File**: `server/services/__tests__/price-aggregation-service.test.ts`

**Quick Fix**: Use real test database instead of mocks

```typescript
// Remove all db mocks, import real db
import { db } from '../../db';

beforeEach(async () => {
  // Clean database
  await db.delete(priceAggregates);
  await db.delete(priceHistory);

  // Insert test data directly
  await db.insert(priceHistory).values([...]);
});
```

**Run**: `npm test server/services/__tests__/price-aggregation-service.test.ts`

---

#### TODO 005: Auth Expired Token (1 test)
**Time**: 30 min | **File**: `server/routes/__tests__/auth-routes.test.ts`

**Quick Fix**: Use fake timers

```typescript
import { vi } from 'vitest';

it('should reject expired token', async () => {
  vi.useFakeTimers();

  // Create token (valid for 1 hour)
  const token = await createResetToken(user.id);

  // Fast-forward past expiration
  vi.advanceTimersByTime(1000 * 60 * 60 + 1000); // 1 hour + 1 sec

  // Test rejection
  const response = await request(app)
    .post('/api/auth/reset-password')
    .send({ token, password: 'newpass' });

  expect(response.status).toBe(400);

  vi.useRealTimers();
});
```

**Run**: `npm test server/routes/__tests__/auth-routes.test.ts -- -t "expired token"`

---

#### TODO 006: Product Discussion Count (2 tests)
**Time**: 1 hour | **File**: `server/routes/__tests__/product-routes.test.ts`

**Quick Fix**: Add LEFT JOIN for discussion count

```typescript
// In product query (storage layer or route)
const result = await db
  .select({
    ...products,
    discussionCount: sql<number>`COUNT(DISTINCT ${discussions.id})::int`.as('discussion_count'),
  })
  .from(products)
  .leftJoin(discussions, eq(discussions.productId, products.id))
  .groupBy(products.id);
```

**Run**: `npm test server/routes/__tests__/product-routes.test.ts -- -t "discussion count"`

---

### Phase 3: Verification - **1-2 hours**

```bash
# Run full test suite
npm test

# Run 3 times to verify stability
npm test && npm test && npm test

# Check CI
git add docs/
git commit -m "docs: add comprehensive test fix plan and TODO files"
git push
```

## 🔍 Root Cause Summary

| Issue | Affected Tests | Root Cause |
|-------|----------------|------------|
| Database cleanup incomplete | 61 tests | `beforeEach` using DELETE instead of TRUNCATE CASCADE |
| Default watchlist auto-creation | 3 tests | Tests don't account for automatic default watchlist |
| Incomplete mock chains | 4 tests | Database mocks missing query builder methods |
| Token timing issues | 1 test | Real time instead of fake timers |
| Missing JOIN | 2 tests | Discussion count not included in queries |

## ✅ Success Metrics

After fixes complete, verify:

- [ ] All 71 tests pass
- [ ] Tests pass when run individually: `npm test path/to/file.test.ts`
- [ ] Tests pass as full suite: `npm test`
- [ ] Tests pass 3+ consecutive times
- [ ] No database cleanup errors
- [ ] No foreign key violations
- [ ] CI/CD pipeline passes
- [ ] Dependabot PRs can be merged

## 🚀 After Tests Pass

1. **Commit test fixes**
   ```bash
   git add server/__tests__/ server/routes/__tests__/ server/services/__tests__/
   git commit -m "fix: resolve test isolation issues across test suites

   - Fix database cleanup in watchlist and alert test suites (61 tests)
   - Handle default watchlist creation in storage tests (3 tests)
   - Fix mock database chains in aggregation service tests (4 tests)
   - Fix token expiration timing in auth tests (1 test)
   - Add discussion count to product queries (2 tests)

   Total: 71 failing tests now passing"
   ```

2. **Merge Dependabot PRs**
   ```bash
   # All 5 PRs
   gh pr merge 153 --squash  # actions/github-script 7→8
   gh pr merge 154 --squash  # github/codeql-action 3→4
   gh pr merge 155 --squash  # actions/setup-node 4→6
   gh pr merge 156 --squash  # actions/checkout 4→6
   gh pr merge 157 --squash  # romeovs/lcov-reporter-action 0.3.1→0.4.0
   ```

3. **Document improvements**
   - Update `docs/02_DATABASE_PATTERNS.md` with test isolation patterns
   - Add test cleanup examples to codebase patterns
   - Consider adding pre-commit test hook

## 📊 Progress Tracking

Use the individual TODO files to track progress:

- [ ] **TODO 001** - Watchlist Routes (32 tests) - **Started: _____ | Completed: _____**
- [ ] **TODO 002** - Alert Routes (29 tests) - **Started: _____ | Completed: _____**
- [ ] **TODO 003** - Storage Watchlist (3 tests) - **Started: _____ | Completed: _____**
- [ ] **TODO 004** - Price Aggregation (4 tests) - **Started: _____ | Completed: _____**
- [ ] **TODO 005** - Auth Token (1 test) - **Started: _____ | Completed: _____**
- [ ] **TODO 006** - Product Discussion (2 tests) - **Started: _____ | Completed: _____**

## 🔗 Related Documentation

- `docs/02_DATABASE_PATTERNS.md` - Database cleanup patterns
- `docs/01_TYPESCRIPT_PATTERNS.md` - Testing best practices
- `server/test/setup.ts` - Global test configuration
- `vitest.config.ts` - Test runner settings

## 💡 Key Insights

1. **TRUNCATE CASCADE is faster and more reliable** than manual DELETE statements
2. **Use real test database** instead of complex mocks when possible
3. **Fake timers** eliminate timing-related test flakiness
4. **Test isolation is critical** - database must be clean between tests
5. **Default behaviors** (like auto-created watchlists) must be documented in tests

---

**Need help?** Refer to the detailed TODO files for step-by-step instructions, code examples, and troubleshooting tips.
