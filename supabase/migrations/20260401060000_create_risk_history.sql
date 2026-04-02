-- Risk history table — tracks risk level changes for escalation detection
CREATE TABLE IF NOT EXISTS risk_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id TEXT NOT NULL,
  trafico TEXT NOT NULL,
  risk_level TEXT NOT NULL,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_risk_history_lookup ON risk_history (company_id, trafico, recorded_at DESC);

ALTER TABLE risk_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "client_isolation_risk_history" ON risk_history
  USING (company_id = current_setting('app.client_code', true));
