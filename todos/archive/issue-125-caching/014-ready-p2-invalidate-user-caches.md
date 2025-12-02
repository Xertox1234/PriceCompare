# TODO: Invalidate User Caches on Update

## Priority: P2 (Important)
## Status: ✅ Ready to Pick Up
## Created: 2025-12-01
## Issue: #125 - Phase 3, Task 4

---

## Problem Statement

When user profiles are updated, cached user data must be invalidated.

---

## Implementation

```typescript
/**
 * Invalidate user caches after profile update.
 *
 * Clears: user:safe:{id}
 *
 * @param userId - ID of updated user
 */
async invalidateUserCache(userId: number): Promise<void> {
  try {
    await this.cache.invalidate(`user:safe:${userId}`);

    logger.debug('User cache invalidated', { userId });
  } catch (error) {
    logger.warn('Failed to invalidate user cache', { userId, error });
  }
}
```

**Integration:** Call from `storage.updateUser()` after successful update

---

## Acceptance Criteria

- [ ] `invalidateUserCache(userId)` method added
- [ ] Invalidates `user:safe:${id}` cache
- [ ] Graceful error handling
- [ ] JSDoc documentation

---

## Notes

**Source:** GitHub issue #125, Phase 3, Task 4
**Dependencies:** Tasks 001, 002, 010
