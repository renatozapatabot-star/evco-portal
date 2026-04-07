-- Build 235: Compliance Precog — company-level audit risk prediction
-- Patente 3596 · Aduana 240

CREATE TABLE IF NOT EXISTS audit_risk_assessments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id TEXT NOT NULL,
  assessment_date DATE NOT NULL,

  -- Overall risk
  risk_score INTEGER NOT NULL CHECK (risk_score BETWEEN 0 AND 100),
  risk_level TEXT NOT NULL CHECK (risk_level IN ('low', 'moderate', 'elevated', 'high')),
  risk_trend TEXT NOT NULL DEFAULT 'stable'
    CHECK (risk_trend IN ('improving', 'stable', 'worsening')),

  -- Factor breakdown (each 0-20, sum = max 100)
  factor_reconocimiento JSONB,     -- {score, count_90d, rate_pct, trend, detail}
  factor_value_anomalies JSONB,    -- {score, outlier_count, avg_deviation_pct, detail}
  factor_doc_completeness JSONB,   -- {score, avg_completeness_pct, late_filing_count, detail}
  factor_mve_compliance JSONB,     -- {score, mve_status, gaps_count, detail}
  factor_network_signals JSONB,    -- {score, industry_audit_rate, similar_client_flags, detail}

  -- Predictions
  estimated_audit_probability INTEGER, -- 0-100%
  estimated_penalty_range_low NUMERIC(12,2),
  estimated_penalty_range_high NUMERIC(12,2),
  predicted_audit_window TEXT,         -- e.g. "Improbable en Q2" or "Posible en mayo"

  -- Recommendations
  recommendations JSONB,              -- [{priority, action, rationale, deadline}]
  top_risk_fracciones JSONB,           -- [{fraccion, concentration_pct, ops_count}]

  created_at TIMESTAMPTZ DEFAULT now(),

  UNIQUE(company_id, assessment_date)
);

ALTER TABLE audit_risk_assessments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "svc_audit_risk" ON audit_risk_assessments
  FOR ALL USING (current_setting('role', true) = 'service_role');

CREATE POLICY "auth_read_audit_risk" ON audit_risk_assessments
  FOR SELECT
  USING (company_id = current_setting('request.jwt.claims', true)::json->>'company_id');

CREATE INDEX idx_audit_risk_company ON audit_risk_assessments(company_id, assessment_date DESC);
