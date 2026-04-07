-- CRUZ Intelligence Bootcamp — 4 new tables + schema fixes for historical data mining
-- Tables: email_classification_history, fraccion_patterns, supplier_profiles, regulatory_timeline
-- All service_role only (cross-client intelligence, never client-facing)

-- ═══════════════════════════════════════════════════════════════════════════
-- Fix: learned_patterns needs a unique constraint on (pattern_type, pattern_key)
-- so that upsert with onConflict works correctly
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE learned_patterns
  ADD CONSTRAINT uq_learned_patterns_type_key UNIQUE (pattern_type, pattern_key);

-- ═══════════════════════════════════════════════════════════════════════════
-- 1. email_classification_history — Bootcamp 1: Email Speed-Run
-- Stores Haiku classifications of ALL historical emails from 3 inboxes
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS email_classification_history (
  id BIGSERIAL PRIMARY KEY,
  email_id TEXT NOT NULL UNIQUE,
  account TEXT NOT NULL,
  from_address TEXT,
  to_address TEXT,
  subject TEXT,
  received_at TIMESTAMPTZ,
  document_type TEXT,
  client_ref TEXT,
  supplier_ref TEXT,
  urgency TEXT,
  confidence NUMERIC(4,2),
  summary TEXT,
  model TEXT DEFAULT 'haiku',
  batch_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE email_classification_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "svc_email_class_hist" ON email_classification_history
  FOR ALL USING (current_setting('role', true) = 'service_role');

CREATE INDEX idx_email_class_hist_account ON email_classification_history(account, received_at DESC);
CREATE INDEX idx_email_class_hist_type ON email_classification_history(document_type);
CREATE INDEX idx_email_class_hist_supplier ON email_classification_history(supplier_ref)
  WHERE supplier_ref IS NOT NULL;
CREATE INDEX idx_email_class_hist_client ON email_classification_history(client_ref)
  WHERE client_ref IS NOT NULL;

-- ═══════════════════════════════════════════════════════════════════════════
-- 2. fraccion_patterns — Bootcamp 2: Classification History Mining
-- Aggregated fraccion usage patterns from 748K globalpc_productos
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS fraccion_patterns (
  id BIGSERIAL PRIMARY KEY,
  fraccion TEXT NOT NULL UNIQUE,
  description_keywords TEXT[],
  supplier_count INTEGER DEFAULT 0,
  product_count INTEGER DEFAULT 0,
  total_partida_count INTEGER DEFAULT 0,
  avg_unit_price NUMERIC(12,2),
  primary_suppliers TEXT[],
  primary_countries TEXT[],
  ambiguous BOOLEAN DEFAULT false,
  alt_fracciones JSONB,
  confidence NUMERIC(4,2),
  computed_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE fraccion_patterns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "svc_fraccion_patterns" ON fraccion_patterns
  FOR ALL USING (current_setting('role', true) = 'service_role');

CREATE INDEX idx_fraccion_patterns_frac ON fraccion_patterns(fraccion);
CREATE INDEX idx_fraccion_patterns_ambiguous ON fraccion_patterns(ambiguous)
  WHERE ambiguous = true;

-- ═══════════════════════════════════════════════════════════════════════════
-- 3. supplier_profiles — Bootcamp 4: Supplier Behavior Modeling
-- Per-supplier reliability scores, turnaround metrics, seasonal patterns
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS supplier_profiles (
  id BIGSERIAL PRIMARY KEY,
  supplier_code TEXT NOT NULL,
  supplier_name TEXT,
  company_id TEXT NOT NULL,
  total_operations INTEGER DEFAULT 0,
  total_value_usd NUMERIC(14,2),
  avg_value_usd NUMERIC(12,2),
  avg_crossing_hours NUMERIC(8,2),
  p50_crossing_hours NUMERIC(8,2),
  p95_crossing_hours NUMERIC(8,2),
  reliability_score NUMERIC(5,2),
  on_time_pct NUMERIC(5,2),
  avg_turnaround_days NUMERIC(6,2),
  peak_months INTEGER[],
  primary_fracciones TEXT[],
  primary_countries TEXT[],
  first_operation DATE,
  last_operation DATE,
  trend TEXT,
  computed_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(supplier_code, company_id)
);

ALTER TABLE supplier_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "svc_supplier_profiles" ON supplier_profiles
  FOR ALL USING (current_setting('role', true) = 'service_role');

CREATE INDEX idx_supplier_profiles_company ON supplier_profiles(company_id, reliability_score DESC);
CREATE INDEX idx_supplier_profiles_code ON supplier_profiles(supplier_code);

-- ═══════════════════════════════════════════════════════════════════════════
-- 4. regulatory_timeline — Bootcamp 7: Regulatory Timeline Builder
-- Detected change-points in historical operations data
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS regulatory_timeline (
  id BIGSERIAL PRIMARY KEY,
  event_date DATE NOT NULL,
  event_type TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  affected_fracciones TEXT[],
  impact_metrics JSONB,
  source TEXT DEFAULT 'detected',
  confidence NUMERIC(4,2),
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE regulatory_timeline ENABLE ROW LEVEL SECURITY;

CREATE POLICY "svc_regulatory_timeline" ON regulatory_timeline
  FOR ALL USING (current_setting('role', true) = 'service_role');

CREATE INDEX idx_regulatory_timeline_date ON regulatory_timeline(event_date DESC);
CREATE INDEX idx_regulatory_timeline_type ON regulatory_timeline(event_type);
