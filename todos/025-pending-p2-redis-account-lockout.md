---
status: pending
priority: p2
issue_id: "025"
tags: [security, auth, redis, distributed, code-review]
dependencies: []
---

# Implement Redis-Backed Account Lockout

## Problem Statement

The account lockout mechanism stores failed login attempts in an in-memory Map. This is not distributed across multiple server instances.

**Impact:** In a multi-instance deployment:
- An attacker can brute-force passwords by distributing requests across instances
- Each instance has its own separate lockout counter
- Lockout data is lost on server restart

## Findings

Discovered during security audit on 2025-11-23.

**Location:** `server/middleware/account-lockout.ts` line 30

**Evidence:**
```typescript
// In-memory storage for failed login attempts
// In production, this should be Redis-based for scalability
const failedAttempts = new Map<string, FailedLoginAttempt>();
```

## Proposed Solutions

### Option 1: Redis-Based Lockout (Recommended)

**Effort:** Medium (1 day)

**Implementation:**
```typescript
import { getRedisClient } from '../config/redis';

const LOCKOUT_PREFIX = 'lockout:';
const ATTEMPT_WINDOW_SECONDS = 900; // 15 minutes

async function recordFailedLogin(email: string): Promise<number> {
  const redis = getRedisClient();
  const key = `${LOCKOUT_PREFIX}${email.toLowerCase()}`;

  const attempts = await redis.incr(key);
  if (attempts === 1) {
    await redis.expire(key, ATTEMPT_WINDOW_SECONDS);
  }

  return attempts;
}

async function isAccountLocked(email: string): Promise<boolean> {
  const redis = getRedisClient();
  const key = `${LOCKOUT_PREFIX}${email.toLowerCase()}`;
  const attempts = await redis.get(key);
  return parseInt(attempts || '0') >= MAX_FAILED_ATTEMPTS;
}

async function clearFailedAttempts(email: string): Promise<void> {
  const redis = getRedisClient();
  await redis.del(`${LOCKOUT_PREFIX}${email.toLowerCase()}`);
}
```

## Technical Details

- **Affected Files**: `server/middleware/account-lockout.ts`
- **Related Components**: Auth routes, Redis config
- **Database Changes**: None (Redis only)

## Acceptance Criteria

- [ ] Failed attempts stored in Redis
- [ ] Lockout works across multiple server instances
- [ ] Lockout persists across server restarts
- [ ] Successful login clears failed attempts
- [ ] TTL automatically expires old attempts
- [ ] Graceful fallback if Redis unavailable (in dev only)

## Work Log

### 2025-11-23 - Security Audit Discovery
**By:** Claude Code Review System (security-sentinel agent)

## Notes

Source: Comprehensive code audit performed on 2025-11-23
