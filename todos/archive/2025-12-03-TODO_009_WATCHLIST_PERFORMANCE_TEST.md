# TODO 009: Add Watchlist Performance Sanity Check

**Priority**: P4 - Optional Enhancement
**Status**: Not Started
**Estimated Time**: 20 minutes
**Category**: Test Coverage - Performance

## Overview

Add performance sanity check to `server/__tests__/storage-watchlist.test.ts` for `getWatchedProducts` which performs complex aggregations.

## Why This Matters

`getWatchedProducts` performs:
- JOINs across multiple tables (products, productWatches, productOffers, priceHistory)
- Price aggregations (MIN, MAX)
- 7-day sparkline generation
- Sorting by price drop percentage

This is computationally expensive and could regress without monitoring.

## Recommended Test

```typescript
it('should complete getWatchedProducts within reasonable time', async () => {
  const startTime = performance.now();
  await storage.getWatchedProducts(testUserId);
  const duration = performance.now() - startTime;

  // Sanity check: should complete in under 500ms
  // Note: This is NOT a strict performance test, just a regression detector
  expect(duration).toBeLessThan(500);
});
```

## Important Notes

**This is NOT a strict performance test**. It's a sanity check to detect:
- Accidental N+1 queries introduced during refactoring
- Missing indexes that cause table scans
- Cartesian product joins from incorrect JOIN conditions

**Do NOT**:
- Use this for benchmarking (use dedicated performance tools)
- Set unrealistic thresholds (500ms is generous for test database)
- Fail CI builds on marginal timing variations (add some buffer)

## Files to Modify

- `server/__tests__/storage-watchlist.test.ts` (add to `getWatchedProducts` describe block)

## Implementation Steps

1. Add test to `getWatchedProducts` describe block (~line 400):
   ```typescript
   describe('getWatchedProducts', () => {
     // ... existing tests ...

     it('should complete within reasonable time (performance sanity check)', async () => {
       const startTime = performance.now();
       await storage.getWatchedProducts(testUserId);
       const duration = performance.now() - startTime;

       // Sanity check - detects accidental N+1 queries or missing indexes
       // NOT a strict performance test - just regression detection
       expect(duration).toBeLessThan(500); // 500ms buffer for CI variability
     });
   });
   ```

2. Run test multiple times to verify stability:
   ```bash
   for i in {1..5}; do npm test server/__tests__/storage-watchlist.test.ts --testNamePattern="performance sanity"; done
   ```

3. If test is flaky (timing varies widely), increase threshold:
   ```typescript
   expect(duration).toBeLessThan(1000); // More generous for slower CI environments
   ```

## Success Criteria

- [ ] Performance sanity check test added
- [ ] Test passes consistently (5 consecutive runs)
- [ ] Threshold is reasonable (accounts for CI environment variability)
- [ ] Test includes comment explaining it's NOT a strict performance test
- [ ] Test would fail if N+1 query accidentally introduced

## Optional Enhancements

If time permits:
- Add performance checks for other expensive operations (`getWatchListStats`)
- Log actual duration for monitoring trends over time
- Add test for large dataset (100 products) to verify scalability

## Related Context

From code review of TODO_003 fix - `getWatchedProducts` does complex aggregations, so a performance sanity check would help detect regressions early.

## Example Regression This Would Catch

```typescript
// BAD: Accidental N+1 query
for (const product of products) {
  const priceHistory = await db.select()
    .from(priceHistory)
    .where(eq(priceHistory.productId, product.id)); // N queries!
}

// Performance test would fail: 50ms → 500ms+
```
