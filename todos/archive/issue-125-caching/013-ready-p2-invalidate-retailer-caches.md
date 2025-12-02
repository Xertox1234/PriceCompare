# TODO: Invalidate Retailer Caches on Update/Delete

## Priority: P2 (Important)
## Status: ✅ Ready to Pick Up
## Created: 2025-12-01
## Issue: #125 - Phase 3, Task 3

---

## Problem Statement

When retailers are updated or deleted (admin operations), cached retailer data must be invalidated.

---

## Implementation

```typescript
/**
 * Invalidate retailer caches after update or delete.
 *
 * Clears:
 * - retailer:id:{id}
 * - retailer:all
 *
 * @param retailerId - ID of updated/deleted retailer
 */
async invalidateRetailerCache(retailerId: number): Promise<void> {
  try {
    // Specific retailer
    await this.cache.invalidate(`retailer:id:${retailerId}`);

    // All retailers list
    await this.cache.invalidate('retailer:all');

    logger.debug('Retailer cache invalidated', { retailerId });
  } catch (error) {
    logger.warn('Failed to invalidate retailer cache', { retailerId, error });
  }
}
```

**Integration:** Call from `storage.updateRetailer()` and `storage.deleteRetailer()`

---

## Acceptance Criteria

- [ ] `invalidateRetailerCache(retailerId)` method added
- [ ] Invalidates `retailer:id:${id}` cache
- [ ] Invalidates `retailer:all` cache
- [ ] Graceful error handling
- [ ] JSDoc documentation

---

## Notes

**Source:** GitHub issue #125, Phase 3, Task 3
**Dependencies:** Tasks 001, 002, 008, 009
