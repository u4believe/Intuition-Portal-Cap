-- All-time history: hourly pattern snapshots kept forever, and bookkeeping
-- for the Cloudflare R2 archive (scripts/patterns/archive.js). Safe to re-run.

-- Append-only: every hourly computation of every metric (pattern_metrics keeps only the latest).
CREATE TABLE IF NOT EXISTS pattern_metrics_history (
  metric        TEXT NOT NULL,
  window_days   INTEGER NOT NULL,
  computed_at   TIMESTAMPTZ NOT NULL,
  sample_size   INTEGER NOT NULL,
  data          JSONB NOT NULL,
  PRIMARY KEY (metric, window_days, computed_at)
);
CREATE INDEX IF NOT EXISTS pattern_metrics_history_time_idx ON pattern_metrics_history (computed_at);

-- One row per UTC day archived to R2 (events/date=YYYY-MM-DD.ndjson.gz).
CREATE TABLE IF NOT EXISTS archive_days (
  day           DATE PRIMARY KEY,
  events        INTEGER NOT NULL,
  bytes         INTEGER NOT NULL,
  verified      BOOLEAN NOT NULL,            -- counts matched the indexer's own totals for the day
  exported_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
