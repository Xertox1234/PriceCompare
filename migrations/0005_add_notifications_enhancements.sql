-- Migration: Add Notification Enhancements for Phase 3.1
-- Date: 2025-11-11
-- Description: Adds notification preferences and extends notifications table for price drop alerts

-- Add relatedProductId column to notifications table
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS related_product_id INTEGER REFERENCES products(id);

-- Create index for faster product-related notification lookups
CREATE INDEX IF NOT EXISTS idx_notifications_product ON notifications(related_product_id) WHERE related_product_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_notifications_type_user ON notifications(type, user_id, created_at DESC);

-- Add comment to clarify notification types
COMMENT ON COLUMN notifications.type IS 'Notification type: mention, reply, like, price_drop, price_alert, etc.';

-- Create notification_preferences table
CREATE TABLE IF NOT EXISTS notification_preferences (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,

  -- Price drop settings
  price_drop_enabled BOOLEAN DEFAULT TRUE,
  price_drop_threshold_percent INTEGER DEFAULT 10, -- 10% default drop threshold
  price_drop_threshold_amount DECIMAL(10, 2) DEFAULT 5.00, -- $5 default drop threshold

  -- Alert settings
  price_alert_enabled BOOLEAN DEFAULT TRUE,

  -- Notification channels
  email_enabled BOOLEAN DEFAULT TRUE,
  in_app_enabled BOOLEAN DEFAULT TRUE,

  -- Frequency settings
  max_daily_notifications INTEGER DEFAULT 10,
  quiet_hours_start INTEGER, -- Hour 0-23, NULL = disabled
  quiet_hours_end INTEGER, -- Hour 0-23, NULL = disabled

  -- Metadata
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for notification preferences
CREATE INDEX IF NOT EXISTS idx_notif_prefs_user ON notification_preferences(user_id);

-- Add comments for documentation
COMMENT ON TABLE notification_preferences IS 'User preferences for price drop and alert notifications';
COMMENT ON COLUMN notification_preferences.price_drop_threshold_percent IS 'Minimum percentage drop to trigger notification (e.g., 10 = 10%)';
COMMENT ON COLUMN notification_preferences.price_drop_threshold_amount IS 'Minimum dollar amount drop to trigger notification';
COMMENT ON COLUMN notification_preferences.quiet_hours_start IS 'Start hour for quiet period (0-23), NULL if disabled';
COMMENT ON COLUMN notification_preferences.quiet_hours_end IS 'End hour for quiet period (0-23), NULL if disabled';
COMMENT ON COLUMN notification_preferences.max_daily_notifications IS 'Maximum number of notifications per day';

-- Create default notification preferences for existing users
INSERT INTO notification_preferences (user_id)
SELECT id FROM users
WHERE id NOT IN (SELECT user_id FROM notification_preferences)
ON CONFLICT (user_id) DO NOTHING;

-- Create a trigger to automatically create preferences for new users
CREATE OR REPLACE FUNCTION create_default_notification_preferences()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO notification_preferences (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_create_notification_preferences
AFTER INSERT ON users
FOR EACH ROW
EXECUTE FUNCTION create_default_notification_preferences();

-- Create a function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_notification_preferences_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_notification_preferences_timestamp
BEFORE UPDATE ON notification_preferences
FOR EACH ROW
EXECUTE FUNCTION update_notification_preferences_updated_at();
