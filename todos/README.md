# Test Fixes TODO Files

This folder contains detailed TODO files for fixing 71 failing tests across the codebase.

## Quick Links

- **[TEST_FIX_SUMMARY](../docs/TEST_FIX_SUMMARY.md)** - Quick start guide in `/docs/`
- **[TODO_TEST_FIXES.md](./TODO_TEST_FIXES.md)** - Complete master plan

## Priority Order

### P0 - Critical (Must fix first)
1. [TODO_001_WATCHLIST_ROUTES.md](./TODO_001_WATCHLIST_ROUTES.md) - 32 tests, 2-3 hours
2. [TODO_002_ALERT_ROUTES.md](./TODO_002_ALERT_ROUTES.md) - 29 tests, 2-3 hours

### P1 - High
3. [TODO_003_STORAGE_WATCHLIST.md](./TODO_003_STORAGE_WATCHLIST.md) - 3 tests, 1 hour

### P2 - Medium
4. [TODO_004_PRICE_AGGREGATION.md](./TODO_004_PRICE_AGGREGATION.md) - 4 tests, 1-2 hours
5. [TODO_005_AUTH_EXPIRED_TOKEN.md](./TODO_005_AUTH_EXPIRED_TOKEN.md) - 1 test, 30 minutes
6. [TODO_006_PRODUCT_DISCUSSION_COUNT.md](./TODO_006_PRODUCT_DISCUSSION_COUNT.md) - 2 tests, 1 hour

## Total Effort

- **Critical**: 4-6 hours
- **High**: 1 hour
- **Medium**: 2.5-3.5 hours
- **Testing & Verification**: 1-2 hours
- **Total**: 10-15 hours

## After Completion

Once all tests pass:
1. Commit test fixes with comprehensive message
2. Merge 5 pending Dependabot PRs for GitHub Actions updates
3. Update documentation with test isolation patterns
