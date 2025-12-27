# TODO 003: Optimize Price Aggregation Date Range Loop (N+1 Pattern)

**Status:** pending
**Priority:** P1 (Critical)
**Created:** 2025-12-26
**Tags:** performance, database, n+1-query, optimization

---

## Problem Statement

The price aggregation service processes one day per transaction in a loop, creating an N+1 query pattern for date range aggregations. For a 90-day aggregation, this results in 90 separate transactions taking ~9 seconds instead of a single bulk operation taking ~500ms.

**Why This Matters:**
- **Performance:** 90-day aggregation = 9 seconds (90 transactions × 100ms)
- **Scalability:** At 10x scale, daily aggregations could take minutes
- **Resource Usage:** 90 database connections instead of 1
- **User Experience:** Slow analytics dashboard loads

---

## Findings

**Source:** Performance Oracle Agent Review (2025-12-26)

**Problematic Code:**
```typescript
// File: server/services/price-aggregation-service.ts:733-895
// Function: aggregateToDaily()

while (currentDate <= endDate) {
  await db.transaction(async (tx) => {
    // Query for this single day
    const priceData = await tx.select(...)
      .from(priceHistory)
      .where(gte(priceHistory.recordedAt, dayStart))
      .where(lt(priceHistory.recordedAt, dayEnd));

    // Aggregate and insert for this day
    if (priceData.length > 0) {
      await tx.insert(priceAggregatesDaily).values(aggregates);
    }
  });

  // Move to next day
  currentDate.setUTCDate(currentDate.getUTCDate() + 1);
}
```

**Current Performance:**
- 1-day range: ~100ms ✅
- 7-day range: ~700ms ⚠️
- 30-day range: ~3 seconds ⚠️
- 90-day range: ~9 seconds ❌

**Expected Performance After Fix:**
- 90-day range: ~500ms (95% improvement)

---

## Proposed Solutions

### Solution 1: Single Transaction with Date Bucketing (Recommended)

**Pros:**
- 90-95% performance improvement
- Single transaction (ACID guarantees maintained)
- Database-level aggregation (efficient)
- Bulk insert (one round-trip)

**Cons:**
- More complex SQL
- Need to handle empty days

**Effort:** 4-5 hours
**Risk:** Medium (complex SQL, needs thorough testing)

**Implementation:**
```typescript
async aggregateToDaily(startDate: Date, endDate: Date): Promise<number> {
  return await this.db.transaction(async (tx) => {
    // Single query with date bucketing
    const allDayAggregates = await tx
      .select({
        date: sql<string>`DATE(${priceHistory.recordedAt})`,
        productId: priceHistory.productId,
        avgPrice: sql<number>`AVG(CAST(${priceHistory.price} AS DECIMAL))`,
        minPrice: sql<number>`MIN(CAST(${priceHistory.price} AS DECIMAL))`,
        maxPrice: sql<number>`MAX(CAST(${priceHistory.price} AS DECIMAL))`,
        recordCount: sql<number>`COUNT(*)`,
      })
      .from(priceHistory)
      .where(
        and(
          gte(priceHistory.recordedAt, startDate),
          lte(priceHistory.recordedAt, endDate),
          isNull(priceHistory.aggregatedAt)
        )
      )
      .groupBy(
        sql`DATE(${priceHistory.recordedAt})`,
        priceHistory.productId
      );

    if (allDayAggregates.length === 0) return 0;

    // Bulk insert all aggregates at once
    await tx.insert(priceAggregatesDaily).values(
      allDayAggregates.map(agg => ({
        date: new Date(agg.date),
        productId: agg.productId,
        averagePrice: agg.avgPrice.toString(),
        lowestPrice: agg.minPrice.toString(),
        highestPrice: agg.maxPrice.toString(),
        dataPoints: agg.recordCount,
      }))
    );

    // Mark all processed records as aggregated
    await tx.update(priceHistory)
      .set({ aggregatedAt: new Date() })
      .where(
        and(
          gte(priceHistory.recordedAt, startDate),
          lte(priceHistory.recordedAt, endDate),
          isNull(priceHistory.aggregatedAt)
        )
      );

    return allDayAggregates.length;
  });
}
```

### Solution 2: Batch Processing (10-day chunks)

**Pros:**
- Incremental improvement
- Easier to implement
- Less complex SQL

**Cons:**
- Still requires multiple transactions
- Only 10x improvement (9s → 900ms)
- More complex retry logic

**Effort:** 2-3 hours
**Risk:** Low

### Solution 3: Parallel Transaction Processing

**Pros:**
- Utilizes multiple DB connections
- Could achieve 5-10x improvement

**Cons:**
- Complex concurrency management
- Risk of deadlocks
- Harder to test

**Effort:** 6-8 hours
**Risk:** High

---

## Recommended Action

**Implement Solution 1** (Single Transaction with Date Bucketing)

**Rationale:**
- Maximum performance improvement (95%)
- Maintains ACID properties
- Database-level aggregation (PostgreSQL optimized)
- Standard SQL pattern
- Single code path (easier to maintain)

---

## Technical Details

**Affected Files:**
- `server/services/price-aggregation-service.ts` (lines 733-895)
- Test file: `server/services/__tests__/price-aggregation-service.test.ts`

**Database Changes:** None (uses existing schema)

**Migration Required:** No

**Backward Compatibility:** Fully compatible (internal optimization)

---

## Acceptance Criteria

- [ ] Refactor `aggregateToDaily()` to use single transaction
- [ ] Implement date bucketing with `GROUP BY DATE(recorded_at)`
- [ ] Bulk insert all daily aggregates in one operation
- [ ] Mark all processed price_history records as aggregated
- [ ] Add integration test for 90-day aggregation
- [ ] Verify performance: 90-day range < 1 second
- [ ] Test edge cases (empty days, single-day range)
- [ ] Verify existing functionality unchanged
- [ ] Update aggregation metrics to track batch performance
- [ ] Document pattern in `docs/02_DATABASE_PATTERNS.md`

**Performance Benchmarks:**
- [ ] 1-day range: < 100ms
- [ ] 7-day range: < 200ms
- [ ] 30-day range: < 500ms
- [ ] 90-day range: < 1000ms (9x improvement)

---

## Work Log

**2025-12-26:** Issue identified during performance audit - N+1 pattern in date loop

---

## Resources

- [PostgreSQL Date/Time Functions](https://www.postgresql.org/docs/current/functions-datetime.html)
- [Drizzle ORM Aggregation](https://orm.drizzle.team/docs/select#aggregations)
- File: `server/services/price-aggregation-service.ts`
- Pattern: `docs/02_DATABASE_PATTERNS.md` (Section 3: N+1 Prevention)
- Performance Audit Report: 2025-12-26
