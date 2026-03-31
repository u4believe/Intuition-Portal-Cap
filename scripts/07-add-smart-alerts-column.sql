-- Add receive_smart_alerts column to push_subscriptions
ALTER TABLE push_subscriptions
ADD COLUMN IF NOT EXISTS receive_smart_alerts BOOLEAN DEFAULT TRUE;
