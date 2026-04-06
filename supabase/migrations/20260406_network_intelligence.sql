-- CRUZ Network Intelligence — cross-client anonymized aggregates

CREATE TABLE IF NOT EXISTS network_intelligence (
  id BIGSERIAL PRIMARY KEY,
  metric_type TEXT NOT NULL,
  metric_key TEXT NOT NULL,
  metric_value JSONB NOT NULL,
  sample_size INTEGER,
  computed_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(metric_type, metric_key)
);

CREATE INDEX idx_network_intel_type ON network_intelligence(metric_type);
ALTER TABLE network_intelligence ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_network_intel" ON network_intelligence
  FOR ALL USING (current_setting('role', true) = 'service_role');
