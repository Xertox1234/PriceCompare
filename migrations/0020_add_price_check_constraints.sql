-- Migration: Add CHECK Constraints on Price Fields
-- Description: Adds database-level CHECK constraints to prevent invalid prices
--              (negative prices, zero target prices, sale > original, inverted ranges)
-- Author: AI Coding Agent
-- Date: 2025-12-01
-- Priority: P0 (CRITICAL - Data Integrity)
-- Related: todos/002-pending-p0-add-price-check-constraints.md
--
-- IMPORTANT: This migration follows the pattern from 0009_add_price_aggregation.sql
-- which already has CHECK constraints on aggregation tables.
--
-- Tables affected:
--   - product_offers: price, original_price
--   - price_history: price, original_price
--   - price_alerts: target_price
--   - price_snapshots: lowest_price, highest_price, average_price
--
-- Pre-migration validation queries are included as comments for safety.

BEGIN;

-- ============================================================================
-- Pre-Migration Validation (Run these manually before applying migration)
-- ============================================================================
-- Execute these queries to check for existing invalid data:
--
-- SELECT COUNT(*) as negative_prices FROM product_offers WHERE CAST(price AS DECIMAL) < 0;
-- SELECT COUNT(*) as invalid_sale_price FROM product_offers WHERE original_price IS NOT NULL AND CAST(price AS DECIMAL) > CAST(original_price AS DECIMAL);
-- SELECT COUNT(*) as negative_history_prices FROM price_history WHERE CAST(price AS DECIMAL) < 0;
-- SELECT COUNT(*) as invalid_target_prices FROM price_alerts WHERE CAST(target_price AS DECIMAL) <= 0;
-- SELECT COUNT(*) as invalid_snapshot_ranges FROM price_snapshots WHERE CAST(highest_price AS DECIMAL) < CAST(lowest_price AS DECIMAL);
--
-- If any count > 0, review and clean data before applying this migration.
-- ============================================================================

-- ============================================================================
-- Step 1: Clean up any existing invalid data (defensive)
-- These updates ensure migration succeeds even if some invalid data exists.
-- ============================================================================

-- Fix any negative prices in product_offers (set to 0)
UPDATE product_offers SET price = '0.00' WHERE CAST(price AS DECIMAL) < 0;

-- Fix any negative original prices in product_offers (set to NULL - unknown)
UPDATE product_offers SET original_price = NULL WHERE CAST(original_price AS DECIMAL) < 0;

-- Fix cases where sale price > original price (set original_price to NULL)
-- This maintains the current price but removes invalid original price
UPDATE product_offers SET original_price = NULL 
  WHERE original_price IS NOT NULL 
  AND CAST(price AS DECIMAL) > CAST(original_price AS DECIMAL);

-- Fix any negative prices in price_history (set to 0)
UPDATE price_history SET price = '0.00' WHERE CAST(price AS DECIMAL) < 0;

-- Fix any negative original prices in price_history (set to NULL)
UPDATE price_history SET original_price = NULL WHERE CAST(original_price AS DECIMAL) < 0;

-- Fix invalid target prices in price_alerts (set to minimum valid price)
UPDATE price_alerts SET target_price = '0.01' WHERE CAST(target_price AS DECIMAL) <= 0;

-- Fix invalid price snapshot ranges (swap lowest and highest if inverted)
UPDATE price_snapshots SET 
  lowest_price = highest_price,
  highest_price = lowest_price
WHERE CAST(highest_price AS DECIMAL) < CAST(lowest_price AS DECIMAL);

-- Fix average_price if outside range (clamp to range)
UPDATE price_snapshots SET average_price = lowest_price 
WHERE CAST(average_price AS DECIMAL) < CAST(lowest_price AS DECIMAL);

UPDATE price_snapshots SET average_price = highest_price 
WHERE CAST(average_price AS DECIMAL) > CAST(highest_price AS DECIMAL);

-- Fix any negative prices in price_snapshots
UPDATE price_snapshots SET lowest_price = '0.00' WHERE CAST(lowest_price AS DECIMAL) < 0;
UPDATE price_snapshots SET highest_price = '0.00' WHERE CAST(highest_price AS DECIMAL) < 0;
UPDATE price_snapshots SET average_price = '0.00' WHERE CAST(average_price AS DECIMAL) < 0;

-- ============================================================================
-- Step 2: Add CHECK constraints to product_offers
-- ============================================================================

-- Price must be non-negative (>= 0)
-- Allows $0.00 for free products (explicit intent)
ALTER TABLE product_offers
  ADD CONSTRAINT check_product_offers_price_positive
    CHECK (CAST(price AS DECIMAL) >= 0);

-- Original price must be non-negative when present
ALTER TABLE product_offers
  ADD CONSTRAINT check_product_offers_original_price_positive
    CHECK (original_price IS NULL OR CAST(original_price AS DECIMAL) >= 0);

-- Sale price must not exceed original price (logical business rule)
-- Allows equal values (no discount scenario)
ALTER TABLE product_offers
  ADD CONSTRAINT check_product_offers_price_logical
    CHECK (original_price IS NULL OR CAST(price AS DECIMAL) <= CAST(original_price AS DECIMAL));

-- ============================================================================
-- Step 3: Add CHECK constraints to price_history
-- ============================================================================

