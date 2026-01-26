-- Migration 0034: Create newsletter_subscribers table
--
-- PURPOSE: Enable newsletter subscription functionality with email collection
-- FEATURES:
--   - Email validation constraint
--   - Unsubscribe support via isActive flag
--   - Source tracking (footer, modal, blog, etc.)
--   - Optional foreign key link to users table for registered users
--   - Indexes on email and isActive for fast lookups

-- Create newsletter_subscribers table
CREATE TABLE IF NOT EXISTS newsletter_subscribers (
  id SERIAL PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  subscribed_at TIMESTAMP NOT NULL DEFAULT NOW(),
  source VARCHAR(50),  -- Track where they subscribed from (footer, modal, blog, etc.)
  user_id INTEGER,     -- Optional FK to users table for registered users
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  -- Foreign key to users table (nullable - subscriber might not be registered)
  CONSTRAINT fk_newsletter_subscribers_user
    FOREIGN KEY (user_id)
    REFERENCES users(id)
    ON DELETE SET NULL  -- Keep subscription record even if user account deleted
);

-- Email validation constraint
-- Ensures email format is valid: has @ symbol and domain part
ALTER TABLE newsletter_subscribers
  ADD CONSTRAINT check_newsletter_email_format
  CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$');

-- Index on email for fast lookups
CREATE INDEX IF NOT EXISTS idx_newsletter_subscribers_email
  ON newsletter_subscribers(email);

-- Index on isActive for querying active subscribers
CREATE INDEX IF NOT EXISTS idx_newsletter_subscribers_is_active
  ON newsletter_subscribers(is_active);

-- Composite index for active subscriber queries (most common use case)
CREATE INDEX IF NOT EXISTS idx_newsletter_subscribers_active_email
  ON newsletter_subscribers(is_active, email)
  WHERE is_active = true;

-- Index on subscribed_at for chronological queries
CREATE INDEX IF NOT EXISTS idx_newsletter_subscribers_subscribed_at
  ON newsletter_subscribers(subscribed_at);

-- Index on user_id for finding subscription by user
CREATE INDEX IF NOT EXISTS idx_newsletter_subscribers_user_id
  ON newsletter_subscribers(user_id)
  WHERE user_id IS NOT NULL;

-- Add table comment
COMMENT ON TABLE newsletter_subscribers IS
  'Newsletter email subscriptions with unsubscribe support and source tracking';

COMMENT ON COLUMN newsletter_subscribers.email IS
  'Subscriber email address (validated format, unique)';

COMMENT ON COLUMN newsletter_subscribers.is_active IS
  'Subscription status: true = subscribed, false = unsubscribed';

COMMENT ON COLUMN newsletter_subscribers.source IS
  'Where the subscription originated (footer, modal, blog, product_page, etc.)';

COMMENT ON COLUMN newsletter_subscribers.user_id IS
  'Optional link to users table if subscriber is a registered user (NULL for anonymous)';

COMMENT ON CONSTRAINT check_newsletter_email_format ON newsletter_subscribers IS
  'Validates email format using regex pattern';
