# Storage Layer Caching Strategy Guide

**Date**: 2025-11-25
**Related**: Task 1.2 (Storage Layer Improvement Roadmap)
**Status**: ✅ Complete

---

## Overview

This guide provides comprehensive documentation for implementing Redis caching with the PriceCompare storage layer. The caching strategies described here are **advisory** - the storage layer is designed to work seamlessly with or without caching.

**Key Principle**: Caching is implemented at the **middleware/service layer**, not within the storage layer itself. This maintains separation of concerns and allows the storage layer to remain simple and focused on data access.

---

## Multi-Level Caching Architecture

```
┌──────────────────────────────────────────────┐
│           Multi-Level Caching                 │
├──────────────────────────────────────────────┤
│  L1: In-Memory Cache (Fast, local)          │
│      - Rate limit counters                   │
│      - Session data (fallback)               │
│                                              │
│  L2: Redis Cache (Fast, distributed)        │
│      - API response cache                    │
│      - Session store                         │
│      - Storage layer reads                   │
│                                              │
│  L3: Storage Layer (DatabaseStorage)        │
│      - PostgreSQL via Drizzle ORM            │
│      - Source of truth                       │
└──────────────────────────────────────────────┘
```

**This guide focuses on L2 (Redis) caching for storage layer operations.**

---

## Cache Key Naming Convention

Use consistent, hierarchical cache keys for easy management:

```
{domain}:{operation}:{identifier}[:{variant}]
```

**Examples:**
- `product:full:123` - Product ID 123 with full details
- `user:safe:456` - User ID 456 (safe fields only, no passwordHash)
- `watchlist:user:789` - All watchlists for user 789
- `alert:triggered` - List of triggered price alerts
- `retailer:all` - All retailers list

**Benefits:**
- Easy pattern-based invalidation (`product:*`)
- Clear ownership by domain
- Self-documenting keys

---

## TTL Selection Guidelines

| Data Type | TTL | Rationale |
|-----------|-----|-----------|
| **Static reference data** (retailers, categories) | 1 hour | Changes infrequently, safe for long caching |
| **User profiles** | 5 minutes | Occasional updates, balance freshness vs load |
| **Product data with prices** | 5 minutes | Prices change regularly, moderate TTL |
| **Search results** | 1-2 minutes | Dynamic, needs freshness for relevance |
| **Price alerts** | 2 minutes | User-facing, needs reasonable freshness |
| **Admin lists** | 2 minutes | Moderation requires responsiveness |
| **Job locks** | 30 seconds | Distributed coordination needs fresh data |
| **Triggered alerts** | 30 seconds | Critical for timely notifications |

**General Rules:**
- **Long TTL (>30 min)**: Static reference data that rarely changes
- **Medium TTL (2-10 min)**: User-facing data with occasional updates
- **Short TTL (<2 min)**: Dynamic queries, search results, frequently changing data
- **Very Short TTL (<1 min)**: Coordination data, real-time features

---

## Caching Strategies by Domain

### 1. Retailer Storage

**Methods to Cache:**

#### `getAllRetailers()`
```typescript
// Cache key: retailer:all
// TTL: 60 minutes
// Invalidate on: createRetailer, updateRetailer, deleteRetailer

async function getAllRetailersCached(): Promise<Retailer[]> {
  const redisClient = getRedisClient();
  if (!redisClient) return await storage.getAllRetailers();

  const cacheKey = 'retailer:all';
  const cached = await redisClient.get(cacheKey);
  if (cached) return JSON.parse(cached);

  const retailers = await storage.getAllRetailers();
  await redisClient.set(cacheKey, JSON.stringify(retailers), 'EX', 3600);
  return retailers;
}

// Invalidation after update
async function updateRetailerWithInvalidation(id: number, updates: Partial<InsertRetailer>) {
  const result = await storage.updateRetailer(id, updates);
  const redisClient = getRedisClient();
  if (redisClient && result) {
    await redisClient.del('retailer:all', `retailer:id:${id}`);
  }
  return result;
}
```

