# Learnings: TODO 003 - Storage Watchlist Test Fixes

**Date**: 2025-12-02
**Issue**: 3 tests failing due to unexpected database trigger creating default watchlists + 3 tests validating wrong layer + 1 return type mismatch
**Status**: ✅ Resolved - All 29 tests passing consistently

## Problem Summary

The storage watchlist test suite had **7 total test failures**:
1. **3 tests failing** - Unexpected default watchlist created by database trigger
2. **3 tests failing** - Testing validation that moved from storage to route layer
3. **1 test failing** - Return type changed from array to paginated object

**Root Causes**:
1. Database trigger `trigger_create_default_watch_list` auto-creates watchlist on user insert
2. Tests expected storage layer to validate inputs, but validation moved to Zod/route layer
3. API evolved from returning array to returning `WatchedProductsResult` object with pagination metadata

## Root Causes

### 1. Database Trigger Creating "Phantom Data"

**Trigger**: `trigger_create_default_watch_list` in `migrations/0008_add_watch_lists.sql`

```sql
-- Database trigger that auto-creates default watchlist
CREATE TRIGGER trigger_create_default_watch_list
  AFTER INSERT ON users
  FOR EACH ROW
  EXECUTE FUNCTION create_default_watch_list();
```

**What it creates**:
```json
{
  "id": 1,
  "userId": 1,
  "name": "My Watches",
  "description": "Default watch list",
  "isDefault": true,
  "createdAt": "2025-12-02T..."
}
```

**Test failures**:
```typescript
// ❌ Test 1: Expected 2 watch lists, got 3 (+ default)
it('should return all watch lists for user with product counts', async () => {
  // Created 2 explicit watchlists
  expect(watchLists).toHaveLength(2); // FAILED: Got 3 (2 + 1 default)
});

// ❌ Test 2: Expected empty array, got 1 (default watchlist)
it('should return empty array for user with no lists', async () => {
  expect(watchLists).toHaveLength(0); // FAILED: Got 1 (default)
});

// ❌ Test 3: Expected 1 watchlist, got 2 (1 + default)
it('should not return other users watch lists', async () => {
  expect(watchLists).toHaveLength(1); // FAILED: Got 2 (1 + 1 default)
});
```

### 2. Storage vs Route Validation Layer Confusion

**Architecture Change**: Validation moved from storage layer to route layer (Zod schemas).

**Storage Layer Comments** (in `watchlist-storage.ts`):
```typescript
// Line 262: VALIDATION: Name trimming and validation now handled by Zod schema in routes
// Line 305: VALIDATION: Name and description trimming/validation now handled by Zod schema in routes
```

**Test failures**:
```typescript
// ❌ Test 4: Expected storage to validate empty name
it('should validate name is required', async () => {
  await expect(
    storage.createWatchList(testUserId, { name: '' })
  ).rejects.toThrow(); // FAILED: Storage accepts empty names (route validates)
});

// ❌ Test 5: Expected storage to enforce max length
it('should validate name length', async () => {
  await expect(
    storage.createWatchList(testUserId, { name: 'a'.repeat(256) })
  ).rejects.toThrow(); // FAILED: Storage accepts long names (route validates)
});

// ❌ Test 6: Expected storage to trim whitespace
it('should trim whitespace', async () => {
  const result = await storage.createWatchList(testUserId, { name: '  Test  ' });
  expect(result.name).toBe('Test'); // FAILED: Got '  Test  ' (route trims, not storage)
});
```

### 3. API Evolution: Array → Paginated Object

**API Change**: `getWatchedProducts` evolved to support cursor pagination.

**Before** (assumed by test):
```typescript
async getWatchedProducts(userId: number): Promise<Product[]>
```

**After** (actual implementation):
```typescript
interface WatchedProductsResult {
  products: Array<...>;
  hasMore: boolean;
  nextCursor: number | null;
}

async getWatchedProducts(userId: number, options?: PaginationOptions): Promise<WatchedProductsResult>
```

