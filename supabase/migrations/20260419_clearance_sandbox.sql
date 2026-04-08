-- CRUZ Clearance Sandbox — accuracy tracking for ghost pedimento pipeline
-- Compares CRUZ's output against historically filed pedimentos to measure
-- readiness for autonomous clearance. Target: 99% accuracy for 30 consecutive days.
-- Patente 3596 · Aduana 240

CREATE TABLE IF NOT EXISTS sandbox_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id TEXT NOT NULL,
  referencia TEXT NOT NULL,
  company_id TEXT NOT NULL,

  -- Ground truth (from aduanet_facturas — what was actually filed)
  actual_fraccion TEXT,
  actual_valor_usd NUMERIC,
  actual_igi NUMERIC,
  actual_dta NUMERIC,
  actual_iva NUMERIC,
  actual_total NUMERIC,
  actual_tmec BOOLEAN,
  actual_tipo_cambio NUMERIC,

  -- Ghost pipeline output (what CRUZ would have filed)
  ghost_fraccion TEXT,
  ghost_valor_usd NUMERIC,
  ghost_igi NUMERIC,
  ghost_dta NUMERIC,
  ghost_iva NUMERIC,
  ghost_total NUMERIC,
  ghost_tmec BOOLEAN,
  ghost_tipo_cambio NUMERIC,

  -- Scoring
  field_scores JSONB NOT NULL DEFAULT '{}',
  overall_score NUMERIC(5,2) NOT NULL DEFAULT 0,
  pass BOOLEAN NOT NULL DEFAULT false,
  failure_reasons TEXT[] DEFAULT '{}',
  incomplete_fields TEXT[] DEFAULT '{}',

  -- Metadata
  mode TEXT DEFAULT 'batch',          -- 'batch' | 'single' | 'shadow'
  ai_cost_usd NUMERIC(8,6) DEFAULT 0,
  tokens_used INTEGER DEFAULT 0,
  latency_ms INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE sandbox_results ENABLE ROW LEVEL SECURITY;

-- Service role: full access (scripts write via service key)
CREATE POLICY "svc_all_sandbox_results" ON sandbox_results
  FOR ALL USING (auth.role() = 'service_role');

-- Authenticated users: read own company data only
CREATE POLICY "sandbox_results_select_own_company" ON sandbox_results
  FOR SELECT USING (company_id = current_setting('app.company_id', true));

CREATE INDEX idx_sr_run ON sandbox_results(run_id);
CREATE INDEX idx_sr_company_date ON sandbox_results(company_id, created_at DESC);
CREATE INDEX idx_sr_pass ON sandbox_results(pass, created_at DESC);

-- Daily aggregate for streak calculation
-- Timezone: America/Chicago (Laredo CST/CDT)
CREATE OR REPLACE VIEW sandbox_daily_scores AS
SELECT
  DATE(created_at AT TIME ZONE 'America/Chicago') AS run_date,
  company_id,
  COUNT(*) AS total_tests,
  COUNT(*) FILTER (WHERE pass) AS passed,
  ROUND(COUNT(*) FILTER (WHERE pass)::numeric / NULLIF(COUNT(*), 0) * 100, 2) AS accuracy_pct,
  ROUND(AVG(overall_score), 2) AS avg_score,
  SUM(ai_cost_usd) AS total_cost_usd,
  SUM(tokens_used) AS total_tokens,
  ROUND(AVG(latency_ms)) AS avg_latency_ms
FROM sandbox_results
GROUP BY DATE(created_at AT TIME ZONE 'America/Chicago'), company_id
ORDER BY run_date DESC;