**Why**: Retailers list changes infrequently (new retailers added rarely). Long TTL significantly reduces database load with minimal staleness risk.

---

### 2. Product Storage

**Methods to Cache:**

#### `getProductById(id)`
```typescript
// Cache key: product:full:${id}
// TTL: 5 minutes (300 seconds)
// Invalidate on: updateProduct, deleteProduct, createProductOffer

async function getProductByIdCached(productId: number): Promise<ProductWithOffers | undefined> {
  const redisClient = getRedisClient();
  if (!redisClient) return await storage.getProductById(productId);

  const cacheKey = `product:full:${productId}`;
  const cached = await redisClient.get(cacheKey);
  if (cached) return JSON.parse(cached);

  const product = await storage.getProductById(productId);
  if (product) {
    await redisClient.set(cacheKey, JSON.stringify(product), 'EX', 300);
  }
  return product;
}
```

**Why**: Product details requested frequently (product pages, comparisons). 5-minute TTL balances freshness (prices change) with performance.

#### `searchProducts(filters)`
```typescript
// Cache key: product:search:${hash(filters)}
// TTL: 1-2 minutes (60-120 seconds)
// Invalidate on: Pattern-based invalidation on product updates

import crypto from 'crypto';

function generateSearchKey(filters: SearchFilters): string {
  const hash = crypto.createHash('md5')
    .update(JSON.stringify(filters))
    .digest('hex')
    .substring(0, 8);
  return `product:search:${hash}`;
}

async function searchProductsCached(filters: SearchFilters) {
  const redisClient = getRedisClient();
  if (!redisClient) return await storage.searchProducts(filters);

  const cacheKey = generateSearchKey(filters);
  const cached = await redisClient.get(cacheKey);
  if (cached) return JSON.parse(cached);

  const results = await storage.searchProducts(filters);
  await redisClient.set(cacheKey, JSON.stringify(results), 'EX', 90); // 1.5 minutes
  return results;
}

// Pattern-based invalidation on product updates
async function invalidateProductSearches() {
  const redisClient = getRedisClient();
  if (!redisClient) return;

  const keys = await redisClient.keys('product:search:*');
  if (keys.length > 0) {
    await redisClient.del(...keys);
  }
}
```

**Why**: Search results are computationally expensive (filtering, sorting, pagination). Short TTL ensures results stay relevant as products/prices update.

---

### 3. User Storage

**Methods to Cache:**

#### `getUserByIdSafe(id)`
```typescript
// Cache key: user:safe:${id}
// TTL: 5 minutes (300 seconds)
// Invalidate on: updateUserProfile, updateUserTrustLevel, suspendUser

async function getUserByIdSafeCached(userId: number): Promise<SafeUser | null> {
  const redisClient = getRedisClient();
  if (!redisClient) return await storage.getUserByIdSafe(userId);

  const cacheKey = `user:safe:${userId}`;
  const cached = await redisClient.get(cacheKey);
  if (cached) return JSON.parse(cached);

  const user = await storage.getUserByIdSafe(userId);
  if (user) {
    await redisClient.set(cacheKey, JSON.stringify(user), 'EX', 300);
  }
  return user;
}

// Invalidation on profile update
async function updateUserProfileWithInvalidation(
  userId: number,
  updates: { bio?: string; location?: string; website?: string; avatarUrl?: string }
) {
  await storage.updateUserProfile(userId, updates);
  const redisClient = getRedisClient();
  if (redisClient) {
    await redisClient.del(`user:safe:${userId}`);
  }
}
```

**Why**: User profiles fetched frequently (comments, forum posts, admin panel). 5-minute TTL provides good balance.

---

### 4. Alert Storage

**Methods to Cache:**

