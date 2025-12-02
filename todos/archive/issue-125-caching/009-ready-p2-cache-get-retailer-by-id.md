# TODO: Cache getRetailerById(id) - Retailer Details

## Priority: P2 (Important)
## Status: ✅ Ready to Pick Up
## Created: 2025-12-01
## Issue: #125 - Phase 2, Task 4

---

## Problem Statement

Implement cached wrapper for `getRetailerById(id)` - individual retailer lookup with 60-minute TTL. Retailers change infrequently, making this ideal for aggressive caching.

---

## Implementation

```typescript
/**
 * Get retailer by ID with caching.
 * Cache key: retailer:id:{id}
 * TTL: 60 minutes (3600s)
 * Tier: STATIC
 */
async getRetailerById(id: number): Promise<Retailer | null> {
  const cacheKey = `retailer:id:${id}`;

  return this.cachedGet<Retailer | null>(
    cacheKey,
    () => storage.getRetailerById(id),
    3600, // 60 minutes
    'STATIC'
  );
}
```

---

## Acceptance Criteria

- [ ] Method added to StorageCacheService
- [ ] Cache key: `retailer:id:${id}`
- [ ] TTL: 3600s (60 minutes)
- [ ] Tier: 'STATIC'
- [ ] Return type: `Promise<Retailer | null>`
- [ ] JSDoc documentation
- [ ] TypeScript passes

---

## Notes

**Source:** GitHub issue #125, Phase 2, Task 4
**Dependencies:** Tasks 001, 002
