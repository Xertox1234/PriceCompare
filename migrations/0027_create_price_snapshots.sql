-- Migration 0027: Create Missing price_snapshots Table
-- Created: 2025-12-23
-- Priority: P0 CRITICAL
-- Description: Creates price_snapshots table that was defined in schema.ts but never migrated
--
-- CRITICAL BUG FIX:
-- - Migration 0020 added CHECK constraints to price_snapshots (assumes table exists)
-- - BUT the table was NEVER created in any migration 0001-0025
-- - This migration fixes that critical gap
--
-- Schema Reference: shared/schema.ts lines 1149-1175

BEGIN;

-- ============================================================================
-- Table: price_snapshots
-- Purpose: Daily aggregated price data for products
-- Schema: shared/schema.ts lines 1149-1175
-- ============================================================================

CREATE TABLE IF NOT EXISTS price_snapshots (
  id SERIAL PRIMARY KEY,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  retailer_id INTEGER NOT NULL REFERENCES retailers(id) ON DELETE CASCADE,
  lowest_price DECIMAL(10, 2) NOT NULL,
  highest_price DECIMAL(10, 2) NOT NULL,
  average_price DECIMAL(10, 2) NOT NULL,
  offer_count INTEGER DEFAULT 1,
  snapshot_date TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- Indexes (from schema.ts lines 1167-1173)
-- ============================================================================

CREATE INDEX price_snapshots_product_id_idx ON price_snapshots(product_id);
CREATE INDEX price_snapshots_retailer_id_idx ON price_snapshots(retailer_id);
CREATE INDEX price_snapshots_snapshot_date_idx ON price_snapshots(snapshot_date);
CREATE INDEX price_snapshots_product_date_idx ON price_snapshots(product_id, snapshot_date);

-- ============================================================================
-- CHECK Constraints (from migration 0020)
-- ============================================================================
-- NOTE: Migration 0020 tried to add these constraints but table didn't exist
-- We add them here during table creation

ALTER TABLE price_snapshots
  ADD CONSTRAINT check_price_snapshots_prices_positive
    CHECK (lowest_price >= 0 AND highest_price >= 0 AND average_price >= 0);

ALTER TABLE price_snapshots
  ADD CONSTRAINT check_price_snapshots_range_valid
    CHECK (highest_price >= lowest_price);

ALTER TABLE price_snapshots
  ADD CONSTRAINT check_price_snapshots_avg_in_range
    CHECK (average_price >= lowest_price AND average_price <= highest_price);

-- ============================================================================
-- Table Comment
-- ============================================================================

COMMENT ON TABLE price_snapshots IS 'Daily aggregated price data - part of data lifecycle (0-30d raw, 30-90d daily, 90-365d weekly, 1y+ monthly)';
COMMENT ON COLUMN price_snapshots.snapshot_date IS 'Date of the price snapshot aggregation';
COMMENT ON COLUMN price_snapshots.offer_count IS 'Number of offers included in this snapshot';

COMMIT;

-- ============================================================================
-- Post-Migration Verification
-- ============================================================================
-- Run these after migration to verify:
--
-- SELECT table_name FROM information_schema.tables
-- WHERE table_schema = 'public' AND table_name = 'price_snapshots';
--
-- SELECT indexname FROM pg_indexes WHERE tablename = 'price_snapshots';
--
-- SELECT constraint_name FROM information_schema.table_constraints
-- WHERE table_name = 'price_snapshots' AND constraint_type = 'CHECK';
--
-- EXPECTED: 3 CHECK constraints (prices_positive, range_valid, avg_in_range)
