---
status: ready
priority: p1
issue_id: "010"
tags: [performance, database, n-plus-1, optimization, code-review]
dependencies: []
---

# Fix N+1 Query in generateDailySnapshots

## Problem Statement

**CRITICAL PERFORMANCE BOTTLENECK**: The `generateDailySnapshots()` function performs individual database queries inside a loop to check for existing snapshots. This classic N+1 query pattern causes the daily snapshot job to take **25 seconds** when it should take **0.5 seconds**.

**Impact:** 50x slower than necessary, blocking other background jobs, causing timeouts.

## Findings

Discovered during comprehensive code audit by performance-oracle agent on 2025-11-18.

**Location:** `/server/services/price-history-service.ts:291-351`

**Problematic Code:**
```typescript
// Lines 305-351: generateDailySnapshots()
for (const [key, prices] of Array.from(groupedOffers.entries())) {
  const [productIdStr, retailerIdStr] = key.split('-');
  const productId = parseInt(productIdStr, 10);
  const retailerId = parseInt(retailerIdStr, 10);

  // ❌ N+1 QUERY: Database query inside loop!
  const existing = await db.select()
    .from(priceSnapshots)
    .where(and(
      eq(priceSnapshots.productId, productId),
      eq(priceSnapshots.retailerId, retailerId),
      sql`DATE(${priceSnapshots.snapshotDate}) = DATE(${snapshotDate})`
    ))
    .limit(1);

  if (existing.length === 0) {
    // Insert new snapshot
  } else {
    // Update existing snapshot
  }
}
```

**Performance Analysis:**
- **Products**: 1000 products
- **Retailers per product**: 5 retailers
- **Total combinations**: 5000
- **Query time per check**: ~5ms
- **Total time**: 5000 × 5ms = **25 seconds**

**Expected with batch query**: ~500ms (50x faster)

## Proposed Solutions

### Option 1: Batch Fetch All Snapshots (Recommended)

**Pros:**
- Single database query instead of 5000
- 50x performance improvement
- Simple to implement
- Maintains same logic

**Cons:** None

**Effort:** Medium (2-3 hours)

**Risk:** Low

**Implementation:**

```typescript
async generateDailySnapshots(snapshotDate?: Date): Promise<number> {
  const targetDate = snapshotDate || new Date();

  // Step 1: Get all offers grouped
  const groupedOffers = await this.groupOffersByProductRetailer(targetDate);

  // Step 2: BATCH FETCH ALL EXISTING SNAPSHOTS IN ONE QUERY
  const allExisting = await db
    .select()
    .from(priceSnapshots)
    .where(sql`DATE(${priceSnapshots.snapshotDate}) = DATE(${targetDate})`);

  // Step 3: Create Map for O(1) lookup
  const existingMap = new Map(
    allExisting.map(s => [`${s.productId}-${s.retailerId}`, s])
  );

  // Step 4: Process offers (no queries in loop!)
  const snapshots = [];
  for (const [key, prices] of groupedOffers) {
    const existing = existingMap.get(key); // O(1) lookup, no query!

    if (!existing) {
      snapshots.push(this.createSnapshot(key, prices, targetDate));
    } else {
      snapshots.push(this.updateSnapshot(existing, prices));
    }
  }

  // Step 5: Batch insert/update
  if (snapshots.length > 0) {
    await db.insert(priceSnapshots)
      .values(snapshots)
      .onConflictDoUpdate({
        target: [priceSnapshots.productId, priceSnapshots.retailerId, priceSnapshots.snapshotDate],
        set: { /* update fields */ }
      });
  }

  return snapshots.length;
}
```

### Option 2: Use Upsert with Single Query (Alternative)

**Pros:**
- Even simpler - no existence checking needed
- Database handles duplicates via ON CONFLICT

**Cons:**
- Requires composite unique constraint on (productId, retailerId, snapshotDate)

**Effort:** Small (1-2 hours)

## Recommended Action

**HIGH PRIORITY - OPTIMIZE DAILY JOB**

1. Implement Option 1 (batch fetch)
2. Add composite unique constraint for Option 2 in future
3. Test with production data volume
4. Monitor job execution time (should be <1 second)

## Technical Details

**Affected Files:**
- `/server/services/price-history-service.ts` (Lines 291-351)

**Related Components:**
- Daily snapshot cron job
- Price tracking background jobs

**Database Changes:** None required for Option 1, unique constraint for Option 2

## Resources

- N+1 Query Pattern: https://planetscale.com/learn/courses/mysql-for-developers/queries/n-1-queries
- Drizzle ORM Upserts: https://orm.drizzle.team/docs/insert#on-conflict-do-update

## Acceptance Criteria

- [ ] Replace loop queries with single batch fetch
- [ ] Create Map for O(1) existence checking
- [ ] Test with 5000+ product-retailer combinations
- [ ] Measure execution time - should be <1 second
- [ ] Verify no data loss during migration
- [ ] Run full test suite - all tests pass
- [ ] Monitor production job logs for improved timing

## Work Log

### 2025-11-18 - Performance Audit Discovery
**By:** Claude Code Review System (performance-oracle agent)
**Actions:**
- Identified N+1 query pattern in generateDailySnapshots
- Calculated 25 second execution time impact
- Estimated 50x performance improvement potential
- Categorized as P1 CRITICAL for performance

**Learnings:**
- Always batch fetch data before loops
- Use Map for O(1) lookups instead of repeated queries
- Consider upsert patterns to eliminate existence checking entirely

## Notes

**PERFORMANCE**: While 25 seconds may not seem critical for a daily job, it:
1. Blocks other background jobs in the queue
2. Consumes database connections unnecessarily
3. Could timeout if data volume increases
4. Wastes server resources

This is a textbook N+1 query and should be fixed immediately. The pattern is well-known and the fix is straightforward.

**Testing**: After implementing, compare execution times:
```typescript
// Before fix:
console.time('generateDailySnapshots');
await generateDailySnapshots();
console.timeEnd('generateDailySnapshots');
// Output: generateDailySnapshots: 25000ms

// After fix:
// Output: generateDailySnapshots: 500ms ✅
```

Source: Comprehensive code audit performed on 2025-11-18
