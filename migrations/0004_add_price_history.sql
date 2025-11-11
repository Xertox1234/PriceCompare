-- Add price_history table for granular price change tracking
CREATE TABLE IF NOT EXISTS price_history (
  id SERIAL PRIMARY KEY,
  product_offer_id INTEGER NOT NULL REFERENCES product_offers(id) ON DELETE CASCADE,
  price DECIMAL(10, 2) NOT NULL,
  original_price DECIMAL(10, 2),
  source VARCHAR(50) DEFAULT 'scraper', -- manual, scraper, api, admin
  confidence DECIMAL(3, 2) DEFAULT 1.00, -- 0.00 to 1.00
  metadata TEXT, -- JSON - Additional context about price change
  recorded_at TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Add price_snapshots table for daily aggregated price data
CREATE TABLE IF NOT EXISTS price_snapshots (
  id SERIAL PRIMARY KEY,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  retailer_id INTEGER NOT NULL REFERENCES retailers(id) ON DELETE CASCADE,
  lowest_price DECIMAL(10, 2) NOT NULL,
  highest_price DECIMAL(10, 2) NOT NULL,
  average_price DECIMAL(10, 2) NOT NULL,
  offer_count INTEGER DEFAULT 1,
  snapshot_date TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for price_history table

-- Index on product_offer_id for faster lookups by offer
CREATE INDEX IF NOT EXISTS price_history_product_offer_id_idx ON price_history(product_offer_id);

-- Index on recorded_at for time-based queries
CREATE INDEX IF NOT EXISTS price_history_recorded_at_idx ON price_history(recorded_at);

-- Composite index for efficient queries by offer and time range
CREATE INDEX IF NOT EXISTS price_history_offer_time_idx ON price_history(product_offer_id, recorded_at DESC);

-- Index on source for filtering by data source
CREATE INDEX IF NOT EXISTS price_history_source_idx ON price_history(source);

-- Create indexes for price_snapshots table

-- Index on product_id for faster lookups by product
CREATE INDEX IF NOT EXISTS price_snapshots_product_id_idx ON price_snapshots(product_id);

-- Index on retailer_id for faster lookups by retailer
CREATE INDEX IF NOT EXISTS price_snapshots_retailer_id_idx ON price_snapshots(retailer_id);

-- Index on snapshot_date for time-based queries
CREATE INDEX IF NOT EXISTS price_snapshots_snapshot_date_idx ON price_snapshots(snapshot_date);

-- Composite index for unique snapshots per product/retailer/date
CREATE UNIQUE INDEX IF NOT EXISTS price_snapshots_unique_idx
  ON price_snapshots(product_id, retailer_id, DATE(snapshot_date));

-- Composite index for efficient queries by product and time range
CREATE INDEX IF NOT EXISTS price_snapshots_product_date_idx ON price_snapshots(product_id, snapshot_date DESC);

-- Composite index for efficient queries by retailer and time range
CREATE INDEX IF NOT EXISTS price_snapshots_retailer_date_idx ON price_snapshots(retailer_id, snapshot_date DESC);

-- Add comments to document the tables
COMMENT ON TABLE price_history IS 'Stores granular price change records for product offers, enabling detailed price tracking and analysis';
COMMENT ON TABLE price_snapshots IS 'Stores daily aggregated price data for products, optimized for historical charts and analytics';

-- Add column comments for clarity
COMMENT ON COLUMN price_history.confidence IS 'Confidence score (0.00-1.00) indicating reliability of the price data';
COMMENT ON COLUMN price_history.metadata IS 'JSON metadata containing additional context about the price change';
COMMENT ON COLUMN price_snapshots.snapshot_date IS 'Date of the price snapshot, used for daily aggregation';
COMMENT ON COLUMN price_snapshots.offer_count IS 'Number of active offers on the snapshot date';
