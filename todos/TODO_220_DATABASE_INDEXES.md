# TODO 220: Missing Database Indexes on Frequently Queried Columns

**Priority**: P1 - HIGH
**File(s)**: `shared/schema.ts`
**Estimated Time**: 30 minutes
**Status**: Not Started
**Created Date**: 2026-01-14
**Source**: Security Audit (2026-01-14)

## Problem Statement

Several columns used in WHERE clauses and JOINs lack indexes, causing slow query performance that will degrade as data grows. During the 6-month data gathering phase, price history tables will grow significantly.

**Performance Impact**:
- Slow price history queries (full table scans)
- Slow product offer lookups
- API latency increases with data volume
- Poor user experience on dashboards

## Root Cause

Schema was designed for correctness but indexes were not added for performance optimization.

## Solution Approach

1. Identify frequently queried columns from actual query patterns
2. Add single-column indexes for common WHERE clauses
3. Add composite indexes for common query combinations
4. Run EXPLAIN ANALYZE to verify index usage

## Implementation Steps

### Step 1: Audit Query Patterns

- [ ] Review `server/storage.ts` for common query patterns
- [ ] Identify columns used in WHERE, JOIN, ORDER BY
- [ ] Prioritize by query frequency and table size

### Step 2: Add Indexes to Price History

- [ ] Index on `productId` (JOIN and WHERE)
- [ ] Index on `recordedAt` (date range queries)
- [ ] Composite index on `(productId, recordedAt)` for time-series queries

### Step 3: Add Indexes to Product Offers

- [ ] Index on `productId` (JOIN)
- [ ] Index on `retailerId` (retailer filtering)
- [ ] Index on `lastChecked` (stale offer detection)

### Step 4: Add Indexes to Other Tables

- [ ] Users: Index on `email` (login lookup)
- [ ] Products: Index on `createdAt` (recent products)
- [ ] Price alerts: Index on `userId`, `productId`

### Step 5: Run Migration

- [ ] Create migration file
- [ ] Test on staging with production-like data
- [ ] Monitor index creation time (large tables)

## Technical Details

**Current Schema (MISSING INDEXES):**
```typescript
export const priceHistory = pgTable('price_history', {
  id: serial('id').primaryKey(),
  productId: integer('product_id').references(() => products.id),
  price: numeric('price', { precision: 10, scale: 2 }),
  recordedAt: timestamp('recorded_at').defaultNow(),
  // ❌ Missing index on productId - used in most queries
  // ❌ Missing index on recordedAt - used for date range queries
});

export const productOffers = pgTable('product_offers', {
  id: serial('id').primaryKey(),
  productId: integer('product_id').references(() => products.id),
  retailerId: integer('retailer_id').references(() => retailers.id),
  price: numeric('price', { precision: 10, scale: 2 }),
  url: text('url'),
  lastChecked: timestamp('last_checked').defaultNow(),
  // ❌ Missing indexes
});
```

**Fixed Schema (WITH INDEXES):**
```typescript
import { pgTable, serial, integer, numeric, timestamp, text, index } from 'drizzle-orm/pg-core';

export const priceHistory = pgTable('price_history', {
  id: serial('id').primaryKey(),
  productId: integer('product_id').references(() => products.id).notNull(),
  price: numeric('price', { precision: 10, scale: 2 }).notNull(),
  recordedAt: timestamp('recorded_at').defaultNow().notNull(),
}, (table) => ({
  // ✅ Index for lookups by product
  productIdIdx: index('price_history_product_id_idx').on(table.productId),
  // ✅ Index for date range queries
  recordedAtIdx: index('price_history_recorded_at_idx').on(table.recordedAt),
  // ✅ Composite index for time-series queries (most common pattern)
  productDateIdx: index('price_history_product_date_idx').on(table.productId, table.recordedAt),
}));

export const productOffers = pgTable('product_offers', {
  id: serial('id').primaryKey(),
  productId: integer('product_id').references(() => products.id).notNull(),
  retailerId: integer('retailer_id').references(() => retailers.id).notNull(),
  price: numeric('price', { precision: 10, scale: 2 }).notNull(),
  url: text('url').notNull(),
  lastChecked: timestamp('last_checked').defaultNow(),
}, (table) => ({
  // ✅ Index for product joins
  productIdIdx: index('product_offers_product_id_idx').on(table.productId),
  // ✅ Index for retailer filtering
  retailerIdIdx: index('product_offers_retailer_id_idx').on(table.retailerId),
  // ✅ Index for finding stale offers
  lastCheckedIdx: index('product_offers_last_checked_idx').on(table.lastChecked),
}));

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  email: text('email').notNull().unique(),
  username: text('username').notNull(),
  passwordHash: text('password_hash').notNull(),
  isAdmin: boolean('is_admin').default(false),
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => ({
  // ✅ Index for login lookup (unique constraint creates index, but explicit is clearer)
  emailIdx: index('users_email_idx').on(table.email),
}));

export const priceAlerts = pgTable('price_alerts', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id).notNull(),
  productId: integer('product_id').references(() => products.id).notNull(),
  targetPrice: numeric('target_price', { precision: 10, scale: 2 }).notNull(),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => ({
  // ✅ Index for user's alerts
  userIdIdx: index('price_alerts_user_id_idx').on(table.userId),
  // ✅ Index for product's alerts (checking when price drops)
  productIdIdx: index('price_alerts_product_id_idx').on(table.productId),
  // ✅ Composite for active alerts by product
  activeProductIdx: index('price_alerts_active_product_idx').on(table.productId, table.isActive),
}));
```

