# TODO: Invalidate Product Caches on Update/Delete

## Priority: P2 (Important)
## Status: ✅ Ready to Pick Up
## Created: 2025-12-01
## Issue: #125 - Phase 3, Task 1

---

## Problem Statement

Implement cache invalidation for product updates and deletes. When a product changes, all related caches must be cleared to prevent stale data.

**Invalidation Triggers:**
- `storage.updateProduct(id, updates)` - invalidate product detail cache
- `storage.deleteProduct(id)` - invalidate all product-related caches

---

## Implementation

```typescript
/**
 * Invalidate product caches after update or delete.
 *
 * Clears:
 * - product:full:{id}
 * - product:offers:{id}
 * - product:search:* (all search caches - aggressive but safe)
 *
 * @param productId - ID of updated/deleted product
 */
async invalidateProductCache(productId: number): Promise<void> {
  try {
    // Invalidate specific product cache
    await this.cache.invalidate(`product:full:${productId}`);
    await this.cache.invalidate(`product:offers:${productId}`);

    // Invalidate all search caches (product might appear in searches)
    await this.cache.invalidatePattern('product:search:*');

    logger.debug('Product cache invalidated', { productId });
  } catch (error) {
    // Log but don't throw - cache invalidation failures shouldn't break updates
    logger.warn('Failed to invalidate product cache', { productId, error });
  }
}
```

**Integration Points:**
- Call from `storage.updateProduct()` after successful update
- Call from `storage.deleteProduct()` after successful deletion
- Wrap in try-catch to prevent cache errors from breaking updates

---

## Technical Details

**Invalidation Strategy:**
- **Specific keys**: `product:full:${id}`, `product:offers:${id}`
- **Pattern match**: `product:search:*` (all searches)
- **Graceful failure**: Log errors but don't throw

**Why Invalidate All Searches?**
- Product might appear in multiple search results
- Tracking which searches contain which products is complex
- Search cache TTL is short (2min) anyway
- Better to over-invalidate than serve stale data

---

## Acceptance Criteria

- [ ] `invalidateProductCache(productId)` method added
- [ ] Invalidates `product:full:${id}` cache
- [ ] Invalidates `product:offers:${id}` cache
- [ ] Invalidates `product:search:*` pattern
- [ ] Wraps calls in try-catch (graceful failure)
- [ ] Logs success/failure appropriately
- [ ] JSDoc documentation
- [ ] TypeScript passes

---

## Notes

**Source:** GitHub issue #125, Phase 3, Task 1
**Dependencies:** Tasks 001, 002, 006, 007
**Integration:** Will be called from storage.updateProduct/deleteProduct
