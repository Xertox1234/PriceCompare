# TODO 003: Fix Storage Watchlist Tests

**Priority**: P1 - High
**File**: `server/__tests__/storage-watchlist.test.ts`
**Failures**: 3 tests
**Estimated Time**: 1 hour
**Status**: Not Started

## Failing Tests

1. ✗ `should return all watch lists for user with product counts`
   - **Expected**: 2 watch lists
   - **Received**: 3 watch lists

2. ✗ `should return empty array for user with no lists`
   - **Expected**: Empty array `[]`
   - **Received**: 1 watch list (default watchlist)

3. ✗ `should not return other users watch lists`
   - **Expected**: 1 watch list
   - **Received**: 2 watch lists

## Root Cause

Tests don't account for automatically created default watchlist. Evidence from CI logs:

```json
{
  "id": 1,
  "userId": 1,
  "name": "My Watchlist",
  "description": "Default watch list",
  "isDefault": true,
  "createdAt": "2025-12-01T13:08:57.973Z"
}
```

## Fix Strategy

Choose one approach:

### Option A: Delete Default Watchlist in Tests (Recommended)

```typescript
beforeEach(async () => {
  // ... existing cleanup ...

  // After creating test user, remove any default watchlist
  await db.delete(watchLists).where(eq(watchLists.isDefault, true));
});
```

### Option B: Update Test Expectations

```typescript
it('should return all watch lists for user with product counts', async () => {
  // Filter out default watchlist
  const watchListsResult = await storage.getUserWatchLists(testUserId);
  const nonDefaultLists = watchListsResult.filter(list => !list.isDefault);

  expect(nonDefaultLists).toHaveLength(2);
});

it('should return empty array for user with no lists', async () => {
  const watchListsResult = await storage.getUserWatchLists(testUserId);
  const nonDefaultLists = watchListsResult.filter(list => !list.isDefault);

  expect(nonDefaultLists).toHaveLength(0);
});
```

### Option C: Disable Default Watchlist Creation

Find where default watchlists are created and add test environment check:

```typescript
// In watchlist-storage.ts or wherever creation happens
if (process.env.NODE_ENV !== 'test') {
  // Create default watchlist
}
```

## Checklist

- [ ] Investigate where default watchlist is created
  ```bash
  grep -rn "Default watch list\|isDefault.*true" server/storage/
  grep -rn "My Watchlist" server/
  ```

- [ ] Check if creation happens on:
  - [ ] User registration
  - [ ] First `getUserWatchLists` call
  - [ ] Storage layer initialization

- [ ] Implement chosen fix (A, B, or C)

- [ ] Update all 3 failing tests consistently

- [ ] Test fix
  ```bash
  npm test server/__tests__/storage-watchlist.test.ts
  ```

- [ ] Verify tests pass 3 times
  ```bash
  for i in {1..3}; do npm test server/__tests__/storage-watchlist.test.ts; done
  ```

- [ ] Document default watchlist behavior in test comments

## Success Criteria

- [ ] All 3 tests pass
- [ ] Tests accurately reflect system behavior
- [ ] Default watchlist handling is consistent
- [ ] Tests don't break if default watchlist creation changes

## Estimated Timeline

- Investigation: 15 minutes
- Implementation: 20 minutes
- Testing: 15 minutes
- Documentation: 10 minutes

**Total**: ~1 hour
