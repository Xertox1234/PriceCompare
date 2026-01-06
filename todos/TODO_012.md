# TODO 012: Add Explicit Schema Validation in E2E Global Setup

**Date**: 2026-01-05
**Status**: 🟡 Ready for Implementation (Parallel Reviews Complete)
**Priority**: MEDIUM
**Parent**: TODO_009 (schema drift prevention)
**Estimated Time**: 1-2 hours
**Updated**: 2026-01-06 (after parallel review by 3 specialist agents)

---

## ✅ Parallel Review Results (2026-01-06)

Three specialist agents reviewed this plan in parallel:

| Reviewer | Verdict | Key Finding |
|----------|---------|-------------|
| **@kieran-typescript-reviewer** | ❌ REQUEST CHANGES | Type safety violations in original plan |
| **@performance-oracle** | ✅ APPROVED | Excellent performance (0.57ms, 0.04% overhead) |
| **@code-simplicity-reviewer** | ⛔ SKIP ENTIRELY | YAGNI violation - problem already solved |

**Decision**: Proceed with **Option B** - Implement with type safety fixes (Kieran's corrections)

**Rationale**:
- Performance cost is negligible (0.04% overhead, 10,000:1 ROI)
- Defense-in-depth philosophy: prevent at source (pre-commit hook) + detect early (validation)
- Type safety issues are fixable
- User preference for fail-fast over relying solely on upstream prevention

**YAGNI Acknowledgment**: The simplicity reviewer correctly notes that TODO_009's pre-commit hook already prevents schema drift at the source. This validation adds a second layer of defense, which some may view as over-engineering. We proceed with awareness that this is a trade-off between simplicity and robustness.

---

## Problem

Current E2E test infrastructure uses a **silent failure pattern** - if expected tables are missing, tests continue but fail later with cryptic errors. This allowed the TODO_009 schema drift issue to go undetected until test execution.

### Current Pattern (e2e/helpers.ts lines 65-79)

```typescript
await db.execute(sql`
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

## Type-Safe Implementation (Kieran's Corrections)

Add schema validation to `e2e/global-setup.ts` that runs before any tests.

### ✅ Type-Safe Code (Final Implementation)

```typescript
// e2e/global-setup.ts
import { db } from '../server/db';
import { sql } from 'drizzle-orm';

/**
 * Expected tables in test database schema.
 *
 * CRITICAL: When adding new migrations, update this list immediately.
 * See CLAUDE.md "Test Schema Synchronization" section.
 *
 * Using `as const satisfies` for type safety and compile-time validation.
 */
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
] as const satisfies readonly string[];

type TableRow = {
  table_name: string;
};

export default async function globalSetup(): Promise<void> {
  console.log('🔍 Validating test database schema...');

  try {
    // Query existing tables with type-safe result
    const result = await db.execute<TableRow>(sql`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_type = 'BASE TABLE'
    `);

    // Use Set for O(1) lookup instead of O(n) includes
    const existingSet = new Set(
      result.map((row) => row.table_name)
    );

    const missingTables = EXPECTED_TABLES.filter(
      (table) => !existingSet.has(table)
    );

    if (missingTables.length > 0) {
      console.error('❌ Schema drift detected - missing tables:');
      missingTables.forEach((table) => {
        console.error(`   - ${table}`);
      });
      console.error('');
      console.error('💡 Fix: Run migrations against test database');
      console.error('   NODE_ENV=test npm run migrate');
      console.error('');
      console.error('📚 See: CLAUDE.md "Test Schema Synchronization"');

      throw new Error(
        `Schema validation failed: ${missingTables.length} table(s) missing: ${missingTables.join(', ')}`
      );
    }

    console.log(
      `✅ Schema validated - all ${EXPECTED_TABLES.length} tables present`
    );
  } catch (error) {
    // Re-throw with context if it's not our validation error
    if (error instanceof Error && error.message.includes('Schema validation failed')) {
      throw error;
    }

    console.error('❌ Failed to validate schema:', error);
    throw new Error(
      `Schema validation error: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}
```

### Type Safety Improvements Over Original Plan

**1. Typed Query Results**
```typescript
// ❌ WRONG (original plan)
const result = await db.execute(sql`SELECT table_name FROM ...`);
const existingTables = result.rows.map(r => r.table_name);  // Type errors!

// ✅ CORRECT (Kieran's fix)
const result = await db.execute<TableRow>(sql`...`);
const existingTables = result.map((row) => row.table_name);  // Type-safe
```

**2. Type-Safe Array with Compile-Time Validation**
```typescript
// ❌ WRONG (original plan)
const EXPECTED_TABLES = ['users', 'products', ...];  // string[], no validation

// ✅ CORRECT (Kieran's fix)
const EXPECTED_TABLES = [...] as const satisfies readonly string[];
```

**3. Performance Optimization**
```typescript
// ❌ O(E*T) - nested array operations (original)
const missingTables = EXPECTED_TABLES.filter(t => !existingTables.includes(t));

// ✅ O(E+T) - Set-based lookup (Kieran's fix)
const existingSet = new Set(existingTables);
const missingTables = EXPECTED_TABLES.filter(t => !existingSet.has(t));
```

**4. Proper Error Handling**
```typescript
// Original plan: No cleanup, missing error context

