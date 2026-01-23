-- Migration 0030: Add Country/Currency Support to Retailers
-- Created: 2026-01-21
-- Description: Adds countryCode and currency columns to retailers table
--              to support multi-country affiliate programs (Amazon US, Amazon CA, etc.)
-- Related: TODO 251 - Retailer Country Support

BEGIN;

-- ============================================================================
-- Step 1: Add new columns with defaults
-- Existing retailers default to US/USD (backwards compatible)
-- ============================================================================
ALTER TABLE retailers 
ADD COLUMN IF NOT EXISTS country_code VARCHAR(2) NOT NULL DEFAULT 'US',
ADD COLUMN IF NOT EXISTS currency VARCHAR(3) NOT NULL DEFAULT 'USD';

-- ============================================================================
-- Step 2: Add index for country filtering
-- Commonly used for: getRetailersByCountry(), filtering by user preference
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_retailers_country ON retailers(country_code);

-- ============================================================================
-- Step 3: Add unique constraint for retailer per country
-- Same retailer name allowed across countries, but unique within a country
-- Example: "Amazon" can exist for US, CA, MX but not two "Amazon" entries for US
-- ============================================================================
CREATE UNIQUE INDEX IF NOT EXISTS idx_retailers_unique_per_country 
ON retailers(name, country_code) 
WHERE is_active = true;

-- ============================================================================
-- Step 4: Add CHECK constraint for valid country codes (Phase 1: US, CA)
-- Can be extended later via ALTER CONSTRAINT for MX, GB, etc.
-- ============================================================================
ALTER TABLE retailers 
ADD CONSTRAINT chk_retailers_country_code 
CHECK (country_code IN ('US', 'CA'));

-- ============================================================================
-- Step 5: Add CHECK constraint for valid currency codes
-- ============================================================================
ALTER TABLE retailers 
ADD CONSTRAINT chk_retailers_currency 
CHECK (currency IN ('USD', 'CAD'));

COMMIT;

-- ============================================================================
-- ROLLBACK SCRIPT (save separately or use in case of issues)
-- ============================================================================
-- BEGIN;
-- ALTER TABLE retailers DROP CONSTRAINT IF EXISTS chk_retailers_currency;
-- ALTER TABLE retailers DROP CONSTRAINT IF EXISTS chk_retailers_country_code;
-- DROP INDEX IF EXISTS idx_retailers_unique_per_country;
-- DROP INDEX IF EXISTS idx_retailers_country;
-- ALTER TABLE retailers DROP COLUMN IF EXISTS currency;
-- ALTER TABLE retailers DROP COLUMN IF EXISTS country_code;
-- COMMIT;
