# TODO 007: Extract Watchlist Test Data Builders

**Priority**: P4 - Optional Enhancement
**Status**: Not Started
**Estimated Time**: 45 minutes
**Category**: Code Quality - Test Maintainability

## Overview

Extract repeated test setup patterns into helper functions to reduce duplication in `server/__tests__/storage-watchlist.test.ts`.

## Current Issue

Test setup is duplicated across multiple `beforeEach` blocks:
- Lines 290-295: Create watchlist + add products
- Lines 374-380: Create watchlist + add products
- Lines 431-440: Create watchlist + add products + price history
- Lines 527-543: Create watchlist + add products

## Recommended Solution

Create test data builder functions:

```typescript
async function createTestWatchList(
  userId: number,
  name: string = 'Test List'
): Promise<WatchList> {
  const [list] = await db.insert(watchLists).values({
    userId,
    name,
  }).returning();
  return list;
}

async function addProductsToWatchList(
  watchListId: number,
  userId: number,
  productIds: number[]
): Promise<void> {
  await db.insert(productWatches).values(
    productIds.map(id => ({ userId, watchListId, productId: id }))
  );
}

async function createPriceHistory(
  productId: number,
  days: number,
  startPrice: number,
  priceDecrement: number = 10
): Promise<void> {
  const history = Array.from({ length: days }, (_, i) => ({
    productId,
    retailerId: testRetailerId,
    price: (startPrice - i * priceDecrement).toFixed(2),
    recordedAt: new Date(Date.now() - i * 24 * 60 * 60 * 1000),
  }));

  await db.insert(priceHistory).values(history);
}
```

## Files to Modify

- `server/__tests__/storage-watchlist.test.ts` (add helpers near top, refactor beforeEach blocks)

## Implementation Steps

1. Add helper functions after the mock definitions (after line ~31)

2. Refactor duplicated setup in test suites:
   - Lines 290-295: Use `createTestWatchList` and `addProductsToWatchList`
   - Lines 374-380: Use `createTestWatchList` and `addProductsToWatchList`
   - Lines 431-440: Use all three helpers
   - Lines 527-543: Use `createTestWatchList` and `addProductsToWatchList`

3. Example refactored `beforeEach`:
   ```typescript
   beforeEach(async () => {
     // Create watchlist with products
     testWatchList = await createTestWatchList(testUserId, 'Test List');
     await addProductsToWatchList(
       testWatchList.id,
       testUserId,
       [testProduct.id, testProduct2.id]
     );
   });
   ```

4. Run tests to ensure no regressions:
   ```bash
   npm test server/__tests__/storage-watchlist.test.ts
   ```

## Benefits

- **Reduced Duplication**: ~50 lines of duplicated setup code eliminated
- **Easier Maintenance**: Change setup logic in one place
- **Better Readability**: Test intent clearer without setup noise
- **Reusability**: Helpers can be used in new tests

## Success Criteria

- [ ] Helper functions created for common test setup patterns
- [ ] At least 4 `beforeEach` blocks refactored to use helpers
- [ ] All 29 tests still pass
- [ ] Test code is more concise and readable
- [ ] No changes to test behavior or assertions

## Optional Enhancements

If time permits, consider:
- Extract product creation helper
- Extract retailer creation helper
- Move helpers to separate `test-helpers.ts` file if they could be reused in other test files

## Related Context

From code review of TODO_003 fix - identified as "nice-to-have" for improving maintainability when more tests are added.
