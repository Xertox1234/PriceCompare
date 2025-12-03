# Audit: Job Lock Storage Timezone Issues

**Date:** 2025-12-03
**Related:** TODO_005_AUTH_EXPIRED_TOKEN, GitHub Issue #169
**Status:** Confirmed - Same pattern as password reset tokens

## Executive Summary

Found **identical timezone handling issues** in `server/storage/domains/job-lock-storage.ts` as discovered in password reset tokens. The file has inconsistent timezone handling across 3 methods that compare with `NOW()`.

## Issues Found

### 1. Inconsistent Timezone Handling (3 methods)

#### Method 1: `isJobLocked()` - Line 312
**Status:** ❌ Uses `NOW()` without `AT TIME ZONE`

```typescript
async isJobLocked(jobName: string): Promise<boolean> {
  const locks = await this.db
    .select({ id: jobLocks.id })
    .from(jobLocks)
    .where(
      and(
        eq(jobLocks.jobName, jobName),
        sql`${jobLocks.expiresAt} > NOW()`  // ❌ No timezone handling
      )
    )
    .limit(1);

  return locks.length > 0;
}
```

**Problem:** Comparing `timestamp` (no timezone) with `NOW()` (timezone-aware) without explicit UTC handling.

#### Method 2: `cleanupExpiredJobLocks()` - Line 332
**Status:** ❌ Uses JavaScript `new Date()` instead of PostgreSQL `NOW()`

```typescript
async cleanupExpiredJobLocks(): Promise<number> {
  const result = await this.db
    .delete(jobLocks)
    .where(lte(jobLocks.expiresAt, new Date()))  // ❌ JavaScript Date
    .returning({ id: jobLocks.id });

  return result.length;
}
```

**Problem:** Different timezone handling strategy than validation methods. Uses JavaScript Date which relies on driver timezone conversion.

#### Method 3: `getActiveJobLocksCount()` - Line 361
**Status:** ❌ Uses `NOW()` without `AT TIME ZONE`

```typescript
async getActiveJobLocksCount(): Promise<number> {
  const result = await this.db
    .select({ count: count() })
    .from(jobLocks)
    .where(sql`${jobLocks.expiresAt} > NOW()`);  // ❌ No timezone handling

  return Number(result[0]?.count ?? 0);
}
```

**Problem:** Same issue as `isJobLocked()` - no explicit timezone handling.

### 2. Method Using JavaScript Date (1 method)

#### Method: `updateExpiredJobLock()` - Line 199
**Status:** ⚠️ Uses JavaScript `new Date()` for comparison

```typescript
async updateExpiredJobLock(
  jobName: string,
  lockedBy: string,
  newExpiresAt: Date
): Promise<{ success: boolean; id?: number }> {
  const result = await this.db
    .update(jobLocks)
    .set({ /* ... */ })
    .where(
      and(
        eq(jobLocks.jobName, jobName),
        lte(jobLocks.expiresAt, new Date())  // ⚠️ JavaScript Date
      )
    )
    .returning({ id: jobLocks.id });
}
```

**Problem:** Inconsistent with PostgreSQL `NOW()` approach used elsewhere.

## Schema Issue

### Root Cause: `timestamp` Without Timezone

From `shared/schema.ts` (needs verification):
```typescript
export const jobLocks = pgTable("job_locks", {
  // ...
  expiresAt: timestamp("expires_at").notNull(),  // ❌ No timezone
  lockedAt: timestamp("locked_at").notNull().defaultNow(),  // ❌ No timezone
});
```

**Same issue as password_reset_tokens:** Using `timestamp` instead of `timestamptz`.

## Impact Assessment

### Severity: **Medium** (Same as password reset tokens)

**Potential Bugs:**
1. **Incorrect lock expiration checks** - Locks may appear active when expired (or vice versa)
2. **Race conditions in distributed systems** - Different servers with different timezones may disagree on lock state
3. **Premature/delayed cleanup** - Expired locks not cleaned up at correct time

