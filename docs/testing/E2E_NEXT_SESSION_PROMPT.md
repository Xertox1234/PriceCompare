# Next Session Prompt — E2E Suite Closeout (2025-12-18)

## What’s done

- Removed all remaining `waitForTimeout()` usage in E2E:
  - `e2e/helpers/price-analytics-helpers.ts`
  - `e2e/price-analytics.spec.ts`
  - `e2e/helpers/notification-helpers.ts` + `e2e/notifications.spec.ts`
- Verified impacted suites:
  - `npx playwright test e2e/price-analytics.spec.ts e2e/accessibility.spec.ts` → **18 passed**

## Current blocker

`npm run test:e2e` still reports failures in suites unrelated to the sleep-removal work.

Known failing areas from the last full run:
- `e2e/advanced-search.spec.ts` (category filtering: initial results count is 0)
- `e2e/watchlist.spec.ts` (delete watchlist: timeout clicking delete)
- Debug/diagnostic specs:
  - `e2e/price-analytics-debug.spec.ts` (direct API request got 403)
  - `e2e/time-range-debug.spec.ts`
- Visual regression suite:
  - `e2e/price-analytics.visual.spec.ts` (treat separately from functional E2E)

## Goal for next prompt

1) Decide what belongs in the default `npm run test:e2e` run:
- Exclude debug specs and (optionally) visual regression specs from the default run (or mark them `test.skip()` / `test.describe.skip()`), so “full E2E” reflects production user flows.

2) Triage and fix the remaining functional failures:
- `e2e/advanced-search.spec.ts`: ensure seed data + selector path produces >0 initial results before filtering.
- `e2e/watchlist.spec.ts`: stabilize delete flow (visibility/overlay handling, confirm dialog timing).

3) Re-run:

```bash
npm run test:e2e
```

If isolating:

```bash
npm run test:e2e -- e2e/advanced-search.spec.ts
npm run test:e2e -- e2e/watchlist.spec.ts
```

## Context files

- Progress notes: `docs/E2E_TEST_IMPLEMENTATION_GAP_ANALYSIS.md`
- Price analytics navigation helper: `e2e/helpers/price-analytics-helpers.ts`
- Notifications helper + deterministic timestamps: `e2e/helpers/notification-helpers.ts`
