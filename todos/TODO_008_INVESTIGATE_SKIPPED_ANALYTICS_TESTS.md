# TODO 008: Investigate Skipped Price Analytics E2E Tests

**Priority**: P3 (Low - Investigation only)
**Estimated Time**: 4-8 hours
**Status**: Backlog
**Created**: 2026-01-05
**Parent**: TODO_007 (resolved)

## Problem Statement

During TODO_007 investigation, we discovered that 5 out of 10 price analytics E2E tests gracefully skip when UI elements aren't found. The features may exist but:
- Use different selectors than expected
- Are hidden behind authentication
- Require specific data patterns
- Are implemented differently than tests expect

**This TODO is purely investigative** - determine if features exist before implementing anything.

## Skipped Tests to Investigate

### 1. Cross-Retailer Comparison (Lines 334-372)
- **Test**: Should compare current prices across multiple retailers
- **Skip condition**: `[data-testid="retailer-comparison"]` not found
- **Investigation**:
  - Search codebase for retailer comparison UI
  - Check if price comparison exists under different name/selector
  - Verify if multi-retailer data is displayed on product pages

### 2. Best Deal Badge (Lines 374-407)
- **Test**: Should display "Best Deal" badge on cheapest retailer
- **Skip condition**: No retailer data or badges found
- **Investigation**:
  - Check if "Best Deal" or "Lowest Price" badges exist
  - Verify badge logic in frontend components
  - Test with product that has multiple retailer prices

### 3. Price Alert Modal from Chart (Lines 411-464)
- **Test**: Should open price alert modal with pre-filled price when clicking chart
- **Skip condition**: `[data-testid="alert-modal"]` not found
- **Investigation**:
  - Check if chart data points are clickable
  - Verify if price alert modal exists
  - Test both authenticated and unauthenticated states
  - Check if feature requires specific user permissions

### 4. Historical Data Accuracy Display (Lines 468-501)
- **Test**: Should display price history data matching database records
- **Skip condition**: Chart data not found
- **Investigation**:
  - This is likely a **data seeding issue**, not a missing feature
  - Verify chart displays when real price history exists
  - Check data format requirements
  - May just need to update test data seeding
- **⚠️ SCHEMA SYNC FIX APPLIED** (2026-01-05):
  - E2E tests were failing because `e2e/helpers.ts` TRUNCATE statement was missing tables
  - Fixed by removing non-existent tables (`scraping_jobs`, `price_snapshots`)
  - Added automated validation: `npm run validate:schema-sync`
  - CI/CD now validates schema sync before E2E tests run
  - See: `scripts/validate-test-schema-sync.ts`, `CLAUDE.md:374-417`

### 5. Price Trend Indicator (Lines 503-546)
- **Test**: Should calculate and display price trend (upward/downward/stable)
- **Skip condition**: `[data-testid="price-trend"]` not found
- **Investigation**:
  - **Backend service EXISTS**: `trend-analysis-service.ts` ✅
  - Check if trend data is fetched by frontend
  - Look for trend indicator UI component
  - Verify if trend is displayed but with different selector
  - May need to add UI component to display existing backend data

## Investigation Methodology

### Phase 1: Codebase Search (2 hours)
```bash
# Search for retailer comparison
grep -r "retailer.*comparison\|compare.*retailer" client/src/

# Search for best deal badge
grep -r "best.*deal\|lowest.*price" client/src/

# Search for price alert modal
grep -r "alert.*modal\|price.*alert" client/src/

# Search for trend indicator
grep -r "trend\|rising\|falling\|stable" client/src/
```

### Phase 2: Component Analysis (2 hours)
1. Read `client/src/pages/price-history.tsx` - main analytics page
2. Read `client/src/components/price-history-chart.tsx` - chart component
3. Check API integration in `client/src/hooks/use-price-analytics.ts`
4. Review backend endpoints in `server/routes/price-analytics-routes.ts`