// ✅ CORRECT: Type-safe error handling with context
try {
  // ... validation logic
} catch (error) {
  if (error instanceof Error && error.message.includes('Schema validation failed')) {
    throw error;  // Re-throw our validation errors
  }
  // Add context to unexpected errors
  throw new Error(
    `Schema validation error: ${error instanceof Error ? error.message : 'Unknown'}`
  );
}
```

---

## Performance Analysis (@performance-oracle)

### Benchmark Results (100 iterations)

| Metric | Value |
|--------|-------|
| **Average Time** | 0.57ms |
| **Min Time** | 0.24ms |
| **Max Time** | 18.81ms |
| **Overhead** | 0.04% of total E2E setup time |

### Impact Assessment

```
Current E2E setup time:     ~1500ms (migrations)
Schema validation overhead: +0.57ms
Percentage increase:        0.04%
```

**Verdict**: ⚡ **EXCELLENT** - Negligible performance impact

### Scalability Testing

| Table Count | Average Time |
|-------------|--------------|
| 10 tables | 0.27ms |
| 20 tables (current) | 0.26ms |
| 50 tables | 0.25ms |
| 100 tables | 0.24ms |

**Counterintuitive Finding**: Performance actually *improves* with more tables because query cost is dominated by the initial information_schema scan, not filtering logic.

### Value Proposition

- **Cost**: 0.57ms per test run (imperceptible)
- **Benefit**: Immediate schema drift detection (prevents hours of debugging)
- **ROI**: ~10,000:1

**Performance Verdict**: No optimization needed - current approach is excellent.

---

## Implementation Tasks

- [ ] Create `e2e/global-setup.ts` with type-safe implementation
- [ ] Add EXPECTED_TABLES constant with all 20 current tables
- [ ] Use `as const satisfies readonly string[]` for type safety
- [ ] Implement schema validation with Set-based filtering (O(1) lookup)
- [ ] Add proper TypeScript types for query results (`TableRow` interface)
- [ ] Implement error handling with proper cleanup
- [ ] Test failure path: remove a table, verify clear error message
- [ ] Test success path: verify passes with complete schema
- [ ] Update Playwright config to use global setup if not already
- [ ] Document pattern in `docs/08_TESTING_PATTERNS.md`

---

## Files to Modify

1. **`e2e/global-setup.ts`** (primary - CREATE)
   - Add type-safe schema validation before tests run
   - Export default async function
   - Use proper TypeScript types for all operations

2. **`playwright.config.ts`** (verify/update)
   - Ensure globalSetup points to `e2e/global-setup.ts`
   - Verify it runs before test execution

3. **`docs/08_TESTING_PATTERNS.md`** (documentation)
   - Document schema validation pattern
   - Explain when to update EXPECTED_TABLES
   - Include type safety best practices
   - Link to migration process

4. **`CLAUDE.md`** (optional enhancement)
   - Update Test Schema Synchronization section (lines 374-417)
   - Add note about global setup validation

---

## Success Criteria

- ✅ E2E test suite fails immediately if tables are missing
- ✅ Error message clearly identifies which tables are missing
- ✅ Error message provides actionable fix instructions
- ✅ Validation runs before any tests execute (global setup)
- ✅ Passing validation confirms schema is complete
- ✅ Implementation passes TypeScript strict mode (no `any` types)
- ✅ Implementation passes ESLint (no type safety violations)
- ✅ Uses Set-based filtering for O(1) performance
- ✅ Proper error handling with cleanup
- ✅ Documentation explains when/how to update validation

---

## Testing the Implementation

### Test Case 1: Missing Table

```bash
# Simulate schema drift
PGDATABASE=pricecompare_test psql -c "DROP TABLE price_snapshots CASCADE;"

# Run E2E tests
npm run test:e2e

# Expected output:
# 🔍 Validating test database schema...
# ❌ Schema drift detected - missing tables:
#    - price_snapshots
#
# 💡 Fix: Run migrations against test database
#    NODE_ENV=test npm run migrate
#
# 📚 See: CLAUDE.md "Test Schema Synchronization"
# Error: Schema validation failed: 1 table(s) missing: price_snapshots
```

### Test Case 2: Complete Schema

```bash
# Ensure all migrations applied
NODE_ENV=test npm run migrate

# Run E2E tests
npm run test:e2e

# Expected output:
# 🔍 Validating test database schema...
# ✅ Schema validated - all 20 tables present
# [tests proceed normally]
```

### Test Case 3: Type Safety Verification

```bash
# Run TypeScript type check
npm run check

# Expected: No type errors in e2e/global-setup.ts

# Run ESLint
npx eslint e2e/global-setup.ts

# Expected: No violations
```

---

## Related Issues

- **TODO_009**: Schema drift incident (parent - completed)
- **Pattern**: Test Schema Synchronization (CLAUDE.md lines 374-417)
- **Documentation**: `docs/08_TESTING_PATTERNS.md` - E2E setup patterns
- **Review**: Parallel review by @kieran-typescript-reviewer, @performance-oracle, @code-simplicity-reviewer

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
🔍 Validating test database schema...
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

### From Parallel Reviews

**@kieran-typescript-reviewer**:
> "Good pattern being held back by poor TypeScript practices. Fix type safety and this becomes a solid addition."

**@performance-oracle**:
> "This is a no-brainer: high value (prevents hours of debugging), negligible cost (0.57ms). ROI is approximately 10,000:1."

**@code-simplicity-reviewer**:
> "Classic YAGNI violation - building infrastructure for a problem already prevented by pre-commit hook. However, if proceeding, use the minimal one-line approach instead of 100+ lines."

### Implementation Decision

Proceeding with **Option B** (full type-safe implementation) despite YAGNI concerns because:
1. User preference for defense-in-depth
2. Performance cost is negligible (0.04% overhead)
3. Fail-fast provides better developer experience
4. Type-safe implementation addresses Kieran's concerns

**Acknowledged Trade-off**: This adds a second layer of validation on top of the pre-commit hook. Some may view this as over-engineering. We proceed with awareness that simplicity is sacrificed for robustness.

**Priority**: MEDIUM - Prevents future schema drift incidents, but not blocking current work since TODO_009 fixed the immediate issue and added prevention.
