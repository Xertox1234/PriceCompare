# TODO 233: Fix E2E Test Selectors for WatchlistToggleButton

**Priority**: P2 (Medium) - Tests passing at 78%, selectors need alignment
**File(s)**: `e2e/watchlist.spec.ts`, `e2e/product-detail.spec.ts`, `e2e/product-discovery.spec.ts`
**Estimated Time**: 30 minutes (revised down from 1.5 hours after scope clarification)
**Status**: Not Started

## Problem Statement

After implementing `WatchlistToggleButton` in TODO_231, 10 E2E tests fail due to **selector mismatches**. The tests expect a dialog/menu pattern (`[role="dialog"], [role="menu"]`) but the new implementation uses direct API calls with optimistic updates and toast notifications - no modal involved.

**Current Test Results**:
- 115 passed (78%)
- 16 failed (10 related to this TODO, 6 separate root causes - see Related TODOs)
- 16 skipped (expected)

## Root Cause

The `addProductToWatchlist()` helper function in `e2e/watchlist.spec.ts` (line 567) waits for a dialog/menu that no longer exists:

```typescript
// Current (broken) - expects modal dialog
await page.waitForSelector('[role="dialog"], [role="menu"]', {
  state: 'visible',
  timeout: 5000,
});
```

The new `WatchlistToggleButton` component:
1. Checks authentication state
2. Calls API mutation directly (no dialog)
3. Uses optimistic updates for instant UI feedback
4. Shows toast notification on success/error

## Solution Approach

Update the `addProductToWatchlist()` helper to match the new button-based flow:
1. Click the watchlist toggle button
2. Wait for `aria-label` attribute change (optimistic update indicator)
3. Optionally verify toast notification
4. No dialog/menu waiting required

**Key Insight**: Use `aria-label` attribute (which EXISTS) instead of `data-in-watchlist` (which does NOT exist in the component).

## Implementation Step

### Single Step: Update `addProductToWatchlist()` Helper

**File**: `e2e/watchlist.spec.ts` (lines 555-580)

- [ ] Remove dialog/menu selector wait
- [ ] Use correct route `/product/${productId}` (singular, NOT `/products/`)
- [ ] Wait for button to be visible AND not disabled (loading state)
- [ ] Use `aria-label` attribute for state verification
- [ ] Add idempotency check (skip if already in watchlist)
- [ ] Use centralized `TIMEOUTS` constants (not hardcoded values)

## Technical Details

### Corrected Helper Function Pattern

```typescript
import { TIMEOUTS, waitForPageReady } from './helpers';

/**
 * Add product to watchlist via the toggle button.
 * Uses aria-label attribute for state verification (component has this attribute).
 */
async function addProductToWatchlist(
  page: Page,
  productId: number,
  watchlistName?: string  // Optional - component uses default watchlist
): Promise<void> {
  // CRITICAL: Route is /product/:id (singular), NOT /products/:id
  await page.goto(`/product/${productId}`);
  await waitForPageReady(page);

  // Find watchlist button
  const watchlistButton = page.locator('[data-testid="add-to-watchlist"]');
  await watchlistButton.waitFor({
    state: 'visible',
    timeout: TIMEOUTS.BUTTON_VISIBLE
  });

  // Wait for button to not be loading (disabled state)
  await expect(watchlistButton).not.toBeDisabled({
    timeout: TIMEOUTS.USER_STATE_CHANGE
  });

  // IDEMPOTENCY: Check current state via aria-label
  const currentLabel = await watchlistButton.getAttribute('aria-label');
  if (currentLabel === 'Remove from watchlist') {
    // Already in watchlist - no-op for idempotency
    return;
  }

  // Click to add
  await watchlistButton.click();

  // Wait for optimistic update (aria-label changes)
  // NOTE: Using aria-label because data-in-watchlist attribute does NOT exist
  await expect(watchlistButton).toHaveAttribute(
    'aria-label',
    'Remove from watchlist',
    { timeout: TIMEOUTS.USER_STATE_CHANGE }
  );

  // Optional: Verify toast (use specific text, not broad viewport selector)
  await expect(page.getByText(/added to watchlist/i).first()).toBeVisible({
    timeout: TIMEOUTS.DIALOG_VISIBLE
  });
}
```

### Authentication Flow (for auth guard tests)

```typescript
async function testWatchlistAuthGuard(
  page: Page,
  productId: number
): Promise<void> {
  // Clear auth state
  await page.context().clearCookies();
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  await page.goto(`/product/${productId}`);
  await waitForPageReady(page);

  // Click watchlist button
  const watchlistButton = page.locator('[data-testid="add-to-watchlist"]');
  await watchlistButton.waitFor({
    state: 'visible',
    timeout: TIMEOUTS.BUTTON_VISIBLE
  });
  await watchlistButton.click();

  // AuthModal uses role="dialog" (NOT data-testid="auth-modal" which doesn't exist)
  await page.waitForSelector('[role="dialog"]', {
    state: 'visible',
    timeout: TIMEOUTS.DIALOG_VISIBLE
  });

  // Verify it's the login modal by checking for login heading
  await expect(page.getByRole('heading', { name: /log in|sign in/i })).toBeVisible({
    timeout: TIMEOUTS.FORM_INPUT
  });
}
```

