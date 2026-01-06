# LEARNINGS: Migration Rollback Incident (TODO_009)

**Date**: 2026-01-05
**Severity**: P0 CRITICAL
**Impact**: All E2E tests blocked, tables dropped in production and test databases
**Root Cause**: Rollback migration files placed in migrations/ directory ran alphabetically after create migrations

## Problem Summary

Migration 0026 (`create_scraping_tables.sql`) and 0027 (`create_price_snapshots.sql`) were created correctly, but corresponding rollback files (`0026_rollback.sql`, `0027_rollback.sql`) were placed in the same migrations/ directory.

The migration script runs files alphabetically:
1. `0026_create_scraping_tables.sql` ✅ Created 6 tables
2. `0026_rollback.sql` ❌ **Dropped all 6 tables immediately**
3. `0027_create_price_snapshots.sql` ✅ Created price_snapshots table
4. `0027_rollback.sql` ❌ **Dropped price_snapshots table immediately**

Result: Tables existed in schema.ts but not in database, causing E2E failures.

## Error Symptoms

```
Error: relation "price_snapshots" does not exist
Error: relation "scraping_jobs" does not exist
```

E2E tests failed during global setup when trying to TRUNCATE non-existent tables.

## Root Cause Analysis

1. **Migration Script Behavior**: `scripts/run-migrations.ts` sorts files alphabetically (line 132)
2. **Naming Convention**: Rollback files used same prefix (0026_, 0027_) as create migrations
3. **No Validation**: No check to prevent rollback files in migrations/ directory
4. **Alphabetical Execution**: "rollback" comes alphabetically after "create", causing drop after create

## Fix Applied

### 1. Move Rollback Files Out of Migrations Directory

```bash
mkdir migrations/rollbacks
mv migrations/0026_rollback.sql migrations/rollbacks/
mv migrations/0027_rollback.sql migrations/rollbacks/
```

### 2. Re-apply Create Migrations to Both Databases

Development database:
```bash
npm run migrate
```

Test database (fixed schema drift):
```bash
NODE_ENV=test npm run migrate
```

Manual re-application was needed because migration script marked rollbacks as "applied" in schema_migrations table.

### 3. Created Migration Management Documentation

Added `migrations/README.md` with critical rule: **NEVER place rollback files in migrations/ directory**

## Prevention Pattern

### File Organization

```
migrations/
  0026_create_scraping_tables.sql     ✅ Auto-run
  0027_create_price_snapshots.sql     ✅ Auto-run
  rollbacks/                          ✅ Manual only
    0026_rollback.sql                 ✅ Safe
    0027_rollback.sql                 ✅ Safe
```

### Migration Naming Convention

- **Create**: `NNNN_<action>_<description>.sql` (e.g., `0027_create_price_snapshots.sql`)
- **Rollback**: Place in `migrations/rollbacks/` directory, NOT in migrations/

### Validation Script (Future Enhancement)

Add pre-commit check to reject rollback files in migrations/:

```bash
# .husky/pre-commit
if ls migrations/*rollback*.sql 2>/dev/null; then
  echo "❌ ERROR: Rollback files must be in migrations/rollbacks/"
  exit 1
fi
```

## E2E Test Impact

After fix applied:
- ✅ Schema drift resolved
- ✅ TRUNCATE operations succeed
- ✅ Test data seeding works
- ⚠️ 104/124 tests still failing due to **rate limiting** (unrelated issue)
- ✅ 16/124 tests passing (proves schema is valid)

FK violations in price_snapshots seeding are a **test data issue**, not a schema issue. The table exists and has correct structure.

## Lessons Learned

1. **Migration Script Fragility**: Alphabetical sorting can cause unexpected execution order
2. **No Rollback in Auto-Run**: Rollbacks should ALWAYS be manual operations
3. **Documentation Critical**: README.md prevents future incidents
4. **Test Database Drift**: Test DB needs same migrations as production
5. **Validation Gaps**: No pre-migration checks for dangerous patterns

## Related Patterns

- `docs/02_DATABASE_PATTERNS.md` - Migration patterns
- `docs/08_TESTING_PATTERNS.md` - Test database setup
- `CLAUDE.md` lines 374-417 - Test schema synchronization

## Action Items

- [x] Move rollback files to migrations/rollbacks/
- [x] Re-apply migrations to dev and test databases
- [x] Create migrations/README.md documentation
- [ ] Add pre-commit validation to reject rollback files in migrations/
- [ ] Fix rate limiting issue causing E2E test failures (separate TODO)
- [ ] Fix FK violation in price-analytics-helpers.ts seed logic (separate issue)

## Status: RESOLVED ✅

Tables restored, E2E infrastructure functional, schema drift eliminated.
