-- Premium subscriptions billed through the Sweep Console payment rail.
-- Sweep only moves USDC against a signed mandate; plans, periods and
-- renewals are owned here. Amounts are USDC micro-units (6 decimals).

-- One row per user. user_ref is 'wallet:0x…' (lowercased) or 'discord:<id>'
-- and is sent to Sweep as external_ref, so every webhook maps back to it.
CREATE TABLE IF NOT EXISTS billing_subscriptions (
  user_ref              TEXT PRIMARY KEY,
  plan                  TEXT NOT NULL,
  billing_interval      TEXT NOT NULL CHECK (billing_interval IN ('monthly', 'yearly')),
  amount                BIGINT NOT NULL,
  -- pending     mandate created, waiting for the wallet signature
  -- authorized  mandate signed, first charge in flight
  -- active      paid through current_period_end
  -- incomplete  first charge failed (no access granted)
  -- past_due    a renewal charge failed
  -- canceled    mandate revoked; access runs to current_period_end
  -- expired     mandate reached expires_at
  status                TEXT NOT NULL DEFAULT 'pending',
  mandate_id            TEXT UNIQUE,
  mandate_expires_at    TIMESTAMPTZ,
  chain_ids             JSONB NOT NULL DEFAULT '[]'::jsonb,
  email                 TEXT,
  current_period_start  TIMESTAMPTZ,
  current_period_end    TIMESTAMPTZ,
  next_charge_at        TIMESTAMPTZ,
  last_failure_code     TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS billing_subscriptions_next_charge_idx
  ON billing_subscriptions (next_charge_at)
  WHERE status IN ('active', 'past_due');

-- One row per POST /v1/charges. The idempotency key is per mandate + period,
-- so a retried webhook or cron run can never double-charge a period.
CREATE TABLE IF NOT EXISTS billing_charges (
  id                TEXT PRIMARY KEY,
  user_ref          TEXT NOT NULL REFERENCES billing_subscriptions(user_ref) ON DELETE CASCADE,
  mandate_id        TEXT NOT NULL,
  amount            BIGINT NOT NULL,
  idempotency_key   TEXT NOT NULL UNIQUE,
  period_start      TIMESTAMPTZ NOT NULL,
  period_end        TIMESTAMPTZ NOT NULL,
  status            TEXT NOT NULL DEFAULT 'pending',
  source_chain      TEXT,
  tx_hash           TEXT,
  failure_code      TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Sweep retries deliveries with the same event id; processed_at marks the
-- ones already applied so a retry is acknowledged without being re-run.
CREATE TABLE IF NOT EXISTS billing_webhook_events (
  event_id      TEXT PRIMARY KEY,
  event_type    TEXT NOT NULL,
  payload       JSONB NOT NULL,
  received_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at  TIMESTAMPTZ
);
