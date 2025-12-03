# Migrate Timestamp Columns to Timestamptz

**Priority:** P2 - Medium (Technical Debt)
**Type:** Schema Migration
**Estimated Effort:** 2-4 hours
**Risk Level:** Medium (requires schema migration, but SQL is safe)

## Problem Statement

Several tables use `timestamp` (without timezone) instead of `timestamptz` (with timezone), causing ambiguous timezone handling and requiring workarounds in queries. This creates subtle bugs when comparing with timezone-aware functions like `NOW()`.

**Root Cause:** PostgreSQL's `timestamp` type stores values without timezone metadata, causing implicit timezone conversions during comparisons.

**Discovered In:** TODO_005 - Auth expired token test fix
**Learnings:** See `docs/LEARNINGS_TODO_005_AUTH_EXPIRED_TOKEN.md`

## Affected Tables

### Confirmed Issues
1. **`password_reset_tokens`** (2 columns)
   - `expires_at` - timestamp without timezone
   - `created_at` - timestamp without timezone
   - **Workaround:** Queries use `AT TIME ZONE 'UTC'`
   - **Location:** `server/storage.ts:2846, 2900`

2. **`job_locks`** (2 columns)
   - `expires_at` - timestamp without timezone
   - `created_at` - timestamp without timezone
   - **Status:** Needs audit (similar pattern suspected)
   - **Location:** `server/storage/domains/job-lock-storage.ts`

### Needs Audit
Run this command to find all timestamp columns:
```bash
grep "timestamp(" shared/schema.ts | grep -v "withTimezone: true"
```

## Technical Details

### Current Anti-Pattern
```typescript
// shared/schema.ts - WRONG
expiresAt: timestamp("expires_at").notNull(),  // ❌ No timezone
```

**Problem:**
- JavaScript `Date` objects are UTC
- PostgreSQL stores them as-is (no timezone metadata)
- `NOW()` returns `timestamptz` (timezone-aware)
- Comparison requires workaround: `(expires_at AT TIME ZONE 'UTC') > NOW()`

### Correct Pattern
```typescript
// shared/schema.ts - CORRECT
expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),  // ✅ With timezone
```

**Benefits:**
- Stores UTC internally, eliminates ambiguity
- Comparisons with `NOW()` work without workarounds
- PostgreSQL best practice
- Consistent behavior across all servers

## Migration Plan

### Phase 1: Schema Migration (Safe)

**Migration SQL:**
```sql
-- password_reset_tokens
ALTER TABLE password_reset_tokens
  ALTER COLUMN expires_at TYPE timestamptz
  USING expires_at AT TIME ZONE 'UTC';

ALTER TABLE password_reset_tokens
  ALTER COLUMN created_at TYPE timestamptz
  USING created_at AT TIME ZONE 'UTC';

-- job_locks
ALTER TABLE job_locks
  ALTER COLUMN expires_at TYPE timestamptz
  USING expires_at AT TIME ZONE 'UTC';

ALTER TABLE job_locks
  ALTER COLUMN created_at TYPE timestamptz
  USING created_at AT TIME ZONE 'UTC';

-- Add others as discovered in audit
```

**Why This is Safe:**
- `USING expires_at AT TIME ZONE 'UTC'` tells PostgreSQL to treat existing timestamps as UTC
- No data loss
- Preserves existing timestamps correctly
- Can be rolled back if needed

### Phase 2: Update Schema Definitions

**Update `shared/schema.ts`:**
```typescript
export const passwordResetTokens = pgTable("password_reset_tokens", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  token: varchar("token", { length: 255 }).notNull().unique(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),  // ✅ Fixed
  isUsed: boolean("is_used").notNull().default(false),
  usedAt: timestamp("used_at", { withTimezone: true }),                  // ✅ Fixed
  ipAddress: varchar("ip_address", { length: 45 }),
  userAgent: varchar("user_agent", { length: 500 }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),  // ✅ Fixed
});
```

### Phase 3: Remove Workarounds

