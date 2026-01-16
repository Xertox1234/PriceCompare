# TODO 235: Fix E2E Accessibility Test CSRF Token Handling

**Priority**: P2 (Medium) - 1 test failure with separate root cause from TODO_233
**File(s)**: `e2e/accessibility.spec.ts`
**Estimated Time**: 30 minutes
**Status**: Not Started

## Problem Statement

1 E2E test in `e2e/accessibility.spec.ts` (line 138) is failing. This failure is **NOT related** to the watchlist selector issue (TODO_233) - it has a separate root cause related to CSRF token handling for direct API requests in E2E tests.

**Test Name**: "should have no WCAG violations in toast notifications"

## Root Cause

The accessibility test makes direct API calls using `page.request.post('/api/watchlists')` without proper CSRF token handling. The CSRF protection middleware rejects the request, causing the test to fail before it can verify toast accessibility.

```typescript
// Current (broken) - missing CSRF token
await page.request.post('/api/watchlists', {
  data: { name: 'Test Watchlist' }
});
// Returns 403 Forbidden - CSRF token missing
```

## Solution Approach

Two options:

### Option A: Add CSRF Token to API Requests (Recommended)

Fetch the CSRF token before making API requests:

```typescript
// Get CSRF token from meta tag or cookie
const csrfToken = await page.evaluate(() => {
  const meta = document.querySelector('meta[name="csrf-token"]');
  return meta?.getAttribute('content') || '';
});

// Include token in request headers
await page.request.post('/api/watchlists', {
  data: { name: 'Test Watchlist' },
  headers: {
    'X-CSRF-Token': csrfToken
  }
});
```

### Option B: Use UI Actions Instead of Direct API

Refactor the test to trigger toasts through UI interactions rather than direct API calls:

```typescript
// Instead of direct API call, use UI to create watchlist
await page.locator('[data-testid="create-watchlist-button"]').click();
await page.locator('[data-testid="watchlist-name-input"]').fill('Test Watchlist');
await page.locator('[data-testid="submit-watchlist"]').click();

// Toast will appear naturally
await expect(page.locator('[role="status"]')).toBeVisible();
```

## Implementation Steps

### Step 1: Investigate Test Setup

- [ ] Read the failing test to understand what it's trying to do
- [ ] Determine if CSRF token is available in the test context
- [ ] Check existing CSRF helper patterns in `e2e/helpers.ts`

### Step 2: Implement Fix

Choose one approach:

**If Option A (CSRF token)**:
- [ ] Create helper function to fetch CSRF token
- [ ] Update test to include token in API request headers

**If Option B (UI actions)**:
- [ ] Refactor test to use UI interactions
- [ ] Remove direct API calls
- [ ] Keep accessibility verification logic

### Step 3: Verify Fix

- [ ] Test passes
- [ ] Toast accessibility is still being verified
- [ ] No regressions in other tests

## Technical Details

### CSRF Token Location

The CSRF token is typically available via:
1. **Meta tag**: `<meta name="csrf-token" content="...">`
2. **Cookie**: `XSRF-TOKEN` or similar
3. **API endpoint**: `/api/csrf-token`

### Existing Patterns

Check `e2e/helpers.ts` for existing CSRF handling patterns that may already exist and can be reused.

### Toast Accessibility Requirements (WCAG)

The test should verify:
- Toast has proper `role` attribute (`status` or `alert`)
- Toast is announced by screen readers
- Toast has sufficient color contrast
- Toast can be dismissed by keyboard users

## Checklist

- [ ] Root cause confirmed
- [ ] Fix implemented (Option A or B)
- [ ] Test passes
- [ ] Accessibility verification still works
- [ ] No regressions

## Success Criteria

- [ ] Accessibility test passes
- [ ] Toast accessibility is still being verified properly
- [ ] E2E pass rate increases by ~1% (1 more test passing)

## Related TODOs

- **TODO_233**: Watchlist selector fix (separate issue)
- **TODO_234**: Price analytics widget visibility (separate issue)
- **docs/04_SECURITY_PATTERNS.md**: CSRF protection patterns

## Pattern References

- **Security Patterns**: `docs/04_SECURITY_PATTERNS.md` - CSRF handling
- **Testing Patterns**: `docs/08_TESTING_PATTERNS.md` - E2E test patterns

---

## PRE-CLOSE VERIFICATION CHECKLIST (MANDATORY)

### Testing
- [ ] **Run affected test**:
  ```bash
  npm run test:e2e -- --grep "WCAG violations in toast"
  ```

- [ ] **Verify test results**: Previously failing test passes

### Build & Type Safety
- [ ] **TypeScript compilation**: `npm run check`
- [ ] **ESLint check**: `npm run lint`

---

## RESOLUTION (YYYY-MM-DD)

**Decision**: [Option A or Option B]

### Summary

[To be filled upon completion]

### Changes Made

[To be filled upon completion]

### Verification Results

```bash
# To be filled upon completion
```

---

**Completed by**: [TBD]
**Completion Date**: [TBD]
**Actual Time**: [TBD] (vs estimated 30 minutes)
