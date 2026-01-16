# TODO 235: Address Test Cleanup Antipatterns

**Created:** 2026-01-16
**Completed:** 2026-01-16
**Priority:** Low
**Effort:** Medium (Actual: 1 hour)
**Category:** Testing / Code Quality
**Status:** ✅ COMPLETED

## Overview

Pre-commit hooks flagged two antipattern warnings in test files that should be addressed for consistency and performance.

## Issues Addressed

### 1. Hardcoded Bcrypt Rounds (WARNING 13) ✅

**Location:** `server/test/basic-auth.test.ts:449`

**Original Code:**
```typescript
const weakHash = await bcrypt.hash(weakPassword, 4); // Only 4 rounds (weak, less than 12)
```

**Fix Applied:** Added inline documentation explaining intentional weak hash for testing

```typescript
// SECURITY TEST: Intentionally weak hash (4 rounds) to test weak password detection/upgrade
const weakHash = await bcrypt.hash(weakPassword, 4);
```

**Rationale:** This is intentionally weak for testing password upgrade functionality. Inline comment documents the exception.

---

### 2. Test Cleanup Using db.delete() (WARNING 18) ✅

**Locations Fixed:**
- ✅ `server/routes/__tests__/api-v1-routes.test.ts:111-116, 197-203`
- ✅ `server/__tests__/agents/coordinator-transaction.test.ts:29-30, 35-36`

**Changes Applied:**

#### api-v1-routes.test.ts
- Migrated `beforeEach` cleanup to TRUNCATE CASCADE (6 tables)
- Migrated `afterEach` cleanup to TRUNCATE CASCADE (6 tables)
- Added inline comments for intentional db.delete() calls:
  - Line 136: Deleting trigger-created watchlist (testing specific behavior)
  - Line 240: Testing empty state behavior
  - Line 306: Testing empty state behavior

```typescript
// Before
await db.delete(priceAlerts);
await db.delete(watchLists);
await db.delete(productOffers);
await db.delete(products);
await db.delete(retailers);
await db.delete(users);

// After
await db.execute(sql`TRUNCATE TABLE price_alerts RESTART IDENTITY CASCADE`);
await db.execute(sql`TRUNCATE TABLE watch_lists RESTART IDENTITY CASCADE`);
await db.execute(sql`TRUNCATE TABLE product_offers RESTART IDENTITY CASCADE`);
await db.execute(sql`TRUNCATE TABLE products RESTART IDENTITY CASCADE`);
await db.execute(sql`TRUNCATE TABLE retailers RESTART IDENTITY CASCADE`);
await db.execute(sql`TRUNCATE TABLE users RESTART IDENTITY CASCADE`);
```

#### coordinator-transaction.test.ts
- Added inline comments explaining category-specific cleanup (NOT migrated to TRUNCATE)
- Rationale: Tests require scoped cleanup by category to isolate transaction tests without affecting other data

```typescript
// NOTE: db.delete() with WHERE clause is intentional here - testing specific category cleanup
// for transaction test isolation without affecting other test data
await db.delete(products).where(eq(products.category, 'TransactionTest'));
```

**Files Already Using cleanupTestData() Helper (No Changes Needed):**
- ✅ `server/routes/__tests__/auth-routes.test.ts` - Already uses TRUNCATE CASCADE via helper
- ✅ `server/services/__tests__/notification-service.test.ts` - Already uses TRUNCATE CASCADE via helper
- ✅ `server/jobs/__tests__/price-alert-checker.test.ts` - Already uses TRUNCATE CASCADE via helper
- ✅ `server/services/__tests__/smart-notification-service.test.ts` - Already uses TRUNCATE CASCADE directly

**Deprecated File (Not Modified):**
- `server/services/__tests__/price-aggregation-service.test.ts` - Already marked DEPRECATED (mock-based tests replaced with real DB tests)

---

## Implementation Summary

### Changes Made

1. **server/test/basic-auth.test.ts**
   - Added inline comment explaining intentional weak bcrypt rounds

2. **server/routes/__tests__/api-v1-routes.test.ts**
   - Added `sql` import from drizzle-orm
   - Migrated beforeEach to TRUNCATE CASCADE (6 tables)
   - Migrated afterEach to TRUNCATE CASCADE (6 tables)
   - Added inline comments for 3 intentional db.delete() calls

3. **server/__tests__/agents/coordinator-transaction.test.ts**
   - Added inline comments explaining category-scoped cleanup pattern

### Test Results

```bash
npm test -- server/test/basic-auth.test.ts \
            server/routes/__tests__/api-v1-routes.test.ts \
            server/__tests__/agents/coordinator-transaction.test.ts

✅ Test Files: 3 passed (3)
✅ Tests: 105 passed | 1 skipped (106)
```

### Benefits

1. **Performance**: TRUNCATE CASCADE is faster than DELETE for full table cleanup
2. **Reliability**: No orphaned records due to CASCADE
3. **Consistency**: ID sequences reset with RESTART IDENTITY
4. **Documentation**: Intentional exceptions clearly marked with comments

---

## Acceptance Criteria

- ✅ Review `basic-auth.test.ts` bcrypt usage - add constant or document exception
- ✅ Migrate eligible `db.delete()` calls to `TRUNCATE CASCADE` pattern
- ✅ Document any intentional `db.delete()` usage with inline comments
- ✅ Pre-commit hooks pass without these warnings
- ✅ All affected tests pass

## Files Modified

1. ✅ `server/test/basic-auth.test.ts` (line 449)
2. ✅ `server/routes/__tests__/api-v1-routes.test.ts` (lines 7, 111-116, 136, 197-203, 240, 306)
3. ✅ `server/__tests__/agents/coordinator-transaction.test.ts` (lines 28-31, 36-38)

## Lessons Learned

1. **TRUNCATE CASCADE Pattern**: Faster and more reliable for test cleanup than row-by-row DELETE
2. **Intentional Exceptions**: When db.delete() is needed (category scoping, empty state testing), document with inline comments
3. **Helper Functions**: cleanupTestData() helper already implements best practices - prefer using it
4. **Pre-commit Hook Value**: Caught antipatterns that improve test performance and reliability

## References

- `docs/08_TESTING_PATTERNS.md` - TRUNCATE CASCADE pattern (Section 8.1)
- `docs/04_SECURITY_PATTERNS.md` - Password security patterns
- `docs/02_DATABASE_PATTERNS.md` - Test database cleanup patterns
