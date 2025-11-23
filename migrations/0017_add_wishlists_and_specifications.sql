-- Migration: Add wishlists and product specifications
-- Date: 2024-11-23
-- Description: Adds wishlist tables for simple "I want this" lists (separate from price tracking watchlists)
--              and product specifications for structured key/value specs

-- =====================================================
-- WISHLISTS - Simple product lists users want to buy
-- =====================================================

-- User wishlists (containers for wishlist items)
CREATE TABLE IF NOT EXISTS wishlists (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL DEFAULT 'My Wishlist',
    description TEXT,
    is_public BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Index for user lookups
CREATE INDEX IF NOT EXISTS wishlists_user_id_idx ON wishlists(user_id);

-- Wishlist items (products in a wishlist)
CREATE TABLE IF NOT EXISTS wishlist_items (
    id SERIAL PRIMARY KEY,
    wishlist_id INTEGER NOT NULL REFERENCES wishlists(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    notes TEXT,
    priority INTEGER DEFAULT 3 CHECK (priority >= 1 AND priority <= 5),
    added_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for wishlist items
CREATE INDEX IF NOT EXISTS wishlist_items_wishlist_id_idx ON wishlist_items(wishlist_id);
CREATE INDEX IF NOT EXISTS wishlist_items_user_id_idx ON wishlist_items(user_id);
CREATE INDEX IF NOT EXISTS wishlist_items_product_id_idx ON wishlist_items(product_id);

-- Prevent duplicate products in same wishlist
CREATE UNIQUE INDEX IF NOT EXISTS unique_wishlist_product ON wishlist_items(wishlist_id, product_id);

-- =====================================================
-- PRODUCT SPECIFICATIONS - Structured key/value specs
-- =====================================================

-- Product specifications table
CREATE TABLE IF NOT EXISTS product_specifications (
    id SERIAL PRIMARY KEY,
    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    spec_group VARCHAR(100),
    spec_name VARCHAR(100) NOT NULL,
    spec_value TEXT NOT NULL,
    spec_unit VARCHAR(50),
    sort_order INTEGER DEFAULT 0,
    is_highlight BOOLEAN DEFAULT FALSE,
    source VARCHAR(50) DEFAULT 'scraper',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for product specifications
CREATE INDEX IF NOT EXISTS product_specs_product_id_idx ON product_specifications(product_id);
CREATE INDEX IF NOT EXISTS product_specs_group_idx ON product_specifications(product_id, spec_group);

-- Prevent duplicate specs for same product/group/name combination
CREATE UNIQUE INDEX IF NOT EXISTS unique_product_spec ON product_specifications(product_id, spec_group, spec_name);

-- =====================================================
-- HELPER FUNCTION - Auto-update timestamps
-- =====================================================

-- Function to update updated_at timestamp (if not exists)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for auto-updating timestamps
DROP TRIGGER IF EXISTS update_wishlists_updated_at ON wishlists;
CREATE TRIGGER update_wishlists_updated_at
    BEFORE UPDATE ON wishlists
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_product_specifications_updated_at ON product_specifications;
CREATE TRIGGER update_product_specifications_updated_at
    BEFORE UPDATE ON product_specifications
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- COMMENTS - Document the tables
-- =====================================================

COMMENT ON TABLE wishlists IS 'User wishlists - simple product lists (separate from price tracking watchlists)';
COMMENT ON COLUMN wishlists.is_public IS 'If true, wishlist can be shared via link';

COMMENT ON TABLE wishlist_items IS 'Products in a wishlist - no price tracking, just "I want this"';
COMMENT ON COLUMN wishlist_items.priority IS '1-5 priority scale, higher = more wanted';
COMMENT ON COLUMN wishlist_items.notes IS 'User notes about why they want this product';

COMMENT ON TABLE product_specifications IS 'Structured key/value specs for electronics, appliances, etc.';
COMMENT ON COLUMN product_specifications.spec_group IS 'Grouping category: Display, Processor, Battery, Dimensions, etc.';
COMMENT ON COLUMN product_specifications.spec_name IS 'Specification name: Screen Size, RAM, Weight, etc.';
COMMENT ON COLUMN product_specifications.spec_value IS 'The value: 6.1 inches, 8GB, 174g, etc.';
COMMENT ON COLUMN product_specifications.spec_unit IS 'Unit of measurement: inches, GB, g, mAh, etc.';
COMMENT ON COLUMN product_specifications.is_highlight IS 'If true, show in product card/summary view';
COMMENT ON COLUMN product_specifications.source IS 'Data source: scraper, manual, api';
