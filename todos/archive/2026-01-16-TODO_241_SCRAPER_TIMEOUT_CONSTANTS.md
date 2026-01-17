# TODO 241: Centralize Scraper Timeout Constants

**Created**: 2026-01-16
**Priority**: High
**Category**: Reliability / Maintainability
**Effort**: 30 minutes

## Problem

Multiple hardcoded timeout values are scattered throughout the scraping code:
- 30000ms navigation timeout
- 10000ms selector wait
- 5000ms network idle wait
- 2000ms text extraction timeout

This makes tuning difficult and violates DRY principles.

**Risk Level**: Medium (Reliability)

## Affected Files

- `server/agents/extraction-agent.ts` (lines 261, 270, 282, 287, 330, etc.)
- `server/utils/constants.ts`

## Current Code Examples

```typescript
// extraction-agent.ts - multiple hardcoded values
await page.goto(validatedUrl.toString(), {
  waitUntil: 'domcontentloaded',
  timeout: 30000,  // hardcoded
});

await page.waitForSelector(strategy.priceSelectors[0], {
  timeout: 10000,  // hardcoded
  state: 'visible',
});

await page.waitForLoadState('networkidle', { timeout: 5000 });  // hardcoded

const text = await element.textContent({ timeout: 2000 });  // hardcoded
```

## Required Changes

### 1. Add scraper constants to `server/utils/constants.ts`

```typescript
/**
 * Scraper/Playwright timeout constants
 * Centralized for easy tuning and consistency
 */
export const SCRAPER = {
  /** Maximum time to wait for page navigation */
  NAVIGATION_TIMEOUT_MS: 30000,
  /** Time to wait for price/product selectors to appear */
  SELECTOR_TIMEOUT_MS: 10000,
  /** Time to wait for network to become idle */
  NETWORK_IDLE_TIMEOUT_MS: 5000,
  /** Time to wait when extracting text/attributes from elements */
  ELEMENT_TIMEOUT_MS: 2000,
  /** Delay between requests to same domain */
  REQUEST_DELAY_MS: 2000,
  /** Maximum concurrent browser contexts */
  MAX_CONCURRENT_CONTEXTS: 3,
  /** Browser launch args */
  BROWSER_ARGS: [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-blink-features=AutomationControlled',
  ],
} as const;
```

### 2. Update extraction-agent.ts to use constants

```typescript
import { SCRAPER } from '../utils/constants';

// Navigation
await page.goto(validatedUrl.toString(), {
  waitUntil: 'domcontentloaded',
  timeout: SCRAPER.NAVIGATION_TIMEOUT_MS,
});

// Selector wait
await page.waitForSelector(strategy.priceSelectors[0], {
  timeout: SCRAPER.SELECTOR_TIMEOUT_MS,
  state: 'visible',
});

// Network idle
await page.waitForLoadState('networkidle', { 
  timeout: SCRAPER.NETWORK_IDLE_TIMEOUT_MS 
});

// Text extraction
const text = await element.textContent({ 
  timeout: SCRAPER.ELEMENT_TIMEOUT_MS 
});
```

## Testing

- [ ] Run existing scraper tests to verify no regressions
- [ ] Verify constants are exported correctly
- [ ] Test E2E scraping functionality

## Acceptance Criteria

- [ ] `SCRAPER` constants added to `server/utils/constants.ts`
- [ ] All hardcoded timeouts in `extraction-agent.ts` replaced with constants
- [ ] No regression in scraper functionality
- [ ] Constants are documented with JSDoc comments
