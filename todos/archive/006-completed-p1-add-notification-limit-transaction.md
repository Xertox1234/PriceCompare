---
status: completed
priority: p1
issue_id: "006"
tags: [concurrency, data-integrity, notifications, transaction]
dependencies: []
completed_date: 2025-12-26
---

# Add SERIALIZABLE Transaction to Notification Daily Limit

## Problem Statement

**CRITICAL RACE CONDITION:** The notification daily limit enforcement likely uses a check-then-insert pattern without a transaction boundary. Two simultaneous price drop notifications can both pass the limit check and insert, allowing users to exceed their daily notification quota.

**Impact:** HIGH - Business logic violation, potential spam, degraded user experience.

## Findings

**From Data Integrity Review (2025-12-26):**

**Likely affected file:** `server/storage/domains/notification-storage.ts`

**Current implementation (inferred):**
```typescript
// ❌ WRONG - Race condition between check and insert
const count = await db.select({ count: sql<number>`count(*)` })
  .from(notifications)
  .where(and(
    eq(notifications.userId, userId),
    eq(notifications.type, type),
    gte(notifications.createdAt, todayStart)
  ));

if (count[0].count >= maxDaily) {
  return null; // Rate limited
}

// RACE CONDITION HERE: Another request could insert between check and insert
await db.insert(notifications).values(notificationData);
```

**Race condition scenario:**
1. User has 9/10 daily notifications
2. Two price drops occur simultaneously
3. **Request A:** Checks count → sees 9 (below limit)
4. **Request B:** Checks count → sees 9 (below limit)
5. **Request A:** Inserts notification (user now has 10)
6. **Request B:** Inserts notification (user now has **11** - LIMIT VIOLATED)

**Business impact:**
- Users receive more notifications than configured limit
- Potential email/SMS spam
- User experience degradation
- Trust violation (users set limits for a reason)

## Proposed Solutions

### Option 1: SERIALIZABLE Transaction (Recommended)

**Approach:** Wrap count check and insert in a single SERIALIZABLE transaction with retry logic.

**Implementation:**
```typescript
async createNotificationWithLimit(
  userId: number,
  type: string,
  data: NotificationData,
  maxDaily: number = 10
): Promise<Notification | null> {
  return await retryWithBackoff(
    async () => {
      return await db.transaction(async (tx) => {
        // Atomic check within transaction
        const [{ count }] = await tx.select({
          count: sql<number>`count(*)::int`
        })
        .from(notifications)
        .where(and(
          eq(notifications.userId, userId),
          eq(notifications.type, type),
          gte(notifications.createdAt, startOfToday())
        ));

        if (count >= maxDaily) {
          // Rate limited - return null without inserting
          return null;
        }

        // Atomic insert - guaranteed count is still valid
        const [notification] = await tx.insert(notifications)
          .values({ userId, type, ...data })
          .returning();

        return notification;
      }, { isolationLevel: 'serializable' });
    },
    { maxRetries: 3, baseDelay: 50 }
  );
}
```

**Pros:**
- Guarantees atomic check-and-insert
- Prevents race condition entirely
- Retry logic handles serialization failures
- Follows existing codebase pattern

**Cons:**
- Slight performance overhead (serializable isolation)
- May retry on high concurrency (acceptable trade-off)

**Effort:** 2-3 hours (including tests)

**Risk:** Low (well-established pattern)

---

### Option 2: Database-Level Constraint

**Approach:** Add database constraint limiting notifications per user per day.

**Pros:**
- Enforced at database level
- Cannot be bypassed

**Cons:**
- **Complex constraint** - Requires partial index or trigger
- Error handling needed (constraint violation → user-friendly message)
- Harder to adjust limits dynamically
- Not portable across databases

**Effort:** 4-6 hours

**Risk:** Medium (complex PostgreSQL features)

---

### Option 3: Distributed Lock with Redis

**Approach:** Use Redis lock during notification creation.

**Pros:**
- Prevents concurrent inserts

**Cons:**
- **Does not solve database race** - Lock released before commit
- Adds external dependency to critical path
- Lock coordination complexity
- **Not a proper fix** - still has TOCTOU issue

**Effort:** 3-4 hours

**Risk:** Medium (introduces new failure modes)

## Recommended Action

**MUST IMPLEMENT Option 1** - SERIALIZABLE transaction is the correct solution.

**Priority:** P1 (Critical) - Business logic violation, affects user experience.

## Technical Details

**Affected files:**
- `server/storage/domains/notification-storage.ts` - Add transaction wrapper
- `server/services/notification-service.ts` - May call storage method
- Tests: `server/storage/domains/__tests__/notification-storage.test.ts`

**Database table:**
- `notifications` (id, userId, type, createdAt, ...)

**Transaction isolation:**
- **SERIALIZABLE** - Prevents phantom reads
- Retry logic: 3 retries, 50ms base delay
- Expected: Low retry rate (notifications not that frequent per user)

**Daily limit defaults:**
- Email notifications: 10/day (configurable)
- SMS notifications: 5/day (configurable)
- Push notifications: 20/day (configurable)

## Resources

- **Pattern:** `docs/02_DATABASE_PATTERNS.md` - SERIALIZABLE transactions section
- **Example:** `server/storage/domains/user-storage.ts:275-305` - First-user pattern
- **Example:** `server/services/price-aggregation-service.ts:746-756` - Daily aggregation deduplication
- **Retry helper:** `server/utils/retry.ts` - `retryWithBackoff()`
- **Data Integrity Review:** 2025-12-26 findings

## Acceptance Criteria

- [ ] Notification creation wrapped in SERIALIZABLE transaction
- [ ] Count check and insert are atomic
- [ ] Retry logic handles serialization failures (max 3 retries)
- [ ] Unit test: Concurrent notification creation respects limit
- [ ] Integration test: 2+ simultaneous price drops → only allowed count inserted
- [ ] Load test: High concurrency scenario (50+ notifications/sec)
- [ ] Daily limit configuration preserved (10/5/20 defaults)
- [ ] Existing notification functionality unchanged
- [ ] Pre-commit hooks pass

## Work Log

### 2025-12-26 - Initial Discovery

**By:** Data Integrity Guardian Agent (Code Review)

**Actions:**
- Analyzed notification creation flow for race conditions
- Identified check-then-insert pattern without transaction
- Documented race condition scenario (2 simultaneous price drops)
- Calculated business impact (limit violations, spam potential)
- Reviewed existing SERIALIZABLE patterns in codebase

**Learnings:**
- Codebase already uses SERIALIZABLE for similar check-then-insert patterns
- Price aggregation service has nearly identical pattern (daily deduplication)
- Retry helper available and well-tested
- Fix straightforward using existing infrastructure

## Notes

- **CRITICAL:** P1 business logic violation, not just edge case
- **User impact:** Spam notifications degrade user experience
- **Frequency:** Race condition likely rare but possible with price monitoring
- **Test coverage:** Must include high-concurrency scenario
- Consider adding metrics to track serialization retry rate
- May want to add notification rate limiting at application level as well (separate from daily limit)
