# TODO 006: Complete API Testing Migration

**Priority**: P4 (Optional - 99.1% already passing)
**File(s)**: See list below
**Reference**: `docs/testing/TODO_API_TESTING_MIGRATION.md`
**Estimated Time**: 15-20 hours total
**Status**: In Progress (6/15+ complete)

## Problem Statement

API test migration to standardized validation helpers is 30-40% complete. Remaining test files still use direct `response.body` access patterns.

**Current Status**: 218/220 tests passing (99.1%) - 2 skipped

## Root Cause

Migration was deprioritized after achieving 99.1% pass rate. Remaining files are lower priority.

## Decision Required

**Should this be completed?** Options:
1. ✅ **Close as "good enough"** - 99.1% passing, no critical bugs remaining
2. 📋 **Continue gradually** - Migrate 1-2 files per sprint as time allows
3. 🚀 **Complete all** - Dedicated effort to finish migration

## Remaining Test Files

### Medium Priority (Feature Routes)
- [ ] `price-history-routes.test.ts` - Historical price data
- [ ] `notification-routes.test.ts` - User notifications
- [ ] `smart-alerts-routes.test.ts` - Advanced alerting
- [ ] `affiliate-routes.test.ts` - Affiliate link generation
- [ ] `admin-routes.test.ts` - Admin panel endpoints

### Low Priority (Specialized Routes)
- [ ] `scraping-routes.test.ts` - Web scraping endpoints
- [ ] `monitoring-routes.test.ts` - System monitoring
- [ ] `community-routes.test.ts` - Community features
- [ ] `enhanced-forum-routes.test.ts` - Enhanced forum
- [ ] `advanced-search-routes.test.ts` - Advanced search
- [ ] `discourse-routes.test.ts` - Discourse SSO
- [ ] `aggregation-metrics-routes.test.ts` - Metrics
- [ ] `cache-routes.test.ts` - Cache management

### Infrastructure
- [ ] `csrf-protection.test.ts` - CSRF middleware
- [ ] `health-routes.test.ts` - Health checks

## Migration Checklist Per File

1. Import validation helpers from `server/__tests__/helpers/response-validators.ts`
2. Replace `response.body` with `expectSuccessResponse<T>()` or `expectErrorResponse()`
3. Fix variable naming conflicts (don't shadow table imports)
4. Update status code expectations
5. Run and fix tests

## Checklist

- [ ] Decision made on completion strategy
- [ ] Priority files migrated (if continuing)
- [ ] Documentation updated

## Success Criteria

- [ ] All migrated tests pass
- [ ] Consistent patterns across test suite
- [ ] Any discovered bugs fixed

## Notes

See `docs/testing/TODO_API_TESTING_MIGRATION.md` for detailed migration guide and patterns.

**Bugs Fixed During Migration So Far**: 15+ issues including 1 CRITICAL SQL injection vulnerability
