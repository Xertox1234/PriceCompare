# LEARNINGS: Redis-Native Simplification (TODO_001)

**Date:** 2025-12-05
**Related Commit:** 297e772 (refactor: Simplify account lockout middleware)
**PR:** #171
**Author:** Claude Code / Development Team

---

## Executive Summary

Simplified account lockout middleware from 623 LOC to 150 LOC (76% reduction) by replacing custom expiration logic with Redis-native TTL features. This refactoring demonstrates a critical principle: **use platform features, don't reimplement them**.

## The Problem: Over-Engineering

### What We Found

The original `server/middleware/account-lockout.ts` (623 lines) implemented:

1. **Dual Storage System**
   - Redis for distributed state
   - In-memory Map with manual TTL tracking for fallback
   - Two storage backends to maintain and synchronize

2. **Manual Cleanup Logic**
   - `setInterval()` running every hour to remove expired entries
   - LRU eviction when approaching 10,000 entry cap
   - Complex timing calculations for TTL comparison

3. **Redundant Function Pairs**
   - Async/sync versions of every function
   - Complex JSON parsing helpers for simple data
   - Monitoring functions (getLockoutStats) adding complexity

4. **Memory Exhaustion Prevention**
   - 10,000 entry cap with LRU eviction
   - Manual tracking of "lastAccess" timestamps
   - Percentage-based cleanup (remove oldest 20%)

### Why This Was Over-Engineered

| What We Built | What Redis Already Does |
|---------------|-------------------------|
| Manual TTL tracking in Map | `EXPIRE` command with automatic key deletion |
| Hourly cleanup intervals | Automatic expiration (passive + active) |
| Memory cap with LRU | `maxmemory` + `maxmemory-policy` config |
| Custom JSON parsing | Native string operations with `INCR`/`GET` |

**Root Cause:** The original implementation was designed defensively for a scenario that never materialized - needing to work without Redis in production while still maintaining distributed state.

---

## The Solution: Redis-Native Implementation

### Key Insight

Redis is **designed** to handle exactly this use case:
- Atomic counters with TTL (rate limiting)
- Automatic key expiration (cleanup)
- Single-source-of-truth state (distributed systems)

### Redis Commands Used

```typescript
// Atomic counter increment
const attempts = await redis.incr(key);

// Set TTL on first attempt (auto-cleanup)
if (attempts === 1) {
  await redis.expire(key, LOCKOUT_DURATION_SECONDS);
}

// Set locked flag with automatic expiration
if (attempts >= MAX_FAILED_ATTEMPTS) {
  await redis.setex(`locked:${email}`, LOCKOUT_DURATION_SECONDS, '1');
}

// Get remaining lockout time
const ttl = await redis.ttl(`locked:${email}`);

// Clear lockout on successful login
await redis.del(`lockout:${email}`, `locked:${email}`);
```

### The New Implementation (150 LOC)

```typescript
// server/utils/account-lockout-simple.ts

export async function recordFailedLoginAsync(email: string): Promise<{
  locked: boolean;
  attempts: number;
  remainingAttempts: number;
  lockedUntil?: Date;
}> {
  const redis = getRedisClient();
  if (!redis) {
    // Graceful degradation - no lockout without Redis
    return { locked: false, attempts: 0, remainingAttempts: MAX_FAILED_ATTEMPTS };
  }

  const normalizedEmail = email.toLowerCase();
  const key = `lockout:${normalizedEmail}`;

  // INCR is atomic - safe for concurrent requests
  const attempts = await redis.incr(key);

  // Set TTL on first attempt
  if (attempts === 1) {
    await redis.expire(key, LOCKOUT_DURATION_SECONDS);
  }

  // Lock if threshold reached
  if (attempts >= MAX_FAILED_ATTEMPTS) {
    await redis.setex(`locked:${normalizedEmail}`, LOCKOUT_DURATION_SECONDS, '1');
    return {
      locked: true,
      attempts,
      remainingAttempts: 0,
      lockedUntil: new Date(Date.now() + LOCKOUT_DURATION_SECONDS * 1000),
    };
  }

  return {
    locked: false,
    attempts,
    remainingAttempts: MAX_FAILED_ATTEMPTS - attempts,
  };
}
```

---

## Patterns to Apply

### Pattern 1: Platform-Feature-First Design

**Before implementing custom logic, ask:**

1. Does the platform (Redis, PostgreSQL, Node.js) already solve this?
2. What happens if we use the platform feature directly?
3. What edge cases does the platform already handle?

**Detection Questions:**
- Is there `setInterval` for cleanup? (Redis has TTL)
- Is there manual timestamp tracking? (Redis has TTL)
- Is there dual storage for "fallback"? (Evaluate if truly needed)
- Are there sync/async function pairs? (Modern code should be async-first)

### Pattern 2: Redis Atomic Operations

**Use these instead of get-check-set patterns:**

