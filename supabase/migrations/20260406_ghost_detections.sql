-- Ghost tráfico detections — cross-client fraud/integrity alerts

CREATE TABLE IF NOT EXISTS ghost_detections (
  id BIGSERIAL PRIMARY KEY,
  check_type TEXT NOT NULL,
  severity TEXT NOT NULL,
  description TEXT NOT NULL,
  traficos JSONB,
  companies JSONB,
  resolved BOOLEAN DEFAULT false,
  resolved_by TEXT,
  resolved_at TIMESTAMPTZ,
  detected_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_ghost_severity ON ghost_detections(severity, resolved);
ALTER TABLE ghost_detections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_ghost" ON ghost_detections
  FOR ALL USING (current_setting('role', true) = 'service_role');
