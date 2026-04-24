-- Build 12 (2026-04-24) — Data Integrity Guard.
--
-- Trend table populated by scripts/lib/post-sync-verify.js after every
-- delta sync. Lets /admin/eagle (and future ops dashboards) chart drift
-- over time and lets investigators answer "when did integrity slip?"
-- without reading 30 days of Telegram.
--
-- One row per sync run × verification call. Keep it small: append-only,
-- no updates, retention managed manually (truncate older than 90d if
-- the table ever grows uncomfortable — it shouldn't, but the option
-- exists).

CREATE TABLE IF NOT EXISTS data_integrity_log (
  id BIGSERIAL PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  sync_type TEXT NOT NULL,
  sync_log_id BIGINT,
  verdict TEXT NOT NULL CHECK (verdict IN ('green', 'amber', 'red')),
  summary JSONB NOT NULL DEFAULT '{}'::jsonb,
  batches JSONB NOT NULL DEFAULT '[]'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_data_integrity_log_created_at
  ON data_integrity_log (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_data_integrity_log_sync_type_created
  ON data_integrity_log (sync_type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_data_integrity_log_verdict
  ON data_integrity_log (verdict, created_at DESC)
  WHERE verdict <> 'green';

-- RLS: broker-internal observability table, not tenant-scoped. Service
-- role bypasses; everything else denied. Mirrors the sync_log policy.
ALTER TABLE data_integrity_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "data_integrity_log_deny_all" ON data_integrity_log;
CREATE POLICY "data_integrity_log_deny_all"
  ON data_integrity_log
  FOR ALL
  USING (false);
