-- Migration: Add Watch Lists and Enhanced Watch Organization
-- Date: 2025-11-14
-- Description: Adds custom watch lists, categories, notes, and priority for watch organization

-- Create watch_lists table
CREATE TABLE IF NOT EXISTS watch_lists (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  color VARCHAR(7), -- Hex color code for UI (e.g., #FF5733)
  icon VARCHAR(50), -- Icon name for UI
  is_default BOOLEAN DEFAULT false,
  sort_order INTEGER DEFAULT 0, -- For custom ordering
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  CONSTRAINT unique_user_list_name UNIQUE(user_id, name)
);

-- Create indexes for watch_lists
CREATE INDEX IF NOT EXISTS idx_watch_lists_user ON watch_lists(user_id);
CREATE INDEX IF NOT EXISTS idx_watch_lists_default ON watch_lists(user_id, is_default) WHERE is_default = true;

COMMENT ON TABLE watch_lists IS 'Custom watch lists for organizing watched products';
COMMENT ON COLUMN watch_lists.name IS 'Display name of the watch list';
COMMENT ON COLUMN watch_lists.is_default IS 'True if this is the user''s default watch list';
COMMENT ON COLUMN watch_lists.sort_order IS 'Custom ordering for user''s watch lists';

-- Add new columns to product_watches table
ALTER TABLE product_watches
  ADD COLUMN IF NOT EXISTS watch_list_id INTEGER REFERENCES watch_lists(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS category VARCHAR(100),
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS priority INTEGER DEFAULT 3 CHECK (priority BETWEEN 1 AND 5),
  ADD COLUMN IF NOT EXISTS target_price DECIMAL(10, 2),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();

-- Create new indexes for enhanced querying
CREATE INDEX IF NOT EXISTS idx_product_watches_list ON product_watches(watch_list_id);
CREATE INDEX IF NOT EXISTS idx_product_watches_category ON product_watches(category) WHERE category IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_product_watches_priority ON product_watches(priority DESC);
CREATE INDEX IF NOT EXISTS idx_product_watches_updated ON product_watches(updated_at DESC);

-- Drop old unique constraint and add new one that allows same product in different lists
ALTER TABLE product_watches DROP CONSTRAINT IF EXISTS product_watches_user_id_product_id_key;
ALTER TABLE product_watches
  ADD CONSTRAINT unique_user_product_list UNIQUE(user_id, product_id, watch_list_id);

COMMENT ON COLUMN product_watches.watch_list_id IS 'Optional watch list this watch belongs to';
COMMENT ON COLUMN product_watches.category IS 'User-defined category for this watch';
COMMENT ON COLUMN product_watches.notes IS 'User notes about this product';
COMMENT ON COLUMN product_watches.priority IS 'Priority level 1-5 (5 is highest)';
COMMENT ON COLUMN product_watches.target_price IS 'User''s target price for alerts';

-- Create default watch list for all existing users
INSERT INTO watch_lists (user_id, name, description, is_default, sort_order)
SELECT
  id,
  'My Watches',
  'Default watch list',
  true,
  0
FROM users
WHERE id NOT IN (SELECT user_id FROM watch_lists WHERE is_default = true)
ON CONFLICT (user_id, name) DO NOTHING;

-- Assign existing watches to users' default watch lists
UPDATE product_watches pw
SET watch_list_id = (
  SELECT id FROM watch_lists wl
  WHERE wl.user_id = pw.user_id AND wl.is_default = true
  LIMIT 1
)
WHERE watch_list_id IS NULL;

-- Create trigger to auto-create default watch list for new users
CREATE OR REPLACE FUNCTION create_default_watch_list()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO watch_lists (user_id, name, description, is_default, sort_order)
  VALUES (NEW.id, 'My Watches', 'Default watch list', true, 0)
  ON CONFLICT (user_id, name) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_create_default_watch_list
AFTER INSERT ON users
FOR EACH ROW
EXECUTE FUNCTION create_default_watch_list();

-- Create trigger to update watch_lists.updated_at
CREATE OR REPLACE FUNCTION update_watch_list_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_watch_list_timestamp
BEFORE UPDATE ON watch_lists
FOR EACH ROW
EXECUTE FUNCTION update_watch_list_updated_at();

-- Create trigger to update product_watches.updated_at
CREATE OR REPLACE FUNCTION update_product_watch_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_product_watch_timestamp
BEFORE UPDATE ON product_watches
FOR EACH ROW
EXECUTE FUNCTION update_product_watch_updated_at();

-- Create materialized view for watch list statistics (for performance)
CREATE MATERIALIZED VIEW IF NOT EXISTS watch_list_stats AS
SELECT
  wl.id AS watch_list_id,
  wl.user_id,
  wl.name,
  COUNT(pw.id) AS watch_count,
  COUNT(CASE WHEN pw.priority = 5 THEN 1 END) AS high_priority_count,
  MIN(pw.created_at) AS oldest_watch,
  MAX(pw.created_at) AS newest_watch
FROM watch_lists wl
LEFT JOIN product_watches pw ON pw.watch_list_id = wl.id
GROUP BY wl.id, wl.user_id, wl.name;

-- Create index on the materialized view
CREATE INDEX IF NOT EXISTS idx_watch_list_stats_user ON watch_list_stats(user_id);

COMMENT ON MATERIALIZED VIEW watch_list_stats IS 'Pre-computed statistics for watch lists';

-- Function to refresh watch list stats
CREATE OR REPLACE FUNCTION refresh_watch_list_stats()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY watch_list_stats;
END;
$$ LANGUAGE plpgsql;
