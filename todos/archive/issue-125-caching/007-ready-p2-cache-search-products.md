# TODO: Cache searchProducts(filters) - Product Search

## Priority: P2 (Important)
## Status: ✅ Ready to Pick Up
## Created: 2025-12-01
## Issue: #125 - Phase 2, Task 2

---

## Problem Statement

Implement cached wrapper for `searchProducts(filters)` - one of the most expensive operations. Search queries with complex filters can take 100-500ms. Caching common searches will dramatically improve search page performance.

**Current State:**
- Every search hits database with complex WHERE clauses and JOINs
- 100-500ms query latency for filtered searches
- Same searches executed repeatedly (e.g., "Electronics" category)
- No caching - popular search queries waste database resources

**Why This Matters:**
- **Expensive Queries**: Complex filters = slow queries (100-500ms)
- **Common Patterns**: Users search similar terms repeatedly
- **Database Load**: Search is one of heaviest database operations
- **Expected Cache Hit Rate**: 50-70% (1-2min TTL, common searches stay cached)

---

## Implementation

```typescript
/**
 * Search products with caching.
 * Cache key: product:search:{hash(filters)}
 * TTL: 1-2 minutes (60-120s)
 * Tier: COLD (occasionally accessed, short TTL due to price volatility)
 */
async searchProducts(filters: ProductSearchFilters): Promise<Product[]> {
  const filterHash = this.hashFilters(filters);
  const cacheKey = `product:search:${filterHash}`;

  return this.cachedGet<Product[]>(
    cacheKey,
    () => storage.searchProducts(filters),
    120, // 2 minutes (balance: freshness vs performance)
    'COLD'
  );
}
```

**Cache Key Strategy:**
- Use `hashFilters()` to create deterministic hash
- Same filters (different order) → same cache key
- Hash ensures reasonable key length

**TTL Rationale:**
- 2 minutes chosen for balance
- Prices change frequently → need fresher data
- Common searches (e.g., category pages) still benefit

---

## Technical Details

**Affected Files:**
- `server/services/storage-cache.ts`

**Dependencies:**
- Task 004 (hashFilters method must exist)
- Task 001 (StorageCacheService class)
- Task 002 (cachedGet primitive)

**Cache Behavior:**
- First search with filters → cache MISS → query DB → cache result
- Repeat search within 2min → cache HIT → return from cache
- After 2min → cache EXPIRED → refresh from DB

**Performance:**
- Cache hit: 5-10ms (Redis)
- Cache miss: 100-500ms (database)
- Expected hit rate: 50-70%

---

## Acceptance Criteria

- [ ] `searchProducts(filters)` method added
- [ ] Uses `hashFilters()` for cache key generation
- [ ] Cache key format: `product:search:${hash}`
- [ ] TTL: 120 seconds (2 minutes)
- [ ] Tier: 'COLD'
- [ ] Return type: `Promise<Product[]>`
- [ ] JSDoc with description and example
- [ ] TypeScript compilation passes

---

## Notes

**Source:** GitHub issue #125, Phase 2, Task 2
**Dependencies:** Tasks 001, 002, 004
**Blocks:** Task 017 (route integration)
