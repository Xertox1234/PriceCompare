# TODO 218: Hardcoded Waits in Scrapers

**Priority**: P2 - MEDIUM
**File(s)**: `server/scrapers/*.ts`, `server/services/scraper-service.ts`
**Estimated Time**: 1 hour
**Status**: Not Started
**Created Date**: 2026-01-14
**Source**: Security Audit (2026-01-14)

## Problem Statement

Scrapers use `page.waitForTimeout()` with hardcoded delays instead of condition-based waits. This causes:

1. **Unreliable scraping**: Fixed delays may be too short for slow pages, causing failures
2. **Slow scraping**: Fixed delays are often too long for fast pages, wasting time
3. **Flaky tests**: Timing-based tests are inherently unreliable
4. **Poor scalability**: Unnecessary waits reduce throughput

**Operational Impact**: Scraping is either unreliable or unnecessarily slow.

## Root Cause

Using arbitrary `waitForTimeout(3000)` instead of proper Playwright wait conditions like `waitForSelector()` or `waitForLoadState()`.

## Solution Approach

1. Audit all scrapers for `waitForTimeout()` usage
2. Replace with condition-based waits (`waitForSelector`, `waitForLoadState`, etc.)
3. Add appropriate timeouts to condition-based waits
4. Use network idle detection where appropriate

## Implementation Steps

### Step 1: Audit Hardcoded Waits

- [ ] Search for `waitForTimeout` in all scraper files
- [ ] Document each instance and its purpose
- [ ] Determine appropriate replacement condition

### Step 2: Replace with Condition-Based Waits

- [ ] Replace price element waits with `waitForSelector('.price')`
- [ ] Replace page load waits with `waitForLoadState('domcontentloaded')`
- [ ] Replace AJAX waits with `waitForResponse()` or `waitForLoadState('networkidle')`

### Step 3: Add Proper Timeouts

- [ ] Add explicit timeouts to all wait operations
- [ ] Use reasonable defaults (10-30 seconds)
- [ ] Document timeout rationale

### Step 4: Test Improvements

- [ ] Verify scraping still works after changes
- [ ] Measure performance improvement
- [ ] Check test stability

## Technical Details

**Current Implementation (UNRELIABLE):**
```typescript
// ❌ Arbitrary wait - may be too short or too long
await page.goto(url);
await page.waitForTimeout(3000);
const price = await page.locator('.price').textContent();

// ❌ Multiple arbitrary waits
await page.click('.load-more');
await page.waitForTimeout(2000);
await page.waitForTimeout(1000); // Extra wait "just in case"
```

**Fixed Implementation:**
```typescript
// ✅ Wait for specific condition
await page.goto(url, { 
  timeout: 30000,
  waitUntil: 'domcontentloaded' 
});

// Wait for price element to be visible
await page.waitForSelector('.price', { 
  state: 'visible',
  timeout: 15000 
});

const price = await page.locator('.price').textContent();
```

**Wait Condition Examples:**

```typescript
// ✅ Wait for element to appear
await page.waitForSelector('.price', { 
  state: 'visible',  // or 'attached', 'detached', 'hidden'
  timeout: 15000 
});

// ✅ Wait for network to be idle (good for SPAs)
await page.waitForLoadState('networkidle', { timeout: 30000 });

// ✅ Wait for specific network response
await page.waitForResponse(
  response => response.url().includes('/api/products') && response.status() === 200,
  { timeout: 15000 }
);

// ✅ Wait for navigation after click
await Promise.all([
  page.waitForNavigation({ timeout: 15000 }),
  page.click('.next-page'),
]);

// ✅ Wait for element to contain text
await page.waitForFunction(
  () => document.querySelector('.price')?.textContent?.includes('$'),
  { timeout: 15000 }
);

// ✅ Wait for multiple conditions
await Promise.all([
  page.waitForSelector('.price', { state: 'visible', timeout: 15000 }),
  page.waitForSelector('.product-title', { state: 'visible', timeout: 15000 }),
]);
```

