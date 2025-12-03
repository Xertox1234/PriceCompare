# TODO 008: Add Watchlist Edge Case Tests

**Priority**: P4 - Optional Enhancement
**Status**: Not Started
**Estimated Time**: 30 minutes
**Category**: Test Coverage - Edge Cases

## Overview

Add edge case tests to `server/__tests__/storage-watchlist.test.ts` for scenarios not currently covered:
1. Products with no price history (empty sparkline)
2. Products with no current offers (no currentPrice)

## Missing Test Case 1: Empty Price History

**Scenario**: Product is added to watchlist but has no historical price data.

**Expected Behavior**:
- `last7Days` should be empty array `[]`
- `currentPrice` should be `0` (no offers)
- `lowestPrice` should be `0` (no history)
- `priceDropPercent` should be `0` or `null`

**Implementation**:
```typescript
it('should handle products with no price history', async () => {
  // Create product with no price history
  const [newProduct] = await db.insert(products).values({
    name: 'New Product No History',
    category: 'Test',
  }).returning();

  // Create watch list and add product
  const [list] = await db.insert(watchLists).values({
    userId: testUserId,
    name: 'Test',
  }).returning();

  await db.insert(productWatches).values({
    userId: testUserId,
    watchListId: list.id,
    productId: newProduct.id,
  });

  const result = await storage.getWatchedProducts(testUserId);
  const product = result.products.find(p => p.productId === newProduct.id);

  expect(product).toBeDefined();
  expect(product!.last7Days).toEqual([]); // Empty sparkline
  expect(product!.currentPrice).toBe(0); // No offers
  expect(product!.lowestPrice).toBe(0); // No history
});
```

## Missing Test Case 2: End-to-End Cursor Pagination

**Scenario**: Verify cursor pagination actually returns different products across pages.

**Expected Behavior**:
- First page returns first product and valid cursor
- Second page uses cursor and returns different product
- Products don't overlap between pages

**Implementation**:
```typescript
it('should implement cursor pagination correctly', async () => {
  // Page 1: Get first product
  const page1 = await storage.getWatchedProducts(testUserId, { limit: 1 });
  expect(page1.products).toHaveLength(1);
  expect(page1.hasMore).toBe(true);
  expect(page1.nextCursor).toBeDefined();

  const firstProductId = page1.products[0].productId;

  // Page 2: Use cursor to get second product
  const page2 = await storage.getWatchedProducts(testUserId, {
    limit: 1,
    cursor: page1.nextCursor,
  });

  expect(page2.products).toHaveLength(1);

  // Verify products are different (no overlap)
  expect(page2.products[0].productId).not.toBe(firstProductId);

  // Verify hasMore is false (only 2 products total)
  expect(page2.hasMore).toBe(false);
  expect(page2.nextCursor).toBeNull();
});
```

## Files to Modify

- `server/__tests__/storage-watchlist.test.ts` (add new test cases in appropriate describe blocks)

## Implementation Steps

1. **Add empty price history test**:
   - Add to the `getWatchedProducts` describe block (~line 400)
   - Create product without price history or offers
   - Verify sparkline and price fields handle missing data gracefully

2. **Add cursor pagination test**:
   - Add to the `getWatchedProducts` describe block (~line 400)
   - Fetch page 1 with limit=1
   - Fetch page 2 with cursor from page 1
   - Verify no product overlap and correct hasMore/nextCursor values

3. **Run tests to verify**:
   ```bash
   npm test server/__tests__/storage-watchlist.test.ts
   ```

4. **Verify test count increases**:
   - Before: 29 tests
   - After: 31 tests (29 + 2 new edge cases)

## Success Criteria

- [ ] Empty price history test added and passing
- [ ] Cursor pagination test added and passing
- [ ] Tests verify edge case behavior is correct
- [ ] Total test count increases from 29 to 31
- [ ] No regressions in existing tests

## Benefits

- **Better Coverage**: Tests verify behavior in edge cases
- **Regression Prevention**: Catches bugs when refactoring aggregation logic
- **Documentation**: Tests serve as examples of expected edge case behavior

## Related Context

From code review of TODO_003 fix - identified as optional enhancement to improve test coverage for edge cases not currently exercised.
