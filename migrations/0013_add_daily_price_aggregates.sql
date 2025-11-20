-- Migration 0013: Add daily price aggregates and aggregatedAt field
-- Purpose: Enable daily price aggregation for 30-90 day data lifecycle
-- Part of data lifecycle: 0-30d raw, 30-90d daily, 90-365d weekly, 1y+ monthly

-- 1. Add aggregated_at column to price_history table
ALTER TABLE price_history
  ADD COLUMN aggregated_at TIMESTAMP;

-- 2. Create index on aggregated_at for efficient cleanup queries
CREATE INDEX idx_price_history_aggregated_at ON price_history(aggregated_at);

-- 3. Create price_aggregates_daily table
CREATE TABLE price_aggregates_daily (
  id SERIAL PRIMARY KEY,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  retailer_id INTEGER NOT NULL REFERENCES retailers(id) ON DELETE CASCADE,

  date VARCHAR(10) NOT NULL, -- YYYY-MM-DD format

  min_price DECIMAL(10, 2) NOT NULL,
  max_price DECIMAL(10, 2) NOT NULL,
  avg_price DECIMAL(10, 2) NOT NULL,
  median_price DECIMAL(10, 2),
  volatility_score DECIMAL(5, 2),

  record_count INTEGER NOT NULL DEFAULT 0,
  day_over_day_change DECIMAL(5, 2),

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 4. Create indexes for efficient queries
CREATE INDEX daily_product_date_idx ON price_aggregates_daily(product_id, date);
CREATE INDEX daily_retailer_date_idx ON price_aggregates_daily(retailer_id, date);
CREATE INDEX daily_date_idx ON price_aggregates_daily(date);
CREATE INDEX daily_created_idx ON price_aggregates_daily(created_at);

-- 5. Create unique constraint to prevent duplicate aggregates
CREATE UNIQUE INDEX unique_product_retailer_date
  ON price_aggregates_daily(product_id, retailer_id, date);

-- 6. Add comment to table
COMMENT ON TABLE price_aggregates_daily IS
  'Daily price aggregates for short-term analysis. Part of data lifecycle: 0-30d raw, 30-90d daily, 90-365d weekly, 1y+ monthly.';

COMMENT ON COLUMN price_history.aggregated_at IS
  'Timestamp when this record was aggregated into daily/weekly/monthly tables. Used for cleanup of old raw data.';