**Real-World Scenarios:**
- Server in PST timezone (UTC-8):
  - Lock created to expire at 12:00 UTC
  - PostgreSQL stores as 12:00 (no timezone)
  - `NOW()` comparison uses PST timezone
  - Lock expires 8 hours early/late

### Affected Functionality
- ✅ Job acquisition: Uses `onConflictDoNothing()` (not affected)
- ❌ Lock expiration checks: `isJobLocked()` may return incorrect results
- ❌ Cleanup operations: `cleanupExpiredJobLocks()` may clean too early/late
- ❌ Active lock counts: `getActiveJobLocksCount()` may be inaccurate
- ❌ Expired lock updates: `updateExpiredJobLock()` may update wrong locks

## Recommended Fixes

### Fix 1: Use `AT TIME ZONE 'UTC'` (Short-Term)

**Same approach as password reset tokens:**

```typescript
// Fix isJobLocked()
async isJobLocked(jobName: string): Promise<boolean> {
  const locks = await this.db
    .select({ id: jobLocks.id })
    .from(jobLocks)
    .where(
      and(
        eq(jobLocks.jobName, jobName),
        sql`(${jobLocks.expiresAt} AT TIME ZONE 'UTC') > NOW()`  // ✅ Explicit UTC
      )
    )
    .limit(1);

  return locks.length > 0;
}

// Fix cleanupExpiredJobLocks()
async cleanupExpiredJobLocks(): Promise<number> {
  const result = await this.db.execute(
    sql`
      DELETE FROM job_locks
      WHERE (expires_at AT TIME ZONE 'UTC') < NOW()
      RETURNING id
    `
  );

  return result.rowCount || 0;
}

// Fix getActiveJobLocksCount()
async getActiveJobLocksCount(): Promise<number> {
  const result = await this.db
    .select({ count: count() })
    .from(jobLocks)
    .where(sql`(${jobLocks.expiresAt} AT TIME ZONE 'UTC') > NOW()`);  // ✅ Explicit UTC

  return Number(result[0]?.count ?? 0);
}

// Fix updateExpiredJobLock()
async updateExpiredJobLock(
  jobName: string,
  lockedBy: string,
  newExpiresAt: Date
): Promise<{ success: boolean; id?: number }> {
  const result = await this.db
    .update(jobLocks)
    .set({ /* ... */ })
    .where(
      and(
        eq(jobLocks.jobName, jobName),
        sql`(${jobLocks.expiresAt} AT TIME ZONE 'UTC') <= NOW()`  // ✅ Use NOW()
      )
    )
    .returning({ id: jobLocks.id });

  // ...
}
```

### Fix 2: Migrate Schema to `timestamptz` (Long-Term)

**Include in GitHub Issue #169:**

```sql
ALTER TABLE job_locks
  ALTER COLUMN expires_at TYPE timestamptz
  USING expires_at AT TIME ZONE 'UTC';

ALTER TABLE job_locks
  ALTER COLUMN locked_at TYPE timestamptz
  USING locked_at AT TIME ZONE 'UTC';
```

```typescript
// shared/schema.ts - After migration
export const jobLocks = pgTable("job_locks", {
  // ...
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),  // ✅
  lockedAt: timestamp("locked_at", { withTimezone: true }).notNull().defaultNow(),  // ✅
});
```

## Testing Requirements

### Test Cases Needed

1. **Cross-timezone validation:**
   ```typescript
   it('should correctly identify expired locks regardless of server timezone', async () => {
     // Create lock that expired 1 hour ago
     const expiredTime = new Date(Date.now() - 60 * 60 * 1000);
     await db.insert(jobLocks).values({
       jobName: 'test-job',
       lockedBy: 'test-instance',
       expiresAt: expiredTime,
       lockedAt: new Date(),
     });

     // Should be recognized as not locked
     const isLocked = await jobLockStorage.isJobLocked('test-job');
     expect(isLocked).toBe(false);
   });
   ```

