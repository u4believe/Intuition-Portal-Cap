-- Intuition activity collection + pattern measurements (scripts/patterns/).
-- Raw events are kept for PATTERN_RETENTION_DAYS (default 90); daily summaries
-- and computed pattern metrics are kept permanently. Safe to re-run.

-- Every deposit, redemption, atom creation and claim (triple) creation.
CREATE TABLE IF NOT EXISTS intuition_events (
  id              TEXT PRIMARY KEY,               -- indexer id (tx hash + log index, or term id for creations)
  kind            TEXT NOT NULL CHECK (kind IN ('deposit', 'redemption', 'atom_created', 'triple_created')),
  occurred_at     TIMESTAMPTZ NOT NULL,
  block_number    BIGINT NOT NULL,
  tx_hash         TEXT,
  sender          TEXT NOT NULL,                  -- lowercased: who sent the tx (payer / redeemer / creator)
  receiver        TEXT NOT NULL,                  -- lowercased: whose position it is (shares owner)
  term_id         TEXT NOT NULL,
  vault_type      TEXT,                           -- Atom | Triple | CounterTriple (creations: Atom | Triple)
  curve_id        SMALLINT,
  assets          NUMERIC(40, 18),                -- TRUST into the vault (deposit) or paid out (redemption)
  shares          NUMERIC(40, 18),
  balance_before  NUMERIC(40, 18)                 -- deposits: sender's TRUST balance at the block before (filled in later)
);

CREATE INDEX IF NOT EXISTS intuition_events_time_idx ON intuition_events (occurred_at);
CREATE INDEX IF NOT EXISTS intuition_events_receiver_idx ON intuition_events (receiver, occurred_at);
CREATE INDEX IF NOT EXISTS intuition_events_term_idx ON intuition_events (term_id, occurred_at);
CREATE INDEX IF NOT EXISTS intuition_events_tx_idx ON intuition_events (tx_hash);
CREATE INDEX IF NOT EXISTS intuition_events_balance_todo_idx
  ON intuition_events (occurred_at DESC) WHERE kind = 'deposit' AND balance_before IS NULL;

-- Where each source's incremental sync has reached (created_at, then id as tie-breaker).
CREATE TABLE IF NOT EXISTS intuition_ingest_cursors (
  source      TEXT PRIMARY KEY,
  last_at     TIMESTAMPTZ NOT NULL,
  last_id     TEXT NOT NULL DEFAULT '',
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Permanent per-day summary (survives raw-event retention).
CREATE TABLE IF NOT EXISTS intuition_daily_stats (
  day       DATE NOT NULL,
  kind      TEXT NOT NULL,
  events    INTEGER NOT NULL,
  wallets   INTEGER NOT NULL,
  terms     INTEGER NOT NULL,
  volume    NUMERIC(40, 18) NOT NULL DEFAULT 0,
  PRIMARY KEY (day, kind)
);

-- Latest value of each measured pattern, per window. Aggregates only — no wallet addresses.
CREATE TABLE IF NOT EXISTS pattern_metrics (
  metric        TEXT NOT NULL,
  window_days   INTEGER NOT NULL,
  computed_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sample_size   INTEGER NOT NULL,
  data          JSONB NOT NULL,
  PRIMARY KEY (metric, window_days)
);
