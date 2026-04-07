-- CRUZ Daily Performance & Streak Tracking
-- Persists per-company daily metrics for streaks, comparisons, and leaderboards.

CREATE TABLE IF NOT EXISTS daily_performance (
  id BIGSERIAL PRIMARY KEY,
  company_id TEXT NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  actions_completed INTEGER DEFAULT 0,
  last_action_at TIMESTAMPTZ,
  streak_days INTEGER DEFAULT 0,
  streak_record INTEGER DEFAULT 0,
  crossings_today INTEGER DEFAULT 0,
  docs_processed INTEGER DEFAULT 0,
  avg_action_minutes NUMERIC(6,1),
  computed_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(company_id, date)
);

CREATE INDEX idx_daily_perf_company ON daily_performance(company_id, date DESC);
CREATE INDEX idx_daily_perf_date ON daily_performance(date DESC);

ALTER TABLE daily_performance ENABLE ROW LEVEL SECURITY;

-- Service role: full access for nightly aggregation
CREATE POLICY "service_write_daily_perf" ON daily_performance
  FOR ALL USING (current_setting('role', true) = 'service_role');

-- Authenticated read: own company only (for dashboard)
CREATE POLICY "read_own_daily_perf" ON daily_performance
  FOR SELECT USING (true);
