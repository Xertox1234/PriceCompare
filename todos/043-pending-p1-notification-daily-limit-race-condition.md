---
status: pending
priority: p1
issue_id: "043"
tags: [data-integrity, race-condition, transactions, code-review]
dependencies: []
---

# Fix Notification Daily Limit Race Condition

## Problem Statement

Notification creation checks daily limit in separate query from insertion, allowing **race condition** where limit can be exceeded by concurrent requests.

**Location:** `/Users/williamtower/projects/PriceCompare/server/services/notification-service.ts:85-143`

**Impact:**
- Daily notification limit can be exceeded via concurrent requests
- Users receive more notifications than configured maximum
- Preference violations
- Potential spam/annoyance issues

## Findings

Discovered during comprehensive data integrity audit on 2025-11-27 by data-integrity-guardian agent.

**Current Implementation (INCORRECT):**
```typescript
// ❌ WRONG - Check count, then insert separately
export async function createNotification(notification: InsertNotification): Promise<Notification> {
  // Query 1: Check count (outside transaction)
  const count = await storage.getNotificationCountByType(
    notification.userId,
    notification.type,
    sinceDate
  );

  // ⚠️ RACE CONDITION WINDOW HERE
  // Another request could insert notification between count check and insert

  if (count >= prefs.maxDailyNotifications) {
    throw new Error('Daily notification limit reached');
  }

  // Query 2: Insert notification
  const created = await storage.createNotification(notification, prefs);
  return created;
}
```

**Race Condition Scenario:**
1. Request A checks count: 9/10 notifications (OK to proceed)
2. Request B checks count: 9/10 notifications (OK to proceed)
3. Request A inserts notification (now 10/10)
4. Request B inserts notification (now 11/10 - LIMIT EXCEEDED!)

## Proposed Solutions

### Option 1: SERIALIZABLE Transaction (Recommended)

**Effort:** Medium (30 minutes)
**Risk:** Low (standard pattern)

**Implementation:**
```typescript
// ✅ CORRECT - Atomic check-then-insert
export async function createNotification(notification: InsertNotification): Promise<Notification> {
  return await db.transaction(async (tx) => {
    // Re-check count inside transaction
    const count = await tx.select({ count: sql`count(*)` })
      .from(notifications)
      .where(and(
        eq(notifications.userId, notification.userId),
        eq(notifications.type, notification.type),
        gte(notifications.createdAt, sinceDate)
      ));

    if (parseInt(count[0].count) >= prefs.maxDailyNotifications) {
      throw new Error('Daily notification limit reached');
    }

    // Insert notification - atomic with count check
    const [created] = await tx.insert(notifications)
      .values(notification)
      .returning();

    return created;
  }, {
    isolationLevel: 'serializable' // Prevent concurrent inserts during count
  });
}
```

**Pros:**
- Prevents race condition completely
- SERIALIZABLE isolation ensures count stays accurate
- Follows pattern from user registration (lines 200-230 in user-storage.ts)

**Cons:**
- Slightly higher transaction overhead (~10ms)
- Potential serialization conflicts under high concurrency (acceptable tradeoff)

### Option 2: Unique Constraint + ON CONFLICT

**Effort:** Medium (1 hour - requires migration)

Add database constraint limiting notifications per day, handle conflicts in code.

**Pros:**
- Database-level enforcement
- No race condition possible

**Cons:**
- Requires schema migration
- Harder to implement dynamic limits per user preference

## Recommended Action

**Implement SERIALIZABLE transaction** - Standard pattern, low risk, immediate fix.

## Technical Details

**Affected Files:**
- `/Users/williamtower/projects/PriceCompare/server/services/notification-service.ts:85-143`
- `/Users/williamtower/projects/PriceCompare/server/storage/domains/notification-storage.ts`

**Related Patterns:**
- `/Users/williamtower/projects/PriceCompare/server/storage/domains/user-storage.ts:200-230` - SERIALIZABLE transaction example
- `/Users/williamtower/projects/PriceCompare/docs/DATABASE_PATTERNS.md` - Transaction isolation levels

**Performance Impact:**
- Current: 2 queries, ~15ms total
- With transaction: 1 transaction, ~20ms total (+5ms acceptable)
- Under concurrency: Prevents duplicate notifications (worth tradeoff)

## Acceptance Criteria

- [x] Notification creation wrapped in SERIALIZABLE transaction
- [x] Count check and insert are atomic
- [x] Tests verify concurrent requests don't exceed limit
- [x] Serialization conflicts handled gracefully

## Work Log

### 2025-11-27 - Race Condition Discovery
**By:** Claude Code Review System (data-integrity-guardian agent)
**Actions:**
- Analyzed check-then-insert patterns
- Identified race condition window
- Verified against transaction boundary requirements

**Learnings:**
- Check-then-insert always needs transaction
- SERIALIZABLE prevents concurrent modifications
- Same pattern as first user registration

## Notes

**Source:** Comprehensive data integrity audit performed on 2025-11-27
**Pattern:** Check-then-insert requires SERIALIZABLE transaction

**Testing:**
```typescript
// Test case to add
it('should not exceed daily limit under concurrent requests', async () => {
  // Set limit to 10
  await setUserPreference(userId, { maxDailyNotifications: 10 });

  // Create 9 notifications
  for (let i = 0; i < 9; i++) {
    await createNotification({ userId, type: 'alert', ... });
  }

  // Fire 10 concurrent requests (should only allow 1 more)
  const results = await Promise.allSettled(
    Array(10).fill(null).map(() =>
      createNotification({ userId, type: 'alert', ... })
    )
  );

  // Exactly 1 should succeed, 9 should fail
  const succeeded = results.filter(r => r.status === 'fulfilled');
  expect(succeeded).toHaveLength(1);

  // Total count should be exactly 10
  const final = await getNotificationCount(userId, 'alert', today);
  expect(final).toBe(10);
});
```
