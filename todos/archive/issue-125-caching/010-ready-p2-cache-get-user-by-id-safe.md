# TODO: Cache getUserByIdSafe(id) - User Profile

## Priority: P2 (Important)
## Status: ✅ Ready to Pick Up
## Created: 2025-12-01
## Issue: #125 - Phase 2, Task 5

---

## Problem Statement

Implement cached wrapper for `getUserByIdSafe(id)` - user profile lookup with sensitive fields excluded. Used for profile pages and user references throughout the app.

**Security Note:** This method returns `SafeUser` (no passwordHash), making it safe to cache.

---

## Implementation

```typescript
/**
 * Get user by ID (safe fields only) with caching.
 * Cache key: user:safe:{id}
 * TTL: 5 minutes (300s)
 * Tier: WARM
 *
 * SECURITY: Only caches SafeUser (passwordHash excluded)
 */
async getUserByIdSafe(id: number): Promise<SafeUser | null> {
  const cacheKey = `user:safe:${id}`;

  return this.cachedGet<SafeUser | null>(
    cacheKey,
    () => storage.getUserByIdSafe(id),
    300, // 5 minutes
    'WARM'
  );
}
```

**Security:**
- ONLY caches `SafeUser` type (no passwordHash)
- Never cache full user with credentials

---

## Acceptance Criteria

- [ ] Method added to StorageCacheService
- [ ] Cache key: `user:safe:${id}`
- [ ] TTL: 300s (5 minutes)
- [ ] Tier: 'WARM'
- [ ] Return type: `Promise<SafeUser | null>`
- [ ] JSDoc with SECURITY note
- [ ] TypeScript passes

---

## Notes

**Source:** GitHub issue #125, Phase 2, Task 5
**Dependencies:** Tasks 001, 002
**Security:** SafeUser type ensures no sensitive data cached