**Query Performance Verification:**
```sql
-- Before indexes (full table scan)
EXPLAIN ANALYZE 
SELECT * FROM price_history 
WHERE product_id = 123 
AND recorded_at > NOW() - INTERVAL '30 days'
ORDER BY recorded_at DESC;
-- Seq Scan on price_history  (cost=0.00..1234.56 rows=100 width=32)

-- After indexes (index scan)
EXPLAIN ANALYZE 
SELECT * FROM price_history 
WHERE product_id = 123 
AND recorded_at > NOW() - INTERVAL '30 days'
ORDER BY recorded_at DESC;
-- Index Scan using price_history_product_date_idx  (cost=0.42..12.34 rows=100 width=32)
```

## Checklist

- [ ] Price history indexes added (productId, recordedAt, composite)
- [ ] Product offers indexes added (productId, retailerId, lastChecked)
- [ ] User indexes added (email)
- [ ] Price alerts indexes added (userId, productId)
- [ ] Migration created and tested
- [ ] EXPLAIN ANALYZE confirms index usage

## Success Criteria

- [ ] All foreign key columns have indexes
- [ ] Common WHERE clause columns indexed
- [ ] EXPLAIN shows Index Scan (not Seq Scan) for common queries
- [ ] Query performance improved (measure before/after)
- [ ] Migration runs without errors
- [ ] All tests pass

## Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Index creation locks table | Medium | Medium | Use CONCURRENTLY for large tables |
| Over-indexing slows writes | Low | Low | Only index frequently queried columns |
| Index bloat over time | Low | Low | Schedule REINDEX maintenance |

---

## ✅ PRE-CLOSE VERIFICATION CHECKLIST (MANDATORY)

**Before marking this TODO as complete, verify ALL of the following:**

### Code Verification
- [ ] **Grep verification**: Confirm indexes defined in schema
  ```bash
  # Verify index definitions exist
  grep -n "index(" shared/schema.ts | wc -l
  # Should be > 10 indexes
  
  # Verify price_history has indexes
  grep -A 10 "priceHistory = pgTable" shared/schema.ts | grep "index"
  ```

- [ ] **File inspection**: Review schema indexes
  ```bash
  grep -B 2 -A 2 "Idx:" shared/schema.ts
  ```

### Database Verification
- [ ] **Check indexes exist in database**:
  ```sql
  -- List all indexes
  SELECT indexname, tablename 
  FROM pg_indexes 
  WHERE schemaname = 'public'
  ORDER BY tablename, indexname;
  
  -- Verify price_history indexes
  SELECT indexname FROM pg_indexes WHERE tablename = 'price_history';
  ```

- [ ] **EXPLAIN ANALYZE verification**:
  ```sql
  EXPLAIN ANALYZE 
  SELECT * FROM price_history 
  WHERE product_id = 1 
  ORDER BY recorded_at DESC 
  LIMIT 100;
  -- Should show "Index Scan" not "Seq Scan"
  ```

### Testing
- [ ] **Run migration**: Apply schema changes
  ```bash
  npm run db:push
  # or
  npm run migrate
  ```

- [ ] **Run affected tests**: Execute database tests
  ```bash
  npm test -- storage
  npm test -- database
  ```

### Build & Type Safety
- [ ] **TypeScript compilation**: Ensure no type errors
  ```bash
  npm run check
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
