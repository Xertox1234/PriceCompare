-- Migration 0022: Add Composite Index for Product+Retailer Price History Queries
-- Performance optimization from comprehensive codebase audit

-- PERFORMANCE: Composite index for product+retailer price history queries
-- Optimizes queries like: WHERE product_id = X AND retailer_id = Y AND recorded_at > Z
-- Use case: getRetailerPriceHistory() and retailer-specific trend analysis
-- Expected improvement: 15-30% faster queries with retailer filtering
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_price_history_product_retailer_date
ON price_history (product_id, retailer_id, recorded_at);
