-- Add missing columns to intelligence tables — March 27, 2026
-- Run in Supabase SQL Editor

-- compliance_predictions
ALTER TABLE compliance_predictions ADD COLUMN IF NOT EXISTS title TEXT;
ALTER TABLE compliance_predictions ADD COLUMN IF NOT EXISTS days_until INTEGER;
ALTER TABLE compliance_predictions ADD COLUMN IF NOT EXISTS calculated_at TIMESTAMPTZ DEFAULT NOW();

-- rectificacion_opportunities
ALTER TABLE rectificacion_opportunities ADD COLUMN IF NOT EXISTS supplier TEXT;
ALTER TABLE rectificacion_opportunities ADD COLUMN IF NOT EXISTS potential_recovery_usd NUMERIC;
ALTER TABLE rectificacion_opportunities ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE rectificacion_opportunities ADD COLUMN IF NOT EXISTS fecha_pago DATE;

-- pedimento_risk_scores
ALTER TABLE pedimento_risk_scores ADD COLUMN IF NOT EXISTS score INTEGER DEFAULT 0;
ALTER TABLE pedimento_risk_scores ADD COLUMN IF NOT EXISTS carrier TEXT;
ALTER TABLE pedimento_risk_scores ADD COLUMN IF NOT EXISTS valor_usd NUMERIC;

-- client_benchmarks
ALTER TABLE client_benchmarks ADD COLUMN IF NOT EXISTS total_operations INTEGER;
ALTER TABLE client_benchmarks ADD COLUMN IF NOT EXISTS total_value_usd NUMERIC;
ALTER TABLE client_benchmarks ADD COLUMN IF NOT EXISTS is_baseline BOOLEAN DEFAULT FALSE;

-- crossing_predictions
ALTER TABLE crossing_predictions ADD COLUMN IF NOT EXISTS carrier TEXT;
ALTER TABLE crossing_predictions ADD COLUMN IF NOT EXISTS category TEXT;
ALTER TABLE crossing_predictions ADD COLUMN IF NOT EXISTS data_points INTEGER;

-- oca_database
ALTER TABLE oca_database ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE oca_database ADD COLUMN IF NOT EXISTS alternative_fracciones JSONB;
ALTER TABLE oca_database ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- supplier_network
ALTER TABLE supplier_network ADD COLUMN IF NOT EXISTS supplier_name_normalized TEXT;
ALTER TABLE supplier_network ADD COLUMN IF NOT EXISTS value_volatility NUMERIC;
ALTER TABLE supplier_network ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- bridge_intelligence
ALTER TABLE bridge_intelligence ADD COLUMN IF NOT EXISTS bridge_id TEXT;
ALTER TABLE bridge_intelligence ADD COLUMN IF NOT EXISTS fecha_cruce DATE;
ALTER TABLE bridge_intelligence ADD COLUMN IF NOT EXISTS calculated_at TIMESTAMPTZ DEFAULT NOW();

-- Unique constraints for upserts
ALTER TABLE pedimento_risk_scores DROP CONSTRAINT IF EXISTS pedimento_risk_scores_trafico_id_key;
ALTER TABLE pedimento_risk_scores ADD CONSTRAINT pedimento_risk_scores_trafico_id_key UNIQUE (trafico_id);

ALTER TABLE crossing_predictions DROP CONSTRAINT IF EXISTS crossing_predictions_trafico_id_key;
ALTER TABLE crossing_predictions ADD CONSTRAINT crossing_predictions_trafico_id_key UNIQUE (trafico_id);

ALTER TABLE client_benchmarks DROP CONSTRAINT IF EXISTS client_benchmarks_company_period_key;
ALTER TABLE client_benchmarks ADD CONSTRAINT client_benchmarks_company_period_key UNIQUE (company_id, period);

ALTER TABLE monthly_intelligence_reports DROP CONSTRAINT IF EXISTS monthly_reports_company_period_key;
ALTER TABLE monthly_intelligence_reports ADD CONSTRAINT monthly_reports_company_period_key UNIQUE (company_id, period);

-- push_subscriptions + service_requests (from Feature 11)
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  company_id TEXT DEFAULT 'evco',
  endpoint TEXT UNIQUE,
  auth TEXT,
  p256dh TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS service_requests (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  company_id TEXT DEFAULT 'evco',
  request_type TEXT,
  description TEXT,
  status TEXT DEFAULT 'recibido',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);

ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "Allow all push_subscriptions" ON push_subscriptions FOR ALL USING (true);
CREATE POLICY IF NOT EXISTS "Allow all service_requests" ON service_requests FOR ALL USING (true);
