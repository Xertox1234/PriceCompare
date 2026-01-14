# TODO 216: Browser Context Memory Leaks in Scrapers

**Priority**: P1 - HIGH
**File(s)**: `server/services/scraper-service.ts`, `server/scrapers/*.ts`
**Estimated Time**: 1 hour
**Status**: Not Started
**Created Date**: 2026-01-14
**Source**: Security Audit (2026-01-14)

## Problem Statement

Browser instances are not always closed on error paths, leading to memory leaks that accumulate over time and eventually crash the server. Each Playwright browser instance uses ~100MB RAM.

**Operational Impact**: 
- Server memory exhaustion after prolonged operation
- OOM kills in production
- Degraded scraping performance
- Service restarts required

## Root Cause

Browser cleanup code is in the happy path only, not in a `finally` block. When navigation timeouts, selector errors, or other exceptions occur, the browser instance is never closed.

## Solution Approach

1. Wrap all browser operations in try/finally blocks
2. Ensure browser.close() is always called, even on error
3. Add error handling for browser.close() itself
4. Consider browser pooling for efficiency

## Implementation Steps

### Step 1: Fix Browser Cleanup Pattern

- [ ] Wrap all scraper functions in try/finally
- [ ] Move browser.close() to finally block
- [ ] Add catch handler for browser.close() errors

### Step 2: Audit All Scraper Files

- [ ] Review `server/services/scraper-service.ts`
- [ ] Review all files in `server/scrapers/`
- [ ] Fix any instances missing proper cleanup

### Step 3: Add Browser Pool (Optional Enhancement)

- [ ] Consider implementing browser pooling for efficiency
- [ ] Reuse browser contexts instead of launching new browsers
- [ ] Add pool size limits and cleanup strategy

### Step 4: Add Monitoring

- [ ] Log browser launch/close for debugging
- [ ] Add metrics for browser instance count
- [ ] Alert on high browser count

## Technical Details

**Current Implementation (LEAKY):**
```typescript
export async function scrapeProductPrice(url: string): Promise<ScrapedData> {
  const browser = await playwright.chromium.launch();
  const page = await browser.newPage();
  
  await page.goto(url);
  const price = await page.locator('.price').textContent();
  
  await browser.close(); // ❌ Not called if goto() or locator() throws!
  return { price };
}
```

**Fixed Implementation:**
```typescript
import { chromium, Browser, BrowserContext, Page } from 'playwright';

export async function scrapeProductPrice(url: string): Promise<ScrapedData> {
  // Validate URL first (see TODO_210)
  const validatedUrl = validateScraperUrl(url);
  
  let browser: Browser | null = null;
  
  try {
    browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    });
    
    const context = await browser.newContext({
      userAgent: getRandomUserAgent(),
      viewport: { width: 1920, height: 1080 },
      // Prevent detection
      javaScriptEnabled: true,
      ignoreHTTPSErrors: false,
    });
    
    const page = await context.newPage();
    
    // Use proper timeouts and wait conditions
    await page.goto(validatedUrl.toString(), {
      timeout: 30000,
      waitUntil: 'domcontentloaded',
    });
    
    // Wait for specific selector instead of arbitrary timeout
    await page.waitForSelector('.price', { 
      state: 'visible',
      timeout: 10000 
    });
    
    const priceText = await page.locator('.price').textContent();
    const price = parsePrice(priceText);
    
    return { price, scrapedAt: new Date() };
    
  } catch (error) {
    // Log error for debugging
    console.error(`Scraping failed for ${url}:`, {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    });
    
    // Re-throw with context
    throw new ScrapingError(`Failed to scrape ${url}`, { cause: error });
    
  } finally {
    // ✅ ALWAYS close browser, even on error
    if (browser) {
      try {
        await browser.close();
      } catch (closeError) {
        // Log but don't throw - main error is more important
        console.error('Failed to close browser:', closeError);
      }
    }
  }
}
```

