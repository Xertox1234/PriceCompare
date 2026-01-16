# TODO 234: Fix E2E Price Analytics Widget Visibility Tests

**Priority**: P2 (Medium) - 5 test failures with separate root cause from TODO_233
**File(s)**: `e2e/price-analytics.spec.ts`
**Estimated Time**: 45 minutes
**Status**: Not Started

## Problem Statement

5 E2E tests in `e2e/price-analytics.spec.ts` are failing. These failures are **NOT related** to the watchlist selector issue (TODO_233) - they have a separate root cause related to widget visibility, collapsible sections, or selector mismatches.

**Current Test Results** (from TODO_233 investigation):
- 5 failures in price-analytics.spec.ts
- All appear related to widget visibility or data-testid mismatches

## Root Cause Analysis Required

The exact root cause needs investigation. Likely causes:
1. Widgets are in collapsible sections that need expanding
2. `data-testid` attributes changed in recent component updates
3. Widget structure changed (different DOM hierarchy)
4. Async data loading not properly waited for

## Affected Tests (5 Total)

### Price Analytics Tests (`e2e/price-analytics.spec.ts`)
1. Line 206: "should update chart when time range changes"
2. Line 259: "should display volatility score"
3. Line 288: "should display price change percentage"
4. Line 315: "should compare prices across retailers"
5. Line 349: "should display best deal badge"
6. Line 473: "should calculate and display price trend"

## Implementation Steps

### Step 1: Investigate Current Failures

- [ ] Run failing tests with `--debug` flag to see actual vs expected
  ```bash
  npm run test:e2e -- --grep "price analytics" --debug
  ```
- [ ] Check if widgets exist in DOM but are hidden
- [ ] Verify `data-testid` attributes match between tests and components

### Step 2: Check Component Changes

- [ ] Review recent changes to price analytics components:
  - `client/src/components/price-analytics/price-trend-indicator.tsx`
  - `client/src/components/price-analytics/retailer-comparison-table.tsx`
- [ ] Check if collapsible sections were added
- [ ] Verify data loading states

### Step 3: Update Test Selectors

- [ ] Fix selectors to match current component structure
- [ ] Add waits for collapsible sections if needed
- [ ] Ensure proper data loading waits

### Step 4: Verify Fixes

- [ ] All 5 tests pass
- [ ] No regressions in other tests

## Technical Investigation Notes

```typescript
// Common patterns to check:

// 1. Collapsible sections - may need to expand first
await page.locator('[data-testid="analytics-section"]').click();
await page.waitForSelector('[data-testid="volatility-score"]', { state: 'visible' });

// 2. Data loading - may need to wait for API response
await page.waitForResponse(resp => resp.url().includes('/api/analytics'));

// 3. Chart rendering - may need extra time
await page.waitForSelector('[data-testid="price-chart"] canvas', { state: 'visible' });
```

## Checklist

- [ ] Root cause identified
- [ ] Test selectors updated
- [ ] All 5 failing tests now pass
- [ ] No regressions in other tests

## Success Criteria

- [ ] E2E pass rate increases by ~3% (5 more tests passing)
- [ ] Price analytics test suite fully passes
- [ ] No new test failures introduced

## Related TODOs

- **TODO_233**: Watchlist selector fix (separate issue)
- **TODO_235**: Accessibility CSRF issue (separate issue)
- **TODO_231** (Archived): May have touched analytics components

## Pattern References

- **Testing Patterns**: `docs/08_TESTING_PATTERNS.md` - E2E test patterns
- **Frontend Patterns**: `docs/05_FRONTEND_PATTERNS.md` - Component patterns

---

## PRE-CLOSE VERIFICATION CHECKLIST (MANDATORY)

### Testing
- [ ] **Run affected tests**:
  ```bash
  npm run test:e2e -- --grep "price analytics"
  ```

- [ ] **Verify test results**: All 5 previously failing tests pass

### Build & Type Safety
- [ ] **TypeScript compilation**: `npm run check`
- [ ] **ESLint check**: `npm run lint`

---

## RESOLUTION (YYYY-MM-DD)

**Decision**: [To be filled upon completion]

### Root Cause Found

[To be filled - document what was actually wrong]

### Changes Made

[To be filled upon completion]

### Verification Results

```bash
# To be filled upon completion
```

---

**Completed by**: [TBD]
**Completion Date**: [TBD]
**Actual Time**: [TBD] (vs estimated 45 minutes)
