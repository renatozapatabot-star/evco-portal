-- content_intel_runs — daily record of the content-intel-cron output.
-- Powers 7-day topic dedup (loadDedupSet) + historical audit of rankings
-- and cost. Service-role writes only; RLS closed to anon per the
-- HMAC-session pattern (see .claude/rules/baseline-2026-04-20.md I20
-- and feedback_rls_policy_pattern.md).

CREATE TABLE IF NOT EXISTS content_intel_runs (
  id BIGSERIAL PRIMARY KEY,
  run_date DATE UNIQUE NOT NULL,
  topic_hashes TEXT[] NOT NULL DEFAULT '{}',
  top_3 JSONB NOT NULL DEFAULT '[]'::jsonb,
  total_items_considered INT,
  cost_usd NUMERIC(6,4),
  log_path TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE content_intel_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY content_intel_runs_closed ON content_intel_runs
  FOR ALL USING (false);

CREATE INDEX IF NOT EXISTS idx_content_intel_runs_date
  ON content_intel_runs(run_date DESC);
