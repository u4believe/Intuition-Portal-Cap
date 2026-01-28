-- Remove user_profiles foreign key and reference auth.users directly
-- Drop the existing foreign key constraint
ALTER TABLE alert_preferences 
DROP CONSTRAINT IF EXISTS alert_preferences_user_id_fkey;

-- Add new foreign key to auth.users
ALTER TABLE alert_preferences
ADD CONSTRAINT alert_preferences_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- Update alert_history to reference auth.users directly
ALTER TABLE alert_history
DROP CONSTRAINT IF EXISTS alert_history_user_id_fkey;

ALTER TABLE alert_history
ADD CONSTRAINT alert_history_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- Update email_logs to reference auth.users directly
ALTER TABLE email_logs
DROP CONSTRAINT IF EXISTS email_logs_user_id_fkey;

ALTER TABLE email_logs
ADD CONSTRAINT email_logs_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