### Phase 3: Manual Testing (2-4 hours)
1. Seed realistic test data with multiple retailers
2. Navigate to product price history page
3. Manually verify each skipped feature
4. Document actual UI patterns vs test expectations

### Phase 4: Update Tests (1-2 hours)
Based on findings:
- **If feature exists**: Update E2E test selectors to match actual implementation
- **If feature missing**: Document what needs to be built
- **If feature unnecessary**: Remove test or mark as future enhancement

## Success Criteria

- [ ] All 5 skipped tests investigated and documented
- [ ] Clear status for each feature (exists/missing/not-needed)
- [ ] E2E test selectors updated to match reality
- [ ] TODO_008 closed with summary of findings

## Possible Outcomes

### Outcome A: Features Exist (Best Case)
- Update E2E test selectors
- All 10 analytics tests pass
- Close TODO_008 immediately

### Outcome B: Some Features Missing (Likely)
- Document which features are truly missing
- Create specific implementation tickets for gaps
- Update TODO_008 status to reflect findings

### Outcome C: Features Not Needed (Also Good)
- Remove unnecessary E2E tests
- Document that simpler UX is intentional
- Close TODO_008 with "No action needed"

## Related Files

**Tests**:
- `e2e/price-analytics.spec.ts:334-546` - Skipped test definitions
- `e2e/helpers/price-analytics-helpers.ts` - Test helper functions

**Frontend**:
- `client/src/pages/price-history.tsx` - Main analytics page
- `client/src/components/price-history-chart.tsx` - Chart component
- `client/src/hooks/use-price-analytics.ts` - Data fetching hooks

**Backend**:
- `server/services/trend-analysis-service.ts` - Trend calculation ✅
- `server/routes/price-analytics-routes.ts` - API endpoints

**Documentation**:
- `todos/TODO_007_INVESTIGATION_SUMMARY.md` - Parent investigation
- `todos/TODO_007_PRICE_ANALYTICS_FEATURES.md` - Original TODO

## Notes

- **This is NOT a feature implementation TODO** - it's purely investigative
- E2E tests use graceful degradation (skip instead of fail) - this is intentional
- The backend trend analysis service already exists - focus on UI integration
- Some features may be "missing" by design (simpler UX might be better)
- Manual testing requires seeded database with realistic multi-retailer data

### Schema Sync Fix Applied (2026-01-05)

**Problem**: E2E tests were failing before any tests ran due to TRUNCATE statement referencing non-existent tables.

**Root Cause**: `e2e/helpers.ts` tried to TRUNCATE `scraping_jobs` and `price_snapshots` tables that don't exist in the test database (schema drift between migrations and test cleanup logic).

**Fix**:
- ✅ Removed non-existent tables from `e2e/helpers.ts:61-77`
- ✅ Created automated validation script: `scripts/validate-test-schema-sync.ts`
- ✅ Added `npm run validate:schema-sync` command
- ✅ Updated CI/CD pipelines to validate schema sync before E2E tests
- ✅ Documented pattern in `CLAUDE.md:374-417`
- ✅ Created `docs/patterns/ADR_PRICE_ANALYTICS_YAGNI_REJECTIONS.md`

**Prevention**: CI now fails if `shared/schema.ts` tables don't match `e2e/helpers.ts` TRUNCATE list. See validation script for exclusion rules.

## Time Breakdown

- Phase 1 (Search): 2 hours
- Phase 2 (Analysis): 2 hours
- Phase 3 (Manual Testing): 2-4 hours
- Phase 4 (Update Tests): 1-2 hours
- **Total**: 7-10 hours (estimate 8 hours)

## Decision Point

**Before starting this TODO**, ask:
1. Are users requesting these features?
2. Do we have real usability issues?
3. Is this work higher priority than other backlog items?

If answers are "no", **leave this TODO in backlog** indefinitely. The 5 working features may be sufficient.
