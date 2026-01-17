# TODO 240: Implement robots.txt Compliance for Scrapers

**Created**: 2026-01-16
**Completed**: 2026-01-16
**Priority**: High
**Category**: Security / Ethics / Legal
**Effort**: 1-2 hours
**Status**: COMPLETED

## Problem

The scraping agents do not check robots.txt before crawling retailer sites. While this is mentioned in documentation (`.claude/agents/scraper-expert.md`), it's not implemented in the actual code.

**Risk Level**: Medium-High (Legal/Ethical)

## Affected Files

- `server/agents/extraction-agent.ts`
- `server/utils/robots-txt-checker.ts` (NEW)

## Solution Implemented

### 1. Installed robots-parser package

```bash
npm install robots-parser --legacy-peer-deps
```

Note: `@types/robots-parser` not available on npm - the package includes its own TypeScript types in `index.d.ts`.

### 2. Created robots.txt utility

Created `server/utils/robots-txt-checker.ts` with:

- `isScrapingAllowed(url, userAgent)` - Checks if URL is allowed by robots.txt
- `getCrawlDelay(origin, userAgent)` - Gets crawl delay if specified
- `clearRobotsCache()` - Clears cache for testing
- `getRobotsCacheSize()` - Returns cache size for monitoring

Features:
- 1-hour cache TTL to minimize requests to origin servers
- 5-second timeout for robots.txt fetch
- Fail-open behavior (allows scraping if robots.txt unreachable)
- Logs warnings for disallowed URLs

### 3. Integrated into extraction agent

Added robots.txt check in `extractProductData()` method:
- Checks after URL validation, before browser launch
- Uses `PriceCompare Bot/1.0` as user agent for robots.txt check
- Throws error with clear message if scraping disallowed

## Acceptance Criteria

- [x] `robots-parser` package installed
- [x] `robots-txt-checker.ts` utility created
- [x] Extraction agent checks robots.txt before scraping
- [x] Results are cached to avoid repeated fetches
- [x] Crawl delay function available if specified
- [x] Disallowed URLs log warning and throw error
- [ ] Unit tests added (deferred - basic functionality verified)

## References

- [robots.txt specification](https://developers.google.com/search/docs/crawling-indexing/robots/intro)
- `.claude/agents/scraper-expert.md` (existing documentation)
