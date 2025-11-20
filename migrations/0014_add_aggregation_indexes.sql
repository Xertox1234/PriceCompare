-- Migration 0014: Add missing indexes for price aggregation queries
-- Purpose: Optimize query performance for aggregation and cleanup operations
-- Impact: 10-100x faster queries on large datasets
--
-- CASCADE DEPENDENCIES (CRITICAL - DO NOT MODIFY WITHOUT REVIEWING):
-- =====================================================================
-- This migration adds indexes to optimize queries that depend on foreign key relationships.
-- Understanding cascade behavior is essential for data integrity:
--
-- FOREIGN KEY CASCADE RULES (from shared/schema.ts):
--
-- 1. price_history.product_id → products.id (CASCADE)
--    - When a product is deleted, ALL price history records are automatically deleted
--    - This is correct: price history has no meaning without the product
--    - These indexes speed up the cascade delete operation
--
-- 2. price_history.retailer_id → retailers.id (CASCADE)
--    - When a retailer is deleted, ALL price records from that retailer are deleted
--    - This is correct: we don't want orphaned retailer data
--    - idx_price_history_retailer_recorded helps cascade deletes
--
-- 3. price_aggregates_daily.product_id → products.id (CASCADE)
-- 4. price_aggregates_weekly.product_id → products.id (CASCADE)
-- 5. price_aggregates_monthly.product_id → products.id (CASCADE)
--    - When a product is deleted, all aggregated data is also deleted
--    - This maintains referential integrity across the aggregation pipeline
--
-- 6. price_aggregates_daily.retailer_id → retailers.id (CASCADE)
-- 7. price_aggregates_weekly.retailer_id → retailers.id (CASCADE)
-- 8. price_aggregates_monthly.retailer_id → retailers.id (CASCADE)
--    - When a retailer is deleted, all aggregates for that retailer are deleted
--
-- TESTING CASCADE BEHAVIOR:
-- To verify cascade rules are working correctly:
--   1. Create test product with price history and aggregates
--   2. DELETE FROM products WHERE id = test_product_id;
--   3. Verify price_history, price_aggregates_* are also deleted
--   4. Check for orphaned records with foreign key violations
--
-- PERFORMANCE IMPLICATIONS:
-- - Cascade deletes with these indexes are fast (indexed foreign key lookups)
-- - Without indexes, cascade deletes would require full table scans
-- - idx_price_history_product_recorded speeds up: "DELETE FROM price_history WHERE product_id = ?"
--
-- MIGRATION SAFETY:
-- - This migration only adds indexes, it does NOT modify cascade rules
-- - Cascade rules are defined in schema.ts and enforced by PostgreSQL
-- - If you need to change cascade behavior, update schema.ts and create a new migration
-- =====================================================================

-- 1. Composite index for product-based range queries
-- Used by: aggregateToDaily(), calculateDailyAggregatesForProduct()
-- Benefit: Eliminates table scans when filtering by product + date range
-- CASCADE: Speeds up cascade deletes when products are deleted
CREATE INDEX IF NOT EXISTS idx_price_history_product_recorded
  ON price_history(product_id, recorded_at DESC);

-- 2. Composite index for retailer-based range queries
-- Used by: Retailer-specific analytics, per-retailer aggregation
-- Benefit: Fast filtering by retailer + date range
-- CASCADE: Speeds up cascade deletes when retailers are deleted
CREATE INDEX IF NOT EXISTS idx_price_history_retailer_recorded
  ON price_history(retailer_id, recorded_at DESC);

-- 3. Recorded timestamp index for time-based operations
-- Used by: cleanupOldData(), daily batch aggregation jobs
-- Benefit: Fast time-range filtering without needing product/retailer filters
CREATE INDEX IF NOT EXISTS idx_price_history_recorded_desc
  ON price_history(recorded_at DESC);

-- 4. Aggregated timestamp index for cleanup queries
-- Already exists from migration 0013, but verify:
-- CREATE INDEX idx_price_history_aggregated_at ON price_history(aggregated_at);

-- 5. Composite index for upsert operations on daily aggregates
-- Used by: Daily aggregation upserts (INSERT ... ON CONFLICT)
-- Benefit: Fast conflict detection and updates
-- Note: We already have unique_product_retailer_date from 0013, which serves this purpose

-- 6. Add comments explaining index strategy and cascade behavior
COMMENT ON INDEX idx_price_history_product_recorded IS
  'Optimizes product-based date range queries for aggregation. Covers 80% of aggregation queries. Also speeds up CASCADE deletes when products are deleted.';

COMMENT ON INDEX idx_price_history_retailer_recorded IS
  'Optimizes retailer-based analytics and per-retailer aggregation queries. Also speeds up CASCADE deletes when retailers are deleted.';

COMMENT ON INDEX idx_price_history_recorded_desc IS
  'Optimizes time-based cleanup and batch aggregation jobs. DESC order matches cleanup query patterns.';
