-- Rate limits table for persistent rate limiting across serverless cold starts
CREATE TABLE IF NOT EXISTS rate_limits (
  id BIGSERIAL PRIMARY KEY,
  key TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for fast lookups by key + time window
CREATE INDEX IF NOT EXISTS idx_rate_limits_key_time ON rate_limits (key, created_at DESC);

-- Auto-cleanup: delete entries older than 2 hours (cron or manual)
-- No RLS needed — service role only
ALTER TABLE rate_limits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_only" ON rate_limits USING (true) WITH CHECK (true);