**Browser Pool Implementation (Optional):**
```typescript
// server/services/browser-pool.ts
import { chromium, Browser, BrowserContext } from 'playwright';

class BrowserPool {
  private browser: Browser | null = null;
  private contexts: BrowserContext[] = [];
  private maxContexts = 10;
  
  async getContext(): Promise<BrowserContext> {
    if (!this.browser) {
      this.browser = await chromium.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      });
    }
    
    // Clean up old contexts if at limit
    if (this.contexts.length >= this.maxContexts) {
      const oldContext = this.contexts.shift();
      await oldContext?.close();
    }
    
    const context = await this.browser.newContext({
      userAgent: getRandomUserAgent(),
    });
    
    this.contexts.push(context);
    return context;
  }
  
  async releaseContext(context: BrowserContext): Promise<void> {
    const index = this.contexts.indexOf(context);
    if (index > -1) {
      this.contexts.splice(index, 1);
    }
    await context.close();
  }
  
  async shutdown(): Promise<void> {
    for (const context of this.contexts) {
      await context.close().catch(() => {});
    }
    this.contexts = [];
    
    if (this.browser) {
      await this.browser.close().catch(() => {});
      this.browser = null;
    }
  }
}

export const browserPool = new BrowserPool();

// Register shutdown handler
process.on('SIGTERM', () => browserPool.shutdown());
process.on('SIGINT', () => browserPool.shutdown());
```

**Usage with Pool:**
```typescript
export async function scrapeProductPrice(url: string): Promise<ScrapedData> {
  const validatedUrl = validateScraperUrl(url);
  const context = await browserPool.getContext();
  
  try {
    const page = await context.newPage();
    await page.goto(validatedUrl.toString(), { timeout: 30000 });
    // ... scraping logic
    return { price };
  } finally {
    await browserPool.releaseContext(context);
  }
}
```

## Checklist

- [ ] All scrapers use try/finally pattern
- [ ] browser.close() in finally block
- [ ] browser.close() errors caught and logged
- [ ] No browser instances leaked on error
- [ ] Memory usage stable over time

## Success Criteria

- [ ] `grep -r "finally" server/scrapers/` shows all scrapers have finally blocks
- [ ] Memory usage doesn't grow unbounded during scraping
- [ ] Error paths properly clean up browser
- [ ] Graceful shutdown closes all browsers
- [ ] All tests pass

## Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Missed scraper file | Medium | High | Use grep to audit all files |
| browser.close() hangs | Low | Medium | Add timeout to close operation |
| Pool exhaustion | Low | Medium | Add queue for pool requests |

---

## ✅ PRE-CLOSE VERIFICATION CHECKLIST (MANDATORY)

**Before marking this TODO as complete, verify ALL of the following:**

### Code Verification
- [ ] **Grep verification**: Confirm try/finally pattern exists
  ```bash
  # All scraper files should have finally blocks
  grep -rn "finally" server/services/scraper-service.ts server/scrapers/
  
  # browser.close should be in finally blocks
  grep -B 5 "browser.close" server/services/scraper-service.ts server/scrapers/ | grep "finally"
  
  # No browser.close outside of finally (except in pool shutdown)
  grep -n "browser.close" server/services/scraper-service.ts | grep -v "finally"
  ```

- [ ] **File inspection**: Review scraper cleanup patterns
  ```bash
  cat server/services/scraper-service.ts | grep -A 10 "finally"
  ```

### Testing
- [ ] **Run affected tests**: Execute scraper tests
  ```bash
  npm test -- scraper
  ```

- [ ] **Memory leak test**: Run multiple scrapes and check memory
  ```bash
  # Before scraping
  ps aux | grep node | awk '{print $6}'
  
  # Run 100 scrapes (including some that fail)
  for i in {1..100}; do
    curl -X POST http://localhost:5000/api/scrape -d '{"url":"https://example.com"}' &
  done
  wait
  
  # After scraping - memory should be similar
  ps aux | grep node | awk '{print $6}'
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
