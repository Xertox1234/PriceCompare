---
status: pending
priority: p1
issue_id: "003"
tags: [code-review, performance, database, scalability]
dependencies: []
---

# Add Critical Database Indexes for Performance

## Problem Statement

Missing database indexes on frequently queried columns will cause severe performance degradation at scale. Full-text search without GIN index and price history queries without composite index will become unacceptably slow as data grows.

## Findings

- **Discovered by**: performance-oracle agent
- **Severity**: HIGH (Performance Blocker at Scale)

### Finding 1: Missing GIN Index on search_vector
- **Location**: `shared/schema.ts` (search_vector column), `server/storage.ts:483-490` (query)
- **Impact**: 10-100x slower search at scale

**Current Performance (without GIN index)**:
- 1,000 products: ~50-100ms
- 10,000 products: ~500ms-1s
- 100,000 products: ~5-10s ⚠️ UNACCEPTABLE

**With GIN Index**:
- 100,000 products: ~10-50ms ✓ EXCELLENT

### Finding 2: Missing Composite Index on price_history
- **Location**: `shared/schema.ts` (lines 86-90), `server/services/price-history-service.ts:668-692`
- **Impact**: 5-10x slower price history queries

**Current**: Individual indexes on `productId` and `recordedAt`
**Problem**: PostgreSQL uses only ONE index, then filters in memory

**Query Pattern**:
```typescript
where(and(
  eq(priceHistory.productId, productId),
  gte(priceHistory.recordedAt, startDate)
))
```

**Current Performance**:
- Product with 1,000 history records: ~20-50ms (acceptable)
- Product with 10,000 records: ~100-200ms (degrading)
- Product with 100,000 records: ~1-2s ⚠️ POOR

## Proposed Solutions

### Solution 1: Add GIN Index for Full-Text Search
**Migration SQL**:
```sql
-- Migration: add-gin-index-to-search-vector.sql
CREATE INDEX CONCURRENTLY idx_products_search_vector
ON products USING GIN(search_vector);
```

**Benefits**:
- 10-100x faster full-text search
- Handles 100K+ products efficiently
- Uses PostgreSQL's optimized GIN index structure

**Risks**:
- Index creation takes ~30 seconds for 100K products (use CONCURRENTLY to avoid locking)
- Increases disk usage by ~5-10%

### Solution 2: Add Composite Index for Price History
**Migration SQL**:
```sql
-- Migration: add-composite-index-to-price-history.sql
CREATE INDEX CONCURRENTLY idx_price_history_product_date_composite
ON price_history(product_id, recorded_at DESC);
```

**Benefits**:
- 5-10x faster price history queries
- Optimal for date range queries
- DESC ordering matches query pattern

**Risks**:
- Index creation takes ~10-20 seconds for 1M records
- Increases disk usage by ~3-5%

## Recommended Action

Create both indexes immediately. Use `CONCURRENTLY` option to avoid locking tables during index creation.

## Technical Details

- **Affected Files**:
  - `shared/schema.ts` (add index definitions to Drizzle schema)
  - New migration files in DB migrations directory
- **Related Components**:
  - Product search functionality
  - Price history charts
  - Analytics queries
- **Database Changes**: 2 new indexes
- **Downtime**: None (CONCURRENT index creation)

## Acceptance Criteria

- [ ] Create migration file for GIN index on search_vector
- [ ] Create migration file for composite index on price_history
- [ ] Add index definitions to Drizzle schema
- [ ] Test migration on development database
- [ ] Verify index is used: `EXPLAIN ANALYZE` on search query
- [ ] Benchmark search performance before/after
- [ ] Verify price history query performance
- [ ] Document index strategy in ARCHITECTURE.md
- [ ] Add monitoring for index usage statistics

## Work Log

### 2025-11-17 - Code Review Discovery
**By:** Claude Code Review System (performance-oracle agent)
**Actions:**
- Analyzed database schema and query patterns
- Identified missing indexes as critical performance bottleneck
- Projected performance degradation at scale
- Calculated expected improvement with proper indexes

**Learnings:**
- Full-text search MUST use GIN index for production scale
- Composite indexes needed for multi-column WHERE clauses
- Index order matters (product_id first, then recorded_at)
- Use CONCURRENTLY to avoid locking during creation

## Migration Template

```typescript
// scripts/migrations/YYYYMMDD_add_performance_indexes.ts
import { sql } from 'drizzle-orm';
import { db } from '../server/db';

export async function up() {
  // Add GIN index for full-text search
  await db.execute(sql`
    CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_products_search_vector
    ON products USING GIN(search_vector);
  `);

  // Add composite index for price history
  await db.execute(sql`
    CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_price_history_product_date
    ON price_history(product_id, recorded_at DESC);
  `);
}

export async function down() {
  await db.execute(sql`DROP INDEX IF EXISTS idx_products_search_vector;`);
  await db.execute(sql`DROP INDEX IF EXISTS idx_price_history_product_date;`);
}
```

## Benchmarking Plan

**Before Indexes**:
```bash
# Insert 10K products with search vectors
# Measure search query time
time psql -c "SELECT * FROM products WHERE search_vector @@ plainto_tsquery('english', 'laptop');"
```

**After Indexes**:
```bash
# Run same query, measure improvement
# Verify index usage
EXPLAIN ANALYZE SELECT * FROM products WHERE search_vector @@ plainto_tsquery('english', 'laptop');
```

**Expected Results**:
- Search: 10-50x faster
- Price history: 5-10x faster
- Index creation: < 1 minute

## Resources

- PostgreSQL GIN Indexes: https://www.postgresql.org/docs/current/gin.html
- Full-Text Search Performance: https://www.postgresql.org/docs/current/textsearch-indexes.html
- Composite Index Best Practices: https://www.postgresql.org/docs/current/indexes-multicolumn.html

## Notes

- Source: Performance analysis performed on 2025-11-17
- Priority: HIGH - Critical for production scalability
- Estimated effort: 2 hours (including testing)
- No application code changes needed
- Safe to deploy during production (CONCURRENTLY)