## Critical Fixes from Review

| Issue | Original Plan | Corrected |
|-------|---------------|-----------|
| Route | `/products/${productId}` | `/product/${productId}` (singular) |
| State attribute | `data-in-watchlist` (doesn't exist) | `aria-label` (exists) |
| Auth modal selector | `[data-testid="auth-modal"]` (doesn't exist) | `[role="dialog"]` + heading check |
| Timeouts | Hardcoded (5000, 3000) | `TIMEOUTS` constants |
| Loading state | Not checked | `not.toBeDisabled()` check |
| Idempotency | Not handled | Check `aria-label` before action |

## Checklist

- [ ] Implementation complete
- [ ] All 10 watchlist-related failing tests now pass
- [ ] No regressions in other tests
- [ ] Helper function uses centralized TIMEOUTS
- [ ] Helper function is idempotent

## Success Criteria

- [ ] Watchlist tests pass (6 failures → 0)
- [ ] Product detail watchlist tests pass (2 failures → 0)
- [ ] Product discovery watchlist tests pass (2 failures → 0)
- [ ] No new test failures introduced
- [ ] E2E pass rate increases from 78% to ~85%+

## Affected Tests (10 Total - Watchlist Selector Related)

### Watchlist Tests (`e2e/watchlist.spec.ts`) - 6 failures
1. Line 130: "should add product to watchlist"
2. Line 218: "should move product between watchlists"
3. Line 275: "should bulk delete from watchlist"
4. Line 356: "should export watchlist to CSV"
5. Line 494: "should make watchlist public"
6. (Various tests using `addProductToWatchlist` helper)

### Product Detail Tests (`e2e/product-detail.spec.ts`) - 2 failures
1. Line 197: "should add product to watchlist from product detail page"
2. Line 266: "should remove product from watchlist"

### Product Discovery Tests (`e2e/product-discovery.spec.ts`) - 2 failures
1. Line 259: "should add product to watchlist"
2. Line 297: "should require authentication to add to watchlist"

## Out of Scope (Separate TODOs)

The following failures have **different root causes** and are tracked separately:

- **TODO_234**: Price Analytics Tests (5 failures) - Widget visibility/selector issues
- **TODO_235**: Accessibility CSRF Test (1 failure) - API CSRF token handling

## Pattern References

- **Testing Patterns**: `docs/08_TESTING_PATTERNS.md` - E2E test patterns
- **Frontend Patterns**: `docs/05_FRONTEND_PATTERNS.md` - Component patterns
- **Component**: `client/src/components/watchlist/WatchlistToggleButton.tsx`

## Related TODOs

- **TODO_231** (Archived): Original UI implementation that changed the watchlist flow
- **TODO_234**: Price analytics test failures (separate root cause)
- **TODO_235**: Accessibility CSRF test failure (separate root cause)

---

## PRE-CLOSE VERIFICATION CHECKLIST (MANDATORY)

**Before marking this TODO as complete, verify ALL of the following:**

### Code Verification
- [ ] **Route verification**: Confirm `/product/` (singular) is used, not `/products/`
  ```bash
  grep -n "goto.*product" e2e/watchlist.spec.ts | head -5
  # Should show: /product/${productId}
  ```

- [ ] **Aria-label assertion**: Confirm using aria-label, not data-in-watchlist
  ```bash
  grep -n "aria-label" e2e/watchlist.spec.ts | head -5
  # Should show: aria-label assertions
  ```

- [ ] **TIMEOUTS usage**: Confirm centralized constants used
  ```bash
  grep -n "TIMEOUTS\." e2e/watchlist.spec.ts | head -5
  # Should show: TIMEOUTS.BUTTON_VISIBLE, etc.
  ```

### Testing
- [ ] **Run affected tests**:
  ```bash
  npm run test:e2e -- --grep "watchlist"
  npm run test:e2e -- --grep "Watchlist"
  ```

- [ ] **Verify test results**:
  - Expected passing: ~125 tests (was 115)
  - 10 failures should be fixed
  - 6 failures remain (price analytics + accessibility - separate TODOs)

### Build & Type Safety
- [ ] **TypeScript compilation**: `npm run check`
- [ ] **ESLint check**: `npm run lint`

---

## RESOLUTION (YYYY-MM-DD)

**Decision**: [To be filled upon completion]

### Summary

[To be filled upon completion]

### Changes Made

[To be filled upon completion]

### Verification Results

```bash
# To be filled upon completion
```

### Outcome

[To be filled upon completion]

---

**Completed by**: [TBD]
**Completion Date**: [TBD]
**Actual Time**: [TBD] (vs estimated 30 minutes)
