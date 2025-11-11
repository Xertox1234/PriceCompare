-- Migration: Enhance Price Alerts for Phase 3.2
-- Date: 2025-11-11
-- Description: Adds tracking fields and smart suggestions to price alerts

-- Add historical context field
ALTER TABLE price_alerts ADD COLUMN IF NOT EXISTS price_when_created DECIMAL(10, 2);

-- Add effectiveness tracking fields
ALTER TABLE price_alerts ADD COLUMN IF NOT EXISTS times_triggered INTEGER DEFAULT 0;
ALTER TABLE price_alerts ADD COLUMN IF NOT EXISTS last_triggered_at TIMESTAMP;

-- Add smart suggestion fields
ALTER TABLE price_alerts ADD COLUMN IF NOT EXISTS suggested_by_system BOOLEAN DEFAULT FALSE;
ALTER TABLE price_alerts ADD COLUMN IF NOT EXISTS suggestion_reason TEXT;

-- Add updated_at field
ALTER TABLE price_alerts ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_price_alerts_user_active ON price_alerts(user_id, is_active) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_price_alerts_product ON price_alerts(product_id);
CREATE INDEX IF NOT EXISTS idx_price_alerts_triggered ON price_alerts(last_triggered_at DESC) WHERE last_triggered_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_price_alerts_suggested ON price_alerts(suggested_by_system) WHERE suggested_by_system = TRUE;

-- Add comments for documentation
COMMENT ON COLUMN price_alerts.price_when_created IS 'Price of the product when the alert was created';
COMMENT ON COLUMN price_alerts.times_triggered IS 'Number of times this alert has been triggered';
COMMENT ON COLUMN price_alerts.last_triggered_at IS 'Timestamp of when the alert was last triggered';
COMMENT ON COLUMN price_alerts.suggested_by_system IS 'Whether this alert was suggested by the smart recommendation system';
COMMENT ON COLUMN price_alerts.suggestion_reason IS 'Explanation of why the system suggested this alert';

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_price_alerts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_price_alerts_timestamp
BEFORE UPDATE ON price_alerts
FOR EACH ROW
EXECUTE FUNCTION update_price_alerts_updated_at();
