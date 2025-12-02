# TODO: Cache getProductById(id) - Product Details

## Priority: P2 (Important)
## Status: ✅ Ready to Pick Up
## Created: 2025-12-01
## Issue: #125 - Phase 2, Task 1

---

## Problem Statement

Implement cached wrapper for `getProductById(id)` - the **most frequently accessed storage method**. Product detail pages hit this endpoint on every view. Caching will reduce response time from 50-150ms (database + joins) to 1-5ms (in-memory cache hit).

**Current State:**
- Every product detail page view hits database
- Complex JOIN queries (product + offers + retailer data)
- 50-150ms query latency on every request
- No caching layer - same products queried repeatedly
- Popular products queried 100s of times per day

**Why This Matters:**
- **#1 Traffic Volume**: Most frequently called storage method
- **User Experience**: Product pages load 30-50x faster with cache hits
- **Database Load**: 70-90% reduction in product detail queries
- **Infrastructure Cost**: Lower database CPU/memory usage
- **Scalability**: Handles traffic spikes without database strain

---

## Findings

**Location:** `server/services/storage-cache.ts` (new public method)

**Traffic Analysis:**
- **Endpoint**: `GET /api/products/:id`
- **Current Performance**: 50-150ms (database query + JOINs)
- **Expected Cache Performance**:
  - L1 hit (in-memory): 1-5ms
  - L2 hit (Redis): 5-10ms
  - Cache miss: 50-150ms + cache write
- **Expected Cache Hit Rate**: 70-90% (popular products stay hot)

**Query Complexity:**
```typescript
// storage.getProductById() performs:
// - Main product query
// - LEFT JOIN with product_offers
// - LEFT JOIN with retailers
// - Price calculation aggregations
// Total: 50-150ms for complex products
```

**Cache Specifications (from JSDoc in storage.ts:1408-1575):**
- **Cache Key**: `product:full:${id}`
- **TTL**: 5 minutes (300s)
- **Tier**: WARM (regularly accessed, moderate TTL)
- **Invalidation**: On product update, delete, price change

**Related Files:**
- `server/storage.ts:450-490` - `getProductById()` implementation
- `server/routes/product-routes.ts:35-55` - Product detail endpoint
- `server/services/storage-cache.ts` - Implementation location

---

## Proposed Solutions

### Option 1: Simple Cached Wrapper (Recommended)

```typescript
/**
 * Get product by ID with multi-tier caching.
 *
 * Cache key: `product:full:${id}`
 * TTL: 5 minutes (300s)
 * Tier: WARM (regularly accessed)
 *
 * @param id - Product ID
 * @returns Product with offers and retailer data, or null if not found
 *
 * @example
 * const product = await storageCache.getProductById(123);
 * if (product) {
 *   console.log(`${product.name} - ${product.offers.length} offers`);
 * }
 */
async getProductById(id: number): Promise<Product | null> {
  const cacheKey = `product:full:${id}`;
  return this.cachedGet<Product | null>(
    cacheKey,
    () => storage.getProductById(id),
    300, // 5 minutes
    'WARM'
  );
}
```

- **Pros**:
  - Clean, simple implementation
  - Follows cache specifications exactly
  - Uses generic cachedGet primitive
  - Type-safe return (Product | null)
  - Self-documenting via JSDoc
- **Cons**:
  - None - this is the ideal implementation
- **Effort**: Small (30 min - 1 hour)
- **Risk**: Low

### Option 2: Cache with Metrics Tracking

```typescript
async getProductById(id: number): Promise<Product | null> {
  const cacheKey = `product:full:${id}`;
  const startTime = Date.now();

  const result = await this.cachedGet<Product | null>(
    cacheKey,
    () => storage.getProductById(id),
    300,
    'WARM'
  );

  const duration = Date.now() - startTime;
  logger.debug(`getProductById(${id})`, { duration, cached: duration < 10 });

  return result;
}
```

- **Pros**:
  - Adds performance monitoring
  - Helps track cache effectiveness
  - Useful for optimization
- **Cons**:
  - More code
  - Adds logging overhead
  - Metrics can be added later if needed
- **Effort**: Small (1 hour)
- **Risk**: Low