#### `getUserPriceAlerts(userId)`
```typescript
// Cache key: alert:user:${userId}
// TTL: 2 minutes (120 seconds)
// Invalidate on: createPriceAlert, deletePriceAlert, updatePriceAlert

async function getUserPriceAlertsCached(userId: number): Promise<PriceAlert[]> {
  const redisClient = getRedisClient();
  if (!redisClient) return await storage.getUserPriceAlerts(userId);

  const cacheKey = `alert:user:${userId}`;
  const cached = await redisClient.get(cacheKey);
  if (cached) return JSON.parse(cached);

  const alerts = await storage.getUserPriceAlerts(userId);
  await redisClient.set(cacheKey, JSON.stringify(alerts), 'EX', 120);
  return alerts;
}

// Invalidation on alert creation
async function createPriceAlertWithInvalidation(alert: InsertPriceAlert) {
  const result = await storage.createPriceAlert(alert);
  const redisClient = getRedisClient();
  if (redisClient) {
    await redisClient.del(`alert:user:${alert.userId}`);
  }
  return result;
}
```

**Why**: Users check their alerts frequently. 2-minute TTL reduces database load while ensuring reasonable freshness.

---

### 5. Job Lock Storage

**Methods to Cache:**

#### `getJobLockByName(jobName)`
```typescript
// Cache key: joblock:name:${jobName}
// TTL: 30 seconds
// Invalidate on: acquireJobLock, releaseJobLock, updateExpiredJobLock

async function getJobLockByNameCached(jobName: string): Promise<JobLock | null> {
  const redisClient = getRedisClient();
  if (!redisClient) return await storage.getJobLockByName(jobName);

  const cacheKey = `joblock:name:${jobName}`;
  const cached = await redisClient.get(cacheKey);
  if (cached) return JSON.parse(cached);

  const lock = await storage.getJobLockByName(jobName);
  if (lock) {
    await redisClient.set(cacheKey, JSON.stringify(lock), 'EX', 30);
  }
  return lock;
}
```

**Why**: Job coordination requires near-real-time data. Very short TTL (30s) prevents stale locks while reducing query load for frequent checks.

**⚠️ Warning**: For critical distributed locking, consider bypassing cache entirely or using Redis native locks (`SET NX EX`).

---

### 6. WatchList Storage

**Methods to Cache:**

#### `getUserWatchLists(userId)`
```typescript
// Cache key: watchlist:user:${userId}
// TTL: 3 minutes (180 seconds)
// Invalidate on: createWatchList, updateWatchList, deleteWatchList

async function getUserWatchListsCached(userId: number): Promise<WatchListWithCount[]> {
  const redisClient = getRedisClient();
  if (!redisClient) return await storage.getUserWatchLists(userId);

  const cacheKey = `watchlist:user:${userId}`;
  const cached = await redisClient.get(cacheKey);
  if (cached) return JSON.parse(cached);

  const watchLists = await storage.getUserWatchLists(userId);
  await redisClient.set(cacheKey, JSON.stringify(watchLists), 'EX', 180);
  return watchLists;
}
```

**Why**: Users view their watchlists frequently. 3-minute TTL improves UX by reducing page load times.

---

## Cache Invalidation Patterns

### 1. Direct Invalidation
**Use when**: Single record updated
```typescript
await redisClient.del(`product:full:${productId}`);
```

### 2. Multi-Key Invalidation
**Use when**: Update affects multiple cache entries
```typescript
await redisClient.del(
  `user:safe:${userId}`,
  `watchlist:user:${userId}`,
  `alert:user:${userId}`
);
```

### 3. Pattern-Based Invalidation
**Use when**: Update affects many related entries
```typescript
const keys = await redisClient.keys('product:search:*');
if (keys.length > 0) {
  await redisClient.del(...keys);
}
```

**⚠️ Warning**: `KEYS` command is O(N) and blocks Redis. Use `SCAN` in production for large keyspaces:

