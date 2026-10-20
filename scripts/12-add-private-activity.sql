-- Premium "private activity": a subscriber's own deposits and redemptions are
-- left out of other users' push notifications. Only honoured while the
-- subscription grants Premium (see lib/billing/subscriptions.ts). Safe to re-run.
ALTER TABLE billing_subscriptions
  ADD COLUMN IF NOT EXISTS hide_activity BOOLEAN NOT NULL DEFAULT FALSE;
