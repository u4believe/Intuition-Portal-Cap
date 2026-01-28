-- Create watched_triples table for storing user-selected claims and atoms
CREATE TABLE IF NOT EXISTS watched_triples (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  preference_id UUID NOT NULL REFERENCES alert_preferences(id) ON DELETE CASCADE,
  triple_id TEXT NOT NULL,
  label TEXT NOT NULL,
  image TEXT,
  type TEXT DEFAULT 'claim',
  market_cap DECIMAL(20, 2),
  position_count INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(preference_id, triple_id)
);

-- Enable RLS
ALTER TABLE watched_triples ENABLE ROW LEVEL SECURITY;

-- RLS Policies for watched_triples
CREATE POLICY "Users can view their own watched triples" ON watched_triples
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM alert_preferences 
      WHERE alert_preferences.id = watched_triples.preference_id 
      AND alert_preferences.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can add their own watched triples" ON watched_triples
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM alert_preferences 
      WHERE alert_preferences.id = watched_triples.preference_id 
      AND alert_preferences.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete their own watched triples" ON watched_triples
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM alert_preferences 
      WHERE alert_preferences.id = watched_triples.preference_id 
      AND alert_preferences.user_id = auth.uid()
    )
  );

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_watched_triples_preference_id ON watched_triples(preference_id);
CREATE INDEX IF NOT EXISTS idx_watched_triples_triple_id ON watched_triples(triple_id);

-- Update alert_history to include triple_id reference
ALTER TABLE alert_history 
ADD COLUMN IF NOT EXISTS triple_id TEXT,
ADD COLUMN IF NOT EXISTS triple_label TEXT,
ADD COLUMN IF NOT EXISTS alert_type TEXT,
ADD COLUMN IF NOT EXISTS predicate_label TEXT,
ADD COLUMN IF NOT EXISTS price_change DECIMAL(10, 4),
ADD COLUMN IF NOT EXISTS market_cap DECIMAL(20, 2),
ADD COLUMN IF NOT EXISTS position_count INTEGER,
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending';

-- Create indexes for alert_history improvements
CREATE INDEX IF NOT EXISTS idx_alert_history_triple_id ON alert_history(triple_id);
CREATE INDEX IF NOT EXISTS idx_alert_history_status ON alert_history(status);
CREATE INDEX IF NOT EXISTS idx_alert_history_created_at ON alert_history(created_at DESC);
