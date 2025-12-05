-- Migration 0021: Add Performance Indexes (Clean Version)
-- Issue #163: Add 3 missing database indexes for query optimization

-- Index 1: Price Alerts - Active Product Lookup
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_price_alerts_active_product
ON price_alerts(product_id, is_active, target_price)
WHERE is_active = true;

-- Index 2: Price History - Aggregation Cleanup
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_price_history_aggregated_cleanup
ON price_history (recorded_at)
WHERE aggregated_at IS NOT NULL;

-- Index 3: Product Offers - Price Lookups (Covering Index)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_product_offers_product_retailer_price
ON product_offers (product_id, retailer_id, price);
