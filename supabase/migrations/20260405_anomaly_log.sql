-- Anomaly detection log — tracks nightly data quality metrics per client.
-- One row per (check_date, client, metric) — trend analysis over time.

CREATE TABLE IF NOT EXISTS anomaly_log (
  id BIGSERIAL PRIMARY KEY,
  check_date DATE NOT NULL,
  client TEXT NOT NULL,
  metric TEXT NOT NULL,
  previous_value NUMERIC,
  current_value NUMERIC,
  delta_pct NUMERIC,
  severity TEXT CHECK (severity IN ('ok', 'warning', 'critical')),
  details JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE anomaly_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_anomaly_log" ON anomaly_log
  FOR ALL
  USING (current_setting('role', true) = 'service_role');

-- Index for trend queries: last N days for a given client + metric
CREATE INDEX idx_anomaly_log_client_date ON anomaly_log (client, check_date DESC);
CREATE INDEX idx_anomaly_log_severity ON anomaly_log (severity) WHERE severity != 'ok';
