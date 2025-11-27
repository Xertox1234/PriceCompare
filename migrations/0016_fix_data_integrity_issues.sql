-- Migration: 0016_fix_data_integrity_issues.sql
-- Description: Fix data integrity issues identified in code review
-- Author: Claude Code Review System
-- Date: 2025-11-22

-- ============================================================================
-- 1. Fix SET NULL + NOT NULL conflict on private_messages.sender_id
-- ============================================================================
-- Problem: sender_id has onDelete: 'set null' but is NOT NULL
-- Solution: Drop NOT NULL constraint so SET NULL can work on user deletion

ALTER TABLE private_messages
  ALTER COLUMN sender_id DROP NOT NULL;

-- ============================================================================
-- 2. Add unique constraint on post_likes to prevent duplicate likes
-- ============================================================================
-- Problem: User can like the same post multiple times
-- Solution: Add unique constraint on (post_id, user_id)

-- First, clean up any existing duplicates (keep earliest like)
DELETE FROM post_likes a
USING post_likes b
WHERE a.ctid > b.ctid
  AND a.post_id = b.post_id
  AND a.user_id = b.user_id;

-- Add the unique constraint (skip if already exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'unique_post_user_like'
  ) THEN
    ALTER TABLE post_likes ADD CONSTRAINT unique_post_user_like UNIQUE (post_id, user_id);
  END IF;
END $$;

-- ============================================================================
-- 3. Add unique constraint on user_badges to prevent duplicate badge awards
-- ============================================================================

-- Clean up any existing duplicates
DELETE FROM user_badges a
USING user_badges b
WHERE a.ctid > b.ctid
  AND a.user_id = b.user_id
  AND a.badge_id = b.badge_id;

-- Add the unique constraint (skip if already exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'unique_user_badge'
  ) THEN
    ALTER TABLE user_badges ADD CONSTRAINT unique_user_badge UNIQUE (user_id, badge_id);
  END IF;
END $$;

-- ============================================================================
-- 4. Add unique constraint on topic_tag_relations
-- ============================================================================

-- Clean up any existing duplicates
DELETE FROM topic_tag_relations a
USING topic_tag_relations b
WHERE a.ctid > b.ctid
  AND a.topic_id = b.topic_id
  AND a.tag_id = b.tag_id;

-- Add the unique constraint (skip if already exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'unique_topic_tag'
  ) THEN
    ALTER TABLE topic_tag_relations ADD CONSTRAINT unique_topic_tag UNIQUE (topic_id, tag_id);
  END IF;
END $$;

-- ============================================================================
-- 5. Add unique constraint on post_mentions
-- ============================================================================

-- Clean up any existing duplicates
DELETE FROM post_mentions a
USING post_mentions b
WHERE a.ctid > b.ctid
  AND a.post_id = b.post_id
  AND a.mentioned_user_id = b.mentioned_user_id;

-- Add the unique constraint (skip if already exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'unique_post_mention'
  ) THEN
    ALTER TABLE post_mentions ADD CONSTRAINT unique_post_mention UNIQUE (post_id, mentioned_user_id);
  END IF;
END $$;

-- ============================================================================
-- 6. Add composite index for notification queries (performance)
-- ============================================================================

CREATE INDEX IF NOT EXISTS notifications_user_type_idx
  ON notifications (user_id, type, is_read, created_at);

-- ============================================================================
-- 7. Add index on forum_topics.slug (performance)
-- ============================================================================

CREATE INDEX IF NOT EXISTS forum_topics_slug_idx
  ON forum_topics (slug);

-- ============================================================================
-- Verification queries (for manual checking after migration)
-- ============================================================================
-- SELECT COUNT(*) FROM post_likes GROUP BY post_id, user_id HAVING COUNT(*) > 1;
-- SELECT COUNT(*) FROM user_badges GROUP BY user_id, badge_id HAVING COUNT(*) > 1;
-- \d+ private_messages (check sender_id is nullable)
