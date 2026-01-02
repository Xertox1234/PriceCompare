# Updated: PriceCompare Subagent Team - Playwright Edition

## Changes Made ✨

Your subagent setup has been updated to use **Playwright** instead of Puppeteer throughout.

### What Changed:

1. **All references updated** - Puppeteer → Playwright in all documentation
2. **New Scraper Expert Agent** - Full dedicated agent for Playwright web scraping
3. **Playwright MCP Integration** - Documentation on using Playwright via MCP server
4. **8 Specialized Agents** - Now includes dedicated scraper-expert

## Your 8 Subagent Team

| # | Agent | Focus |
|---|-------|-------|
| 1 | **orchestrator** | Strategic coordinator (NEVER implements) |
| 2 | **backend-architect** | Node.js/Express/PostgreSQL/Redis/Bull queues |
| 3 | **frontend-specialist** | React 19/Vite/React Query/Recharts |
| 4 | **database-engineer** | PostgreSQL/Drizzle ORM/migrations |
| 5 | **extension-builder** | Chrome Extension Manifest V3 |
| 6 | **scraper-expert** | **Playwright browser automation (NEW!)** |
| 7 | **test-engineer** | Vitest/React Testing Library |
| 8 | **security-auditor** | Security reviews and audits |

## New Scraper Expert Features 🕷️

The scraper-expert agent now includes:

### Playwright MCP Integration
```typescript
// Uses Playwright MCP server tools:
// - playwright_navigate
// - playwright_screenshot  
// - playwright_click
// - playwright_fill
// - playwright_evaluate
// - playwright_get_text
```

### Advanced Scraping Patterns
- **Robust selector strategies** (data attributes → IDs → classes → text)
- **Rate limiting & politeness** (2+ second delays)
- **Anti-bot handling** (user agents, viewport, headers)
- **Error recovery** (screenshots, retries, exponential backoff)
- **Site-specific scrapers** (Amazon, Walmart, etc.)

### Best Practices
- Fallback selector chains
- Headless browser optimization
- Screenshot capture on failures
- Price format normalization
- Distributed scraping with Bull queues
- Redis-based scraper state management

## Example Usage

### Implementing a New Scraper
```bash
Use scraper-expert to implement a Walmart product scraper.
The scraper should:
- Navigate to Walmart product URLs
- Extract product name, price, and availability
- Handle out-of-stock scenarios
- Use Playwright MCP tools for automation
- Add rate limiting (2 seconds between requests)
```

### Fixing Broken Selectors
```bash
Use scraper-expert to fix the Amazon price extractor.
The current selector '[data-testid="price"]' is failing.
File: src/scrapers/amazon-scraper.ts
```

### Handling Anti-Bot Measures
```bash
Use scraper-expert to improve the scraper's bot detection avoidance.
We're getting blocked on BestBuy. Add proper headers and delays.
File: src/scrapers/bestbuy-scraper.ts
```

## Playwright vs Puppeteer: Why the Upgrade Matters

| Feature | Puppeteer | Playwright |
|---------|-----------|------------|
| Browser Support | Chrome/Chromium | Chrome, Firefox, WebKit |
| Auto-wait | Manual | Built-in |
| Parallel contexts | Limited | Excellent |
| Mobile emulation | Basic | Advanced |
| Network interception | Basic | Advanced |
| Debugging | Good | Excellent |
| Multi-tab handling | Manual | Automatic |
| Community | Large | Growing rapidly |

## Setup - Same as Before!

```bash
cd /path/to/pricecompare
bash setup-subagents.sh
```

The setup script now creates the scraper-expert agent with Playwright patterns.

## Updated Files

All three files have been updated:

1. ✅ **claude-code-subagent-setup-guide.md** - Full guide with Playwright
2. ✅ **setup-subagents.sh** - Creates scraper-expert with Playwright
3. ✅ **subagent-quick-reference.md** - Quick reference updated

## Playwright MCP Server Setup

Make sure you have the Playwright MCP server enabled in Claude Code:

1. Check enabled MCP servers: `/mcp list`
2. If not enabled: `/mcp enable playwright`
3. Verify: `/context` (should show Playwright tools)

## Key Scraper Patterns with Playwright

### Pattern 1: Robust Price Extraction
```typescript
async function extractPrice(page: Page): Promise<number | null> {
  const selectors = [
    '[data-testid="product-price"]',  // Most stable
    '#price',                           // ID-based
    '.product-price',                   // Class-based
    'text=/\\$[0-9,]+\\.?[0-9]*/'      // Text pattern fallback
  ];
  
  for (const selector of selectors) {
    try {
      const element = page.locator(selector).first();
      const text = await element.textContent();
      if (text) return parsePrice(text);
    } catch {
      continue;
    }
  }
  return null;
}
```

### Pattern 2: Rate-Limited Scraping
```typescript
const SCRAPE_DELAY = 2000; // 2 seconds
const MAX_RETRIES = 3;

async function scrapeWithBackoff(url: string) {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      await new Promise(r => setTimeout(r, SCRAPE_DELAY));
      return await performScrape(url);
    } catch (error) {
      if (attempt === MAX_RETRIES) throw error;
      await new Promise(r => 
        setTimeout(r, SCRAPE_DELAY * Math.pow(2, attempt))
      );
    }
  }
}
```

### Pattern 3: Anti-Bot Headers
```typescript
const context = await browser.newContext({
  userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
  viewport: { width: 1920, height: 1080 },
  locale: 'en-US',
  timezoneId: 'America/Edmonton'
});

await context.setExtraHTTPHeaders({
  'Accept-Language': 'en-US,en;q=0.9',
  'Accept-Encoding': 'gzip, deflate, br'
});
```

## Integration with Your Tech Stack

The scraper-expert integrates seamlessly with PriceCompare:

- **Bull Queues** - Schedule scraping jobs
- **Redis** - Cache scraper state and results
- **PostgreSQL** - Store scraped product data via Drizzle ORM
- **Express API** - Trigger scrapes via API endpoints
- **Extension** - Scrape from user's current browser tab

## Token Savings Still Apply! 💰

The scraper-expert operates in its own context, so:
- **Orchestrator stays clean** (~10-20K tokens)
- **Scraper work isolated** (~20-30K tokens, then discarded)
- **No scraping noise** in main conversation
- **50-70% token savings** maintained

## Next Steps

1. Run the updated setup script
2. Test the scraper-expert: 
   ```
   Use scraper-expert to create a simple test scraper for 
   https://example.com that extracts the page title.
   ```
3. Review the full Playwright patterns in the guide
4. Start building your production scrapers!

---

**You're now ready to build robust, maintainable scrapers with Playwright!** 🚀