```typescript
async function invalidateByPattern(pattern: string) {
  const redisClient = getRedisClient();
  if (!redisClient) return;

  let cursor = '0';
  const keysToDelete: string[] = [];

  do {
    const [newCursor, keys] = await redisClient.scan(
      cursor,
      'MATCH',
      pattern,
      'COUNT',
      100
    );
    cursor = newCursor;
    keysToDelete.push(...keys);
  } while (cursor !== '0');

  if (keysToDelete.length > 0) {
    await redisClient.del(...keysToDelete);
  }
}

// Usage
await invalidateByPattern('product:search:*');
```

### 4. Time-Based Expiration (Passive)
**Use when**: Invalidation logic is complex or updates are infrequent
```typescript
// Just let TTL expire naturally - simpler, less error-prone
await redisClient.set(cacheKey, JSON.stringify(data), 'EX', ttl);
```

**Trade-off**: Potential staleness window vs implementation simplicity.

---

## When NOT to Cache

### ❌ Avoid Caching These Operations

1. **Write Operations** (creates, updates, deletes)
   - Always go directly to database
   - Reason: Source of truth must be database

2. **Security-Sensitive Operations**
   - Password resets, token validation, authentication
   - Reason: Security > performance, need absolute freshness

3. **Real-Time Data** (websocket events, live notifications)
   - Reason: Cached data introduces unacceptable latency

4. **Low-Traffic Endpoints**
   - Example: Admin endpoints with <10 requests/hour
   - Reason: Cache overhead (memory, complexity) exceeds benefit

5. **Data with Complex Invalidation**
   - Example: Nested hierarchical data with many update paths
   - Reason: Risk of stale data outweighs performance gain

6. **Small, Fast Queries**
   - Example: `SELECT * FROM table WHERE id = ? LIMIT 1` with index
   - Reason: Database already fast (<5ms), caching adds overhead

---

## Cache Performance Benchmarks

### Latency Comparison

| Operation | Latency | Notes |
|-----------|---------|-------|
| **Redis GET** | 1-2ms | Local network, single key |
| **Redis MGET (10 keys)** | 2-3ms | Batch retrieval |
| **PostgreSQL indexed lookup** | 10-50ms | Single row by primary key |
| **PostgreSQL complex query** | 50-500ms | JOINs, aggregations, sorting |
| **JSON serialize/deserialize** | 0.1-0.5ms | Per operation |

**Cache Hit Benefit**:
- Simple query: 10ms → 2ms = **80% reduction**
- Complex query: 200ms → 2ms = **99% reduction**

### Cache Hit Rate Targets

| Hit Rate | Assessment | Action |
|----------|------------|--------|
| **>80%** | Excellent | TTL is well-tuned |
| **60-80%** | Good | Monitor, may need TTL adjustment |
| **40-60%** | Fair | Investigate invalidation frequency |
| **<40%** | Poor | TTL too short or invalidation too aggressive |

**Monitoring**:
```typescript
// Track cache hits/misses
let cacheHits = 0;
let cacheMisses = 0;

async function getCached<T>(key: string, fetchFn: () => Promise<T>, ttl: number): Promise<T> {
  const redisClient = getRedisClient();
  if (!redisClient) return await fetchFn();

  const cached = await redisClient.get(key);
  if (cached) {
    cacheHits++;
    return JSON.parse(cached);
  }

  cacheMisses++;
  const result = await fetchFn();
  await redisClient.set(key, JSON.stringify(result), 'EX', ttl);
  return result;
}

// Log metrics periodically
setInterval(() => {
  const total = cacheHits + cacheMisses;
  const hitRate = total > 0 ? (cacheHits / total) * 100 : 0;
  logger.info(`Cache hit rate: ${hitRate.toFixed(1)}% (${cacheHits}/${total})`);
  cacheHits = 0;
  cacheMisses = 0;
}, 60000); // Every minute
```

---

## Implementation Best Practices

### 1. Always Handle Redis Unavailability

