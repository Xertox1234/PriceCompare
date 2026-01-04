# TODO 005: Fix Chart Enhancements Test Suite

**Priority**: P3
**File(s)**: `client/src/components/price-history/__tests__/ChartEnhancements.test.tsx`
**Line**: 5-7
**Estimated Time**: 3-4 hours
**Status**: Not Started

## Problem Statement

The Chart Enhancements test suite is entirely skipped due to Recharts rendering issues:

```typescript
// TODO: Skipped - These tests have rendering issues with Recharts in the test environment
// Consider moving to E2E testing with Playwright
describe.skip('Chart Enhancements', () => {
```

This leaves chart enhancement functionality untested at the unit level.

## Root Cause

Recharts library doesn't render properly in jsdom/vitest environment. Charts require browser rendering context.

## Solution Approach

Either:
1. **Option A**: Fix unit test mocking for Recharts components
2. **Option B**: Move chart tests to E2E with Playwright (recommended)
3. **Option C**: Use React Testing Library's `render` with proper SVG mocking

## Implementation Steps

### Option A: Fix Unit Test Mocks

- [ ] Create comprehensive Recharts mock in `__mocks__/recharts.tsx`
- [ ] Mock SVG rendering behavior
- [ ] Enable skipped tests and verify they pass

### Option B: E2E Testing (Recommended)

- [ ] Create `e2e/chart-enhancements.spec.ts`
- [ ] Test chart rendering in real browser context
- [ ] Test interactive features (tooltips, zooming, etc.)
- [ ] Remove or mark unit tests as deprecated

### Option C: Snapshot Testing

- [ ] Configure snapshot testing for chart components
- [ ] Accept that interaction testing won't work in unit tests
- [ ] Use E2E for interaction tests

## Technical Details

```typescript
// Mock approach for unit tests
vi.mock('recharts', () => ({
  LineChart: ({ children }: any) => <div data-testid="line-chart">{children}</div>,
  Line: () => <div data-testid="line" />,
  XAxis: () => <div data-testid="x-axis" />,
  YAxis: () => <div data-testid="y-axis" />,
  Tooltip: () => <div data-testid="tooltip" />,
  ResponsiveContainer: ({ children }: any) => <div>{children}</div>,
}));

// E2E approach
test('chart renders price history', async ({ page }) => {
  await page.goto('/products/1');
  await expect(page.locator('.recharts-line-chart')).toBeVisible();
  await expect(page.locator('.recharts-line')).toHaveCount(1);
});
```

## Checklist

- [ ] Approach decided (mock vs E2E)
- [ ] Implementation complete
- [ ] Tests passing
- [ ] Chart functionality verified

## Success Criteria

- [ ] Chart enhancement features have test coverage
- [ ] Tests are not skipped
- [ ] No flaky tests from rendering issues
