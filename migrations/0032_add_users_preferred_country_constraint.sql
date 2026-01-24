-- Migration 0032: Add CHECK constraint to users.preferred_country
-- Created: 2026-01-23
-- Related: TODO 267 - Code Review Finding
--
-- PURPOSE: Ensure data integrity by validating preferred_country at database level.
-- This mirrors the constraint on retailers.country_code from migration 0030.
--
-- IMPORTANT: Country values in CHECK constraint must stay in sync with:
--   shared/country-constants.ts - Single source of truth for TypeScript code
--   migrations/0030_add_retailer_country_support.sql - Retailers table constraints
--
-- When adding new countries, update ALL THREE locations.

-- Add CHECK constraint for valid country codes (idempotent)
-- Allows NULL (user hasn't set preference) or valid country codes (US, CA)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_users_preferred_country'
  ) THEN
    ALTER TABLE users
    ADD CONSTRAINT chk_users_preferred_country
    CHECK (preferred_country IS NULL OR preferred_country IN ('US', 'CA'));
  END IF;
END $$;

-- Add comment documenting the constraint
COMMENT ON CONSTRAINT chk_users_preferred_country ON users IS
  'Validates preferred_country matches supported countries. Sync with shared/country-constants.ts and migrations/0030.';

-- ============================================================================
-- ROLLBACK SCRIPT (save separately or use in case of issues)
-- ============================================================================
-- ALTER TABLE users DROP CONSTRAINT IF EXISTS chk_users_preferred_country;
