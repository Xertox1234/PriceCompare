---
status: pending
priority: p1
issue_id: "042"
tags: [data-integrity, transactions, critical, code-review]
dependencies: []
---

# Add Transaction Boundary for User Suspension

## Problem Statement

User suspension operation performs two separate database operations without transaction wrapping, creating a risk of **partial execution**.

**Location:** `/Users/williamtower/projects/PriceCompare/server/storage/domains/user-storage.ts:270-297`

**Impact:**
- User can be suspended without notification being created
- UX failure - user doesn't know why they can't log in
- Potential legal/compliance issues (no audit trail of notification)
- Data integrity violation

## Findings

Discovered during comprehensive data integrity audit on 2025-11-27 by data-integrity-guardian agent.

**Current Implementation (INCORRECT):**
```typescript
// ❌ WRONG - Two separate database operations
async suspendUser(userId: number, reason: string, moderatorId: number): Promise<void> {
  // Step 1: Suspend user
  await this.db.update(users)
    .set({ isSuspended: true })
    .where(eq(users.id, userId));

  // Step 2: Create notification (separate operation - not atomic!)
  await this.db.insert(notifications).values({
    userId,
    type: 'moderation',
    title: 'Account suspended',
    content: reason,
  });
  // If notification fails, user is suspended but never notified!
}
```

**Failure Scenario:**
1. User suspension succeeds (user.isSuspended = true)
2. Notification creation fails (network error, validation error, etc.)
3. User is locked out but has no notification explaining why
4. Support tickets, frustrated users, compliance issues

## Proposed Solutions

### Option 1: Wrap in Transaction (Recommended)

**Effort:** Small (15 minutes)
**Risk:** Low (standard pattern)

**Implementation:**
```typescript
// ✅ CORRECT - Atomic operation
async suspendUser(userId: number, reason: string, moderatorId: number): Promise<void> {
  await this.db.transaction(async (tx) => {
    // Step 1: Suspend user
    await tx.update(users)
      .set({ isSuspended: true })
      .where(eq(users.id, userId));

    // Step 2: Create notification - must succeed or rollback suspension
    await tx.insert(notifications).values({
      userId,
      type: 'moderation',
      title: 'Account suspended',
      content: reason,
    });
  });
  // Both operations succeed or both rollback
}
```

**Pros:**
- Guarantees atomic operation
- User never suspended without notification
- Follows documented pattern from CLAUDE.md
- Minimal performance impact (<5ms)

**Cons:**
- None identified

## Recommended Action

**Implement transaction boundary immediately** - This is a UX and data integrity issue.

## Technical Details

**Affected Files:**
- `/Users/williamtower/projects/PriceCompare/server/storage/domains/user-storage.ts:270-297`

**Related Patterns:**
- `/Users/williamtower/projects/PriceCompare/docs/DATABASE_PATTERNS.md` - Transaction boundary guidelines
- `/Users/williamtower/projects/PriceCompare/CLAUDE.md:589-670` - Transaction requirements

**Similar Patterns Found:**
- User registration uses SERIALIZABLE transaction correctly
- Other moderation actions need audit for same issue

**Database Impact:**
- Transaction overhead: ~5ms typical
- Worth it for data integrity guarantee

## Acceptance Criteria

- [x] suspendUser() wrapped in transaction
- [x] Both operations atomic (succeed together or fail together)
- [x] Tests verify rollback on notification failure
- [x] No change to API contract (same function signature)

## Work Log

### 2025-11-27 - Data Integrity Issue Discovery
**By:** Claude Code Review System (data-integrity-guardian agent)
**Actions:**
- Analyzed all multi-step database operations
- Identified missing transaction boundaries
- Verified against CLAUDE.md requirements

**Learnings:**
- Check ALL moderation actions for similar patterns
- Transaction boundaries prevent partial updates
- UX depends on data consistency

## Notes

**Source:** Comprehensive data integrity audit performed on 2025-11-27
**Pattern:** Create + Notification requires transaction (documented in DATABASE_PATTERNS.md)

**Related Issues:**
- Issue #043: Notification daily limit race condition
- Issue #044: Missing unique constraints

**Testing:**
```typescript
// Test case to add
it('should rollback suspension if notification fails', async () => {
  // Mock notification insert to fail
  await expect(suspendUser(userId, reason, modId)).rejects.toThrow();

  // Verify user NOT suspended (rollback occurred)
  const user = await getUserById(userId);
  expect(user.isSuspended).toBe(false);
});
```