```typescript
async function getCachedWithFallback<T>(
  cacheKey: string,
  fetchFn: () => Promise<T>,
  ttl: number
): Promise<T> {
  const redisClient = getRedisClient();

  // Redis unavailable - fallback to direct fetch
  if (!redisClient) {
    return await fetchFn();
  }

  try {
    const cached = await redisClient.get(cacheKey);
    if (cached) return JSON.parse(cached);

    const result = await fetchFn();
    await redisClient.set(cacheKey, JSON.stringify(result), 'EX', ttl);
    return result;
  } catch (error) {
    // Redis error - log and fallback
    logger.error('Redis error, falling back to direct fetch', { error, cacheKey });
    return await fetchFn();
  }
}
```

**Why**: Redis should be optional in development, critical in production. Always provide graceful degradation.

### 2. Use TypeScript Generics for Reusability

```typescript
async function cachedGet<T>(
  cacheKey: string,
  fetchFn: () => Promise<T>,
  options: { ttl: number; skipCache?: boolean } = { ttl: 300 }
): Promise<T> {
  if (options.skipCache) return await fetchFn();

  const redisClient = getRedisClient();
  if (!redisClient) return await fetchFn();

  const cached = await redisClient.get(cacheKey);
  if (cached) return JSON.parse(cached) as T;

  const result = await fetchFn();
  await redisClient.set(cacheKey, JSON.stringify(result), 'EX', options.ttl);
  return result;
}

// Usage
const product = await cachedGet(
  `product:full:${id}`,
  () => storage.getProductById(id),
  { ttl: 300 }
);
```

### 3. Implement Cache Warming for Critical Data

```typescript
// Warm cache on server startup for frequently accessed data
async function warmCriticalCaches() {
  logger.info('Warming critical caches...');

  const redisClient = getRedisClient();
  if (!redisClient) return;

  try {
    // Warm retailer cache
    const retailers = await storage.getAllRetailers();
    await redisClient.set('retailer:all', JSON.stringify(retailers), 'EX', 3600);

    logger.info('Cache warming completed', {
      retailers: retailers.length,
    });
  } catch (error) {
    logger.error('Cache warming failed', { error });
  }
}

// Call during server initialization
// app.listen(PORT, async () => {
//   await warmCriticalCaches();
//   logger.info(`Server running on port ${PORT}`);
// });
```

### 4. Add Cache Headers for Client-Side Caching

```typescript
app.get('/api/retailers', async (req, res) => {
  const retailers = await getAllRetailersCached();

  // Tell client to cache for 5 minutes
  res.set('Cache-Control', 'public, max-age=300');
  res.json(retailers);
});
```

**Benefits**: Reduces server requests by leveraging browser cache.

### 5. Monitor Cache Memory Usage

```typescript
async function getCacheStats() {
  const redisClient = getRedisClient();
  if (!redisClient) return null;

  const info = await redisClient.info('memory');
  const stats = info.split('\r\n').reduce((acc: Record<string, string>, line) => {
    const [key, value] = line.split(':');
    if (key && value) acc[key] = value;
    return acc;
  }, {});

  return {
    usedMemory: stats.used_memory_human,
    maxMemory: stats.maxmemory_human || 'unlimited',
    evictionPolicy: stats.maxmemory_policy || 'noeviction',
  };
}
```

---

## Testing Cache Implementation

