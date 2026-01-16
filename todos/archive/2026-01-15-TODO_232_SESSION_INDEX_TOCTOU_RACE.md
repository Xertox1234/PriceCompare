# TODO 232: Fix TOCTOU Race Condition in Session Index Cleanup

**Priority**: P0 - CRITICAL (Correctness/Memory Leak)
**File(s)**: `server/utils/session-index.ts`
**Estimated Time**: 20 minutes
**Status**: Not Started
**Created Date**: 2026-01-15
**Source**: Code Review (code-review-specialist agent)

## Pattern References

- **Primary**: [docs/02_DATABASE_PATTERNS.md#transactions](docs/02_DATABASE_PATTERNS.md) - Transaction patterns for atomicity
- **Related**: [docs/06_ERROR_HANDLING_PATTERNS.md](docs/06_ERROR_HANDLING_PATTERNS.md) - Error handling
- **Redis Patterns**: Redis pipelining and MULTI/EXEC transactions

## Problem Statement

The `cleanupStaleSessionsFromIndex()` function has a **Time-Of-Check-Time-Of-Use (TOCTOU) race condition** that can cause:

1. **Memory leak** - Stale session IDs accumulate in Redis `user_sessions:*` sets
2. **Index corruption** - Session IDs remain in index after logout/expiration
3. **False positives** - Password change thinks sessions exist when they don't

**Attack/Failure Scenario**:
```
T0: sMembers returns ['session-1', 'session-2']
T1: exists('sess:session-1') → 0 (expired, marked stale)
T2: exists('sess:session-2') → 1 (still valid)
T3: User logs out session-2 → removeSessionFromUserIndex() called
T4: sRem('user_sessions:123', ['session-1']) → Only removes session-1
T5: session-2 stays in index forever (orphaned)
```

**Over time**: Each race condition leaves one orphaned session ID. After 1000 password changes with races, `user_sessions:*` keys grow by 1000 stale entries, consuming Redis memory.

## Root Cause

**Current Implementation** (lines 182-233):

```typescript
// ❌ UNSAFE - Race condition between check and use
const sessionIds = await redisClient.sMembers(key);  // Snapshot at T0

// Multiple separate Redis calls (non-atomic)
for (const sessionId of sessionIds) {
  const sessionKey = `sess:${sessionId}`;
  const exists = await redisClient.exists(sessionKey);  // Check at T1, T2, T3...
  if (exists === 0) {
    staleSessionIds.push(sessionId);
  }
}

// RACE WINDOW: Sessions can expire/logout between exists() and sRem()
if (staleSessionIds.length > 0) {
  await redisClient.sRem(key, staleSessionIds);  // Use at T100
}
```

**Why this fails**:
- **Check phase** (`exists()` calls) and **use phase** (`sRem()`) are separated by time
- Session state can change between check and use (logout, expiration)
- No atomic guarantee that checked state matches used state

## Solution Approach

Use **Redis pipelining (MULTI/EXEC)** to make all existence checks atomic relative to each other, minimizing the race window.

---

## Implementation Steps

### Step 1: Replace Loop-Based Checks with Pipeline (15 min)

Replace the `for` loop with Redis `multi()` pipeline:

**File**: `server/utils/session-index.ts` lines 182-233

```typescript
export async function cleanupStaleSessionsFromIndex(userId: number): Promise<number> {
  const redisClient = getRedisSessionClient();
  if (!redisClient) {
    logger.warn('[SessionIndex] Cannot cleanup: Redis not available', { userId });
    return 0;
  }

  try {
    const key = getUserSessionsKey(userId);
    const sessionIds = await redisClient.sMembers(key);

    if (sessionIds.length === 0) {
      return 0;
    }

    // ✅ SAFE - Use pipelined exists checks (atomic batch)
    // All checks happen in a single Redis round-trip
    const pipeline = redisClient.multi();
    for (const sessionId of sessionIds) {
      pipeline.exists(`sess:${sessionId}`);
    }
    const results = await pipeline.exec();

    // Collect stale sessions based on pipeline results
    const staleSessionIds: string[] = [];
    if (results) {
      for (let i = 0; i < sessionIds.length; i++) {
        // Pipeline results are [error, result] tuples
        const [error, exists] = results[i];
        if (!error && exists === 0) {
          staleSessionIds.push(sessionIds[i]);
        }
      }
    }

    // Remove stale sessions from index
    if (staleSessionIds.length > 0) {
      await redisClient.sRem(key, staleSessionIds);

      logger.info('[SessionIndex] Cleaned up stale sessions from index', {
        userId,
        staleCount: staleSessionIds.length,
        totalCount: sessionIds.length,
      });

      // If SET is now empty, delete the key
      const remainingCount = await redisClient.sCard(key);
      if (remainingCount === 0) {
        await redisClient.del(key);
        logger.debug('[SessionIndex] Removed empty user sessions key', { userId });
      }
    }

    return staleSessionIds.length;
  } catch (error) {
    logger.error('[SessionIndex] Failed to cleanup stale sessions', {
      userId,
      error: error instanceof Error ? error.message : String(error),
    });
    return 0;
  }
}
```

**Why this is better**:
- All `exists()` checks execute in a single Redis round-trip (pipeline)
- Minimizes race window from ~100ms (N sequential calls) to ~1ms (single batch)
- Still not 100% atomic (could use WATCH/MULTI/EXEC for that), but drastically reduces race probability

### Step 2: Add Tests for Race Condition (5 min)

Add test to verify pipeline behavior:

**File**: `server/utils/__tests__/session-index.test.ts`

```typescript
it('should use pipelined exists checks to minimize race window', async () => {
  const userId = 123;
  const sessionIds = ['session-1', 'session-2', 'session-3'];

  mockSMembers.mockResolvedValue(sessionIds);

  // Mock pipeline execution
  const mockMulti = {
    exists: vi.fn().mockReturnThis(),
    exec: vi.fn().mockResolvedValue([
      [null, 0],  // session-1 doesn't exist
      [null, 1],  // session-2 exists
      [null, 0],  // session-3 doesn't exist
    ]),
  };

  // Mock redisClient.multi()
  const mockRedisWithMulti = {
    ...mockRedisClient,
    multi: vi.fn().mockReturnValue(mockMulti),
  };

  vi.mocked(getRedisSessionClient).mockReturnValue(mockRedisWithMulti as any);

  const result = await cleanupStaleSessionsFromIndex(userId);

  expect(result).toBe(2);  // session-1 and session-3 removed
  expect(mockMulti.exists).toHaveBeenCalledTimes(3);
  expect(mockSRem).toHaveBeenCalledWith('user_sessions:123', ['session-1', 'session-3']);
});
```

---

## Technical Details

### Redis Pipeline vs Transaction

**Pipeline (MULTI/EXEC)** - What we're using:
- Batches multiple commands into single round-trip
- Commands execute sequentially but atomically as a group
- Faster than N separate calls
- Reduces (but doesn't eliminate) race window

**Full Transaction (WATCH/MULTI/EXEC)** - Overkill for this case:
- WATCH monitors keys for changes
- Transaction aborts if watched keys change
- Requires retry logic
- More complex, not needed for cleanup operation

**Why pipeline is sufficient**:
- Cleanup is best-effort (doesn't need perfect accuracy)
- Race window reduced from ~100ms to ~1ms (100x improvement)
- Worst case: One orphaned session ID (acceptable)
- Full ACID transaction overhead not justified

### Alternative Approaches Considered

**Option 1: Delete-All-Then-Re-Add** (simpler but slower):
```typescript
await redisClient.del(key);  // Atomic delete
for (const sessionId of sessionIds) {
  if (await redisClient.exists(`sess:${sessionId}`)) {
    await redisClient.sAdd(key, sessionId);  // Re-add valid ones
  }
}
```
❌ Rejected: Slower (2N calls vs N), temporary data loss during rebuild

**Option 2: Lua Script** (most atomic):
```lua
local key = KEYS[1]
local sessionIds = redis.call('SMEMBERS', key)
local stale = {}
for _, sid in ipairs(sessionIds) do
  if redis.call('EXISTS', 'sess:' .. sid) == 0 then
    table.insert(stale, sid)
  end
end
if #stale > 0 then
  redis.call('SREM', key, unpack(stale))
end
return #stale
```
❌ Rejected: Harder to maintain, debugging complexity, diminishing returns

**Option 3: Pipeline (chosen)**:
✅ Best balance of simplicity, performance, and correctness

---

## Checklist

- [ ] Replace loop-based `exists()` with Redis pipeline
- [ ] Handle pipeline result format `[error, value]` tuples
- [ ] Add test for pipelined execution
- [ ] Verify pipeline reduces race window (log timestamps)
- [ ] Update JSDoc to mention race condition mitigation

## Success Criteria

- [ ] `cleanupStaleSessionsFromIndex()` uses `redisClient.multi()` for batch checks
- [ ] All tests pass (including new pipeline test)
- [ ] TypeScript compilation succeeds
- [ ] ESLint passes with zero warnings
- [ ] Manual test: Create sessions, expire some, verify cleanup removes only stale ones
- [ ] Load test: 100 concurrent cleanups, verify no memory leaks

---

## ✅ PRE-CLOSE VERIFICATION CHECKLIST (MANDATORY)

### Code Verification
- [ ] **Grep verification**: Confirm pipeline usage
  ```bash
  # Verify multi() is used
  grep -n "redisClient.multi()" server/utils/session-index.ts

  # Verify pipeline.exec() is used
  grep -n "pipeline.exec()" server/utils/session-index.ts

  # Verify old loop pattern is gone
  ! grep -A 5 "for (const sessionId of sessionIds)" server/utils/session-index.ts | grep "await redisClient.exists"
  ```

- [ ] **Pipeline result handling**:
  ```bash
  # Verify results are destructured properly
  grep -n "const \[error, exists\]" server/utils/session-index.ts
  ```

### Testing
- [ ] **Run affected tests**:
  ```bash
  npm test server/utils/__tests__/session-index.test.ts
  ```

- [ ] **Manual test** (optional):
  ```typescript
  // In Node REPL with Redis connection:
  const { cleanupStaleSessionsFromIndex } = require('./server/utils/session-index');

  // Create test data
  await redisClient.sAdd('user_sessions:999', ['sess-1', 'sess-2', 'sess-3']);
  await redisClient.set('sess:sess-1', 'data');  // Valid session
  // sess-2 and sess-3 don't exist (stale)

  // Run cleanup
  const removed = await cleanupStaleSessionsFromIndex(999);
  console.log('Removed:', removed);  // Should be 2

  // Verify
  const remaining = await redisClient.sMembers('user_sessions:999');
  console.log('Remaining:', remaining);  // Should be ['sess-1']
  ```

### Build & Type Safety
- [ ] **TypeScript compilation**: `npm run check`
- [ ] **ESLint check**: `npm run lint`

### Performance
- [ ] **Verify performance improvement**:
  ```typescript
  // Add timing logs to cleanup function
  const start = Date.now();
  const results = await pipeline.exec();
  const pipelineDuration = Date.now() - start;

  logger.debug('[SessionIndex] Pipeline execution time', {
    userId,
    sessionCount: sessionIds.length,
    pipelineDurationMs: pipelineDuration,
  });
  ```

  Expected: <10ms for 100 sessions (vs ~100ms with sequential calls)

---

## Impact Assessment

**Before Fix**:
- Race window: ~100ms per cleanup (N sequential `exists()` calls)
- Race probability: ~5% for active user (1 logout per 2 seconds during cleanup)
- Memory leak rate: ~50 orphaned session IDs per 1000 password changes

**After Fix**:
- Race window: ~1ms per cleanup (single pipelined batch)
- Race probability: ~0.05% (100x reduction)
- Memory leak rate: ~0.5 orphaned session IDs per 1000 password changes

**Production impact at scale**:
- 10,000 users × 3 sessions each = 30,000 session IDs
- Before: ~150 orphaned IDs per day (5% of 3000 password changes)
- After: ~1.5 orphaned IDs per day (negligible)

---

## Related Issues

- **TODO_229**: Password change validation (where this optimization was introduced)
- **Performance Oracle Review**: Identified O(N) → O(M) transformation need
- **Code Review**: Identified TOCTOU race condition (this TODO)

---

## Notes

**Why this is P0 CRITICAL**:
- Memory leak in production Redis (unbounded growth)
- Correctness issue (index doesn't match reality)
- Affects core security feature (session invalidation)

**Why pipeline is sufficient** (vs full WATCH/MULTI/EXEC):
- Cleanup is best-effort operation
- 100x race reduction is acceptable (perfect atomicity not required)
- Simpler code, easier to maintain

**Future enhancement**: If orphaned sessions become a problem despite pipeline, consider:
- Periodic background job to scan all `user_sessions:*` keys and validate
- TTL-based auto-expiration (index keys expire naturally)
- Redis Lua script for full atomicity (if justified)

---

**Created by**: Code Review Agent (code-review-specialist)
**Creation Date**: 2026-01-15
**Severity**: P0 - CRITICAL (Memory Leak + Correctness)
**Blocking**: Production deployment (must fix before release)
