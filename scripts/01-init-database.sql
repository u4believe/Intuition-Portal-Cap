-- Create users table (extends Supabase auth)
CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create alert trigger types
CREATE TABLE IF NOT EXISTS alert_trigger_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  label TEXT UNIQUE NOT NULL,
  description TEXT,
  metric_type TEXT NOT NULL, -- 'price_change', 'market_cap', 'position_count'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create user alert preferences
CREATE TABLE IF NOT EXISTS alert_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  predicate_id TEXT NOT NULL, -- From Intuition portal
  predicate_name TEXT,
  email TEXT NOT NULL,
  alert_frequency TEXT NOT NULL DEFAULT 'daily', -- 'realtime', 'hourly', 'daily', 'weekly'
  is_enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, predicate_id)
);

-- Create alert triggers (what should trigger an email)
CREATE TABLE IF NOT EXISTS alert_triggers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  preference_id UUID NOT NULL REFERENCES alert_preferences(id) ON DELETE CASCADE,
  trigger_type_id UUID NOT NULL REFERENCES alert_trigger_types(id),
  threshold_value DECIMAL(10, 2),
  threshold_type TEXT, -- 'percentage', 'absolute'
  is_enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create alert history
CREATE TABLE IF NOT EXISTS alert_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  preference_id UUID REFERENCES alert_preferences(id) ON DELETE SET NULL,
  trigger_type TEXT NOT NULL,
  data JSONB, -- Store the actual data from Intuition portal
  email_sent_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create email logs for tracking
CREATE TABLE IF NOT EXISTS email_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  recipient_email TEXT NOT NULL,
  subject TEXT NOT NULL,
  status TEXT DEFAULT 'pending', -- 'sent', 'failed', 'bounced'
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  sent_at TIMESTAMP WITH TIME ZONE
);

-- Enable RLS (Row Level Security)
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE alert_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE alert_triggers ENABLE ROW LEVEL SECURITY;
ALTER TABLE alert_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for user_profiles
CREATE POLICY "Users can view their own profile" ON user_profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile" ON user_profiles
  FOR UPDATE USING (auth.uid() = id);

-- RLS Policies for alert_preferences
CREATE POLICY "Users can view their own alert preferences" ON alert_preferences
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create alert preferences" ON alert_preferences
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own alert preferences" ON alert_preferences
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own alert preferences" ON alert_preferences
  FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for alert_triggers
CREATE POLICY "Users can view their own alert triggers" ON alert_triggers
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM alert_preferences 
      WHERE alert_preferences.id = alert_triggers.preference_id 
      AND alert_preferences.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can manage their own alert triggers" ON alert_triggers
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM alert_preferences 
      WHERE alert_preferences.id = alert_triggers.preference_id 
      AND alert_preferences.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update their own alert triggers" ON alert_triggers
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM alert_preferences 
      WHERE alert_preferences.id = alert_triggers.preference_id 
      AND alert_preferences.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete their own alert triggers" ON alert_triggers
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM alert_preferences 
      WHERE alert_preferences.id = alert_triggers.preference_id 
      AND alert_preferences.user_id = auth.uid()
    )
  );

-- RLS Policies for alert_history
CREATE POLICY "Users can view their own alert history" ON alert_history
  FOR SELECT USING (auth.uid() = user_id);

-- RLS Policies for email_logs
CREATE POLICY "Users can view their own email logs" ON email_logs
  FOR SELECT USING (auth.uid() = user_id);

-- Insert default trigger types
INSERT INTO alert_trigger_types (label, description, metric_type) VALUES
  ('Price Change', 'Alert when share price changes by a threshold', 'price_change'),
  ('Market Cap Change', 'Alert when total market cap changes', 'market_cap'),
  ('Position Count Change', 'Alert when position count changes', 'position_count')
ON CONFLICT (label) DO NOTHING;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_alert_preferences_user_id ON alert_preferences(user_id);
CREATE INDEX IF NOT EXISTS idx_alert_preferences_predicate_id ON alert_preferences(predicate_id);
CREATE INDEX IF NOT EXISTS idx_alert_history_user_id ON alert_history(user_id);
CREATE INDEX IF NOT EXISTS idx_email_logs_user_id ON email_logs(user_id);
