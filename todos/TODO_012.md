# TODO 012: Add Explicit Schema Validation in E2E Global Setup

**Date**: 2026-01-05
**Status**: ✅ Completed
**Priority**: MEDIUM
**Parent**: TODO_009 (schema drift prevention)
**Estimated Time**: 1-2 hours

---

## Problem

Current E2E test infrastructure uses a **silent failure pattern** - if expected tables are missing, tests continue but fail later with cryptic errors. This allowed the TODO_009 schema drift issue to go undetected until test execution.

### Current Pattern (e2e/helpers.ts lines 65-79)

```typescript
await db.ex/ecute(sql`
  DO $$
  DECLARE
    tbl TEXT;
    table_list TEXT[] := ARRAY['users', 'products', ...];
  BEGIN
    FOREACH tbl IN ARRAY table_list
    LOOP
      IF EXISTS (...) THEN
        EXECUTE 'TRUNCATE TABLE ' || quote_ident(tbl) || ' RESTART IDENTITY CASCADE';
      END IF;  -- Silently skips missing tables
    END LOOP;
  END $$;
`);
```

**Problem**: Missing tables are silently skipped, causing:
- ❌ Tests proceed with incomplete schema
- ❌ Failures occur during test execution (not setup)
- ❌ Error messages don't indicate schema drift (e.g., "relation does not exist")
- ❌ Difficult to diagnose root cause

---

## Impact

- **Debugging Time**: Schema drift issues take hours to diagnose
- **False Failures**: Tests fail for wrong reasons (missing tables vs. code bugs)
- **CI Confusion**: Build logs show test failures, not setup failures
- **Developer Experience**: Cryptic error messages frustrate developers

---

## Proposed Solution

Add **explicit schema validation** in E2E global setup that **fails fast** with clear error messages when expected tables are missing.

### Approach 1: Validation in Global Setup (RECOMMENDED)

Add schema validation to `e2e/global-setup.ts` that runs before any tests:

```typescript
// e2e/global-setup.ts
import { db } from '../server/db';
import { sql } from 'drizzle-orm';

const EXPECTED_TABLES = [
  'users',
  'products',
  'product_offers',
  'price_history',
  'price_alerts',
  'price_snapshots',
  'retailers',
  'user_sessions',
  'watchlist_items',
  'forum_posts',
  'forum_topics',
  'comments',
  'votes',
  'notifications',
  'scraping_jobs',
  'scraping_logs',
  'scraping_proxies',
  'scraping_errors',
  'scraping_queue',
  'scraping_schedule',
  // Add new tables here when migrations are created
];

export default async function globalSetup() {
  console.log('🔍 Validating test database schema...');

  // Query existing tables
  const result = await db.execute(sql`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
  `);

  const existingTables = result.rows.map(r => r.table_name);
  const missingTables = EXPECTED_TABLES.filter(
    t => !existingTables.includes(t)
  );

  if (missingTables.length > 0) {
    console.error('❌ Schema drift detected - missing tables:');
    missingTables.forEach(t => console.error(`   - ${t}`));
    console.error('');
    console.error('💡 Fix: Run migrations against test database');
    console.error('   NODE_ENV=test npm run migrate');
    console.error('');
    console.error('📚 See: migrations/README.md for migration management');
    throw new Error(`Schema validation failed: ${missingTables.length} tables missing`);
  }

  console.log(`✅ Schema validated - all ${EXPECTED_TABLES.length} tables present`);
}
```

**Pros**:
- Fails fast before any tests run
- Clear, actionable error messages
- Easy to maintain (just update EXPECTED_TABLES array)
- Runs once per test session (fast)

**Cons**:
- Requires keeping EXPECTED_TABLES list in sync with migrations
- Adds slight overhead to test startup

### Approach 2: Enhanced TRUNCATE with Warnings

Modify the existing cleanup to raise warnings instead of silent skipping:

```typescript
// e2e/helpers.ts
await db.execute(sql`
  DO $$
  DECLARE
    tbl TEXT;
    missing_tables TEXT := '';
    table_list TEXT[] := ARRAY['users', 'products', ...];
  BEGIN
    FOREACH tbl IN ARRAY table_list
    LOOP
      IF EXISTS (...) THEN
        EXECUTE 'TRUNCATE TABLE ' || quote_ident(tbl) || ' RESTART IDENTITY CASCADE';
      ELSE
        missing_tables := missing_tables || tbl || ', ';
      END IF;
    END LOOP;

    IF missing_tables <> '' THEN
      RAISE WARNING 'Schema drift detected - missing tables: %', missing_tables;
    END IF;
  END $$;
`);
```

**Pros**:
- Minimal code changes
- Shows warnings in test output
- Still allows tests to run

**Cons**:
- Warnings can be ignored
- Tests still proceed with incomplete schema
- Less discoverable than hard failure

### Approach 3: Automated Migration Validation Script

Create a validation script that compares expected tables from migrations with actual database tables:

