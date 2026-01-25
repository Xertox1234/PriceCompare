# TODO 273: Add Composite Index on price_history(product_id, recorded_at)

**Priority**: P2 (IMPORTANT - Performance)
**File(s)**: `migrations/0033_add_price_history_composite_index.sql` (new)
**Estimated Time**: 30 minutes
**Status**: RESOLVED - Indexes Already Exist
**Resolved Date**: 2026-01-25
**Source**: Code Review 2026-01-23 (Multi-Agent Analysis)

## Problem Statement

The `price_history` table lacks a composite index for the common query pattern of fetching price history by product and date range. Migration 0029 added FK indexes but missed this critical access pattern.

## Root Cause

The FK index on `product_id` alone doesn't optimize date range queries. Common queries scan the entire price_history table when filtering by both product_id AND recorded_at.

## Evidence

**Common Query Pattern (price-storage.ts:752-764):**
```typescript
// Frequently used pattern
WHERE product_offer_id IN (
  SELECT id FROM product_offers WHERE product_id = ?
)
AND recorded_at >= ?
ORDER BY recorded_at DESC
```

**Impact at Scale:**
- Current: Full table scan for date-filtered queries
- With 10M+ rows: 500ms+ query time
- With composite index: <5ms query time

## Solution Approach

Create migration to add composite index covering both columns in optimal order.

## Implementation Steps

### Step 1: Create Migration

- [ ] Create `migrations/0033_add_price_history_composite_index.sql`
- [ ] Add composite index with DESC order on recorded_at

### Step 2: Verify Query Plans

- [ ] Test EXPLAIN ANALYZE before/after
- [ ] Verify index is used for common queries

## Technical Details

**Migration:**
```sql
-- Migration 0033: Add composite index for price history date range queries
-- Optimizes: SELECT * FROM price_history
--            WHERE product_offer_id = ? AND recorded_at >= ?
--            ORDER BY recorded_at DESC

CREATE INDEX CONCURRENTLY IF NOT EXISTS
  idx_price_history_offer_recorded
  ON price_history(product_offer_id, recorded_at DESC);

-- Also add index for direct product lookups via subquery
-- This helps when joining price_history with product_offers
CREATE INDEX CONCURRENTLY IF NOT EXISTS
  idx_price_history_recorded_at
  ON price_history(recorded_at DESC);
```

**Note:** Using `CONCURRENTLY` for production safety (doesn't lock table).

## Checklist

- [ ] Migration created with CONCURRENTLY
- [ ] Index naming follows convention
- [ ] EXPLAIN ANALYZE shows index usage
- [ ] No performance regression on inserts
- [ ] E2E helpers updated with new migration

## Success Criteria

- [ ] Query `SELECT * FROM price_history WHERE product_offer_id = X AND recorded_at >= Y` uses index
- [ ] Query time reduced from 500ms to <5ms on large dataset
- [ ] Insert performance not significantly degraded

---

**Created by**: Code Review Multi-Agent Analysis
**Creation Date**: 2026-01-23
**Agents**: performance-oracle

---

## Resolution Notes (2026-01-25)

**Status: NO ACTION NEEDED - Indexes Already Exist**

Investigation revealed that the requested indexes were already created in migration `0004_add_price_history.sql`:

### Existing Indexes (Migration 0004)

1. **`idx_price_history_offer_id`** on `(product_offer_id, recorded_at DESC)` - Line 25
   - Functionally equivalent to requested `idx_price_history_offer_recorded`
   - Optimizes: `WHERE product_offer_id = ? AND recorded_at >= ? ORDER BY recorded_at DESC`

2. **`idx_price_history_recorded_at`** on `(recorded_at DESC)` - Line 31
   - Exact index requested already exists
   - Optimizes: time-series queries and `ORDER BY recorded_at DESC`

### Additional Existing Indexes

Migration 0004 also created these related indexes:
- `idx_price_history_product_id` on `(product_id, recorded_at DESC)`
- `idx_price_history_retailer_id` on `(retailer_id, recorded_at DESC)`
- `idx_price_history_product_retailer_time` on `(product_id, retailer_id, recorded_at DESC)`
- `idx_price_history_product_price` on `(product_id, CAST(price AS DECIMAL))`

### Conclusion

The code review tool did not detect that migration 0004 (created 2025-11-11) already includes comprehensive indexing for the `price_history` table. No new migration is needed.

**Verified by**: Code Review Resolution Specialist
**Resolution**: Closed as duplicate - indexes exist in migration 0004
