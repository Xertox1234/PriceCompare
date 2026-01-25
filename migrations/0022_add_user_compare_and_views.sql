-- Migration: Add user compare list and recently viewed tables
-- Description: Agent-native APIs for localStorage-only features (TODO 272)
-- Author: Code Review Multi-Agent Analysis
-- Date: 2026-01-25
--
-- These tables enable AI agents to access compare list and recently viewed
-- features that were previously localStorage-only in the browser.

-- ============================================================================
-- Compare list (normalized table for type safety)
-- Max 4 items enforced at application layer
-- ============================================================================
CREATE TABLE user_compare_items (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  added_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, product_id)
);

-- Index for efficient user lookups
CREATE INDEX idx_user_compare_items_user_id ON user_compare_items(user_id);

-- ============================================================================
-- Recently viewed (normalized table for analytics potential)
-- Max 50 items enforced at application layer with FIFO eviction
-- Uses upsert pattern to update viewed_at timestamp on re-view
-- ============================================================================
CREATE TABLE user_product_views (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  viewed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, product_id)  -- Latest view only (upsert pattern)
);

-- Index for user lookups
CREATE INDEX idx_user_product_views_user_id ON user_product_views(user_id);

-- Composite index for efficient time-ordered queries per user
CREATE INDEX idx_user_product_views_user_time ON user_product_views(user_id, viewed_at DESC);
