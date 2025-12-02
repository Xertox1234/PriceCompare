# TODO: Invalidate Caches on Price Changes

## Priority: P2 (Important)
## Status: ✅ Ready to Pick Up
## Created: 2025-12-01
## Issue: #125 - Phase 3, Task 2

---

## Problem Statement

When product prices change, both product detail and search caches must be invalidated to show current pricing information.

---

## Implementation

```typescript
/**
 * Invalidate caches when product price changes.
 * Called by price snapshot service, offer updates, etc.
 *
 * @param productId - Product with updated price
 */
async invalidatePriceCache(productId: number): Promise<void> {
  try {
    // Price changes affect product details and search results
    await this.invalidateProductCache(productId);

    logger.debug('Price cache invalidated', { productId });
  } catch (error) {
    logger.warn('Failed to invalidate price cache', { productId, error });
  }
}
```

**Integration:** Call from price update operations (snapshot service, offer management)

---

## Acceptance Criteria

- [ ] `invalidatePriceCache(productId)` method added
- [ ] Delegates to `invalidateProductCache()`
- [ ] Graceful error handling
- [ ] Logging for debugging
- [ ] JSDoc documentation

---

## Notes

**Source:** GitHub issue #125, Phase 3, Task 2
**Dependencies:** Task 011 (invalidateProductCache)