2. **Cleanup accuracy:**
   ```typescript
   it('should clean up expired locks correctly', async () => {
     // Create 2 expired locks and 1 active lock
     const now = Date.now();
     await db.insert(jobLocks).values([
       { jobName: 'expired-1', expiresAt: new Date(now - 60000), /* ... */ },
       { jobName: 'expired-2', expiresAt: new Date(now - 60000), /* ... */ },
       { jobName: 'active', expiresAt: new Date(now + 60000), /* ... */ },
     ]);

     const cleaned = await jobLockStorage.cleanupExpiredJobLocks();
     expect(cleaned).toBe(2);

     const remaining = await db.select().from(jobLocks);
     expect(remaining).toHaveLength(1);
     expect(remaining[0].jobName).toBe('active');
   });
   ```

3. **Active count accuracy:**
   ```typescript
   it('should count only active (non-expired) locks', async () => {
     // Create mixed expired and active locks
     const now = Date.now();
     await db.insert(jobLocks).values([
       { jobName: 'expired', expiresAt: new Date(now - 1000), /* ... */ },
       { jobName: 'active-1', expiresAt: new Date(now + 60000), /* ... */ },
       { jobName: 'active-2', expiresAt: new Date(now + 60000), /* ... */ },
     ]);

     const count = await jobLockStorage.getActiveJobLocksCount();
     expect(count).toBe(2);  // Only active locks
   });
   ```

## Priority & Timeline

**Priority:** P2 - Medium (Same as password reset tokens)

**Timeline:**
1. **Short-term (1-2 hours):**
   - Apply `AT TIME ZONE 'UTC'` fixes to all 4 methods
   - Add type assertion comments if using raw SQL
   - Write/update tests for timezone handling

2. **Long-term (Part of Issue #169):**
   - Include `job_locks` table in schema migration
   - Remove `AT TIME ZONE` workarounds after migration
   - Simplify code to use Drizzle query builder

## Files to Modify

1. **`server/storage/domains/job-lock-storage.ts`** (Primary)
   - Lines 312, 332, 361, 199 - Add timezone handling

2. **`shared/schema.ts`** (Migration)
   - Add `{ withTimezone: true }` to `expiresAt` and `lockedAt`

3. **Tests** (Create if missing)
   - `server/storage/domains/__tests__/job-lock-storage.test.ts`

## Comparison with Password Reset Tokens

| Aspect | Password Reset Tokens | Job Locks |
|--------|----------------------|-----------|
| Schema issue | ✅ `timestamp` w/o timezone | ✅ `timestamp` w/o timezone |
| Methods affected | 2 (validate, cleanup) | 4 (isLocked, cleanup, count, update) |
| Inconsistent handling | ✅ Mixed NOW() and new Date() | ✅ Mixed NOW() and new Date() |
| Workaround applied | ✅ Yes (TODO_005) | ❌ Not yet |
| Tests exist | ✅ Yes | ⚠️ Unknown (needs check) |
| Priority | P2 | P2 |

## Related Documentation

- **Learnings:** `docs/LEARNINGS_TODO_005_AUTH_EXPIRED_TOKEN.md`
- **Patterns:** `docs/02_DATABASE_PATTERNS.md#53-timestamp-vs-timestamptz-critical`
- **GitHub Issue:** #169 (Schema migration)
- **Original TODO:** `todos/archive/2025-12-03-TODO_005_AUTH_EXPIRED_TOKEN.md`

## Conclusion

**Job lock storage has identical timezone issues as password reset tokens.** The fixes are straightforward and should be applied using the same approach:

1. ✅ **Immediate:** Apply `AT TIME ZONE 'UTC'` workarounds
2. ✅ **Long-term:** Include in schema migration (Issue #169)
3. ✅ **Testing:** Add timezone-specific test cases

**Estimated Effort:** 1-2 hours (same pattern, well-documented solution)

---

**Auditor:** Claude Code
**Date:** 2025-12-03
**Status:** Ready for implementation
