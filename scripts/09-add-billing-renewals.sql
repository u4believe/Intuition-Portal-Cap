-- Renewal retries for Premium subscriptions (see lib/billing/subscriptions.ts).
-- renewal_attempts counts failed tries for the current period; it resets to 0
-- when a charge succeeds. After the last retry the status becomes 'lapsed'.
ALTER TABLE billing_subscriptions
  ADD COLUMN IF NOT EXISTS renewal_attempts INTEGER NOT NULL DEFAULT 0;

-- Reconciliation looks up pending charges by age.
CREATE INDEX IF NOT EXISTS billing_charges_pending_idx
  ON billing_charges (created_at)
  WHERE status = 'pending';
