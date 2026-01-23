# TODO 256: Fix Cache Over-Invalidation Pattern

**Priority**: P2 - Important (Performance)
**Effort**: Medium (~2-3 hours)
**Category**: Performance
**Source**: Code Review - Performance Oracle Agent
**Branch**: add_scraping

## Problem Statement

Every price update, product update, and offer update invalidates ALL search results by calling `advancedCache.invalidatePrefix(CachePrefix.PRODUCT_SEARCH)`. This causes:

1. Single product price change invalidates thousands of search cache entries
2. Search cache hit rate approaches 0% during active price scraping
3. Estimated 10x increase in database load for search queries during updates

## Impact Analysis

| Scale | Products | Expected Impact |
|-------|----------|-----------------|
| Current | ~1,000 | Manageable, noticeable during scraping |
| 10x | 10,000 | Search cache effectively useless |
| 100x | 100,000 | Database overwhelmed during price updates |

## Findings

### Over-Invalidation Locations

**cache-invalidation.ts:108** (Price Update)
```typescript
advancedCache.invalidatePrefix(CachePrefix.PRODUCT_SEARCH),
```

**cache-invalidation.ts:136-137** (Product Update)
```typescript
advancedCache.invalidatePrefix(CachePrefix.PRODUCT_SEARCH),
```

**cache-invalidation.ts:189** (Offer Update)
```typescript
advancedCache.invalidatePrefix(CachePrefix.PRODUCT_SEARCH),
```

### Batch Amplification (Lines 232-247)
```typescript
// For 100 products: 100 x 5 invalidation patterns = 500 SCAN operations
for (let i = 0; i < productIds.length; i += batchSize) {
  const batch = productIds.slice(i, i + batchSize);
  await Promise.all(batch.map((productId) => this.onPriceUpdate(productId)));
}
```

## Proposed Solutions

### Option 1: Short TTL Instead of Event-Driven Invalidation (Recommended)
- Set search cache TTL to 1-3 minutes
- Remove search invalidation from price/product update events
- Pros: Simple, predictable, no complex tagging
- Cons: Slightly stale search results (acceptable trade-off)

### Option 2: Product-Tagged Cache Keys
- Include product IDs in search cache keys
- Only invalidate caches containing the updated product
- Pros: Precise invalidation
- Cons: Complex implementation, memory overhead for tags

### Option 3: Background Re-computation
- Don't invalidate, queue background job to refresh affected caches
- Pros: No cache misses during updates
- Cons: Temporary staleness, job queue overhead

## Acceptance Criteria

- [ ] Price updates don't invalidate ALL search caches
- [ ] Search cache hit rate > 80% during normal operation
- [ ] Batch updates don't cause SCAN explosion
- [ ] Performance test showing improvement

## Files to Modify

- `server/services/cache-invalidation.ts`
- `server/services/advanced-cache.ts` (if implementing tagging)

## Work Log

| Date | Action | Notes |
|------|--------|-------|
| 2026-01-23 | Created | From code review - performance oracle agent |
| 2026-01-23 | **APPROVED** | Triage session - ready to work on |

## Resources

- Cache service: `server/services/advanced-cache.ts`
- Invalidation service: `server/services/cache-invalidation.ts`
