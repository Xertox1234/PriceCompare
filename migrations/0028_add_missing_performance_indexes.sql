-- Migration 0028: Add Missing Performance Indexes
-- Related: TODO_220_DATABASE_INDEXES.md
-- Date: 2026-01-15
--
-- Summary:
--   Adds missing indexes identified during security audit for performance optimization.
--   These indexes improve query performance for common access patterns:
--   - products.created_at: "Recent products" queries
--   - product_offers.last_updated: Finding stale offers that need re-scraping
--
-- Performance Impact:
--   - Prevents full table scans on large tables
--   - Improves dashboard loading times
--   - Optimizes scraping job queue queries
--
-- Safety:
--   - Uses CREATE INDEX CONCURRENTLY for non-blocking execution
--   - Safe to run on production with active traffic
--   - No data changes, only index additions

-- Index 1: products.created_at
-- Use case: "Recent products" page, trending products, new arrivals
-- Expected improvement: O(n) -> O(log n) for date-filtered queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS products_created_at_idx
ON products(created_at DESC);

-- Index 2: product_offers.last_updated
-- Use case: Finding stale offers for re-scraping (WHERE last_updated < NOW() - INTERVAL '24 hours')
-- Expected improvement: O(n) -> O(log n) for scraping job scheduling
CREATE INDEX CONCURRENTLY IF NOT EXISTS product_offers_last_updated_idx
ON product_offers(last_updated);

-- Verification queries (for post-migration validation)
-- Run these to confirm indexes are being used:

-- EXPLAIN ANALYZE
-- SELECT * FROM products
-- ORDER BY created_at DESC
-- LIMIT 20;
-- Expected: Index Scan using products_created_at_idx

-- EXPLAIN ANALYZE
-- SELECT * FROM product_offers
-- WHERE last_updated < NOW() - INTERVAL '24 hours'
-- LIMIT 100;
-- Expected: Index Scan using product_offers_last_updated_idx
