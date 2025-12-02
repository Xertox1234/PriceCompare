# TODO: Add Graceful Fallback for Redis Unavailability

## Priority: P2 (Important)
## Status: ✅ Ready to Pick Up
## Created: 2025-12-01
## Issue: #125 - Phase 1, Task 3

---

## Problem Statement

Ensure the `StorageCacheService` gracefully degrades when Redis is unavailable. The application must continue functioning by falling back to the storage layer (database) without crashing or returning errors to users.

**Current State:**
- Redis is **MANDATORY** in production (app exits on startup if unavailable)
- However, Redis can fail **after startup** (network issues, server restarts, memory limits)
- Without graceful fallback during runtime, cache errors crash request handlers
- Users experience downtime despite database being healthy

**Why This Matters:**
- **Production Stability**: Cache should enhance performance, not create single point of failure
- **User Experience**: Users shouldn't see errors when Redis has issues
- **Operations**: Reduces false alarms - cache failures are non-critical if fallback works
- **SLA Protection**: Application remains available even during cache infrastructure issues

---

## Findings

**Location:** `server/services/storage-cache.ts` (error handling in cachedGet method)

**Problem Scenario:**
1. Application starts successfully with Redis connected
2. During runtime: Redis connection drops (network partition, server restart, etc.)
3. Request handler calls `storageCache.getProductById(123)`
4. Without fallback: `cache.getOrSet()` throws error → request crashes → 500 error to user
5. With fallback: Error caught → log warning → execute `fetchFn()` directly → return data

**Expected Behavior:**
```typescript
// ✅ CORRECT - Graceful degradation
try {
  return await this.cache.getOrSet(key, fetchFn, ttl, tier);
} catch (error) {
  // Log error but don't crash
  logger.warn(`Cache unavailable for key ${key}, using storage fallback`, { error });
  return await fetchFn(); // Direct database query
}
```

**Related Files:**
- `server/services/storage-cache.ts` - Implementation location
- `server/config/redis.ts:1-225` - Redis client setup with error handling
- `server/utils/logger.ts` - Structured logging utility
- `docs/storage-layer/CACHING_STRATEGY_GUIDE.md` - Fallback strategy documentation

---

## Proposed Solutions

### Option 1: Comprehensive Error Handling (Recommended)
Add detailed error logging with context and structured error handling.

```typescript
private async cachedGet<T>(
  cacheKey: string,
  fetchFn: () => Promise<T>,
  ttl: number,
  tier: 'HOT' | 'WARM' | 'COLD' | 'STATIC'
): Promise<T> {
  try {
    return await this.cache.getOrSet(cacheKey, fetchFn, ttl, tier);
  } catch (error) {
    // Use structured logger, not console.error
    logger.warn('Cache operation failed, falling back to storage layer', {
      cacheKey,
      tier,
      error: error instanceof Error ? error.message : 'Unknown error',
      fallback: 'storage'
    });

    // Graceful fallback: execute fetch function directly
    return await fetchFn();
  }
}
```

- **Pros**:
  - Structured logging for monitoring/alerting
  - Includes context (cache key, tier) for debugging
  - Uses proper logger utility (not console)
  - Clear fallback indication
- **Cons**:
  - Slightly more code
- **Effort**: Small (1 hour)
- **Risk**: Low

### Option 2: Simple Fallback (Already in Task 002)
Basic try-catch with console.error logging.

- **Pros**:
  - Minimal code
  - Works for basic scenarios
- **Cons**:
  - Less debuggable (no context in logs)
  - Uses console instead of structured logger
  - Harder to set up monitoring/alerts
- **Effort**: Small (30 min)
- **Risk**: Low

---

## Recommended Action

**Use Option 1: Comprehensive Error Handling**

This provides better operational visibility and follows the project's logging patterns.

**Testing Requirements:**

1. **Manual Test - Redis Disabled:**
   ```bash
   # Stop Redis temporarily
   redis-cli shutdown

   # Start app (will use in-memory fallback in dev)
   npm run dev

   # Test product endpoint
   curl http://localhost:5000/api/products/1

   # Should work, but slower (no cache)
   # Check logs for "Cache operation failed" warnings
   ```

2. **Manual Test - Redis Connection Loss:**
   ```bash
   # Start app with Redis running
   npm run dev

   # Make request (should cache)
   curl http://localhost:5000/api/products/1

   # Kill Redis during operation
   redis-cli shutdown

   # Make another request
   curl http://localhost:5000/api/products/1

   # Should still work via storage fallback
   ```

3. **Check Logs:**
   - Verify structured logging with context
   - Confirm no error stack traces in user responses
   - Validate fallback indicator present

---

## Technical Details

**Affected Files:**
- `server/services/storage-cache.ts` (update cachedGet method)
- `server/utils/logger.ts` (import structured logger)

**Related Components:**
- `AdvancedCacheService` - May throw errors on Redis failures
- `storage.ts` - Fallback data source
- Route handlers - Should receive data regardless of cache status

**Database Changes:** No

**Error Handling Strategy:**
- **Catch**: All errors from `cache.getOrSet()`
- **Log**: Structured warning with context (not error level - this is expected behavior)
- **Fallback**: Execute `fetchFn()` directly
- **Never Throw**: Errors should not propagate to route handlers

**Monitoring Considerations:**
- Warning logs should trigger low-priority alerts (investigate, don't page)
- Track fallback frequency as metric (if too high, investigate Redis health)
- No user-facing errors (graceful degradation)

---

## Acceptance Criteria

- [ ] Error handling added to `cachedGet()` method
- [ ] Uses structured `logger.warn()` (not console.error)
- [ ] Log includes cache key, tier, and error message
- [ ] Fallback executes `fetchFn()` directly on cache errors
- [ ] Tested manually with Redis disabled
- [ ] Tested manually with Redis connection loss during operation
- [ ] Application continues working in both test scenarios
- [ ] No error stack traces exposed to users
- [ ] Log output includes "fallback: 'storage'" indicator
- [ ] TypeScript compilation passes (`npm run check`)
- [ ] JSDoc updated to document fallback behavior

---

## Resources

**Internal References:**
- `server/config/redis.ts:1-225` - Redis error handling patterns
- `server/utils/logger.ts` - Structured logging utility
- `docs/storage-layer/CACHING_STRATEGY_GUIDE.md` - Fallback strategy
- `REDIS_PRODUCTION_REQUIREMENT.md` - Production Redis requirements

**External References:**
- [Node.js Error Handling Best Practices](https://nodejs.org/en/docs/guides/error-handling/)
- [ioredis Error Handling](https://github.com/redis/ioredis#error-handling)

---

## Work Log

### 2025-12-01 - Initial Discovery
**By:** Claude Triage System
**Actions:**
- Issue discovered during triage of GitHub #125
- Categorized as P2 (Important) - production reliability
- Estimated effort: Small (1 hour)
- Marked as **Ready to Pick Up**

**Learnings:**
- This is Phase 1, Task 3 - reliability foundation
- Redis can fail after startup (network issues, restarts)
- Graceful degradation critical for production SLA
- Structured logging enables better operational visibility

---

## Notes

**Source:** Triage session on 2025-12-01 for GitHub issue #125
**Phase:** 1 of 4 (Core Cache Infrastructure)
**Dependencies:** Task 002 (cachedGet method must exist)
**Testing Focus:** Manual testing required - verify with Redis down
**Production Impact:** Critical for avoiding cache-related outages
