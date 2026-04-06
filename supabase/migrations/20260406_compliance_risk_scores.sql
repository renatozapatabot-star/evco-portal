-- CRUZ Compliance Risk Model — quarterly SAT audit probability per client

CREATE TABLE IF NOT EXISTS compliance_risk_scores (
  id BIGSERIAL PRIMARY KEY,
  company_id TEXT NOT NULL,
  quarter TEXT NOT NULL,
  audit_probability NUMERIC NOT NULL,
  risk_level TEXT NOT NULL,
  risk_factors JSONB NOT NULL,
  recommended_actions JSONB,
  scored_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(company_id, quarter)
);

CREATE INDEX idx_compliance_risk_company ON compliance_risk_scores(company_id, quarter DESC);
ALTER TABLE compliance_risk_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_compliance_risk" ON compliance_risk_scores
  FOR ALL USING (current_setting('role', true) = 'service_role');