**Retailer-Specific Wait Strategies:**

```typescript
// Amazon - wait for price element
async function scrapeAmazon(page: Page) {
  await page.waitForSelector('#priceblock_ourprice, #priceblock_dealprice, .a-price .a-offscreen', {
    state: 'visible',
    timeout: 15000,
  });
}

// Best Buy - wait for AJAX content
async function scrapeBestBuy(page: Page) {
  await page.waitForSelector('[data-testid="customer-price"]', {
    state: 'visible',
    timeout: 15000,
  });
}

// Walmart - wait for dynamic pricing
async function scrapeWalmart(page: Page) {
  await page.waitForSelector('[itemprop="price"]', {
    state: 'visible',
    timeout: 15000,
  });
}
```

**When Fixed Timeout IS Appropriate:**

```typescript
// ✅ Rate limiting delay between requests (intentional)
await sleep(1000); // Respect rate limits

// ✅ Animation completion (no selector change)
await page.waitForTimeout(500); // Wait for price animation

// ✅ Debounce for user-like behavior
await page.waitForTimeout(randomInt(100, 300)); // Human-like delay
```

## Checklist

- [ ] All `waitForTimeout` instances audited
- [ ] Unnecessary waits replaced with conditions
- [ ] Appropriate timeouts added to all waits
- [ ] Remaining fixed waits documented with rationale
- [ ] Scraping performance improved

## Success Criteria

- [ ] `grep -r "waitForTimeout" server/scrapers/` returns minimal results
- [ ] Remaining `waitForTimeout` calls have documented reasons
- [ ] Scraping success rate unchanged or improved
- [ ] Average scrape time reduced
- [ ] All tests pass

## Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Wrong selector breaks scraping | Medium | Medium | Test each retailer after changes |
| Timeout too short | Medium | Low | Start with generous timeouts, tune later |
| Site structure changes | Low | Medium | Monitor scrape failures, alert on patterns |

---

## ✅ PRE-CLOSE VERIFICATION CHECKLIST (MANDATORY)

**Before marking this TODO as complete, verify ALL of the following:**

### Code Verification
- [ ] **Grep verification**: Audit waitForTimeout usage
  ```bash
  # Count remaining waitForTimeout calls
  grep -rn "waitForTimeout" server/scrapers/ server/services/scraper-service.ts
  # Should be minimal, each with documented reason
  
  # Verify waitForSelector is used
  grep -rn "waitForSelector" server/scrapers/ server/services/scraper-service.ts
  # Should show condition-based waits
  ```

- [ ] **File inspection**: Review scraper wait patterns
  ```bash
  # Check each scraper file
  for f in server/scrapers/*.ts; do
    echo "=== $f ===" 
    grep -n "waitFor" "$f"
  done
  ```

### Testing
- [ ] **Run affected tests**: Execute scraper tests
  ```bash
  npm test -- scraper
  ```

- [ ] **Performance comparison**: Measure scrape times
  ```bash
  # Before changes
  time curl -X POST http://localhost:5000/api/scrape -d '{"url":"https://amazon.com/dp/..."}'
  
  # After changes (should be faster or similar)
  time curl -X POST http://localhost:5000/api/scrape -d '{"url":"https://amazon.com/dp/..."}'
  ```

### Build & Type Safety
- [ ] **TypeScript compilation**: Ensure no type errors
  ```bash
  npm run check
  ```

- [ ] **ESLint check**: Verify no linting errors
  ```bash
  npm run lint
  ```

---

## ✅ RESOLUTION (YYYY-MM-DD)

**Decision**: [To be completed]

### Summary

[To be completed upon resolution]

### Changes Made

[To be completed upon resolution]

### Verification Results

[To be completed upon resolution]

---

**Created by**: Claude Code (Security Audit)
**Completion Date**: TBD
**Actual Time**: TBD
