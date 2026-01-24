# TODO 270: Fix Storage Layer Pattern Violations

**Priority**: P1 (CRITICAL - Architecture Violation)
**File(s)**: `server/routes/health.ts`, `server/jobs/price-alert-checker.ts`, `server/jobs/notification-processor.ts`, `server/utils/price-change-hooks.ts`
**Estimated Time**: 2 hours
**Status**: ✅ RESOLVED
**Resolved Date**: 2026-01-24
**Source**: Code Review 2026-01-23 (Multi-Agent Analysis)

## Problem Statement

Several files import `db` directly instead of using the `storage` layer, violating the established architecture pattern documented in CLAUDE.md.

## Root Cause

These files were added without following the storage layer pattern. The only documented exception is `price-aggregation-service.ts` which has explicit justification for transaction context passing.

## Resolution Summary

### 1. `server/routes/health.ts` - ✅ FIXED
- Updated to use `storage.checkDatabaseHealth()` instead of `db.execute(sql\`SELECT 1\`)`
- Removed duplicate `/health` endpoint from `health-routes.ts`

### 2. `server/jobs/notification-processor.ts` - ✅ FIXED
- Added `storage.getUserIdsWithWatchedProducts()` method to storage layer
- Updated to use storage layer instead of direct `db.selectDistinct()`

### 3. `server/jobs/price-alert-checker.ts` - ✅ DOCUMENTED EXCEPTION
- Documented as justified exception (like `price-aggregation-service.ts`)
- Reason: Complex aggregation query with JOINs, GROUP BY, and correlated subqueries
- Performance-critical batch operation that runs every 30 minutes

### 4. `server/utils/price-change-hooks.ts` - ✅ FIXED
- Removed dead code: `_checkAndNotifyPriceAlerts()` function (never called)
- This function was superseded by `processPriceChange()` from `price-drop-detection.ts`
- Removed `db` import as it's no longer needed

## Files Modified

1. `server/routes/health.ts` - Use storage.checkDatabaseHealth()
2. `server/routes/health-routes.ts` - Remove duplicate /health endpoint
3. `server/jobs/notification-processor.ts` - Use storage layer
4. `server/jobs/price-alert-checker.ts` - Document exception
5. `server/utils/price-change-hooks.ts` - Remove dead code
6. `server/storage.ts` - Add getUserIdsWithWatchedProducts() delegation
7. `server/storage/domains/watchlist-storage.ts` - Add getUserIdsWithWatchedProducts()

## Checklist

- [x] health.ts updated to use storage layer
- [x] notification-processor.ts refactored to use storage layer
- [x] price-alert-checker.ts documented as justified exception
- [x] price-change-hooks.ts dead code removed
- [x] TypeScript compiles successfully
- [x] ESLint passes on modified files

## Success Criteria

- [x] `server/routes/health.ts` uses `storage.checkDatabaseHealth()`
- [x] `server/jobs/notification-processor.ts` uses `storage.getUserIdsWithWatchedProducts()`
- [x] `server/jobs/price-alert-checker.ts` has documented exception justification
- [x] `server/utils/price-change-hooks.ts` no longer imports `db`

---

**Created by**: Code Review Multi-Agent Analysis
**Creation Date**: 2026-01-23
**Resolved by**: Claude Code
**Resolution Date**: 2026-01-24
**Agents**: architecture-strategist
