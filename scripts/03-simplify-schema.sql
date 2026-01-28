-- Remove user_profiles table dependency and update foreign keys
-- This script removes the problematic user_profiles table and updates alert_preferences
-- to reference auth.users directly without RLS issues

-- Drop the user_profiles table if it exists
DROP TABLE IF EXISTS user_profiles CASCADE;

-- Update alert_preferences foreign key to reference auth.users directly
ALTER TABLE alert_preferences
DROP CONSTRAINT IF EXISTS alert_preferences_user_id_fkey;

ALTER TABLE alert_preferences
ADD CONSTRAINT alert_preferences_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- Disable RLS on alert_preferences and alert_triggers to allow auth users to write
ALTER TABLE alert_preferences DISABLE ROW LEVEL SECURITY;
ALTER TABLE alert_triggers DISABLE ROW LEVEL SECURITY;
ALTER TABLE alert_history DISABLE ROW LEVEL SECURITY;

-- Create simpler RLS policies that only require authentication
ALTER TABLE alert_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read their own preferences" ON alert_preferences
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own preferences" ON alert_preferences
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own preferences" ON alert_preferences
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own preferences" ON alert_preferences
  FOR DELETE USING (auth.uid() = user_id);

-- Apply similar policies to alert_triggers
ALTER TABLE alert_triggers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read their own triggers" ON alert_triggers
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM alert_preferences 
      WHERE alert_preferences.id = alert_triggers.preference_id
      AND alert_preferences.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert their own triggers" ON alert_triggers
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM alert_preferences 
      WHERE alert_preferences.id = alert_triggers.preference_id
      AND alert_preferences.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update their own triggers" ON alert_triggers
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM alert_preferences 
      WHERE alert_preferences.id = alert_triggers.preference_id
      AND alert_preferences.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete their own triggers" ON alert_triggers
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM alert_preferences 
      WHERE alert_preferences.id = alert_triggers.preference_id
      AND alert_preferences.user_id = auth.uid()
    )
  );
