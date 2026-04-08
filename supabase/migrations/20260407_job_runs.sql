-- Block 1: Observability Foundation
-- Spine table: every script execution writes one row here

CREATE TABLE IF NOT EXISTS job_runs (
  id              BIGSERIAL PRIMARY KEY,
  job_name        TEXT NOT NULL,
  started_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at     TIMESTAMPTZ,
  status          TEXT NOT NULL CHECK (status IN ('running','success','failure','timeout')),
  rows_processed  INTEGER DEFAULT 0,
  rows_failed     INTEGER DEFAULT 0,
  error_message   TEXT,
  metadata        JSONB DEFAULT '{}'::jsonb,
  host            TEXT DEFAULT 'throne',
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_job_runs_job_name_started
  ON job_runs(job_name, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_job_runs_status_failures
  ON job_runs(status) WHERE status != 'success';

CREATE INDEX IF NOT EXISTS idx_job_runs_recent
  ON job_runs(started_at DESC);

-- Latest run per job, with staleness in minutes
CREATE OR REPLACE FUNCTION get_job_health()
RETURNS TABLE (
  job_name TEXT,
  status TEXT,
  finished_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  rows_processed INTEGER,
  rows_failed INTEGER,
  error_message TEXT,
  minutes_since NUMERIC
) AS $$
  SELECT DISTINCT ON (job_name)
    job_name,
    status,
    finished_at,
    started_at,
    rows_processed,
    rows_failed,
    error_message,
    EXTRACT(EPOCH FROM (NOW() - COALESCE(finished_at, started_at))) / 60 AS minutes_since
  FROM job_runs
  ORDER BY job_name, started_at DESC;
$$ LANGUAGE SQL STABLE;

-- Service role needs to write; authenticated users only need to read for /health page
GRANT SELECT ON job_runs TO authenticated;
GRANT EXECUTE ON FUNCTION get_job_health() TO authenticated;
