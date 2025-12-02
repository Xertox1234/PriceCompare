# TODO: Cache getAllRetailers() - Retailer List

## Priority: P2 (Important)
## Status: ✅ Ready to Pick Up
## Created: 2025-12-01
## Issue: #125 - Phase 2, Task 3

---

## Problem Statement

Implement cached wrapper for `getAllRetailers()` - a relatively static dataset that changes infrequently. Perfect candidate for aggressive caching with 60-minute TTL.

**Current State:**
- Every request hits database for retailer list
- Retailers rarely change (only admin operations)
- Small dataset but called frequently (dropdowns, filters, product pages)
- 20-50ms query latency unnecessarily repeated

**Why This Matters:**
- **Static Data**: Retailers change rarely (days/weeks between updates)
- **High Frequency**: Called on many pages (search filters, product displays)
- **Easy Wins**: 95%+ cache hit rate possible with 60min TTL
- **Near-Zero Latency**: L1 cache hit = 1ms (vs 20-50ms database)

---

## Implementation

```typescript
/**
 * Get all retailers with caching.
 * Cache key: retailer:all
 * TTL: 60 minutes (3600s)
 * Tier: STATIC (rarely changes)
 */
async getAllRetailers(): Promise<Retailer[]> {
  const cacheKey = 'retailer:all';

  return this.cachedGet<Retailer[]>(
    cacheKey,
    () => storage.getAllRetailers(),
    3600, // 60 minutes
    'STATIC'
  );
}
```

**Cache Strategy:**
- Single cache key (no parameters)
- Long TTL (60 minutes) - retailers rarely change
- STATIC tier - highest priority for L1 cache

---

## Technical Details

**Affected Files:**
- `server/services/storage-cache.ts`

**Cache Behavior:**
- First call → cache MISS → query DB → store in L1 + L2
- Next 60 minutes → cache HIT from L1 (in-memory, ~1ms)
- After 60 minutes → cache EXPIRED → refresh

**Performance:**
- Cache hit (L1): ~1ms
- Cache hit (L2): ~5ms
- Cache miss: 20-50ms
- Expected hit rate: 95%+

---

## Acceptance Criteria

- [ ] `getAllRetailers()` method added
- [ ] Cache key: `retailer:all`
- [ ] TTL: 3600 seconds (60 minutes)
- [ ] Tier: 'STATIC'
- [ ] Return type: `Promise<Retailer[]>`
- [ ] JSDoc with description
- [ ] TypeScript compilation passes

---

## Notes

**Source:** GitHub issue #125, Phase 2, Task 3
**Dependencies:** Tasks 001, 002
**Blocks:** Task 018 (route integration)
