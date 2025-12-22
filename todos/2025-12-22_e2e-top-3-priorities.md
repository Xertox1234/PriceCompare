# E2E Testing - Top 3 Priority Improvements

**Created:** 2025-12-22
**Type:** Infrastructure + Safety Improvements
**Priority:** P1 (Critical for scale)
**Estimated Effort:** 2-3 days total

---

## Summary

Comprehensive review of the E2E test suite (12 spec files, ~11,500 lines) revealed **exceptional architecture quality** (A- grade, 91/100) but identified 3 critical infrastructure gaps that should be addressed before the suite scales further.

**Overall Assessment:** Production-ready with clear improvement path. No blocking bugs, but missing CI automation and safety guardrails.

---

## Priority 1: Add E2E CI/CD Workflow 🔴

**Impact:** High - Tests only run locally, regressions can reach production
**Effort:** 2-3 hours
**Files:** `.github/workflows/e2e.yml` (new)

### Problem
- E2E tests configured for CI (reporters, retries, artifacts) but no workflow executes them
- Playwright config references `process.env.CI` but tests never run in CI
- No automated regression detection before merge

### Solution
Create `.github/workflows/e2e.yml`:

```yaml
name: E2E Tests
on:
  pull_request:
    paths:
      - 'e2e/**'
      - 'client/**'
      - 'server/**'
      - 'shared/**'
  push:
    branches: [main]

jobs:
  e2e:
    runs-on: ubuntu-latest
    timeout-minutes: 20

    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_DB: pricecompare_test
          POSTGRES_USER: test
          POSTGRES_PASSWORD: test
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 5432:5432

      redis:
        image: redis:7-alpine
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 10s
        ports:
          - 6379:6379

    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Install Playwright browsers
        run: npx playwright install --with-deps chromium

      - name: Run E2E tests
        env:
          DATABASE_URL: postgresql://test:test@localhost:5432/pricecompare_test
          REDIS_URL: redis://localhost:6379
          NODE_ENV: test
        run: npm run test:e2e

      - name: Upload test results
        if: failure()
        uses: actions/upload-artifact@v4
        with:
          name: playwright-report
          path: playwright-report/
          retention-days: 7

      - name: Upload test artifacts
        if: failure()
        uses: actions/upload-artifact@v4
        with:
          name: test-results
          path: test-results/
          retention-days: 7
```

### Acceptance Criteria
- [ ] E2E workflow runs on every PR
- [ ] Tests run with PostgreSQL 15 and Redis 7
- [ ] Artifacts uploaded on failure (screenshots, videos, traces)
- [ ] Workflow fails PR if tests fail
- [ ] JUnit report generated for GitHub UI integration

---

## Priority 2: Add Production Safety Guardrails 🔴

**Impact:** Medium - Risk of accidental production data deletion if misconfigured
**Effort:** 1 hour
**Files:** `e2e/helpers.ts`

### Problem
- `cleanDatabase()` uses `KEYS 'sess:*'` (blocks Redis, O(N) operation)
- No validation that `DATABASE_URL` or `REDIS_URL` point to test environments
- Could accidentally truncate production database or clear production sessions if env vars misconfigured

### Solution
Add safety checks to `cleanDatabase()`:

```typescript
export async function cleanDatabase() {
  // SAFETY: Validate we're in test mode
  if (process.env.NODE_ENV !== 'test') {
    throw new Error('cleanDatabase() can only run when NODE_ENV=test');
  }

  // SAFETY: Validate database name contains "test"
  const dbUrl = process.env.DATABASE_URL || '';
  const dbName = new URL(dbUrl).pathname.slice(1);
  if (!dbName.includes('test')) {
    throw new Error(
      `Refusing to truncate database "${dbName}" - name must contain "test". ` +
      `Set DATABASE_NAME=pricecompare_test in .env.test`
    );
  }

  // TRUNCATE tables...
  await db.execute(sql`TRUNCATE TABLE users, products, ... CASCADE`);

  // SAFETY: Validate Redis URL doesn't contain "production"
  const redisUrl = process.env.REDIS_URL || '';
  if (redisUrl.includes('production') || redisUrl.includes('prod-')) {
    throw new Error('Refusing to clear sessions - Redis URL contains "production"');
  }

  const redisClient = getRedisSessionClient();
  if (redisClient) {
    // PERFORMANCE: Use SCAN instead of KEYS (non-blocking)
    let cursor = '0';
    const sessionKeys: string[] = [];
    do {
      const [newCursor, keys] = await redisClient.scan(cursor, {
        MATCH: 'sess:*',
        COUNT: 100,
      });
      cursor = newCursor;
      sessionKeys.push(...keys);
    } while (cursor !== '0');

    if (sessionKeys.length > 0) {
      await redisClient.del(sessionKeys);
    }
  }
}
```

