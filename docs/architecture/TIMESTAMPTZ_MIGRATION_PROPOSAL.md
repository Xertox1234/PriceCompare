# Timestamptz Migration Proposal

**Status:** Proposed
**Created:** 2026-01-17
**Author:** Claude Code Session
**Priority:** Medium (P2)
**Affected Columns:** 84 timestamp columns across 30+ tables

## Problem Statement

PostgreSQL `timestamp` (without timezone) columns combined with Drizzle ORM create a **timezone interpretation mismatch**:

1. PostgreSQL stores `timestamp` values **as-is** (no timezone conversion)
2. Drizzle ORM interprets these values as **UTC** when reading
3. Application code comparing with JavaScript `Date` objects may use either local or UTC time

This caused a **silent bug** in notification daily limits where `setUTCHours(0, 0, 0, 0)` (UTC midnight) was compared against locally-stored timestamps, causing the limit check to always pass.

### Evidence

From `server/storage/domains/notification-storage.ts:315`:

```typescript
// BEFORE (broken):
const today = new Date();
today.setUTCHours(0, 0, 0, 0); // UTC midnight - WRONG for local timestamp columns

// AFTER (fixed):
const today = new Date();
today.setHours(0, 0, 0, 0); // Local midnight - matches PostgreSQL storage
```

**Root Cause:** `timestamp` columns don't encode timezone, so the interpretation is ambiguous.

## Proposed Solution

Migrate all `timestamp` columns to `timestamptz` (timestamp with timezone):

```typescript
// BEFORE
createdAt: timestamp('created_at').defaultNow(),

// AFTER
createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
```

### Why `timestamptz` Solves This

- PostgreSQL stores `timestamptz` in **UTC internally**
- Drizzle correctly interprets as UTC
- No ambiguity - all comparisons work consistently
- `setUTCHours()` works correctly with `timestamptz` columns

## Migration Plan

### Phase 1: Audit & Categorize (1-2 hours)

Categorize all 84 columns by risk:

**High Risk (data-sensitive):**
- `price_history.recordedAt` - Historical accuracy critical
- `price_snapshots.snapshotDate` - Affects price aggregation
- `notifications.createdAt` - Affects daily limits (the bug we found)

**Medium Risk (user-facing):**
- `users.createdAt`, `users.updatedAt`
- `forum_posts.createdAt`, `forum_posts.editedAt`
- `topics.createdAt`, `topics.lastPostAt`

**Low Risk (internal tracking):**
- `agent_sessions.sessionStart`, `agent_sessions.sessionEnd`
- `scraping_jobs.scheduledAt`, `scraping_jobs.startedAt`

### Phase 2: Create Migration Script (2-4 hours)

```sql
-- Migration: Convert timestamp to timestamptz
-- IMPORTANT: Run during low-traffic window

-- Convert assuming existing values are in server's local timezone
ALTER TABLE users
  ALTER COLUMN created_at TYPE timestamptz
  USING created_at AT TIME ZONE 'America/New_York'; -- Or server timezone

-- Repeat for all columns...
```

**Critical Considerations:**
1. **Timezone assumption:** Must know what timezone existing data represents
2. **Index rebuilding:** May temporarily increase I/O
3. **Downtime:** Consider read-only mode during migration

### Phase 3: Update Schema Definition (1 hour)

Update `shared/schema.ts`:

```typescript
// shared/schema.ts
export const users = pgTable('users', {
  // ... other fields
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});
```

### Phase 4: Update Application Code (2-4 hours)

After migration to `timestamptz`:
- `setUTCHours()` becomes the **correct** choice for UTC comparisons
- `setHours()` would become incorrect (uses local timezone)
- Audit all date comparison code

### Phase 5: Validation (1-2 hours)

- Run full test suite
- Verify notification daily limits work
- Check price aggregation calculations
- Test in multiple timezones

## Affected Tables

| Table | Columns | Risk |
|-------|---------|------|
| `users` | `created_at`, `updated_at`, `last_seen_at` | Medium |
| `password_reset_tokens` | `expires_at`, `used_at`, `created_at` | Medium |
| `products` | `embedding_updated_at`, `created_at` | Low |
| `product_offers` | `last_link_check`, `last_updated` | Low |
| `price_history` | `recorded_at`, `aggregated_at`, `created_at` | **High** |
| `price_snapshots` | `snapshot_date`, `created_at` | **High** |
| `notifications` | `created_at` | **High** |
| `notification_preferences` | `created_at`, `updated_at` | Low |
| `forum_topics` | `last_post_at`, `created_at`, `updated_at` | Medium |
| `forum_posts` | `edited_at`, `created_at`, `updated_at` | Medium |
| `price_alerts` | `last_triggered_at`, `created_at`, `updated_at` | Medium |
| `watch_lists` | `created_at`, `updated_at` | Low |
| `watch_list_items` | `created_at`, `updated_at` | Low |
| `scraping_jobs` | `scheduled_at`, `started_at`, `completed_at`, `created_at`, `updated_at` | Low |
| `agent_sessions` | `session_start`, `session_end`, `created_at` | Low |
| ... and 15+ more tables | | |

## Risks & Mitigations

### Risk 1: Data Corruption During Migration
**Mitigation:**
- Full database backup before migration
- Test on staging environment first
- Use explicit timezone in `AT TIME ZONE` clause

### Risk 2: Application Code Breaks
**Mitigation:**
- Audit all date comparison code before migration
- Run full test suite after schema change
- Deploy during low-traffic window

### Risk 3: Performance Impact
**Mitigation:**
- `timestamptz` has same storage size as `timestamp` (8 bytes)
- Index on timestamp columns will be rebuilt automatically
- Run `ANALYZE` after migration

## Alternative: Keep `timestamp` with Strict Conventions

Instead of migrating, enforce strict conventions:

1. **Always use `setHours()`** (local time) for timestamp columns
2. **Document clearly** in CLAUDE.md
3. **Add ESLint rule** to warn on `setUTCHours()` usage

**Pros:** No migration risk, no downtime
**Cons:** Convention-based (easy to forget), bug-prone

## Recommendation

**Migrate to `timestamptz`** for these reasons:

1. **Eliminates ambiguity** - No more guessing timezone
2. **Industry standard** - Most production systems use `timestamptz`
3. **Future-proof** - Works correctly with multi-region deployment
4. **Simpler code** - Always use UTC methods, no timezone juggling

## Timeline Estimate

| Phase | Duration | Dependencies |
|-------|----------|--------------|
| Audit & Categorize | 1-2 hours | None |
| Migration Script | 2-4 hours | Audit complete |
| Schema Definition | 1 hour | Migration script ready |
| Application Code | 2-4 hours | Schema updated |
| Validation | 1-2 hours | All updates complete |
| **Total** | **7-13 hours** | |

## Approval Required

- [ ] Project owner approval
- [ ] Database backup verified
- [ ] Staging environment tested
- [ ] Deployment window scheduled

---

**Next Steps:**
1. Review this proposal
2. Schedule migration window if approved
3. Create detailed migration script
4. Execute migration on staging
5. Production migration

**References:**
- PostgreSQL docs: [Date/Time Types](https://www.postgresql.org/docs/current/datatype-datetime.html)
- Pattern: `docs/02_DATABASE_PATTERNS.md#drizzle-orm-timestamp-interpretation-mismatch`
- Bug fix: `server/storage/domains/notification-storage.ts:315`
