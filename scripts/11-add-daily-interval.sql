-- Allow the daily Premium tier (and weekly, which Sweep also supports) in
-- billing_subscriptions. Safe to run more than once.
ALTER TABLE billing_subscriptions
  DROP CONSTRAINT IF EXISTS billing_subscriptions_billing_interval_check;

ALTER TABLE billing_subscriptions
  ADD CONSTRAINT billing_subscriptions_billing_interval_check
  CHECK (billing_interval IN ('daily', 'weekly', 'monthly', 'yearly'));