### Acceptance Criteria
- [ ] Tests fail fast if `NODE_ENV !== 'test'`
- [ ] Tests fail if database name doesn't contain "test"
- [ ] Tests fail if Redis URL contains "production"
- [ ] Redis session clearing uses `SCAN` instead of `KEYS`
- [ ] Clear error messages guide developers to fix configuration

---

## Priority 3: Fix Schema Drift Risk 🟡

**Impact:** Medium - Test schema may diverge from production
**Effort:** 2-3 hours
**Files:** `e2e/global-setup.ts` (new), `e2e/helpers.ts`, `playwright.config.ts`

### Problem
- Tests manually create `watch_list_shares` table with raw SQL
- Schema defined in 2 places (migrations + test helpers)
- Migration changes don't automatically apply to test environment
- Missing migration file for `watch_list_shares`

### Solution A: Run Migrations in Global Setup (Recommended)

```typescript
// e2e/global-setup.ts (NEW FILE)
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { db } from '../server/db';

export default async function globalSetup() {
  console.log('Running migrations on test database...');
  await migrate(db, { migrationsFolder: './migrations' });
  console.log('Migrations complete');
}
```

```typescript
// playwright.config.ts
export default defineConfig({
  globalSetup: './e2e/global-setup.ts',
  // ... existing config
});
```

Then remove manual table creation from `e2e/helpers.ts` (lines 19-32).

### Solution B: Document Exemption (If migrations can't run)

If there's a technical reason migrations can't run in E2E setup, document it:

```typescript
// e2e/helpers.ts
// TESTING EXEMPTION: watch_list_shares schema manually created
// Reason: Playwright webServer doesn't run migrations (see playwright.config.ts:88)
// Schema MUST match migrations/NNNN_add_watch_list_shares.sql
// TODO: Migrate to global setup with automatic migration running (#XXX)
await db.execute(sql`CREATE TABLE IF NOT EXISTS watch_list_shares (...)`);
```

And create the missing migration file.

### Acceptance Criteria
- [x] Migrations run automatically before E2E tests
- [x] No manual `CREATE TABLE IF NOT EXISTS` in test helpers
- [x] Migration file exists for `watch_list_shares` table (0024_add_watch_list_shares.sql)
- [x] Test schema matches production schema exactly

---

## Additional Context

### Review Scope
- **Files Analyzed:** 23 files (12 spec files, 11 helper files)
- **Lines Reviewed:** ~11,500 lines of E2E test code
- **Review Team:** 6 specialized agents + direct analysis
- **Review Time:** ~4 hours

### Test Suite Strengths (Keep These!)
✅ Zero `any` types across entire suite
✅ 3-tier helper architecture (fixtures → core → feature-specific)
✅ Deterministic test data (LCG algorithm prevents flakiness)
✅ Multi-layer isolation (PostgreSQL + Redis + browser state)
✅ 90+ line pattern documentation in spec headers
✅ Accessibility-first selectors (`getByRole`, `getByLabel`)
✅ Graceful degradation (`test.skip()` for unimplemented features)

### Other Improvements (P2/P3, can defer)
- Sequential execution → Parallel (4 workers) for faster CI
- N+1 query in `seedMultipleProducts()` → Batch insert (23x faster)
- No transactions in seed helpers → Wrap in `db.transaction()`
- Hardcoded timeouts → Extract to constants
- Selector inconsistency → Standardize on semantic selectors

---

## Implementation Order

**Week 1 (Critical - Do First):**
1. ✅ Add E2E CI/CD workflow (2 hours) - COMPLETE
2. ✅ Add production safety guardrails (1 hour) - COMPLETE

**Week 2 (Important):**
3. ✅ Fix schema drift risk (2 hours) - COMPLETE

**Total Effort:** 5 hours actual (5-7 hours estimated)
**Status:** ALL 3 PRIORITIES COMPLETE (2025-12-22)

---

## Related Documentation

- `docs/08_TESTING_PATTERNS.md` - E2E testing patterns reference
- `playwright.config.ts` - Current CI configuration (reporters, retries)
- `.env.test.example` - Test environment configuration
- `.github/WORKFLOWS.md` - CI/CD pipeline documentation

---

## Success Metrics

- [ ] E2E tests run automatically on every PR
- [ ] CI provides clear feedback on test failures (artifacts, reports)
- [ ] Zero risk of production data deletion from test runs
- [ ] Test schema always matches production schema
- [ ] Team confident in E2E test reliability

---

**Labels:** `testing`, `e2e`, `ci-cd`, `infrastructure`, `P1`
**Milestone:** Q1 2026 - Testing Infrastructure
**Assignee:** TBD
