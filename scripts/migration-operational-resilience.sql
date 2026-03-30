-- CRUZ Operational Resilience — Log Tables
-- Run: psql or Supabase SQL Editor
-- Tables for heartbeat, regression guard, and draft escalation tracking

-- ─── HEARTBEAT LOG ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS heartbeat_log (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  checked_at TIMESTAMPTZ DEFAULT NOW(),
  pm2_ok BOOLEAN NOT NULL,
  supabase_ok BOOLEAN NOT NULL,
  supabase_ms INTEGER,
  vercel_ok BOOLEAN NOT NULL,
  vercel_ms INTEGER,
  sync_ok BOOLEAN NOT NULL,
  sync_age_hours NUMERIC(6,1),
  all_ok BOOLEAN NOT NULL,
  details JSONB DEFAULT '{}'
);

ALTER TABLE heartbeat_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role only on heartbeat_log"
  ON heartbeat_log FOR ALL
  USING (auth.role() = 'service_role');

CREATE INDEX idx_heartbeat_log_checked_at ON heartbeat_log (checked_at DESC);

-- ─── REGRESSION GUARD LOG ─────────────────────────────────
CREATE TABLE IF NOT EXISTS regression_guard_log (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  checked_at TIMESTAMPTZ DEFAULT NOW(),
  table_name TEXT NOT NULL,
  row_count INTEGER NOT NULL,
  prev_row_count INTEGER,
  row_delta_pct NUMERIC(6,2),
  coverage_pct NUMERIC(6,2),
  prev_coverage_pct NUMERIC(6,2),
  coverage_delta_pct NUMERIC(6,2),
  unmatched_count INTEGER DEFAULT 0,
  alert_fired BOOLEAN DEFAULT FALSE,
  details JSONB DEFAULT '{}'
);

ALTER TABLE regression_guard_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role only on regression_guard_log"
  ON regression_guard_log FOR ALL
  USING (auth.role() = 'service_role');

CREATE INDEX idx_regression_guard_log_checked_at ON regression_guard_log (checked_at DESC);
CREATE INDEX idx_regression_guard_log_table ON regression_guard_log (table_name, checked_at DESC);

-- ─── DRAFT ESCALATION TRACKING (add columns to pedimento_drafts) ──
ALTER TABLE pedimento_drafts
  ADD COLUMN IF NOT EXISTS escalation_level INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_escalation_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS needs_manual_intervention BOOLEAN DEFAULT FALSE;
