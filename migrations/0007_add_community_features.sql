-- Migration: Add Community Features for Phase 3.3
-- Date: 2025-11-11
-- Description: Adds product watches, user reputation, deal spotting, and gamification features

-- Create product_watches table
CREATE TABLE IF NOT EXISTS product_watches (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, product_id)
);

-- Create indexes for product_watches
CREATE INDEX IF NOT EXISTS idx_product_watches_user ON product_watches(user_id);
CREATE INDEX IF NOT EXISTS idx_product_watches_product ON product_watches(product_id);
CREATE INDEX IF NOT EXISTS idx_product_watches_created ON product_watches(created_at DESC);

COMMENT ON TABLE product_watches IS 'Tracks which users are watching which products for price changes';
COMMENT ON COLUMN product_watches.user_id IS 'User watching the product';
COMMENT ON COLUMN product_watches.product_id IS 'Product being watched';

-- Create user_reputation table
CREATE TABLE IF NOT EXISTS user_reputation (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  reputation_points INTEGER DEFAULT 0,
  deals_spotted INTEGER DEFAULT 0,
  accurate_predictions INTEGER DEFAULT 0,
  community_contributions INTEGER DEFAULT 0,
  level INTEGER DEFAULT 1,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for user_reputation
CREATE INDEX IF NOT EXISTS idx_user_reputation_user ON user_reputation(user_id);
CREATE INDEX IF NOT EXISTS idx_user_reputation_points ON user_reputation(reputation_points DESC);
CREATE INDEX IF NOT EXISTS idx_user_reputation_level ON user_reputation(level DESC);

COMMENT ON TABLE user_reputation IS 'Tracks user reputation and gamification metrics';
COMMENT ON COLUMN user_reputation.reputation_points IS 'Total reputation points earned';
COMMENT ON COLUMN user_reputation.deals_spotted IS 'Number of deals this user has spotted';
COMMENT ON COLUMN user_reputation.accurate_predictions IS 'Number of accurate price predictions';
COMMENT ON COLUMN user_reputation.community_contributions IS 'Forum posts, helpful comments, etc.';
COMMENT ON COLUMN user_reputation.level IS 'User level based on reputation (1-100)';

-- Create deal_spottings table
CREATE TABLE IF NOT EXISTS deal_spottings (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  price_drop_percent DECIMAL(5, 2) NOT NULL,
  price_drop_amount DECIMAL(10, 2) NOT NULL,
  forum_post_id INTEGER REFERENCES forum_posts(id) ON DELETE SET NULL,
  reputation_awarded INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for deal_spottings
CREATE INDEX IF NOT EXISTS idx_deal_spottings_user ON deal_spottings(user_id);
CREATE INDEX IF NOT EXISTS idx_deal_spottings_product ON deal_spottings(product_id);
CREATE INDEX IF NOT EXISTS idx_deal_spottings_created ON deal_spottings(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_deal_spottings_drop_percent ON deal_spottings(price_drop_percent DESC);

COMMENT ON TABLE deal_spottings IS 'Tracks when users spot and report significant price drops';
COMMENT ON COLUMN deal_spottings.price_drop_percent IS 'Percentage the price dropped';
COMMENT ON COLUMN deal_spottings.price_drop_amount IS 'Dollar amount the price dropped';
COMMENT ON COLUMN deal_spottings.forum_post_id IS 'Link to forum post if auto-posted';
COMMENT ON COLUMN deal_spottings.reputation_awarded IS 'Reputation points awarded for this spotting';

-- Create default reputation records for existing users
INSERT INTO user_reputation (user_id)
SELECT id FROM users
WHERE id NOT IN (SELECT user_id FROM user_reputation)
ON CONFLICT (user_id) DO NOTHING;

-- Create trigger to auto-create reputation for new users
CREATE OR REPLACE FUNCTION create_default_user_reputation()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO user_reputation (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_create_user_reputation
AFTER INSERT ON users
FOR EACH ROW
EXECUTE FUNCTION create_default_user_reputation();

-- Create trigger to update user_reputation.updated_at
CREATE OR REPLACE FUNCTION update_user_reputation_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  -- Auto-calculate level based on reputation points
  NEW.level = LEAST(100, GREATEST(1, (NEW.reputation_points / 100) + 1));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_user_reputation_timestamp
BEFORE UPDATE ON user_reputation
FOR EACH ROW
EXECUTE FUNCTION update_user_reputation_updated_at();
