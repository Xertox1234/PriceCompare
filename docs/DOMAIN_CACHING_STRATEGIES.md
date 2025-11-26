# Domain-Specific Caching Strategies

**Status**: Comprehensive guide for caching patterns across storage layer domains

**Related Documentation**:
- `ARCHITECTURE.md` - Storage layer architecture and repository pattern
- `server/middleware/redis-cache.ts` - HTTP response caching middleware
- `server/services/advanced-cache.ts` - Multi-tier cache service (L1/L2)

---

## Table of Contents

1. [Overview](#overview)
2. [Caching Architecture](#caching-architecture)
3. [Domain-Specific Strategies](#domain-specific-strategies)
4. [Cache Invalidation Patterns](#cache-invalidation-patterns)
5. [Performance Considerations](#performance-considerations)
6. [Implementation Examples](#implementation-examples)

---

## Overview

This document provides caching recommendations for each domain in the storage layer. The strategies are based on:

- **Data Access Patterns**: How frequently data is read vs written
- **Data Mutability**: How often data changes
- **Data Criticality**: Tolerance for stale data
- **Query Complexity**: Cost of regenerating data
- **User Context**: Whether data is user-specific or global

### Caching Layers Available

1. **L1 Cache** (In-Memory LRU): Ultra-hot data, 60s TTL, 1000 items max
2. **L2 Cache** (Redis): Distributed cache with configurable TTL
3. **HTTP Response Cache**: Middleware-level response caching
4. **Client Cache** (React Query): Browser-side state with `staleTime`/`gcTime`

---

## Caching Architecture

### Multi-Tier Cache Flow

```
Request → L1 Cache (In-Memory) → L2 Cache (Redis) → Database → Response
          ↑ 60s TTL               ↑ Tier-based TTL    ↑ Source of truth
          ↑ 1000 items max        ↑ Distributed       ↑ PostgreSQL
```

### Cache Tiers (from `advanced-cache.ts`)

| Tier       | TTL      | Use Case                                    |
|------------|----------|---------------------------------------------|
| `HOT`      | 30 min   | Frequently accessed, rarely changes         |
| `WARM`     | 10 min   | Moderately accessed, occasional updates     |
| `COLD`     | 3 min    | Rarely accessed, frequent updates           |
| `STATIC`   | 1 hour   | Rarely changes (retailers, categories)      |
| `COMPUTED` | 30 min   | Expensive calculations (analytics, trends)  |

### Cache Key Patterns

```typescript
// General pattern
{domain}:{operation}:{id}:{variant}

// Examples
product:detail:123                    // Product details
product:offers:123                    // Product offers
price:history:123:30d                 // 30-day price history
analytics:trend:123:7d                // 7-day trend analysis
user:profile:456                      // User profile
watchlist:123:products                // WatchList products
forum:topic:789                       // Forum topic
retailer:list:active                  // Active retailers
```

---

## Domain-Specific Strategies

### 1. User Domain (15 methods)

**Data Characteristics**:
- User-specific data (profiles, preferences, reputation)
- Moderate write frequency (profile updates, reputation changes)
- Critical correctness for authentication/authorization

**Recommended Strategy**:

| Method                     | Cache? | Tier     | TTL      | Invalidation Trigger                |
|----------------------------|--------|----------|----------|-------------------------------------|
| `getUsers`                 | ❌ No  | -        | -        | Admin operation, always fresh       |
| `getUserById`              | ✅ Yes | `WARM`   | 10 min   | User update, suspension             |
| `getUserByUsername`        | ✅ Yes | `WARM`   | 10 min   | User update, suspension             |
| `getUserByEmail`           | ✅ Yes | `WARM`   | 10 min   | User update                         |
| `createUser`               | ❌ No  | -        | -        | Write operation                     |
| `updateUserProfile`        | ❌ No  | -        | -        | Invalidates `user:*:{userId}`       |
| `incrementUserReputation`  | ❌ No  | -        | -        | Invalidates `user:reputation:{id}`  |
| `getUserGrowthData`        | ✅ Yes | `COMPUTED` | 30 min | Daily aggregation job               |
| `suspendUser`              | ❌ No  | -        | -        | Invalidates all user caches         |

**Key Patterns**:
```typescript
// Cache user profile (session-based)
const key = `user:profile:${userId}`;
await advancedCache.set(key, userData, CacheTier.WARM, true); // Use L1

// Invalidate on update
await advancedCache.invalidatePrefix(`user:${userId}`);
```

**Special Considerations**:
- **Authentication data**: NEVER cache `passwordHash` or session tokens
- **Reputation**: Cache computed reputation scores, invalidate on changes
- **Suspensions**: Immediately invalidate all user caches when suspended

---

### 2. Product Domain (20 methods)

**Data Characteristics**:
- High read frequency (product searches, detail views)
- Price-sensitive data (changes frequently via scraping)
- Search results can be cached with short TTL

**Recommended Strategy**:

| Method                          | Cache? | Tier     | TTL      | Invalidation Trigger                  |
|---------------------------------|--------|----------|----------|---------------------------------------|
| `getProducts`                   | ✅ Yes | `COLD`   | 3 min    | New product creation                  |
| `getProductById`                | ✅ Yes | `WARM`   | 10 min   | Product update, offer changes         |
| `getProductByIdWithOffers`      | ✅ Yes | `COLD`   | 3 min    | Price changes (scraping jobs)         |
| `searchProducts`                | ✅ Yes | `COLD`   | 3 min    | New products, price updates           |
| `searchProductsFuzzy`           | ✅ Yes | `COLD`   | 3 min    | Same as searchProducts                |
| `getProductsByRetailer`         | ✅ Yes | `WARM`   | 10 min   | New products for retailer             |
| `createProduct`                 | ❌ No  | -        | -        | Invalidates `product:list:*`          |
| `updateProduct`                 | ❌ No  | -        | -        | Invalidates `product:*:{productId}`   |
| `getProductsByCategory`         | ✅ Yes | `WARM`   | 10 min   | Category changes                      |
| `getPopularProducts`            | ✅ Yes | `HOT`    | 30 min   | View count updates (batched)          |
| `getCategoryDistribution`       | ✅ Yes | `COMPUTED` | 30 min | Product creation/deletion             |

**Key Patterns**:
```typescript
// Cache product details with popularity-based tiering
const isPopular = productViews > 1000;
const key = `product:detail:${productId}`;
const tier = isPopular ? CacheTier.HOT : CacheTier.WARM;
await advancedCache.set(key, productData, tier, isPopular);

// Cache search results (short TTL due to price sensitivity)
const key = `product:search:${query}:${JSON.stringify(filters)}`;
await advancedCache.set(key, results, CacheTier.COLD, false);
```

**Special Considerations**:
- **Price-sensitive data**: Use SHORT TTL (3 min) for data with offers
- **Popular products**: Use L1 cache for top 1000 products
- **Search results**: Include filter parameters in cache key

---

### 3. Price Domain (28 methods)

**Data Characteristics**:
- High write frequency (scraping jobs, price snapshots)
- Historical data (rarely changes once written)
- Expensive aggregations (trends, statistics)

**Recommended Strategy**:

| Method                          | Cache? | Tier       | TTL      | Invalidation Trigger                |
|---------------------------------|--------|------------|----------|-------------------------------------|
| `createProductOffer`            | ❌ No  | -          | -        | Invalidates `product:offers:{id}`   |
| `updateProductOffer`            | ❌ No  | -          | -        | Invalidates `product:offers:{id}`   |
| `getProductOffers`              | ✅ Yes | `COLD`     | 3 min    | Offer updates                       |
| `getLowestProductOffer`         | ✅ Yes | `COLD`     | 3 min    | Price changes                       |
| `getPriceHistory`               | ✅ Yes | `HOT`      | 30 min   | Snapshot jobs (batched)             |
| `getPriceHistoryByDateRange`    | ✅ Yes | `WARM`     | 10 min   | Snapshot jobs                       |
| `createPriceSnapshot`           | ❌ No  | -          | -        | Invalidates `price:history:{id}`    |
| `getPriceTrends`                | ✅ Yes | `COMPUTED` | 30 min   | Trend analysis job                  |
| `getVolatilityScore`            | ✅ Yes | `COMPUTED` | 30 min   | Volatility calculation job          |
| `getBestTimeToBuy`              | ✅ Yes | `COMPUTED` | 1 hour   | Historical pattern analysis         |
| `getPriceDrops`                 | ✅ Yes | `WARM`     | 10 min   | Real-time drop detection            |
| `getAveragePriceByRetailer`     | ✅ Yes | `COMPUTED` | 30 min   | Daily aggregation                   |

**Key Patterns**:
```typescript
// Cache historical price data (rarely changes)
const key = `price:history:${productId}:${days}d`;
await advancedCache.set(key, priceHistory, CacheTier.HOT, false);

// Cache expensive analytics (computed metrics)
const key = `analytics:trend:${productId}:${dateRange}`;
await advancedCache.set(key, trendData, CacheTier.COMPUTED, false);

// Real-time offers (short TTL)
const key = `product:offers:${productId}`;
await advancedCache.set(key, offers, CacheTier.COLD, false);
```

**Special Considerations**:
- **Historical data**: Long TTL (30 min - 1 hour) since it's immutable
- **Real-time offers**: Short TTL (3 min) for current prices
- **Analytics**: Cache expensive aggregations (trends, volatility)
- **Batch invalidation**: Invalidate after nightly snapshot jobs

---

### 4. WatchList Domain (13 methods)

**Data Characteristics**:
- User-specific data (personalized watch lists)
- Moderate write frequency (add/remove products)
- Real-time notifications on price changes

**Recommended Strategy**:

| Method                          | Cache? | Tier     | TTL      | Invalidation Trigger                |
|---------------------------------|--------|----------|----------|-------------------------------------|
| `getWatchLists`                 | ✅ Yes | `WARM`   | 10 min   | List creation/deletion              |
| `getWatchListById`              | ✅ Yes | `WARM`   | 10 min   | List updates                        |
| `getWatchListsByUser`           | ✅ Yes | `WARM`   | 10 min   | List creation/deletion              |
| `getWatchListWithProducts`      | ✅ Yes | `COLD`   | 3 min    | Product watch changes, price drops  |
| `createWatchList`               | ❌ No  | -        | -        | Invalidates `watchlist:user:{id}`   |
| `updateWatchList`               | ❌ No  | -        | -        | Invalidates `watchlist:{id}`        |
| `deleteWatchList`               | ❌ No  | -        | -        | Invalidates `watchlist:*:{id}`      |
| `addProductToWatchList`         | ❌ No  | -        | -        | Invalidates `watchlist:{id}:products` |
| `removeProductFromWatchList`    | ❌ No  | -        | -        | Invalidates `watchlist:{id}:products` |
| `getProductWatches`             | ✅ Yes | `WARM`   | 10 min   | Watch creation/deletion             |
| `getWatchListStats`             | ✅ Yes | `COMPUTED` | 30 min | Watch changes (batched)             |

**Key Patterns**:
```typescript
// Cache user's watch lists (user-specific)
const key = `watchlist:user:${userId}`;
await advancedCache.set(key, watchLists, CacheTier.WARM, false);

// Cache watch list with products (short TTL for price updates)
const key = `watchlist:${listId}:products`;
await advancedCache.set(key, productsWithPrices, CacheTier.COLD, false);

// Invalidate on product watch changes
await advancedCache.invalidate(`watchlist:${listId}:products`);
await advancedCache.invalidate(`watchlist:user:${userId}`);
```

**Special Considerations**:
- **User-specific**: Cache per user, invalidate on user actions
- **Price updates**: Short TTL for lists with products (price-sensitive)
- **Notifications**: Don't cache notification triggers, but cache list metadata

---

### 5. Forum Domain (6 methods)

**Data Characteristics**:
- High read frequency (topic views, post reads)
- Moderate write frequency (new posts, replies)
- Real-time updates for active discussions

**Recommended Strategy**:

| Method                          | Cache? | Tier     | TTL      | Invalidation Trigger                |
|---------------------------------|--------|----------|----------|-------------------------------------|
| `getForumTopics`                | ✅ Yes | `COLD`   | 3 min    | New topics, post updates            |
| `getForumTopicById`             | ✅ Yes | `COLD`   | 3 min    | Topic updates, new posts            |
| `getForumPostsByTopic`          | ✅ Yes | `COLD`   | 3 min    | New posts                           |
| `createForumTopic`              | ❌ No  | -        | -        | Invalidates `forum:topics:*`        |
| `createForumPost`               | ❌ No  | -        | -        | Invalidates `forum:topic:{id}`      |
| `incrementForumTopicViews`      | ❌ No  | -        | -        | No invalidation (counter only)      |

**Key Patterns**:
```typescript
// Cache forum topics list (short TTL for real-time discussions)
const key = `forum:topics:${categoryId}:page:${page}`;
await advancedCache.set(key, topics, CacheTier.COLD, false);

// Cache individual topic with posts
const key = `forum:topic:${topicId}:page:${page}`;
await advancedCache.set(key, topicWithPosts, CacheTier.COLD, false);

// Invalidate topic on new post
await advancedCache.invalidate(`forum:topic:${topicId}:*`);
await advancedCache.invalidate(`forum:topics:*`); // Refresh topic list
```

**Special Considerations**:
- **Real-time discussions**: Use SHORT TTL (3 min) for active forums
- **Pagination**: Include page number in cache key
- **View counts**: Don't invalidate cache on view increments (counter only)

---

### 6. Retailer Domain (12 methods)

**Data Characteristics**:
- Low write frequency (retailers rarely change)
- High read frequency (retailer metadata, affiliate links)
- Static data (logos, domains, affiliate URLs)

**Recommended Strategy**:

| Method                          | Cache? | Tier       | TTL      | Invalidation Trigger                |
|---------------------------------|--------|------------|----------|-------------------------------------|
| `getRetailers`                  | ✅ Yes | `STATIC`   | 1 hour   | Retailer creation/update            |
| `getRetailerById`               | ✅ Yes | `STATIC`   | 1 hour   | Retailer update                     |
| `getRetailerByDomain`           | ✅ Yes | `STATIC`   | 1 hour   | Domain mapping changes              |
| `getRetailerByName`             | ✅ Yes | `STATIC`   | 1 hour   | Retailer rename                     |
| `createRetailer`                | ❌ No  | -          | -        | Invalidates `retailer:list:*`       |
| `updateRetailer`                | ❌ No  | -          | -        | Invalidates `retailer:*:{id}`       |
| `deleteRetailer`                | ❌ No  | -          | -        | Invalidates all retailer caches     |
| `getActiveRetailers`            | ✅ Yes | `STATIC`   | 1 hour   | Retailer activation/deactivation    |
| `getRetailerStats`              | ✅ Yes | `COMPUTED` | 30 min   | Product/offer changes (batched)     |

**Key Patterns**:
```typescript
// Cache retailer list (long TTL, rarely changes)
const key = `retailer:list:active`;
await advancedCache.set(key, retailers, CacheTier.STATIC, true); // Use L1

// Cache retailer by domain (for scraping)
const key = `retailer:domain:${domain}`;
await advancedCache.set(key, retailer, CacheTier.STATIC, true);

// Invalidate on retailer update
await advancedCache.invalidatePrefix(`retailer:${retailerId}`);
await advancedCache.invalidate('retailer:list:*'); // Refresh all lists
```

**Special Considerations**:
- **Static data**: Use LONGEST TTL (1 hour), data rarely changes
- **L1 cache**: Use L1 for retailer list (frequently accessed by scrapers)
- **Domain mapping**: Critical for scraping, cache with high priority

---

### 7. Job Lock Domain (9 methods)

**Data Characteristics**:
- Critical for distributed job coordination
- Real-time lock status required
- Low read frequency (only checked before job execution)

**Recommended Strategy**:

| Method                          | Cache? | Reason                                      |
|---------------------------------|--------|---------------------------------------------|
| `getJobLocks`                   | ❌ No  | Admin operation, always needs fresh data   |
| `acquireJobLock`                | ❌ No  | Write operation, race-critical              |
| `getJobLockByName`              | ❌ No  | Lock status must be real-time               |
| `updateExpiredJobLock`          | ❌ No  | Write operation, race-critical              |
| `releaseJobLock`                | ❌ No  | Write operation, must be immediate          |
| `extendJobLock`                 | ❌ No  | Write operation, TTL update                 |
| `isJobLocked`                   | ❌ No  | Real-time status required for coordination  |
| `cleanupExpiredJobLocks`        | ❌ No  | Maintenance operation                       |
| `getActiveJobLocksCount`        | ❌ No  | Monitoring operation, needs real-time data  |

**Key Principle**:
```typescript
// ❌ NEVER cache job lock operations
// Distributed locking requires REAL-TIME database state
// Even 1-second stale data can cause race conditions

// Database provides atomicity via onConflictDoNothing()
const result = await db.insert(jobLocks)
  .values({ jobName, lockedBy, expiresAt })
  .onConflictDoNothing(); // Atomic operation
```

**Special Considerations**:
- **NO CACHING**: Job locks coordinate distributed systems, stale data causes race conditions
- **Database-level atomicity**: PostgreSQL `ON CONFLICT DO NOTHING` provides correct behavior
- **TTL at database level**: Lock expiration managed by database `expiresAt` column
- **Monitoring only**: If caching needed for dashboards, use separate read-only cache with warnings

---

## Cache Invalidation Patterns

### 1. Single Entity Invalidation

Invalidate specific entity when updated:

```typescript
// Product update
await advancedCache.invalidatePrefix(`product:${productId}`);
// Invalidates: product:detail:123, product:offers:123, product:analytics:123:*

// User update
await advancedCache.invalidatePrefix(`user:${userId}`);
// Invalidates: user:profile:456, user:reputation:456, user:stats:456
```

### 2. Related Entity Invalidation

Invalidate related entities when dependency changes:

```typescript
// New product offer created
await advancedCache.invalidate(`product:offers:${productId}`);
await advancedCache.invalidate(`product:detail:${productId}`);
await advancedCache.invalidatePrefix(`analytics:${productId}`);

// WatchList product added
await advancedCache.invalidate(`watchlist:${listId}:products`);
await advancedCache.invalidate(`watchlist:user:${userId}`);
```

### 3. List/Collection Invalidation

Invalidate lists when items added/removed:

```typescript
// New forum post
await advancedCache.invalidate(`forum:topic:${topicId}:*`); // All pages
await advancedCache.invalidate(`forum:topics:*`); // Topic list

// New product
await advancedCache.invalidate(`product:list:*`); // All product lists
await advancedCache.invalidate(`product:search:*`); // All search results
```

### 4. Batch Invalidation (Background Jobs)

Invalidate in batches after scheduled jobs:

```typescript
// After nightly price snapshot job
const productIds = [123, 456, 789];
for (const id of productIds) {
  await advancedCache.invalidatePrefix(`price:history:${id}`);
}

// After trend analysis job
await advancedCache.invalidatePrefix('analytics:trend:*');
```

### 5. Time-Based Invalidation (TTL)

Let TTL handle invalidation for computed data:

```typescript
// Set analytics with COMPUTED tier (30 min TTL)
await advancedCache.set(key, analytics, CacheTier.COMPUTED, false);
// Automatically invalidates after 30 minutes
// Re-fetches on next request
```

---

## Performance Considerations

### 1. L1 vs L2 Cache Decision

**Use L1 (In-Memory) when**:
- Data accessed on EVERY request (retailer list, popular products)
- Data size is small (<1KB per item)
- Total dataset fits in 1000 items
- Sub-millisecond latency required

**Use L2 (Redis) only when**:
- Data accessed occasionally
- Data size is large (>1KB)
- Distributed cache needed across servers
- User-specific data (not shared across requests)

### 2. TTL Selection Guidelines

| Data Mutability | Read:Write Ratio | Recommended TTL | Example                    |
|-----------------|------------------|-----------------|----------------------------|
| Static          | 1000:1           | 1 hour          | Retailer metadata          |
| Slow-changing   | 100:1            | 30 min          | Popular products           |
| Moderate        | 10:1             | 10 min          | User profiles              |
| Fast-changing   | 5:1              | 3 min           | Product offers             |
| Real-time       | 2:1              | No cache        | Job locks, live prices     |

### 3. Cache Key Design

**Good cache keys** (predictable, readable, hierarchical):
```typescript
product:detail:123
product:offers:123:active
analytics:trend:123:7d
user:profile:456
```

**Bad cache keys** (unpredictable, not hierarchical):
```typescript
prod_123_data
offers-123-filter-active
user456profile
trend_data_123_week
```

### 4. Monitoring Cache Performance

```typescript
// Get cache statistics
const stats = advancedCache.getStats();
// {
//   l1: { hits: 1500, misses: 200, hitRate: '88.24%' },
//   l2: { hits: 2000, misses: 300, hitRate: '86.96%' },
//   overall: { totalRequests: 4000, sets: 300, invalidations: 50 }
// }

// Target metrics:
// - L1 hit rate: >80% (ultra-hot data)
// - L2 hit rate: >70% (distributed cache)
// - Overall hit rate: >75% (combined)
```

---

## Implementation Examples

### Example 1: Product Detail Caching

```typescript
// server/routes/product-routes.ts
app.get('/api/products/:id', async (req, res) => {
  const productId = parseIntSafe(req.params.id, 'productId', { min: 1 });

  // Try cache first
  const cacheKey = `product:detail:${productId}`;
  const cached = await advancedCache.get(cacheKey);
  if (cached) {
    return res.json(cached);
  }

  // Cache miss - fetch from database
  const product = await storage.getProductByIdWithOffers(productId);
  if (!product) {
    return res.status(404).json({ error: 'Product not found' });
  }

  // Determine cache tier based on popularity
  const isPopular = product.viewCount > 1000;
  const tier = isPopular ? CacheTier.HOT : CacheTier.WARM;

  // Cache for next request
  await advancedCache.set(cacheKey, product, tier, isPopular);

  res.json(product);
});
```

### Example 2: Price History Caching

```typescript
// server/routes/price-history-routes.ts
app.get('/api/products/:id/price-history', async (req, res) => {
  const productId = parseIntSafe(req.params.id, 'productId', { min: 1 });
  const days = parseIntOptional(req.query.days, 'days', { min: 1, max: 365 }) ?? 30;

  // Cache key includes date range parameter
  const cacheKey = `price:history:${productId}:${days}d`;

  // Use getOrSet pattern (cache-aside)
  const priceHistory = await advancedCache.getOrSet(
    cacheKey,
    async () => {
      // Expensive database query
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);
      return storage.getPriceHistoryByDateRange(productId, startDate, new Date());
    },
    CacheTier.HOT, // Historical data rarely changes
    false // Don't use L1 (data size varies)
  );

  res.json(priceHistory);
});
```

### Example 3: WatchList Invalidation

```typescript
// server/routes/watchlist-routes.ts
app.post('/api/watchlists/:id/products', withAuth(async (req, res) => {
  const listId = parseIntSafe(req.params.id, 'listId', { min: 1 });
  const userId = req.user!.id;

  // Add product to watch list
  await storage.addProductToWatchList(listId, productId);

  // Invalidate relevant caches
  await advancedCache.invalidate(`watchlist:${listId}:products`);
  await advancedCache.invalidate(`watchlist:user:${userId}`);
  await advancedCache.invalidatePrefix(`analytics:watchlist:${listId}`);

  res.json({ success: true });
}));
```

### Example 4: Batch Invalidation in Background Jobs

```typescript
// server/jobs/price-snapshot-queue.ts
priceSnapshotQueue.process(async (job) => {
  const { productIds } = job.data;

  // Perform snapshot for all products
  await performPriceSnapshot(productIds);

  // Batch invalidate all affected caches
  for (const productId of productIds) {
    // Invalidate product offers and price history
    await advancedCache.invalidate(`product:offers:${productId}`);
    await advancedCache.invalidatePrefix(`price:history:${productId}`);
    await advancedCache.invalidatePrefix(`analytics:${productId}`);
  }

  logger.info(`Price snapshot completed for ${productIds.length} products`);
});
```

### Example 5: Retailer List Caching (L1 + L2)

```typescript
// server/routes/retailer-routes.ts
app.get('/api/retailers', async (req, res) => {
  const cacheKey = 'retailer:list:active';

  // Use L1 + L2 cache (retailer list accessed on every scrape)
  const retailers = await advancedCache.getOrSet(
    cacheKey,
    async () => storage.getActiveRetailers(),
    CacheTier.STATIC, // Retailers rarely change
    true // Use L1 cache (small dataset, frequently accessed)
  );

  res.json(retailers);
});
```

---

## Summary

### Caching Decision Matrix

| Domain       | Default Tier | Default TTL | Use L1? | Primary Invalidation Trigger      |
|--------------|--------------|-------------|---------|-----------------------------------|
| User         | `WARM`       | 10 min      | ✅ Yes  | Profile updates, suspensions      |
| Product      | `COLD`       | 3 min       | ❌ No   | Price changes, new products       |
| Price        | `HOT`        | 30 min      | ❌ No   | Snapshot jobs, offer updates      |
| WatchList    | `WARM`       | 10 min      | ❌ No   | Product watch changes             |
| Forum        | `COLD`       | 3 min       | ❌ No   | New posts, topic updates          |
| Retailer     | `STATIC`     | 1 hour      | ✅ Yes  | Retailer updates (rare)           |
| Job Lock     | ❌ No cache  | -           | ❌ No   | Real-time coordination required   |

### Key Takeaways

1. **Cache read-heavy operations**: Focus on data with high read:write ratios
2. **Use tiered TTLs**: Match TTL to data mutability (static = 1 hour, real-time = no cache)
3. **Invalidate proactively**: Don't rely solely on TTL, invalidate on writes
4. **L1 for hot paths**: Use in-memory cache for frequently accessed small datasets
5. **Pattern-based invalidation**: Use `invalidatePrefix()` for related entity cleanup
6. **Monitor cache performance**: Track hit rates, adjust strategies based on metrics
7. **NEVER cache job locks**: Distributed coordination requires real-time database state

---

**See Also**:
- `ARCHITECTURE.md` - Overall system architecture
- `server/middleware/redis-cache.ts` - HTTP middleware implementation
- `server/services/advanced-cache.ts` - Multi-tier cache service
- `server/utils/constants.ts` - Cache duration constants