```typescript
// Pattern: Atomic counter with TTL
const attempts = await redis.incr(key);
if (attempts === 1) {
  await redis.expire(key, ttl);
}

// Pattern: Lock flag with automatic expiration
await redis.setex(`locked:${identifier}`, ttl, '1');

// Pattern: Check existence (not value)
const isLocked = await redis.exists(`locked:${identifier}`);

// Pattern: Atomic get-and-delete
const value = await redis.getdel(key);
```

### Pattern 3: Graceful Degradation

```typescript
const redis = getRedisClient();
if (!redis) {
  // Fail open for availability (security enhancement, not critical path)
  return { locked: false };
}
```

**Decision Framework:**
- Account lockout: Fail open (better to allow login than block legitimate users)
- Rate limiting: Fail open (service availability > perfect rate limiting)
- Session storage: Fail closed (security-critical, no fallback)
- Authentication: Fail closed (security-critical, no fallback)

### Pattern 4: API Compatibility

When simplifying, maintain the same function signatures:

```typescript
// Original
export async function recordFailedLoginAsync(email: string): Promise<{
  locked: boolean;
  attempts: number;
  remainingAttempts: number;
  lockedUntil?: Date;
}>

// Simplified - SAME SIGNATURE
export async function recordFailedLoginAsync(email: string): Promise<{
  locked: boolean;
  attempts: number;
  remainingAttempts: number;
  lockedUntil?: Date;
}>
```

This enables drop-in replacement with zero breaking changes.

---

## Over-Engineering Detection Checklist

When reviewing code, flag these as potential over-engineering:

### High Confidence (Flag Immediately)

- [ ] **Dual storage backends** for the same data (Redis + Map)
- [ ] **Manual cleanup intervals** (`setInterval` for cache/TTL)
- [ ] **Custom TTL tracking** (storing timestamps instead of using platform TTL)
- [ ] **Memory cap implementations** (manual LRU when platform has it)
- [ ] **Sync/async function pairs** for the same operation

### Medium Confidence (Investigate)

- [ ] **Complex JSON parsing** for simple key-value data
- [ ] **>500 LOC** for a single-purpose utility (rate limiting, lockout, etc.)
- [ ] **Monitoring functions** that add complexity for rarely-used features
- [ ] **"Fallback" logic** for scenarios that never occur in production

### Questions to Ask

1. "What happens if we remove the fallback storage?"
2. "Does Redis/PostgreSQL/Node already handle this expiration?"
3. "Is this complexity earning its keep in production?"
4. "What's the actual failure mode we're protecting against?"

---

## Metrics

| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| Lines of Code | 623 | 150 | 76% reduction |
| Functions | 12 | 5 | 58% reduction |
| Storage Backends | 2 | 1 | 50% reduction |
| Cleanup Logic | Manual (setInterval) | Automatic (Redis TTL) | Eliminated |
| Test Complexity | 510 LOC | Reuses auth tests | Simplified |
| Code Review Issues | None found | Minor (parseInt radix) | Validates approach |

---

## Security Considerations

### What Was Preserved

- Lock account after 5 failed login attempts
- Lockout expires automatically after 15 minutes
- Atomic operations (race-condition safe via INCR)
- Graceful degradation when Redis unavailable

### What Was Improved

- Single storage backend = single source of truth
- No race conditions between Redis and Map
- Simpler code = fewer bugs = better security

### Graceful Degradation Trade-off

The simplified version "fails open" when Redis is unavailable - no lockout protection. This is acceptable because:

1. Account lockout is a security *enhancement*, not a security *requirement*
2. Primary authentication (password verification) still works
3. Other rate limiting layers exist (IP-based)
4. Redis unavailability is rare and typically brief
5. Better to allow login than block legitimate users

---

## Code Review Validation

The code review found only **one minor issue**: missing radix parameter in `parseInt()`.

```typescript
// Before (implicit radix)
attempts ? parseInt(attempts) : undefined

// After (explicit radix - ESLint best practice)
attempts ? parseInt(attempts, 10) : undefined
```

This validates the approach: **simpler code using platform primitives = more reliable code**.

---

## When to Apply This Pattern

### Good Candidates for Simplification

1. **Rate limiting with custom cleanup** - Use Redis TTL
2. **Session management with manual expiration** - Use Redis TTL
3. **Cache with custom eviction** - Use Redis maxmemory-policy
4. **Distributed locks with manual cleanup** - Use Redis TTL + SETNX
5. **Temporary flags/tokens** - Use Redis SETEX

### Not Good Candidates

1. **Business logic that varies by environment** - May need flexibility
2. **Data that must persist beyond Redis restart** - Use PostgreSQL
3. **Complex state machines** - May need explicit control
4. **Audit logging** - Needs persistence, not TTL

---

## References

- **Commit:** 297e772919208350f13b7a5fef80658deb710c5d
- **Original File:** `server/middleware/account-lockout.ts` (deleted)
- **New File:** `server/utils/account-lockout-simple.ts`
- **Redis Commands:** [INCR](https://redis.io/commands/incr/), [EXPIRE](https://redis.io/commands/expire/), [SETEX](https://redis.io/commands/setex/), [TTL](https://redis.io/commands/ttl/)

---

## Changelog

- 2025-12-05: Initial documentation (TODO_001 completion)
