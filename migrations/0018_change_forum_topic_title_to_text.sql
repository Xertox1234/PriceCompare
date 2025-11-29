-- Migration: Change forum_topics.title from VARCHAR(255) to TEXT
-- Reason: Support forum titles longer than 255 characters
-- Date: 2025-11-28

-- Change title column type from VARCHAR(255) to TEXT
ALTER TABLE forum_topics
  ALTER COLUMN title TYPE TEXT;

-- No data migration needed - VARCHAR values are compatible with TEXT