**Test failure**:
```typescript
// ❌ Test 7: Expected array, got object
it('should respect limit option', async () => {
  const products = await storage.getWatchedProducts(testUserId, { limit: 1 });
  expect(products).toHaveLength(1); // FAILED: products is an object, not an array
});
```

## Solution Implemented

### Fix 1: Clean Up Database Trigger Data

**Added cleanup in `beforeEach`** (lines 79-81):
```typescript
beforeEach(async () => {
  // ... create test user ...

  // Delete auto-created default watchlist (created by trigger_create_default_watch_list)
  // This ensures tests start with a clean slate and test explicit watchlist creation
  await db.delete(watchLists).where(eq(watchLists.userId, testUserId));
});
```

**Added documentation** (lines 44-47):
```typescript
/**
 * NOTE: Database trigger auto-creates default watchlist on user insert
 * - Trigger: trigger_create_default_watch_list
 * - Migration: migrations/0008_add_watch_lists.sql
 * - Creates watchlist with name="My Watches", isDefault=true
 * - We delete this in beforeEach cleanup to isolate tests
 */
```

**Why this approach?**:
- ✅ Maintains clean test isolation without modifying production schema
- ✅ Documents the trigger behavior for future developers
- ✅ Allows testing explicit watchlist creation, not database defaults
- ✅ Pragmatic - doesn't require environment checks or schema changes

**Alternative approaches considered**:
- ❌ Filter out `isDefault` in test assertions - hides production behavior
- ❌ Environment check in trigger - adds complexity, harder to test production behavior
- ❌ Mock database layer - defeats purpose of integration tests

### Fix 2: Update Validation Test Expectations

**Inverted test expectations** to verify storage layer does NOT validate (lines 263-283):

```typescript
// ✅ Test 4: Verify storage preserves empty names (route validates)
it('should accept empty name (validation is route responsibility)', async () => {
  const result = await storage.createWatchList(testUserId, { name: '' });
  expect(result).toBeDefined();
  expect(result.name).toBe(''); // Storage preserves empty name
});

// ✅ Test 5: Verify storage preserves long names (route validates)
it('should accept long names (validation is route responsibility)', async () => {
  const longName = 'a'.repeat(256);
  const result = await storage.createWatchList(testUserId, { name: longName });
  expect(result).toBeDefined();
  expect(result.name).toBe(longName); // Storage preserves long name
});

// ✅ Test 6: Verify storage preserves untrimmed names (route validates)
it('should accept untrimmed names (validation is route responsibility)', async () => {
  const untrimmedName = '  Test  ';
  const result = await storage.createWatchList(testUserId, { name: untrimmedName });
  expect(result).toBeDefined();
  expect(result.name).toBe(untrimmedName); // Storage preserves whitespace
});
```