---

## Recommended Action

**Use Option 1: Simple Cached Wrapper**

Keep it simple for initial implementation. Metrics/monitoring can be added later to the `cachedGet()` primitive itself if needed (benefits all cached methods).

**Implementation Checklist:**

1. **Add Method to StorageCacheService:**
   - Signature: `async getProductById(id: number): Promise<Product | null>`
   - Cache key: `product:full:${id}`
   - TTL: 300 seconds (5 minutes)
   - Tier: 'WARM'

2. **Import Types:**
   ```typescript
   import type { Product } from '@shared/schema';
   ```

3. **Add JSDoc:**
   - Document cache behavior
   - Include example usage
   - Note TTL and invalidation strategy

4. **Export Method:**
   - Public method on StorageCacheService class
   - Accessible via `storageCache.getProductById(id)`

---

## Technical Details

**Affected Files:**
- `server/services/storage-cache.ts` (add getProductById method)

**Related Components:**
- `storage.getProductById()` - Underlying database query
- `product-routes.ts` - Will consume this method (Phase 4)

**Database Changes:** No

**Cache Behavior:**
- **First Call**: Cache MISS → Query database → Store in L1 + L2 → Return data
- **Subsequent Calls (< 5min)**: Cache HIT → Return from L1/L2 → Skip database
- **After 5min**: Cache EXPIRED → Query database → Refresh cache → Return data

**Type Safety:**
```typescript
const product = await storageCache.getProductById(123);
// Type: Product | null ✓
// TypeScript knows product might be null
if (product) {
  console.log(product.name); // Safe access
}
```

---

## Acceptance Criteria

- [ ] `getProductById(id)` method added to `StorageCacheService`
- [ ] Method signature: `async getProductById(id: number): Promise<Product | null>`
- [ ] Cache key format: `product:full:${id}`
- [ ] TTL set to 300 seconds (5 minutes)
- [ ] Tier set to 'WARM'
- [ ] Uses `this.cachedGet()` primitive
- [ ] JSDoc comment with description, params, returns, example
- [ ] TypeScript compilation passes (`npm run check`)
- [ ] Return type properly typed as `Product | null`
- [ ] Public method (accessible outside class)

**Manual Testing:**
```bash
# Start app with Redis
npm run dev

# Test 1: First call (cache miss)
curl http://localhost:5000/api/products/1
# Should work, ~50-150ms response time

# Check Redis
redis-cli GET "product:full:1"
# Should return cached JSON

# Test 2: Second call (cache hit)
curl http://localhost:5000/api/products/1
# Should be much faster (~1-10ms)

# Test 3: After 5 minutes
# Wait 5+ minutes, call again
curl http://localhost:5000/api/products/1
# Should refresh cache (cache miss)
```

---

## Resources

**Internal References:**
- `server/storage.ts:450-490` - getProductById implementation
- `server/storage.ts:1408-1575` - Cache specifications (JSDoc)
- `docs/storage-layer/CACHING_STRATEGY_GUIDE.md` - Caching guide
- `shared/schema.ts` - Product type definition

**Performance References:**
- [Redis Performance Best Practices](https://redis.io/docs/management/optimization/)
- [Node.js Caching Strategies](https://betterstack.com/community/guides/scaling-nodejs/nodejs-caching-redis/)

---

## Work Log

### 2025-12-01 - Initial Discovery
**By:** Claude Triage System
**Actions:**
- Issue discovered during triage of GitHub #125
- Categorized as P2 (Important) - highest-traffic method
- Estimated effort: Small (30 min - 1 hour)
- Marked as **Ready to Pick Up**

**Learnings:**
- This is Phase 2, Task 1 - first high-traffic method to cache
- Expected 70-90% cache hit rate for popular products
- 30-50x performance improvement on cache hits
- Foundation for all other cached storage methods

---

## Notes

**Source:** Triage session on 2025-12-01 for GitHub issue #125
**Phase:** 2 of 4 (High-Traffic Method Caching)
**Dependencies:** Tasks 001, 002 (StorageCacheService and cachedGet must exist)
**Blocks:** Task 016 (route integration needs this method)
**Production Impact:** Highest performance impact of all caching tasks
