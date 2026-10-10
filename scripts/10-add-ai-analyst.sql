-- AI Analyst (Premium). Conversations are stored server-side and only ever
-- appended to: Claude's thinking blocks are valid only while every earlier
-- message stays byte-identical, and a stable prefix keeps the prompt cache hot.

CREATE TABLE IF NOT EXISTS ai_conversations (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_ref          TEXT NOT NULL,
  title             TEXT NOT NULL DEFAULT 'New conversation',
  -- Anthropic MessageParam[] exactly as sent to / returned by the API
  messages          JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- Last <user_context> block sent, so it is only re-sent when it changes
  context_snapshot  TEXT,
  -- Set while a turn is streaming; blocks a second concurrent turn
  busy_until        TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ai_conversations_user_idx
  ON ai_conversations (user_ref, updated_at DESC);

-- Per-user daily usage: enforces the message limit and tracks token spend.
CREATE TABLE IF NOT EXISTS ai_usage_daily (
  user_ref            TEXT NOT NULL,
  day                 DATE NOT NULL,
  requests            INTEGER NOT NULL DEFAULT 0,
  input_tokens        BIGINT NOT NULL DEFAULT 0,
  output_tokens       BIGINT NOT NULL DEFAULT 0,
  cache_read_tokens   BIGINT NOT NULL DEFAULT 0,
  cache_write_tokens  BIGINT NOT NULL DEFAULT 0,
  PRIMARY KEY (user_ref, day)
);

-- Which model backend a conversation was started on ('openai' = any
-- OpenAI-compatible API, 'anthropic' = Claude). History is stored in that
-- provider's message format, so a conversation stays on its provider.
ALTER TABLE ai_conversations
  ADD COLUMN IF NOT EXISTS provider TEXT NOT NULL DEFAULT 'openai';
