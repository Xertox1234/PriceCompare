# TODO 005: Enhance Watchlist Pagination Test Assertions

**Priority**: P3 - Low
**Status**: Not Started
**Estimated Time**: 20 minutes
**Category**: Code Quality - Test Coverage

## Overview

Enhance pagination test in `server/__tests__/storage-watchlist.test.ts` to verify pagination values, not just property existence.

## Current Implementation

Test only checks that properties exist (line ~514):
```typescript
it('should respect limit option', async () => {
  const result = await storage.getWatchedProducts(testUserId, { limit: 1 });

  expect(result.products).toHaveLength(1);
  expect(result).toHaveProperty('hasMore');
  expect(result).toHaveProperty('nextCursor');
});
```

## Recommended Enhancement

Verify actual pagination behavior:
```typescript
it('should respect limit option', async () => {
  const result = await storage.getWatchedProducts(testUserId, { limit: 1 });

  expect(result.products).toHaveLength(1);
  expect(result.hasMore).toBe(true); // Two products added, limit=1, so more=true
  expect(result.nextCursor).toBeDefined();
  expect(typeof result.nextCursor).toBe('number');
});
```

## Files to Modify

- `server/__tests__/storage-watchlist.test.ts` (lines ~514-523)

## Implementation Steps

1. Locate the "should respect limit option" test (~line 514)

2. Replace assertions with enhanced version:
   ```typescript
   it('should respect limit option', async () => {
     const result = await storage.getWatchedProducts(testUserId, { limit: 1 });

     // Verify correct number of products returned
     expect(result.products).toHaveLength(1);

     // Verify hasMore is true (we have 2 products, limit is 1)
     expect(result.hasMore).toBe(true);

     // Verify nextCursor is a valid number
     expect(result.nextCursor).toBeDefined();
     expect(typeof result.nextCursor).toBe('number');
   });
   ```

3. Run tests to verify:
   ```bash
   npm test server/__tests__/storage-watchlist.test.ts
   ```

## Success Criteria

- [ ] Test verifies `hasMore` value is correct (not just property existence)
- [ ] Test verifies `nextCursor` type is number
- [ ] Test still passes with enhanced assertions
- [ ] Comments explain why `hasMore` should be `true`

## Related Context

From code review of TODO_003 fix - current test only checks structure, not pagination logic correctness.