**Clean up `server/storage.ts`:**
```typescript
// BEFORE (with workaround)
async validatePasswordResetToken(token: string): Promise<PasswordResetToken | null> {
  const result = await db.execute(
    sql`
      SELECT * FROM password_reset_tokens
      WHERE token = ${token}
        AND is_used = false
        AND (expires_at AT TIME ZONE 'UTC') > NOW()  -- ⚠️ Workaround
      LIMIT 1
    `
  );
}

// AFTER (clean - can use Drizzle query builder)
async validatePasswordResetToken(token: string): Promise<PasswordResetToken | null> {
  const tokens = await db.select()
    .from(passwordResetTokens)
    .where(and(
      eq(passwordResetTokens.token, token),
      eq(passwordResetTokens.isUsed, false),
      sql`${passwordResetTokens.expiresAt} > NOW()`  // ✅ Clean comparison
    ))
    .limit(1);

  return tokens[0] || null;
}
```

**Benefits:**
- Can use Drizzle query builder instead of raw SQL
- Better TypeScript type safety
- Cleaner, more maintainable code
- No manual snake_case → camelCase mapping

## Testing Plan

### Before Migration
1. Run full test suite: `npm test`
2. Document current behavior
3. Backup database

### During Migration
1. Apply migration in development first
2. Verify existing timestamps preserved correctly
3. Run test suite: `npm test`
4. Manual verification:
   ```sql
   -- Check timezone conversion
   SELECT
     expires_at,
     expires_at AT TIME ZONE 'UTC' as utc_time,
     NOW() as now_time,
     expires_at > NOW() as is_future
   FROM password_reset_tokens
   LIMIT 5;
   ```

### After Migration
1. Remove `AT TIME ZONE 'UTC'` workarounds from code
2. Update to use Drizzle query builder
3. Run full test suite again
4. Verify no regressions

### Rollback Plan (If Needed)
```sql
-- Rollback to timestamp (without timezone)
ALTER TABLE password_reset_tokens
  ALTER COLUMN expires_at TYPE timestamp
  USING expires_at AT TIME ZONE 'UTC';

-- Restore workarounds in code
```

## Success Criteria

- [ ] All affected tables migrated to `timestamptz`
- [ ] Schema definitions updated in `shared/schema.ts`
- [ ] Workarounds removed from `server/storage.ts`
- [ ] Code uses Drizzle query builder instead of raw SQL
- [ ] All tests passing
- [ ] No regressions in password reset or job locking
- [ ] Documentation updated

## Related Files

**Schema:**
- `shared/schema.ts` - Table definitions

**Storage Layer:**
- `server/storage.ts:2832-2908` - Password reset token methods
- `server/storage/domains/job-lock-storage.ts` - Job lock methods

**Tests:**
- `server/routes/__tests__/auth-routes.test.ts` - Password reset tests
- Tests for job locking (TBD)

**Documentation:**
- `docs/LEARNINGS_TODO_005_AUTH_EXPIRED_TOKEN.md` - Complete learnings
- `docs/02_DATABASE_PATTERNS.md` - Section 5.3 (Timestamp vs Timestamptz)

## Follow-Up Actions

1. **Audit Command:**
   ```bash
   grep "timestamp(" shared/schema.ts | grep -v "withTimezone: true"
   ```

2. **Find Workarounds:**
   ```bash
   grep -r "AT TIME ZONE" server/ | grep -v node_modules
   ```

3. **Check Related Issues:**
   ```bash
   grep -r "NOW()" server/ | grep -E "(timestamp|expires|created)"
   ```

## References

- PostgreSQL Docs: [Date/Time Types](https://www.postgresql.org/docs/current/datatype-datetime.html)
- Drizzle ORM: [Timestamp Types](https://orm.drizzle.team/docs/column-types/pg#timestamp)
- Project Patterns: `docs/02_DATABASE_PATTERNS.md#53-timestamp-vs-timestamptz-critical`

## Risk Assessment

**Low Risk:**
- Migration SQL is safe (uses `AT TIME ZONE 'UTC'`)
- Can be rolled back if issues found
- Comprehensive testing plan

**Medium Impact:**
- Requires schema migration
- Code changes needed after migration
- Multiple files affected

**Mitigation:**
- Test in development first
- Backup database before migration
- Incremental rollout (one table at a time)
- Keep workarounds until verified working

---

**Created:** 2025-12-03
**Related TODO:** TODO_005_AUTH_EXPIRED_TOKEN
**Status:** Ready for implementation
