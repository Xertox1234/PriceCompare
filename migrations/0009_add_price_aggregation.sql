-- Migration: Add Price Aggregation Tables
-- Description: Adds tables for weekly/monthly price aggregates and price trends
-- Author: Claude
-- Date: 2025-11-15

-- Weekly price aggregates
CREATE TABLE IF NOT EXISTS price_aggregates_weekly (
  id SERIAL PRIMARY KEY,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  retailer_id INTEGER NOT NULL REFERENCES retailers(id) ON DELETE CASCADE,
  year INTEGER NOT NULL CHECK (year >= 2000 AND year <= 2100),
  week INTEGER NOT NULL CHECK (week >= 1 AND week <= 53), -- ISO week number (1-53)
  min_price DECIMAL(10, 2) NOT NULL CHECK (min_price >= 0),
  max_price DECIMAL(10, 2) NOT NULL CHECK (max_price >= 0),
  avg_price DECIMAL(10, 2) NOT NULL CHECK (avg_price >= 0),
  median_price DECIMAL(10, 2) CHECK (median_price IS NULL OR median_price >= 0),
  volatility_score DECIMAL(5, 2) CHECK (volatility_score IS NULL OR (volatility_score >= 0 AND volatility_score <= 100)), -- 0-100 scale
  record_count INTEGER NOT NULL DEFAULT 0 CHECK (record_count >= 0),
  week_over_week_change DECIMAL(10, 2), -- Percentage change from previous week
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(product_id, retailer_id, year, week),
  CHECK (max_price >= min_price),
  CHECK (avg_price >= min_price AND avg_price <= max_price)
);

CREATE INDEX idx_weekly_product_year ON price_aggregates_weekly(product_id, year DESC, week DESC);
CREATE INDEX idx_weekly_retailer_year ON price_aggregates_weekly(retailer_id, year DESC, week DESC);
CREATE INDEX idx_weekly_created ON price_aggregates_weekly(created_at DESC);

-- Monthly price aggregates
CREATE TABLE IF NOT EXISTS price_aggregates_monthly (
  id SERIAL PRIMARY KEY,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  retailer_id INTEGER NOT NULL REFERENCES retailers(id) ON DELETE CASCADE,
  year INTEGER NOT NULL CHECK (year >= 2000 AND year <= 2100),
  month INTEGER NOT NULL CHECK (month >= 1 AND month <= 12), -- 1-12
  min_price DECIMAL(10, 2) NOT NULL CHECK (min_price >= 0),
  max_price DECIMAL(10, 2) NOT NULL CHECK (max_price >= 0),
  avg_price DECIMAL(10, 2) NOT NULL CHECK (avg_price >= 0),
  median_price DECIMAL(10, 2) CHECK (median_price IS NULL OR median_price >= 0),
  volatility_score DECIMAL(5, 2) CHECK (volatility_score IS NULL OR (volatility_score >= 0 AND volatility_score <= 100)), -- 0-100 scale
  record_count INTEGER NOT NULL DEFAULT 0 CHECK (record_count >= 0),
  month_over_month_change DECIMAL(10, 2), -- Percentage change from previous month
  year_over_year_change DECIMAL(10, 2), -- Percentage change from same month last year
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(product_id, retailer_id, year, month),
  CHECK (max_price >= min_price),
  CHECK (avg_price >= min_price AND avg_price <= max_price)
);

CREATE INDEX idx_monthly_product_year ON price_aggregates_monthly(product_id, year DESC, month DESC);
CREATE INDEX idx_monthly_retailer_year ON price_aggregates_monthly(retailer_id, year DESC, month DESC);
CREATE INDEX idx_monthly_created ON price_aggregates_monthly(created_at DESC);

-- Price trends tracking
CREATE TABLE IF NOT EXISTS price_trends (
  id SERIAL PRIMARY KEY,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  retailer_id INTEGER NOT NULL REFERENCES retailers(id) ON DELETE CASCADE,
  trend_direction VARCHAR(20) NOT NULL CHECK (trend_direction IN ('uptrend', 'downtrend', 'stable')),
  trend_slope DECIMAL(10, 4), -- Linear regression slope ($/day)
  trend_strength DECIMAL(5, 4) CHECK (trend_strength IS NULL OR (trend_strength >= 0 AND trend_strength <= 1)), -- R² value (0-1)
  predicted_next_price DECIMAL(10, 2) CHECK (predicted_next_price IS NULL OR predicted_next_price >= 0),
  confidence_level VARCHAR(20) CHECK (confidence_level IS NULL OR confidence_level IN ('high', 'medium', 'low')),
  analysis_period_days INTEGER NOT NULL CHECK (analysis_period_days > 0 AND analysis_period_days <= 365), -- Number of days analyzed
  last_analyzed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(product_id, retailer_id)
);

CREATE INDEX idx_trends_product ON price_trends(product_id);
CREATE INDEX idx_trends_retailer ON price_trends(retailer_id);
CREATE INDEX idx_trends_direction ON price_trends(trend_direction);
CREATE INDEX idx_trends_analyzed ON price_trends(last_analyzed_at DESC);

-- Comments for documentation
COMMENT ON TABLE price_aggregates_weekly IS 'Weekly price aggregates for products across retailers';
COMMENT ON TABLE price_aggregates_monthly IS 'Monthly price aggregates for products across retailers';
COMMENT ON TABLE price_trends IS 'Price trend analysis and predictions based on linear regression';

COMMENT ON COLUMN price_aggregates_weekly.week IS 'ISO week number (1-53)';
COMMENT ON COLUMN price_aggregates_weekly.volatility_score IS 'Price volatility score (0-100, higher = more volatile)';
COMMENT ON COLUMN price_aggregates_weekly.week_over_week_change IS 'Percentage change from previous week';

COMMENT ON COLUMN price_aggregates_monthly.month IS 'Month number (1-12)';
COMMENT ON COLUMN price_aggregates_monthly.volatility_score IS 'Price volatility score (0-100, higher = more volatile)';
COMMENT ON COLUMN price_aggregates_monthly.month_over_month_change IS 'Percentage change from previous month';
COMMENT ON COLUMN price_aggregates_monthly.year_over_year_change IS 'Percentage change from same month last year';

COMMENT ON COLUMN price_trends.trend_slope IS 'Linear regression slope ($/day)';
COMMENT ON COLUMN price_trends.trend_strength IS 'R² value indicating how well the trend fits (0-1, higher = stronger trend)';

-- Auto-update triggers for updated_at columns
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_price_aggregates_weekly_updated_at
  BEFORE UPDATE ON price_aggregates_weekly
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_price_aggregates_monthly_updated_at
  BEFORE UPDATE ON price_aggregates_monthly
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_price_trends_updated_at
  BEFORE UPDATE ON price_trends
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