```typescript
// scripts/validate-test-schema.ts
import { readdirSync } from 'fs';
import { db } from '../server/db';
import { sql } from 'drizzle-orm';

// Parse migration files to extract table names
function getTablesFromMigrations(): string[] {
  const migrations = readdirSync('migrations')
    .filter(f => f.endsWith('.sql') && !f.includes('rollback'))
    .sort();

  const tables = new Set<string>();

  migrations.forEach(file => {
    const content = readFileSync(`migrations/${file}`, 'utf-8');
    // Match CREATE TABLE statements
    const matches = content.matchAll(/CREATE TABLE (?:IF NOT EXISTS )?(\w+)/gi);
    for (const match of matches) {
      tables.add(match[1].toLowerCase());
    }
  });

  return Array.from(tables);
}

async function validateSchema() {
  const expectedTables = getTablesFromMigrations();
  const actualTables = await db.execute(sql`...`);
  // Compare and report differences
}

validateSchema();
```

**Pros**:
- Automatically discovers expected tables from migrations
- No manual list maintenance
- Can be run independently or in CI

**Cons**:
- More complex implementation
- Relies on parsing SQL (fragile)
- May miss tables created by complex migrations

---

## Recommended Implementation

**Combination of Approaches 1 + Enhanced Documentation**:

1. **Add explicit validation to global setup** (Approach 1)
   - Fail fast with clear error messages
   - Simple, maintainable, effective

2. **Document schema sync pattern** in CLAUDE.md
   - Already exists (lines 374-417) but reinforce it
   - Add pre-commit checklist item

3. **Add comment in global-setup.ts**
   - Links to migration adding instructions
   - Reminds developers to update EXPECTED_TABLES

This provides both automation and education.

---

## Implementation Tasks

- [ ] Create or modify `e2e/global-setup.ts`
- [ ] Add EXPECTED_TABLES constant with all 19 current tables
- [ ] Implement schema validation logic (Approach 1 code)
- [ ] Test failure path: remove a table, verify clear error
- [ ] Test success path: verify passes with complete schema
- [ ] Add helpful error messages with fix instructions
- [ ] Update Playwright config to use global setup if not already
- [ ] Document pattern in `docs/08_TESTING_PATTERNS.md`

---

## Files to Modify

1. `e2e/global-setup.ts` (primary)
   - Add schema validation before tests run
   - Export default async function

2. `playwright.config.ts` (if needed)
   - Ensure globalSetup points to `e2e/global-setup.ts`
   - Verify it runs before test execution

3. `docs/08_TESTING_PATTERNS.md` (documentation)
   - Document schema validation pattern
   - Explain when to update EXPECTED_TABLES
   - Link to migration process

4. `CLAUDE.md` (optional enhancement)
   - Update Test Schema Synchronization section (lines 374-417)
   - Add note about global setup validation

---

## Success Criteria

- ✅ E2E test suite fails immediately if tables are missing
- ✅ Error message clearly identifies which tables are missing
- ✅ Error message provides actionable fix instructions
- ✅ Validation runs before any tests execute (global setup)
- ✅ Passing validation confirms schema is complete
- ✅ Documentation explains when/how to update validation

---

## Testing the Implementation

### Test Case 1: Missing Table

```bash
# Simulate schema drift
psql pricecompare_test -c "DROP TABLE price_snapshots CASCADE;"

# Run E2E tests
npm run test:e2e

# Expected output:
# ❌ Schema drift detected - missing tables:
#    - price_snapshots
# 💡 Fix: Run migrations against test database
#    NODE_ENV=test npm run migrate
# Error: Schema validation failed: 1 tables missing
```

### Test Case 2: Complete Schema

```bash
# Ensure all migrations applied
NODE_ENV=test npm run migrate

# Run E2E tests
npm run test:e2e

# Expected output:
# ✅ Schema validated - all 19 tables present
# [tests proceed normally]
```

---

## Related Issues

- **TODO_009**: Schema drift incident (parent - completed)
- **Pattern**: Test Schema Synchronization (CLAUDE.md lines 374-417)
- **Documentation**: `docs/08_TESTING_PATTERNS.md` - E2E setup patterns

---

## Benefits

### Before (Silent Failure)
```
npm run test:e2e
✓ Some test passes
✗ 104 tests fail with "relation does not exist"
  → Developer spends 3 hours investigating
  → Eventually discovers missing table
  → Runs migration
  → All tests pass
```

### After (Fail Fast)
```
npm run test:e2e
❌ Schema drift detected - missing tables:
   - price_snapshots
💡 Fix: NODE_ENV=test npm run migrate
  → Developer immediately knows the issue
  → Runs migration (30 seconds)
  → All tests pass
```

**Time Saved**: Hours of debugging → Seconds to fix

---

## Notes

From TODO_009 code review (performance-oracle agent):

> **Issue**: Silent failure pattern - if a table is missing, it's silently skipped. This allowed the schema drift to go undetected until actual test operations failed.
>
> **Better Pattern**: Fail fast with explicit validation. Early failure detection is better than silent skipping.

**Key Insight**: The current pattern optimizes for "tests might pass anyway" instead of "detect problems early." Explicit validation shifts to early detection, which is much better for developer experience.

**Priority**: MEDIUM - Prevents future schema drift incidents, but not blocking current work since TODO_009 fixed the immediate issue.
