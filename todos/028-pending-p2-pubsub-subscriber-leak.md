---
status: pending
priority: p2
issue_id: "028"
tags: [performance, memory-leak, redis, cache, code-review]
dependencies: []
---

# Fix Pub/Sub Subscriber Memory Leak in Advanced Cache

## Problem Statement

The `subscribeToInvalidations()` method creates a duplicate Redis client for pub/sub but the subscriber connection is never stored for cleanup.

**Impact:** The subscriber connection persists for the lifetime of the process but cannot be properly closed during graceful shutdown. In environments with frequent deployments, orphaned connections accumulate.

## Findings

Discovered during performance audit on 2025-11-23.

**Location:** `server/services/advanced-cache.ts` lines 438-467

**Evidence:**
```typescript
private subscribeToInvalidations(): void {
  // Create a separate Redis client for pub/sub
  const subscriber = redisClient.duplicate(); // Not stored for cleanup!

  subscriber.subscribe(this.PUBSUB_CHANNEL, (err) => {...});
  subscriber.on('message', (channel, message) => {...});
}
```

## Proposed Solutions

### Option 1: Store Subscriber for Cleanup (Recommended)

**Effort:** Small (30 minutes)

**Implementation:**
```typescript
private subscriber: Redis | null = null;

private subscribeToInvalidations(): void {
  this.subscriber = redisClient.duplicate();

  this.subscriber.subscribe(this.PUBSUB_CHANNEL, (err) => {
    if (err) {
      logger.error('Failed to subscribe to cache invalidations', { error: err });
    }
  });

  this.subscriber.on('message', (channel, message) => {
    // ... existing handler
  });
}

async close(): Promise<void> {
  if (this.subscriber) {
    await this.subscriber.quit();
    this.subscriber = null;
  }
}
```

Then call `advancedCache.close()` in graceful shutdown handler.

## Acceptance Criteria

- [ ] Subscriber stored as class property
- [ ] close() method implemented
- [ ] Graceful shutdown calls close()
- [ ] No orphaned Redis connections after restart

## Work Log

### 2025-11-23 - Performance Audit Discovery
**By:** Claude Code Review System (performance-oracle agent)

## Notes

Source: Comprehensive code audit performed on 2025-11-23
