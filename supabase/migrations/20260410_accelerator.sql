-- ADUANA Accelerator — All new tables for the full stack build
-- Run in Supabase SQL Editor

-- 1. Job Runs (observability)
CREATE TABLE IF NOT EXISTS job_runs (
  id BIGSERIAL PRIMARY KEY,
  job_name TEXT NOT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMPTZ,
  status TEXT NOT NULL CHECK (status IN ('running','success','failure','timeout')),
  rows_processed INTEGER DEFAULT 0,
  rows_failed INTEGER DEFAULT 0,
  error_message TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  host TEXT DEFAULT 'throne',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_job_runs_name ON job_runs(job_name, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_job_runs_fail ON job_runs(status) WHERE status != 'success';

-- 2. Agent Corrections (self-correction loop)
CREATE TABLE IF NOT EXISTS agent_corrections (
  id BIGSERIAL PRIMARY KEY,
  original_fraccion TEXT,
  corrected_fraccion TEXT,
  product_description TEXT,
  cve_proveedor TEXT,
  cve_cliente TEXT,
  correction_reason TEXT,
  corrected_by TEXT DEFAULT 'tito',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Carrier Updates (carrier network)
CREATE TABLE IF NOT EXISTS carrier_updates (
  id BIGSERIAL PRIMARY KEY,
  trafico_id TEXT NOT NULL,
  company_id TEXT NOT NULL,
  carrier_name TEXT,
  carrier_phone TEXT,
  status TEXT CHECK (status IN ('recogido','en_ruta','en_puente','cruzando','cruzado','entregado')),
  location_text TEXT,
  reported_at TIMESTAMPTZ DEFAULT NOW(),
  source TEXT DEFAULT 'whatsapp'
);
CREATE INDEX IF NOT EXISTS idx_carrier_updates_trafico ON carrier_updates(trafico_id, reported_at DESC);

-- 4. Invoices (post-op handler)
CREATE TABLE IF NOT EXISTS invoices (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  trafico_id TEXT NOT NULL,
  company_id TEXT NOT NULL,
  invoice_number TEXT,
  invoice_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  total_mxn NUMERIC,
  status TEXT DEFAULT 'generada' CHECK (status IN ('generada','enviada','pagada','vencida')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Brokerages (SaaS foundation)
CREATE TABLE IF NOT EXISTS brokerages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  patente TEXT NOT NULL,
  aduana TEXT NOT NULL,
  rfc TEXT,
  status TEXT DEFAULT 'active',
  settings JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
INSERT INTO brokerages (name, patente, aduana)
VALUES ('Renato Zapata & Company', '3596', '240')
ON CONFLICT DO NOTHING;

-- 6. Portal Config (white-label)
CREATE TABLE IF NOT EXISTS portal_config (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  brokerage_id UUID,
  brand_name TEXT DEFAULT 'ADUANA',
  logo_url TEXT,
  primary_color TEXT DEFAULT '#eab308',
  accent_color TEXT DEFAULT '#00E5FF',
  support_email TEXT,
  support_phone TEXT,
  custom_domain TEXT,
  features_enabled JSONB DEFAULT '{"clasificaciones": true, "anexo24": true, "bridge_intelligence": true}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. RLS on new tables
ALTER TABLE job_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_corrections ENABLE ROW LEVEL SECURITY;
ALTER TABLE carrier_updates ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE brokerages ENABLE ROW LEVEL SECURITY;
ALTER TABLE portal_config ENABLE ROW LEVEL SECURITY;

-- 8. Health check function
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
    job_name, status, finished_at, started_at,
    rows_processed, rows_failed, error_message,
    EXTRACT(EPOCH FROM (NOW() - COALESCE(finished_at, started_at))) / 60
  FROM job_runs
  ORDER BY job_name, started_at DESC;
$$ LANGUAGE SQL STABLE;