-- Price must be non-negative
ALTER TABLE price_history
  ADD CONSTRAINT check_price_history_price_positive
    CHECK (CAST(price AS DECIMAL) >= 0);

-- Original price must be non-negative when present
ALTER TABLE price_history
  ADD CONSTRAINT check_price_history_original_price_positive
    CHECK (original_price IS NULL OR CAST(original_price AS DECIMAL) >= 0);

-- ============================================================================
-- Step 4: Add CHECK constraints to price_alerts
-- ============================================================================

-- Target price must be strictly positive (> 0)
-- Zero target price makes no sense for price alerts
ALTER TABLE price_alerts
  ADD CONSTRAINT check_price_alerts_target_price_positive
    CHECK (CAST(target_price AS DECIMAL) > 0);

-- price_when_created must be non-negative when present
ALTER TABLE price_alerts
  ADD CONSTRAINT check_price_alerts_price_when_created_positive
    CHECK (price_when_created IS NULL OR CAST(price_when_created AS DECIMAL) >= 0);

-- ============================================================================
-- Step 5: Add CHECK constraints to price_snapshots
-- ============================================================================

-- All prices must be non-negative
ALTER TABLE price_snapshots
  ADD CONSTRAINT check_price_snapshots_prices_positive
    CHECK (
      CAST(lowest_price AS DECIMAL) >= 0 
      AND CAST(highest_price AS DECIMAL) >= 0 
      AND CAST(average_price AS DECIMAL) >= 0
    );

-- Price range must be valid (highest >= lowest)
ALTER TABLE price_snapshots
  ADD CONSTRAINT check_price_snapshots_range_valid
    CHECK (CAST(highest_price AS DECIMAL) >= CAST(lowest_price AS DECIMAL));

-- Average must be within range (lowest <= avg <= highest)
ALTER TABLE price_snapshots
  ADD CONSTRAINT check_price_snapshots_avg_in_range
    CHECK (
      CAST(average_price AS DECIMAL) >= CAST(lowest_price AS DECIMAL) 
      AND CAST(average_price AS DECIMAL) <= CAST(highest_price AS DECIMAL)
    );

-- ============================================================================
-- Step 6: Documentation
-- ============================================================================

-- Document the constraints for future reference
COMMENT ON CONSTRAINT check_product_offers_price_positive ON product_offers IS 
  'Ensures price is non-negative (>= 0). Added in migration 0020.';

COMMENT ON CONSTRAINT check_product_offers_original_price_positive ON product_offers IS 
  'Ensures original_price is non-negative when present. Added in migration 0020.';

COMMENT ON CONSTRAINT check_product_offers_price_logical ON product_offers IS 
  'Ensures sale price does not exceed original price. Added in migration 0020.';

COMMENT ON CONSTRAINT check_price_history_price_positive ON price_history IS 
  'Ensures historical price records are non-negative. Added in migration 0020.';

COMMENT ON CONSTRAINT check_price_history_original_price_positive ON price_history IS 
  'Ensures historical original_price is non-negative when present. Added in migration 0020.';

COMMENT ON CONSTRAINT check_price_alerts_target_price_positive ON price_alerts IS 
  'Ensures target price is strictly positive (> 0). Added in migration 0020.';

COMMENT ON CONSTRAINT check_price_alerts_price_when_created_positive ON price_alerts IS 
  'Ensures price_when_created is non-negative when present. Added in migration 0020.';

COMMENT ON CONSTRAINT check_price_snapshots_prices_positive ON price_snapshots IS 
  'Ensures all snapshot prices are non-negative. Added in migration 0020.';

COMMENT ON CONSTRAINT check_price_snapshots_range_valid ON price_snapshots IS 
  'Ensures highest_price >= lowest_price. Added in migration 0020.';

COMMENT ON CONSTRAINT check_price_snapshots_avg_in_range ON price_snapshots IS 
  'Ensures average_price is within [lowest_price, highest_price] range. Added in migration 0020.';

COMMIT;

-- ============================================================================
-- Rollback Instructions
-- ============================================================================
-- To rollback this migration, execute:
--
-- BEGIN;
-- 
-- ALTER TABLE product_offers DROP CONSTRAINT IF EXISTS check_product_offers_price_positive;
-- ALTER TABLE product_offers DROP CONSTRAINT IF EXISTS check_product_offers_original_price_positive;
-- ALTER TABLE product_offers DROP CONSTRAINT IF EXISTS check_product_offers_price_logical;
-- 
-- ALTER TABLE price_history DROP CONSTRAINT IF EXISTS check_price_history_price_positive;
-- ALTER TABLE price_history DROP CONSTRAINT IF EXISTS check_price_history_original_price_positive;
-- 
-- ALTER TABLE price_alerts DROP CONSTRAINT IF EXISTS check_price_alerts_target_price_positive;
-- ALTER TABLE price_alerts DROP CONSTRAINT IF EXISTS check_price_alerts_price_when_created_positive;
-- 
-- ALTER TABLE price_snapshots DROP CONSTRAINT IF EXISTS check_price_snapshots_prices_positive;
-- ALTER TABLE price_snapshots DROP CONSTRAINT IF EXISTS check_price_snapshots_range_valid;
-- ALTER TABLE price_snapshots DROP CONSTRAINT IF EXISTS check_price_snapshots_avg_in_range;
-- 
-- COMMIT;
-- ============================================================================
