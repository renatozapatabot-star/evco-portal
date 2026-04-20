-- BUILD 9 — TRADE INTELLIGENCE FEED
-- Run in Supabase Dashboard > SQL Editor

CREATE TABLE IF NOT EXISTS trade_prospects (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  rfc TEXT UNIQUE NOT NULL,
  razon_social TEXT,
  nombre_comercial TEXT,
  aduana TEXT DEFAULT '240',
  first_seen_date DATE,
  last_seen_date DATE,
  total_pedimentos INTEGER DEFAULT 0,
  total_valor_usd NUMERIC DEFAULT 0,
  avg_valor_por_pedimento NUMERIC DEFAULT 0,
  top_fracciones JSONB DEFAULT '[]',
  top_proveedores JSONB DEFAULT '[]',
  primary_regime TEXT,
  uses_immex BOOLEAN DEFAULT FALSE,
  opportunity_score INTEGER DEFAULT 0,
  estimated_annual_value_usd NUMERIC DEFAULT 0,
  estimated_annual_fees_mxn NUMERIC DEFAULT 0,
  likely_tmec_eligible BOOLEAN DEFAULT FALSE,
  tmec_savings_opportunity_mxn NUMERIC DEFAULT 0,
  classification_risk_detected BOOLEAN DEFAULT FALSE,
  high_value_importer BOOLEAN DEFAULT FALSE,
  contact_name TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  website TEXT,
  linkedin_url TEXT,
  status TEXT DEFAULT 'prospect',
  assigned_to TEXT DEFAULT 'tito',
  notes TEXT,
  contacted_at TIMESTAMPTZ,
  next_follow_up DATE,
  is_current_client BOOLEAN DEFAULT FALSE,
  current_client_clave TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS prospect_sightings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  prospect_rfc TEXT,
  pedimento TEXT,
  fecha_pago DATE,
  valor_usd NUMERIC,
  fraccion TEXT,
  regime TEXT,
  proveedor TEXT,
  patente_agente TEXT,
  source TEXT DEFAULT 'aduanet',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS competitor_sightings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  patente TEXT,
  nombre TEXT,
  prospect_rfc TEXT,
  pedimento TEXT,
  fecha DATE,
  valor_usd NUMERIC,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE trade_prospects ENABLE ROW LEVEL SECURITY;
ALTER TABLE prospect_sightings ENABLE ROW LEVEL SECURITY;
ALTER TABLE competitor_sightings ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN CREATE POLICY service_tp ON trade_prospects FOR ALL USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY service_ps ON prospect_sightings FOR ALL USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY service_cs ON competitor_sightings FOR ALL USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS idx_tp_score ON trade_prospects(opportunity_score DESC);
CREATE INDEX IF NOT EXISTS idx_tp_status ON trade_prospects(status);
CREATE INDEX IF NOT EXISTS idx_tp_value ON trade_prospects(estimated_annual_value_usd DESC);
CREATE INDEX IF NOT EXISTS idx_ps_rfc ON prospect_sightings(prospect_rfc);