**Why invert instead of delete?**:
- ✅ Documents architectural boundary (storage vs route responsibility)
- ✅ Prevents regression (ensures storage doesn't add validation later)
- ✅ Tests actual storage behavior, not route behavior
- ✅ Aligns with codebase pattern (validation at route layer via Zod)

### Fix 3: Update Return Type Test

**Updated test to destructure paginated result** (lines 514-523):

```typescript
// ✅ Test 7: Verify paginated return structure
it('should respect limit option', async () => {
  const result = await storage.getWatchedProducts(testUserId, { limit: 1 });

  // Verify products array
  expect(result.products).toHaveLength(1);

  // Verify pagination metadata
  expect(result).toHaveProperty('hasMore');
  expect(result).toHaveProperty('nextCursor');
});
```

**Why check structure instead of values?**:
- Test focuses on limit enforcement (1 product returned)
- Pagination metadata existence verified
- Follow-up TODO created for value assertions (TODO_005)

### Fix 4: Add Required Mocks

**Added Redis and logger mocks** (lines 7-31):
```typescript
// Mock Redis client (required by AdvancedCacheService)
vi.mock('../config/redis', () => ({
  redisClient: {
    get: vi.fn(),
    setex: vi.fn(),
    del: vi.fn(),
    keys: vi.fn(),
    scan: vi.fn(),
    duplicate: vi.fn(() => ({
      subscribe: vi.fn(),
      on: vi.fn(),
      quit: vi.fn(),
    })),
  },
}));

// Mock logger (required by storage layer)
vi.mock('../utils/logger', () => ({
  logger: {
    error: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
  },
}));
```

**Pattern source**: Copied from `server/__tests__/advanced-cache.test.ts` (standard pattern).

## Key Insights

### 1. Database Triggers in Testing

**Discovery Pattern**:
```bash
# When "phantom data" appears, check for triggers
grep -rn "CREATE TRIGGER" migrations/

# Found: migrations/0008_add_watch_lists.sql
CREATE TRIGGER trigger_create_default_watch_list
  AFTER INSERT ON users
  FOR EACH ROW
  EXECUTE FUNCTION create_default_watch_list();
```

**Testing Strategies**:

| Strategy | Pros | Cons | Verdict |
|----------|------|------|---------|
| **Delete in beforeEach** | ✅ Simple<br>✅ Maintains prod behavior<br>✅ Clean isolation | ❌ Requires understanding trigger | ✅ **Recommended** |
| **Filter in assertions** | ✅ No setup changes | ❌ Hides behavior<br>❌ Clutters tests | ❌ Avoid |
| **Environment check in trigger** | ✅ No test changes | ❌ Production code for tests<br>❌ Harder to test prod behavior | ❌ Avoid |
| **Mock database** | ✅ Full control | ❌ Not integration test<br>❌ Misses real DB issues | ❌ Wrong layer |

### 2. Storage vs Route Validation Separation

**Architecture Pattern** (documented in storage layer):
```
Route Layer (server/routes/)
├─ Input validation (Zod schemas)
├─ Trimming, length checks, format validation
└─ Sends validated data to storage

Storage Layer (server/storage/)
├─ Trusts validated data from routes
├─ Business logic and data integrity
└─ NO input validation (except SQL injection prevention)
```

**Why this separation?**:
- ✅ **Single Responsibility**: Routes handle HTTP concerns, storage handles data
- ✅ **Testability**: Storage tests don't need to test validation edge cases
- ✅ **Reusability**: Storage methods can be called from multiple routes with confidence
- ✅ **Performance**: Validation happens once at route boundary, not repeated in storage

**Test Design Principle**:
> "Storage layer tests should test storage behavior, not route validation.
> Validation tests belong in route integration tests."

**Example from this fix**:
```typescript
// ❌ WRONG - Testing route responsibility in storage test
it('should validate name is required', async () => {
  await expect(storage.createWatchList(userId, { name: '' }))
    .rejects.toThrow('Name is required');
});

// ✅ CORRECT - Test storage preserves data (route validates)
it('should preserve empty names without validation (route responsibility)', async () => {
  const result = await storage.createWatchList(userId, { name: '' });
  expect(result.name).toBe(''); // Storage doesn't validate
});

// ✅ CORRECT - Validation test in route test file
it('POST /api/watchlists validates required name', async () => {
  const res = await request(app)
    .post('/api/watchlists')
    .send({ name: '' }); // Empty name

  expect(res.status).toBe(400);
  expect(res.body.error).toContain('Name is required');
});
```

### 3. API Evolution and Backwards Compatibility

**Problem**: `getWatchedProducts` evolved from simple array to rich pagination object.

**Evolution**:
```typescript
// Version 1: Simple array
async getWatchedProducts(userId: number): Promise<Product[]>

// Version 2: Paginated with metadata
async getWatchedProducts(
  userId: number,
  options?: { limit?: number; cursor?: number | null }
): Promise<{
  products: Product[];
  hasMore: boolean;
  nextCursor: number | null;
}>
```

**Test Update Pattern**:
```typescript
// Before: Assumed array return
const products = await storage.getWatchedProducts(userId);
expect(products).toHaveLength(2);

// After: Destructure paginated result
const result = await storage.getWatchedProducts(userId);
expect(result.products).toHaveLength(2);
expect(result.hasMore).toBe(false);
expect(result.nextCursor).toBeNull();
```

**Lesson**: When APIs evolve, update ALL tests that call the method:
```bash
# Find all tests using the method
grep -rn "getWatchedProducts" server/__tests__/
```

## Testing Results

### Before Fix
```
❌ Test 1: Expected 2, received 3 (default watchlist)
❌ Test 2: Expected 0, received 1 (default watchlist)
❌ Test 3: Expected 1, received 2 (default watchlist)
❌ Test 4: Expected throw, but succeeded (storage doesn't validate)
❌ Test 5: Expected throw, but succeeded (storage doesn't validate)
❌ Test 6: Expected 'Test', got '  Test  ' (storage doesn't trim)
❌ Test 7: TypeError - products.length undefined (wrong return type)

Total: 7 failures
```

### After Fix
```
✅ Run 1: 29/29 tests passed (1284ms)
✅ Run 2: 29/29 tests passed (1336ms)
✅ Run 3: 29/29 tests passed (1375ms)
✅ Consistent timing (~1.3s)
✅ No flakiness detected
✅ All assertions correct
```

## Files Modified

1. **server/__tests__/storage-watchlist.test.ts**:
   - Added Redis and logger mocks (lines 7-31)
   - Added trigger documentation (lines 44-47)
   - Added default watchlist cleanup (lines 79-81)
   - Inverted validation test expectations (lines 263-283)
   - Fixed return type handling (lines 514-523)

## Applying This Pattern to Other Tests

### Checklist for Database Trigger Testing

- [ ] **Search for triggers** when "phantom data" appears
  ```bash
  grep -rn "CREATE TRIGGER" migrations/
  grep -rn "CREATE FUNCTION" migrations/ # Trigger functions
  ```

- [ ] **Document trigger behavior** in test comments
  ```typescript
  /**
   * NOTE: Database trigger auto-creates [entity] on [event]
   * - Trigger: trigger_name
   * - Migration: migrations/NNNN_file.sql (lines XX-YY)
   * - Creates [what it creates]
   * - We delete this in beforeEach cleanup to isolate tests
   */
  ```

- [ ] **Clean up trigger data** in test setup
  ```typescript
  beforeEach(async () => {
    // Delete auto-created data from triggers
    await db.delete(tableName).where(eq(tableName.isDefault, true));
  });
  ```

- [ ] **Consider trigger impact** on test expectations
  - Does trigger create records? (adjust count expectations)
  - Does trigger modify records? (check for unexpected changes)
  - Does trigger prevent operations? (expect constraint errors)

### Checklist for Storage vs Route Validation Testing

- [ ] **Understand architectural boundaries**
  - Routes: Zod validation, trimming, format checks
  - Storage: Business logic, data integrity, NO input validation

- [ ] **Read storage layer comments** for validation notes
  ```typescript
  // VALIDATION: [What] now handled by Zod schema in routes
  ```

- [ ] **Test storage behavior, not route validation**
  ```typescript
  // ✅ CORRECT - Storage test
  it('should preserve untrimmed values (route responsibility)', ...)

  // ❌ WRONG - Route test in storage suite
  it('should validate required field', ...)
  ```

- [ ] **Move validation tests to route test files**
  - Storage tests: Business logic, data relationships
  - Route tests: Input validation, HTTP status codes

### Checklist for API Evolution Testing

- [ ] **Check return types** before asserting
  ```typescript
  // Old API might return array
  // New API might return object with pagination
  const result = await method();
  console.log(typeof result); // Debug return type
  ```

- [ ] **Update all callers** when API changes
  ```bash
  grep -rn "methodName" server/__tests__/
  # Update every test that calls the method
  ```

- [ ] **Verify pagination metadata** if applicable
  ```typescript
  expect(result.hasMore).toBe(true/false);
  expect(result.nextCursor).toBe(number or null);
  ```

## Related Patterns

- **Database Patterns**: See `docs/02_DATABASE_PATTERNS.md` for:
  - Storage layer architecture (Section 1)
  - Transaction boundaries (Section 4)
  - Schema design patterns (Section 5)

- **API Patterns**: See `docs/03_API_PATTERNS.md` for:
  - Route layer validation (Section 2)
  - Testing patterns (Section 6)
  - Service integration (Section 4)

- **Test Isolation**: See `docs/LEARNINGS_TODO_001_WATCHLIST_TEST_FIX.md` for:
  - TRUNCATE CASCADE cleanup strategy
  - Redis mocking patterns
  - Test consistency verification

## Follow-Up TODOs Created

Based on code review, created 6 TODO files for optional improvements:

### Low Priority (P3) - Quick Wins (~45 min total)
1. **TODO_004**: Clarify test descriptions ("accept" → "preserve") - 15 min
2. **TODO_005**: Enhance pagination assertions (verify values, not just existence) - 20 min
3. **TODO_006**: Add migration line reference to trigger docs - 10 min

### Optional Enhancement (P4) - Future Improvements (~1.5 hours total)
4. **TODO_007**: Extract test data builders (reduce duplication) - 45 min
5. **TODO_008**: Add edge case tests (empty price history, cursor pagination) - 30 min
6. **TODO_009**: Add performance sanity check for complex aggregations - 20 min

**Note**: All are optional - tests are production-ready as-is.

## Lessons Learned

### 1. Database Triggers are Hidden Dependencies
**Problem**: Tests failed with "phantom data" that wasn't created in test setup.

**Solution**: Always grep for triggers when unexpected data appears:
```bash
grep -rn "CREATE TRIGGER" migrations/
```

**Prevention**: Document triggers in:
- Migration files (add comments explaining trigger behavior)
- Test files (document cleanup strategy)
- Schema documentation (list active triggers)

### 2. Architectural Boundaries Must Be Respected in Tests
**Problem**: Tests validated inputs in storage layer, but validation moved to routes.

**Solution**: Tests should match architectural boundaries:
- Storage tests → Test data operations, not validation
- Route tests → Test validation, HTTP concerns
- Service tests → Test business logic

**Prevention**: Before writing tests, read code comments for validation notes:
```typescript
// VALIDATION: [What] now handled by Zod schema in routes
```

### 3. API Evolution Requires Test Migration
**Problem**: API evolved from array → paginated object, breaking tests.

**Solution**: When changing return types:
1. Search for all callers: `grep -rn "methodName" server/__tests__/`
2. Update every test that calls the method
3. Verify new structure in tests

**Prevention**: Add integration tests that verify API contracts don't break.

### 4. Mock Patterns Should Be Consistent
**Problem**: Tests couldn't run without Redis mock.

**Solution**: Copy mock patterns from similar test files:
- Redis mocks → See `advanced-cache.test.ts`
- Logger mocks → See `storage-*.test.ts`
- Email mocks → See `email-service.test.ts`

**Prevention**: Create shared test utilities for common mocks.

### 5. Test Descriptions Should Be Precise
**Problem**: "should accept empty name" could imply validation.

**Better**: "should preserve empty names without validation (route responsibility)"

**Pattern**:
- "accept" → implies validation decision
- "preserve" → implies pass-through behavior
- Add "(route responsibility)" → clarifies architectural boundary

---

**Completion Time**: ~45 minutes (investigation + fixes + verification + documentation)
**Original Estimate**: 1 hour
**Test Success Rate**: 75.9% (22/29) → 100% (29/29) ✅
**Architecture Clarity**: Codified storage vs route validation separation
**Future-Proofing**: Created 6 TODO items for optional improvements
