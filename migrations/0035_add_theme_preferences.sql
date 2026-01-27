-- Migration 0035: Add theme preferences to users table
-- Part of TODO 258: Add API Endpoints for User Preferences (Agent-Native)
--
-- PURPOSE: Enable theme preference persistence at account level
-- FEATURES:
--   - Theme selection (light, dark, system)
--   - High contrast mode toggle
--   - Accessible to agents for preference synchronization
--
-- RATIONALE: Theme preferences were only in localStorage, making them:
-- 1. Device-specific (not synced across devices)
-- 2. Lost when clearing browser data
-- 3. Inaccessible to agents (violating agent-native principle)

-- Add theme preference column
ALTER TABLE users
ADD COLUMN IF NOT EXISTS theme VARCHAR(10) DEFAULT 'system';

-- Add high contrast preference column
ALTER TABLE users
ADD COLUMN IF NOT EXISTS high_contrast BOOLEAN DEFAULT false;

-- Add check constraint for valid theme values
ALTER TABLE users
ADD CONSTRAINT check_users_theme_valid
CHECK (theme IN ('light', 'dark', 'system'));

-- Add comments explaining columns
COMMENT ON COLUMN users.theme IS 'User theme preference: light, dark, or system (follows OS preference)';
COMMENT ON COLUMN users.high_contrast IS 'High contrast mode toggle for accessibility';

-- Add partial index for analytics queries (theme usage statistics)
CREATE INDEX IF NOT EXISTS idx_users_theme
ON users(theme)
WHERE theme IS NOT NULL;
