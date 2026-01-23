# TODO 266: Add close() Method to CacheInvalidationService

**Priority**: P3 - Nice-to-Have (Code Quality)
**Effort**: Small (~10 minutes)
**Category**: Resource Management
**Source**: Code Review - Performance Oracle Agent
**Branch**: add_scraping

## Problem Statement

The `CacheInvalidationService` creates a duplicate Redis subscriber (line 293) but does not expose a `close()` method. This could leak connections if the service is recreated during hot reloading or graceful shutdown.

## Findings

### Unclosed Subscriber (cache-invalidation.ts:293)
```typescript
const subscriber = redisClient.duplicate(); // Never closed
```

### AdvancedCacheService Has Proper Cleanup (advanced-cache.ts:783-795)
```typescript
async close(): Promise<void> {
  // Properly cleans up subscriber client
}
```

## Proposed Solution

Add `close()` method to CacheInvalidationService:

```typescript
// In CacheInvalidationService class
private subscriber: Redis | null = null;

// Store reference when creating subscriber
this.subscriber = redisClient.duplicate();

// Add close method
async close(): Promise<void> {
  if (this.subscriber) {
    await this.subscriber.quit();
    this.subscriber = null;
  }
}
```

Also register in graceful shutdown:

```typescript
// In server/index.ts shutdown handler
await cacheInvalidationService.close();
```

## Acceptance Criteria

- [ ] Store subscriber reference as class property
- [ ] Add `close()` method that quits subscriber
- [ ] Register in graceful shutdown handler
- [ ] Verify no connection leaks in dev mode with hot reload

## Files to Modify

- `server/services/cache-invalidation.ts`
- `server/index.ts` (shutdown handler)

## Work Log

| Date | Action | Notes |
|------|--------|-------|
| 2026-01-23 | Created | From code review - performance oracle agent |
| 2026-01-23 | **APPROVED** | Triage session - ready to work on |

## Resources

- Cache invalidation: `server/services/cache-invalidation.ts`
- Graceful shutdown: `server/index.ts`
