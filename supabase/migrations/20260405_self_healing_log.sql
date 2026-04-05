-- Self-healing event log — tracks detect, heal, and learn events.
-- Every 15 minutes, self-healer.js checks system health and logs here.

CREATE TABLE IF NOT EXISTS self_healing_log (
  id BIGSERIAL PRIMARY KEY,
  detected_at TIMESTAMPTZ DEFAULT now(),
  issue_type TEXT NOT NULL,
  severity TEXT CHECK (severity IN ('info', 'warning', 'critical')),
  description TEXT,
  action_taken TEXT,
  healed BOOLEAN DEFAULT false,
  heal_duration_ms INTEGER,
  manual_required BOOLEAN DEFAULT false,
  details JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE self_healing_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_self_healing" ON self_healing_log
  FOR ALL USING (current_setting('role', true) = 'service_role');

CREATE INDEX idx_self_healing_date ON self_healing_log (detected_at DESC);
CREATE INDEX idx_self_healing_type ON self_healing_log (issue_type, severity);