### Unit Test Example

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('Product caching', () => {
  let mockRedisClient: any;
  let mockStorage: any;

  beforeEach(() => {
    mockRedisClient = {
      get: vi.fn(),
      set: vi.fn(),
      del: vi.fn(),
    };

    mockStorage = {
      getProductById: vi.fn(),
    };
  });

  it('should return cached product if available', async () => {
    const cachedProduct = { id: 1, name: 'Test Product' };
    mockRedisClient.get.mockResolvedValue(JSON.stringify(cachedProduct));

    const result = await getProductByIdCached(1);

    expect(result).toEqual(cachedProduct);
    expect(mockRedisClient.get).toHaveBeenCalledWith('product:full:1');
    expect(mockStorage.getProductById).not.toHaveBeenCalled();
  });

  it('should fetch from storage on cache miss and populate cache', async () => {
    const product = { id: 1, name: 'Test Product' };
    mockRedisClient.get.mockResolvedValue(null);
    mockStorage.getProductById.mockResolvedValue(product);

    const result = await getProductByIdCached(1);

    expect(result).toEqual(product);
    expect(mockStorage.getProductById).toHaveBeenCalledWith(1);
    expect(mockRedisClient.set).toHaveBeenCalledWith(
      'product:full:1',
      JSON.stringify(product),
      'EX',
      300
    );
  });

  it('should invalidate cache on product update', async () => {
    await updateProductWithInvalidation(1, { name: 'Updated' });

    expect(mockRedisClient.del).toHaveBeenCalledWith('product:full:1');
  });
});
```

---

## Production Deployment Checklist

- [ ] **Redis configured** with `REDIS_URL` environment variable
- [ ] **Max memory policy** set to `allkeys-lru` (evict least recently used)
- [ ] **Redis persistence** enabled (RDB or AOF for durability)
- [ ] **Monitoring** set up for hit rate, memory usage, latency
- [ ] **Cache warming** implemented for critical data on startup
- [ ] **Graceful degradation** tested (app works if Redis fails)
- [ ] **TTLs tuned** based on production traffic patterns
- [ ] **Invalidation logic** tested for all write operations
- [ ] **Cache key prefix** configured if sharing Redis instance
- [ ] **Memory limits** set to prevent OOM (out of memory)

---

## Troubleshooting

### Problem: Low Cache Hit Rate

**Symptoms**: Hit rate <60%, high database load

**Possible Causes**:
1. TTL too short - cache expires before re-use
2. Invalidation too aggressive - keys deleted prematurely
3. Cache keys not consistent - different keys for same data
4. Traffic pattern doesn't suit caching - random access, no repetition

**Solutions**:
- Increase TTL if data staleness is acceptable
- Review invalidation logic for over-invalidation
- Audit cache key generation for consistency
- Profile access patterns - may not benefit from caching

### Problem: Stale Data

**Symptoms**: Users see outdated information

**Possible Causes**:
1. Missing invalidation on update operations
2. TTL too long for data change frequency
3. Race condition in cache update

**Solutions**:
- Audit all write operations for invalidation calls
- Reduce TTL to acceptable staleness window
- Use versioned cache keys or timestamps

### Problem: Redis Memory Exhaustion

**Symptoms**: Cache evictions, OOM errors

**Possible Causes**:
1. No max memory limit set
2. No eviction policy configured
3. TTLs too long, keys accumulate
4. Caching too much data (large objects)

**Solutions**:
- Set `maxmemory` limit in Redis config
- Configure `maxmemory-policy allkeys-lru`
- Reduce TTLs for less critical data
- Compress large objects before caching
- Use cache tiers (hot/warm data)

---

## Related Documentation

- **Storage Layer**: `server/storage.ts` - Main implementation with caching JSDoc
- **Redis Configuration**: `server/config/redis.ts` - Dual Redis client setup
- **Caching Services**: `server/services/redis-cache.ts`, `server/services/advanced-cache.ts`
- **Architecture**: `ARCHITECTURE.md` (lines 505-524) - Multi-level caching overview
- **CLAUDE.md**: Multi-Level Caching Strategy section

---

## Conclusion

This caching strategy provides a balanced approach to improving performance while maintaining data consistency. The storage layer remains simple and focused on data access, with caching implemented at the service/middleware layer where it belongs.

**Key Takeaways**:
- Cache read operations, not writes
- Always handle Redis unavailability gracefully
- Tune TTLs based on data change frequency
- Invalidate caches proactively on updates
- Monitor hit rates and adjust strategy
- Start conservative, optimize based on metrics

**Status**: ✅ **Task 1.2 Complete - Caching Documentation Added**
