---
Guide: Database Performance Review
Version: 1.0
Last Updated: 2026-01-28
Maintainer: Claude Code / Development Team
Status: Active
For: backend-architect, database-engineer, code-review-specialist
Related Patterns: [02_DATABASE_PATTERNS.md, 03_API_PATTERNS.md, 07_BACKGROUND_JOBS_PATTERNS.md]
---

# Database Performance Review Guide

**Collaborative Guide for performance analysis and optimization**

This guide provides systematic approaches for reviewing database performance, identifying bottlenecks, and optimizing queries in the PriceCompare codebase.

## Table of Contents

1. [Performance Review Checklist](#performance-review-checklist)
2. [N+1 Query Detection](#n1-query-detection)
3. [EXPLAIN ANALYZE Interpretation](#explain-analyze-interpretation)
4. [Index Usage Review](#index-usage-review)
5. [Drizzle ORM Performance Patterns](#drizzle-orm-performance-patterns)
6. [Connection Pool Monitoring](#connection-pool-monitoring)
7. [Slow Query Identification](#slow-query-identification)

---

## Performance Review Checklist

Use this checklist when reviewing database-related code:

### Query Patterns
- [ ] No N+1 queries (loops with database calls inside)
- [ ] JOINs used for related data fetched together
- [ ] `inArray()` used for batch fetching optional relations
- [ ] Pagination implemented with proper LIMIT/OFFSET or cursor
- [ ] SELECT only needed columns (no `SELECT *` equivalent)
- [ ] Aggregations use `array_agg()` or `COUNT CASE WHEN` patterns

### Index Utilization
- [ ] WHERE clauses use indexed columns
- [ ] ORDER BY columns have supporting indexes
- [ ] Composite indexes match query column order
- [ ] No full table scans for large tables
- [ ] Foreign key columns are indexed

### Transaction Boundaries
- [ ] Multi-step operations wrapped in transactions
- [ ] Transactions are short-lived (no external API calls inside)
- [ ] Appropriate isolation level (SERIALIZABLE for race conditions)
- [ ] Read-only operations NOT in transactions

### Connection Management
- [ ] No connection leaks (all connections returned to pool)
- [ ] Batch operations use single connection where possible
- [ ] Long-running queries have appropriate timeouts

---

## N+1 Query Detection

### What is N+1?

N+1 occurs when code fetches N records, then makes N additional queries for related data:

```typescript
// ❌ N+1 ANTI-PATTERN - Makes 1 + N queries
const products = await db.select().from(products);
for (const product of products) {
  // This runs N times!
  const offers = await db.select().from(productOffers)
    .where(eq(productOffers.productId, product.id));
}
```

### Detection Methods

**1. Code Review Pattern (Pre-commit blocks this)**
```bash
# Look for database calls inside loops
grep -E "for\s*\(|\.forEach|\.map" server/**/*.ts | \
  xargs -I{} grep -l "await db\." {}
```

**2. Query Logging**
```typescript
// Enable in development
const db = drizzle(pool, { logger: true });
```

**3. Performance Testing**
```typescript
// Count queries in test
let queryCount = 0;
const originalQuery = db.execute;
db.execute = async (...args) => {
  queryCount++;
  return originalQuery.apply(db, args);
};

await functionUnderTest();
expect(queryCount).toBeLessThanOrEqual(3); // Expected queries
```

### Solutions

**Solution 1: JOIN for always-needed relations**
```typescript
// ✅ Single query with JOIN
const productsWithOffers = await db.select({
  product: products,
  offer: productOffers,
}).from(products)
  .leftJoin(productOffers, eq(products.id, productOffers.productId));
```

**Solution 2: Batch fetch with IN clause**
```typescript
// ✅ 2 queries total (1 + 1 batch)
const allProducts = await db.select().from(products);
const productIds = allProducts.map(p => p.id);

const allOffers = await db.select().from(productOffers)
  .where(inArray(productOffers.productId, productIds));

// Group in memory
const offersByProduct = Map.groupBy(allOffers, o => o.productId);
```

**Solution 3: Correlated subquery (100x improvement)**
```typescript
// ✅ Single query with correlated subquery
const productsWithLatestPrice = await db.select({
  ...getTableColumns(products),
  latestPrice: sql<number>`(
    SELECT price FROM ${priceHistory}
    WHERE ${priceHistory.productId} = ${products.id}
    ORDER BY created_at DESC LIMIT 1
  )`,
}).from(products);
```

---

## EXPLAIN ANALYZE Interpretation

### Running EXPLAIN ANALYZE

```sql
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT * FROM products WHERE category = 'Electronics';
```

### Key Metrics to Check

| Metric | Good | Concerning |
|--------|------|------------|
| Seq Scan on large table | ❌ | Add index |
| Index Scan / Index Only Scan | ✅ | Ideal |
| Nested Loop with many rows | ❌ | Consider Hash Join |
| Rows Removed by Filter | High ratio = ❌ | Index not selective |
| Actual Rows vs Planned | >10x difference = ❌ | Run ANALYZE |

### Common Patterns

**1. Missing Index (Seq Scan)**
```
Seq Scan on products  (cost=0.00..1250.00 rows=50000)
  Filter: (category = 'Electronics')
  Rows Removed by Filter: 45000
```
**Fix:** `CREATE INDEX idx_products_category ON products(category);`

**2. Index Not Used (Wrong Column Order)**
```sql
-- Index exists: (category, brand)
-- Query uses: WHERE brand = 'Apple'
-- Result: Seq Scan (index not used)
```
**Fix:** Create index on `(brand)` or reorder composite index

**3. Inefficient Join**
```
Nested Loop  (actual rows=50000)
  -> Seq Scan on products
  -> Index Scan on offers (50000 loops!)
```
**Fix:** Ensure join columns are indexed, consider batch size

### Drizzle ORM Query Inspection

```typescript
// Get raw SQL for EXPLAIN
const query = db.select().from(products).where(eq(products.id, 1));
const sql = query.toSQL();
console.log(sql.sql, sql.params);

// Run EXPLAIN in psql
// EXPLAIN ANALYZE <paste sql here>
```

---

## Index Usage Review

### Index Audit Query

```sql
-- Find unused indexes
SELECT
  schemaname || '.' || relname AS table,
  indexrelname AS index,
  pg_size_pretty(pg_relation_size(i.indexrelid)) AS size,
  idx_scan AS scans
FROM pg_stat_user_indexes i
JOIN pg_index USING (indexrelid)
WHERE idx_scan < 50
  AND NOT indisunique
ORDER BY pg_relation_size(i.indexrelid) DESC;
```

### Index Recommendations

**1. Foreign Key Columns (MANDATORY)**
```typescript
// schema.ts - All FKs should have indexes
export const productOffers = pgTable('product_offers', {
  productId: integer('product_id').references(() => products.id),
  retailerId: integer('retailer_id').references(() => retailers.id),
}, (table) => ({
  productIdx: index('idx_offers_product').on(table.productId),
  retailerIdx: index('idx_offers_retailer').on(table.retailerId),
}));
```

**2. Composite Indexes for Multi-Column Queries**
```typescript
// Query: WHERE user_id = ? AND created_at > ?
// Index should be: (user_id, created_at)
compositeIdx: index('idx_alerts_user_created').on(table.userId, table.createdAt),
```

**3. Partial Indexes for Filtered Queries**
```sql
-- Only index active products
CREATE INDEX idx_products_active_category
ON products(category)
WHERE is_active = true;
```

### Index Naming Convention

```
idx_{table}_{columns}[_{suffix}]

Examples:
- idx_products_category
- idx_offers_product_retailer
- idx_alerts_user_created_partial
```

---

## Drizzle ORM Performance Patterns

### Efficient Selects

```typescript
// ❌ Fetches all columns
const products = await db.select().from(products);

// ✅ Fetch only needed columns
const products = await db.select({
  id: products.id,
  name: products.name,
  price: products.currentPrice,
}).from(products);
```

### Batch Inserts

```typescript
// ❌ N insert statements
for (const item of items) {
  await db.insert(products).values(item);
}

// ✅ Single batch insert
await db.insert(products).values(items);
```

### Upsert Pattern

```typescript
// ✅ Single query upsert
await db.insert(products)
  .values(productData)
  .onConflictDoUpdate({
    target: products.sku,
    set: {
      price: sql`EXCLUDED.price`,
      updatedAt: new Date(),
    },
  });
```

### Conditional Aggregation

```typescript
// ✅ Single query for multiple counts
const stats = await db.select({
  total: count(),
  active: count(sql`CASE WHEN ${products.isActive} THEN 1 END`),
  outOfStock: count(sql`CASE WHEN ${products.stock} = 0 THEN 1 END`),
}).from(products);
```

---

## Connection Pool Monitoring

### Pool Configuration

```typescript
// server/db.ts
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,                    // Max connections
  idleTimeoutMillis: 30000,   // Close idle connections after 30s
  connectionTimeoutMillis: 5000, // Fail if can't connect in 5s
});
```

### Monitoring Queries

```sql
-- Active connections
SELECT count(*) FROM pg_stat_activity
WHERE datname = current_database();

-- Connection states
SELECT state, count(*)
FROM pg_stat_activity
WHERE datname = current_database()
GROUP BY state;

-- Long-running queries (>5 seconds)
SELECT pid, now() - pg_stat_activity.query_start AS duration, query
FROM pg_stat_activity
WHERE (now() - pg_stat_activity.query_start) > interval '5 seconds'
  AND state = 'active';
```

### Connection Leak Detection

```typescript
// Wrap pool for leak detection in development
if (process.env.NODE_ENV === 'development') {
  const originalConnect = pool.connect.bind(pool);
  pool.connect = async () => {
    const client = await originalConnect();
    const stack = new Error().stack;
    setTimeout(() => {
      if (!client.released) {
        console.warn('Potential connection leak:', stack);
      }
    }, 5000);
    return client;
  };
}
```

---

## Slow Query Identification

### Enable Slow Query Logging

```sql
-- PostgreSQL configuration
ALTER SYSTEM SET log_min_duration_statement = 1000; -- Log queries >1s
SELECT pg_reload_conf();
```

### Application-Level Monitoring

```typescript
// Middleware for query timing
const queryWithTiming = async <T>(
  name: string,
  queryFn: () => Promise<T>
): Promise<T> => {
  const start = performance.now();
  try {
    return await queryFn();
  } finally {
    const duration = performance.now() - start;
    if (duration > 100) { // Log queries >100ms
      logger.warn(`Slow query [${name}]: ${duration.toFixed(2)}ms`);
    }
  }
};

// Usage
const products = await queryWithTiming('getProducts', () =>
  db.select().from(products).where(eq(products.category, category))
);
```

### Common Slow Query Causes

| Symptom | Likely Cause | Solution |
|---------|--------------|----------|
| Consistent slowness | Missing index | Add appropriate index |
| Intermittent slowness | Lock contention | Review transaction scope |
| Degrading over time | Table bloat | Run VACUUM ANALYZE |
| Slow after data growth | Insufficient work_mem | Tune PostgreSQL config |

---

## Quick Reference

### Pre-Review Commands

```bash
# Check for N+1 patterns
grep -rn "for.*await.*db\." server/

# Find queries without limits
grep -rn "\.select()" server/ | grep -v "\.limit("

# Check index coverage
psql -c "SELECT * FROM pg_stat_user_indexes WHERE idx_scan = 0;"
```

### Performance Test Template

```typescript
describe('Query Performance', () => {
  it('should fetch products efficiently', async () => {
    const start = performance.now();
    await storage.getProductsWithOffers({ limit: 100 });
    const duration = performance.now() - start;

    expect(duration).toBeLessThan(100); // Under 100ms
  });
});
```

---

## Related Documentation

- **[02_DATABASE_PATTERNS.md](../02_DATABASE_PATTERNS.md)** - Core database patterns and anti-patterns
- **[03_API_PATTERNS.md](../03_API_PATTERNS.md)** - Route performance patterns
- **[07_BACKGROUND_JOBS_PATTERNS.md](../07_BACKGROUND_JOBS_PATTERNS.md)** - Batch processing patterns
- **[PERFORMANCE_GUIDE.md](./PERFORMANCE_GUIDE.md)** - General performance optimization
