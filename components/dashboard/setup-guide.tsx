"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { AlertCircle, Copy, ExternalLink } from "lucide-react"
import { useState } from "react"

const SQL_SCRIPT = `-- Create users table (extends Supabase auth)
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
  metric_type TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create user alert preferences
CREATE TABLE IF NOT EXISTS alert_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  predicate_id TEXT NOT NULL,
  predicate_name TEXT,
  email TEXT NOT NULL,
  alert_frequency TEXT NOT NULL DEFAULT 'daily',
  is_enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, predicate_id)
);

-- Create alert triggers
CREATE TABLE IF NOT EXISTS alert_triggers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  preference_id UUID NOT NULL REFERENCES alert_preferences(id) ON DELETE CASCADE,
  trigger_type_id UUID NOT NULL REFERENCES alert_trigger_types(id),
  threshold_value DECIMAL(10, 2),
  threshold_type TEXT,
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
  data JSONB,
  email_sent_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create email logs
CREATE TABLE IF NOT EXISTS email_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  recipient_email TEXT NOT NULL,
  subject TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  sent_at TIMESTAMP WITH TIME ZONE
);

-- Enable RLS
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

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_alert_preferences_user_id ON alert_preferences(user_id);
CREATE INDEX IF NOT EXISTS idx_alert_preferences_predicate_id ON alert_preferences(predicate_id);
CREATE INDEX IF NOT EXISTS idx_alert_history_user_id ON alert_history(user_id);
CREATE INDEX IF NOT EXISTS idx_email_logs_user_id ON email_logs(user_id);`

export default function SetupGuide() {
  const [copied, setCopied] = useState(false)

  function copyToClipboard() {
    navigator.clipboard.writeText(SQL_SCRIPT)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="space-y-6">
      <Card className="border-amber-200 bg-amber-50 dark:bg-amber-950 dark:border-amber-800">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-amber-900 dark:text-amber-200">
            <AlertCircle className="w-5 h-5" />
            Database Setup Required
          </CardTitle>
          <CardDescription className="text-amber-800 dark:text-amber-300">
            The database tables need to be created before you can use the alert system
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <h3 className="font-semibold text-amber-900 dark:text-amber-200">
              Follow these steps to set up your database:
            </h3>

            <ol className="space-y-3 list-decimal list-inside text-sm text-amber-900 dark:text-amber-100">
              <li>
                Go to your{" "}
                <a
                  href="https://app.supabase.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-semibold underline inline-flex items-center gap-1"
                >
                  Supabase Dashboard
                  <ExternalLink className="w-3 h-3" />
                </a>
              </li>
              <li>Select your project</li>
              <li>Go to SQL Editor (left sidebar)</li>
              <li>Click "New Query"</li>
              <li>Copy and paste the SQL script below</li>
              <li>Click "Run" to execute the script</li>
              <li>Refresh this page (the alerts will start working)</li>
            </ol>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-lg border p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-mono text-sm font-semibold text-amber-900 dark:text-amber-200">SQL Script</h4>
              <Button size="sm" variant="outline" onClick={copyToClipboard} className="gap-2 bg-transparent">
                <Copy className="w-4 h-4" />
                {copied ? "Copied!" : "Copy"}
              </Button>
            </div>
            <pre className="text-xs overflow-auto max-h-96 bg-slate-100 dark:bg-slate-800 p-3 rounded font-mono text-slate-700 dark:text-slate-300">
              {SQL_SCRIPT}
            </pre>
          </div>

          <div className="p-3 rounded-md bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 text-sm text-blue-900 dark:text-blue-200">
            After running the SQL script, refresh this page and you'll be able to configure your alert preferences.
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
