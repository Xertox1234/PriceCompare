# TODO 004: Optimize Gap Detection Query (365-day = 730 queries)

**Status:** pending
**Priority:** P1 (Critical)
**Created:** 2025-12-26
**Tags:** performance, database, n+1-query, optimization

---

## Problem Statement

The gap detection function checks every single day in a date range with 2 database queries per day, resulting in 730 queries for a 365-day check. This takes ~15 seconds for one year when a single aggregated query could complete in ~150ms (99% improvement).

**Why This Matters:**
- **Performance:** 365-day check = 14.6 seconds (730 queries × 20ms)
- **Resource Usage:** 730 database round-trips
- **Scalability:** Impossible to run on-demand for users
- **Maintenance:** Currently only runs in background jobs

---

## Findings

**Source:** Performance Oracle Agent Review (2025-12-26)

**Problematic Code:**
```typescript
// File: server/services/price-aggregation-service.ts:933-963
// Function: detectGaps()

while (currentDate <= endDate) {
  const [hasRawData, hasAggregatedData] = await Promise.all([
    // Query 1: Check for raw price history
    db.select({ count: sql`count(*)` })
      .from(priceHistory)
      .where(
        and(
          gte(priceHistory.recordedAt, dayStart),
          lt(priceHistory.recordedAt, dayEnd)
        )
      ),

    // Query 2: Check for aggregated data
    db.select({ count: sql`count(*)` })
      .from(priceAggregatesDaily)
      .where(eq(priceAggregatesDaily.date, currentDate))
  ]);

  // Check if gap exists
  if (parseInt(hasRawData[0].count) > 0 &&
      parseInt(hasAggregatedData[0].count) === 0) {
    gaps.push(currentDate);
  }

  // Move to next day
  currentDate.setUTCDate(currentDate.getUTCDate() + 1);
}
```

**Current Performance:**
- 7-day check: ~280ms (14 queries)
- 30-day check: ~1.2 seconds (60 queries)
- 90-day check: ~3.6 seconds (180 queries)
- 365-day check: ~14.6 seconds (730 queries) ❌

**Expected Performance After Fix:**
- 365-day check: ~150ms (1 query, 99% improvement)

---

## Proposed Solutions

### Solution 1: Single Query with Date Bucketing (Recommended)

**Pros:**
- 99% performance improvement (14.6s → 150ms)
- Single query with LEFT JOIN
- Returns only gaps (no processing needed)
- Database-optimized aggregation

**Cons:**
- More complex SQL
- Different result format

**Effort:** 3-4 hours
**Risk:** Low (straightforward SQL pattern)

**Implementation:**
```typescript
async detectGaps(startDate: Date, endDate: Date): Promise<Date[]> {
  // Single query to find all gaps
  const gapDates = await this.db
    .select({
      date: sql<Date>`DATE(ph.recorded_at)`,
    })
    .from(priceHistory.as('ph'))
    .leftJoin(
      priceAggregatesDaily.as('pa'),
      sql`DATE(ph.recorded_at) = ${priceAggregatesDaily.date}`
    )
    .where(
      and(
        gte(sql`DATE(ph.recorded_at)`, startDate),
        lte(sql`DATE(ph.recorded_at)`, endDate),
        isNull(priceHistory.aggregatedAt) // Has raw data
      )
    )
    .groupBy(sql`DATE(ph.recorded_at)`)
    .having(
      and(
        sql`COUNT(ph.id) > 0`,           // Has raw price data
        sql`COUNT(pa.id) = 0`            // No aggregated data (gap!)
      )
    )
    .orderBy(sql`DATE(ph.recorded_at)`);

  return gapDates.map(row => row.date);
}
```

### Solution 2: CTE with Generate Series (PostgreSQL-Specific)

**Pros:**
- Handles days with no data at all
- Can detect missing days in raw data
- Most comprehensive approach

**Cons:**
- PostgreSQL-specific (not portable)
- More complex SQL
- Harder to understand

**Effort:** 5-6 hours
**Risk:** Medium

**Implementation:**
```sql
WITH date_range AS (
  SELECT generate_series(
    $1::date,
    $2::date,
    '1 day'::interval
  )::date AS date
),
raw_counts AS (
  SELECT DATE(recorded_at) as date, COUNT(*) as count
  FROM price_history
  WHERE recorded_at >= $1 AND recorded_at <= $2
  GROUP BY DATE(recorded_at)
),
agg_counts AS (
  SELECT date, COUNT(*) as count
  FROM price_aggregates_daily
  WHERE date >= $1 AND date <= $2
  GROUP BY date
)
SELECT dr.date
FROM date_range dr
LEFT JOIN raw_counts rc ON dr.date = rc.date
LEFT JOIN agg_counts ac ON dr.date = ac.date
WHERE rc.count > 0 AND (ac.count IS NULL OR ac.count = 0)
ORDER BY dr.date;
```

### Solution 3: Batch Processing (7-day chunks)

**Pros:**
- Easier migration path
- Incremental improvement

**Cons:**
- Only ~5x improvement (14.6s → 3s)
- Still requires many queries
- More complex batching logic

**Effort:** 2-3 hours
**Risk:** Low

---

## Recommended Action

**Implement Solution 1** (Single Query with LEFT JOIN)

**Rationale:**
- Maximum performance (99% improvement)
- Portable SQL (not PostgreSQL-specific)
- Returns exactly what we need (gap dates only)
- Leverages database indexes
- Simpler than CTE approach

---

## Technical Details

**Affected Files:**
- `server/services/price-aggregation-service.ts` (lines 933-963)
- Test: `server/services/__tests__/price-aggregation-service.test.ts`

**Database Changes:** None

**Indexes Used:**
- `price_history.recorded_at` (already indexed)
- `price_aggregates_daily.date` (primary key)

**Migration Required:** No

---

## Acceptance Criteria

- [ ] Refactor `detectGaps()` to use single query with LEFT JOIN
- [ ] Group by date with HAVING clause for gap detection
- [ ] Return array of gap dates (same interface as before)
- [ ] Add integration test with 365-day range
- [ ] Verify performance: 365-day check < 500ms
- [ ] Test edge cases (no gaps, all gaps, empty range)
- [ ] Verify existing gap-filling logic still works
- [ ] Update monitoring to track gap detection performance
- [ ] Document pattern in `docs/02_DATABASE_PATTERNS.md`

**Performance Benchmarks:**
- [ ] 7-day check: < 50ms
- [ ] 30-day check: < 100ms
- [ ] 90-day check: < 150ms
- [ ] 365-day check: < 500ms (30x improvement)

---

## Work Log

**2025-12-26:** Issue identified during performance audit - sequential loop with 2 queries/day

---

## Resources

- [PostgreSQL LEFT JOIN Documentation](https://www.postgresql.org/docs/current/tutorial-join.html)
- [Drizzle ORM Joins](https://orm.drizzle.team/docs/joins)
- File: `server/services/price-aggregation-service.ts`
- Pattern: `docs/02_DATABASE_PATTERNS.md` (Section 3)
- Performance Audit Report: 2025-12-26
