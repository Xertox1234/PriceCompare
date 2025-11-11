-- Add Price History Tracking
-- Created: 2025-11-11
-- Purpose: Track historical price changes for trend analysis and graphs

-- Create price_history table
CREATE TABLE IF NOT EXISTS price_history (
  id SERIAL PRIMARY KEY,
  product_offer_id INTEGER NOT NULL REFERENCES product_offers(id),
  product_id INTEGER NOT NULL REFERENCES products(id),
  retailer_id INTEGER NOT NULL REFERENCES retailers(id),
  price DECIMAL(10, 2) NOT NULL,
  original_price DECIMAL(10, 2),
  availability TEXT,
  rating DECIMAL(2, 1),
  review_count INTEGER,
  recorded_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Performance indexes for common query patterns
-- Index for querying history by product (most common use case)
CREATE INDEX IF NOT EXISTS idx_price_history_product_id ON price_history (product_id, recorded_at DESC);

-- Index for querying history by product offer
CREATE INDEX IF NOT EXISTS idx_price_history_offer_id ON price_history (product_offer_id, recorded_at DESC);

-- Index for querying history by retailer
CREATE INDEX IF NOT EXISTS idx_price_history_retailer_id ON price_history (retailer_id, recorded_at DESC);

-- Index for time-series queries
CREATE INDEX IF NOT EXISTS idx_price_history_recorded_at ON price_history (recorded_at DESC);

-- Composite index for product + retailer + time queries (for retailer comparison charts)
CREATE INDEX IF NOT EXISTS idx_price_history_product_retailer_time ON price_history (product_id, retailer_id, recorded_at DESC);

-- Composite index for price range queries
CREATE INDEX IF NOT EXISTS idx_price_history_product_price ON price_history (product_id, CAST(price AS DECIMAL));

-- Analyze table to update statistics for query planner
ANALYZE price_history;

-- Create helpful comments
COMMENT ON TABLE price_history IS 'Historical price snapshots for trend analysis and price graphs';
COMMENT ON COLUMN price_history.product_offer_id IS 'Reference to the product offer (may be deleted)';
COMMENT ON COLUMN price_history.product_id IS 'Denormalized product reference for fast queries';
COMMENT ON COLUMN price_history.retailer_id IS 'Denormalized retailer reference for fast queries';
COMMENT ON COLUMN price_history.recorded_at IS 'Timestamp when this price snapshot was recorded';
COMMENT ON INDEX idx_price_history_product_id IS 'Primary index for querying price history by product over time';
COMMENT ON INDEX idx_price_history_product_retailer_time IS 'Composite index for retailer comparison queries';
