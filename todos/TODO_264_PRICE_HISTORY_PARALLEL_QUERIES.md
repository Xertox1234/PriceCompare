# TODO 264: Parallelize Price History Queries

**Priority**: P3 - Nice-to-Have (Performance)
**Effort**: Small (~15 minutes)
**Category**: Performance
**Source**: Code Review - Performance Oracle Agent
**Branch**: add_scraping

## Problem Statement

`getPriceHistoryOptimized` (Strategy 4: 1+ years) executes multiple sequential database queries for different time ranges instead of running them in parallel.

## Findings

### Sequential Queries (price-storage.ts:251-276)
```typescript
// Strategy 4: 1+ years - 4 sequential queries
const recentRaw = await this.getRawPriceHistoryNormalized(...);
const dailyAgg = await this.getDailyAggregatesNormalized(...);
const weeklyAgg = await this.getWeeklyAggregatesNormalized(...);
const monthlyAgg = await this.getMonthlyAggregatesNormalized(...);
```

Each query waits for the previous one to complete, but they're independent and could run in parallel.

## Impact

- 4 sequential database round trips instead of 1 parallel batch
- Increased latency for year+ price history requests
- Estimated 3-4x improvement possible with parallel execution

## Proposed Solution

Use `Promise.all()` for independent queries:

```typescript
// Strategy 4: 1+ years - parallel execution
const [recentRaw, dailyAgg, weeklyAgg, monthlyAgg] = await Promise.all([
  this.getRawPriceHistoryNormalized(offerId, thirtyDaysAgo, now),
  this.getDailyAggregatesNormalized(offerId, ninetyDaysAgo, thirtyDaysAgo),
  this.getWeeklyAggregatesNormalized(offerId, oneYearAgo, ninetyDaysAgo),
  this.getMonthlyAggregatesNormalized(offerId, startDate, oneYearAgo),
]);
```

## Acceptance Criteria

- [ ] Strategy 4 queries run in parallel
- [ ] No change to result data
- [ ] Benchmark shows latency improvement

## Files to Modify

- `server/storage/domains/price-storage.ts` (lines 251-276)

## Work Log

| Date | Action | Notes |
|------|--------|-------|
| 2026-01-23 | Created | From code review - performance oracle agent |
| 2026-01-23 | **APPROVED** | Triage session - ready to work on |

## Resources

- Price storage: `server/storage/domains/price-storage.ts`
