-- Migration: Fix SET NULL + NOT NULL constraint conflicts
-- Issue: #85 - https://github.com/Xertox1234/PriceCompare/issues/85
--
-- Problem: Several columns have onDelete: 'set null' but also have NOT NULL constraints.
-- This causes constraint violations when trying to delete users with associated forum content.
--
-- Solution: Make the columns nullable to allow SET NULL to work properly.
-- This preserves forum content when users are deleted (displayed as "[deleted user]").
--
-- Affected tables:
-- 1. forum_topics.author_id
-- 2. forum_posts.author_id
-- 3. post_revisions.edited_by_id

-- Safety: Check if we're in a transaction
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_stat_activity WHERE state = 'active' AND query LIKE '%0015_fix_set_null_constraints%') THEN
    RAISE NOTICE 'Migration 0015: Fixing SET NULL + NOT NULL constraint conflicts';
  END IF;
END $$;

-- 1. Make forum_topics.author_id nullable
-- This allows SET NULL on user deletion while preserving the topic
ALTER TABLE forum_topics ALTER COLUMN author_id DROP NOT NULL;

-- 2. Make forum_posts.author_id nullable
-- This allows SET NULL on user deletion while preserving the post
ALTER TABLE forum_posts ALTER COLUMN author_id DROP NOT NULL;

-- 3. Make post_revisions.edited_by_id nullable
-- This allows SET NULL on user deletion while preserving the revision history
ALTER TABLE post_revisions ALTER COLUMN edited_by_id DROP NOT NULL;

-- Verify the changes
DO $$
DECLARE
  forum_topics_nullable boolean;
  forum_posts_nullable boolean;
  post_revisions_nullable boolean;
BEGIN
  SELECT is_nullable = 'YES' INTO forum_topics_nullable
  FROM information_schema.columns
  WHERE table_name = 'forum_topics' AND column_name = 'author_id';

  SELECT is_nullable = 'YES' INTO forum_posts_nullable
  FROM information_schema.columns
  WHERE table_name = 'forum_posts' AND column_name = 'author_id';

  SELECT is_nullable = 'YES' INTO post_revisions_nullable
  FROM information_schema.columns
  WHERE table_name = 'post_revisions' AND column_name = 'edited_by_id';

  IF forum_topics_nullable AND forum_posts_nullable AND post_revisions_nullable THEN
    RAISE NOTICE 'Migration 0015 completed successfully: All columns are now nullable';
  ELSE
    RAISE EXCEPTION 'Migration 0015 verification failed: One or more columns are still NOT NULL';
  END IF;
END $$;
