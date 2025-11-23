---
status: pending
priority: p2
issue_id: "018"
tags: [code-review, performance, redis, caching]
dependencies: []
---

# Replace Redis KEYS Command with SCAN for Cache Invalidation

## Problem Statement

Cache invalidation uses `KEYS *` command which blocks Redis and is O(n) on all keys.

## Findings

- Discovered by Performance Oracle agent
- Location: `server/services/advanced-cache.ts:282`
- In-memory fallback also has O(n) scan: `server/middleware/redis-cache.ts:41-44`
- At 100,000+ keys, invalidation becomes slow and blocks other Redis operations

## Recommended Action

Use SCAN instead of KEYS:
```typescript
async invalidatePattern(pattern: string): Promise<number> {
  let cursor = '0';
  let deletedCount = 0;

  do {
    const [nextCursor, keys] = await redisClient.scan(
      cursor, 'MATCH', pattern, 'COUNT', 100
    );
    cursor = nextCursor;
    if (keys.length > 0) {
      await redisClient.del(...keys);
      deletedCount += keys.length;
    }
  } while (cursor !== '0');

  return deletedCount;
}
```

## Acceptance Criteria

- [ ] No KEYS command usage in production code
- [ ] SCAN used for pattern-based operations
- [ ] Cache invalidation non-blocking
