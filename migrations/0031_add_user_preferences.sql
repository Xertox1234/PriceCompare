-- Migration 0031: Add user preferences column for country preference
-- Part of TODO 258: Add API Endpoints for User Preferences (Agent-Native)
--
-- RATIONALE: Country preference was only stored in localStorage, making it:
-- 1. Device-specific (not account-specific)
-- 2. Lost when clearing browser data
-- 3. Inaccessible to agents (violating agent-native principle)
--
-- This migration adds preferredCountry to persist preference at account level.
-- The column is nullable to maintain backward compatibility (falls back to default 'US').

-- Add user preferences column for country preference
-- VARCHAR(2) matches ISO 3166-1 alpha-2 format used by retailers table
ALTER TABLE users
ADD COLUMN IF NOT EXISTS preferred_country VARCHAR(2) DEFAULT NULL;

-- Add comment explaining the column purpose and valid values
COMMENT ON COLUMN users.preferred_country IS 'ISO 3166-1 alpha-2 country code for user preference (e.g., US, CA). NULL defaults to US in application layer.';

-- Add partial index for queries filtering by preference
-- Only indexes rows where preferred_country is set (most users will have NULL initially)
-- This optimizes admin analytics queries like "users by country preference"
CREATE INDEX IF NOT EXISTS idx_users_preferred_country
ON users(preferred_country)
WHERE preferred_country IS NOT NULL;
