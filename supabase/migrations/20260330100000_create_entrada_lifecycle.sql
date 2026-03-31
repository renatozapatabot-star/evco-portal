-- entrada_lifecycle: tracks entrada from warehouse receipt through crossing
CREATE TABLE IF NOT EXISTS entrada_lifecycle (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  entrada_number TEXT UNIQUE NOT NULL,
  company_id TEXT NOT NULL,
  email_received_at TIMESTAMPTZ,
  email_subject TEXT,
  email_from TEXT,
  supplier TEXT,
  bultos INTEGER,
  peso_bruto NUMERIC,
  trafico_id TEXT,
  trafico_assigned_at TIMESTAMPTZ,
  pedimento TEXT,
  semaforo INTEGER,
  fecha_cruce TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS required on every table
ALTER TABLE entrada_lifecycle ENABLE ROW LEVEL SECURITY;

-- Owner can read their own data
CREATE POLICY "entrada_lifecycle_select_by_company"
  ON entrada_lifecycle FOR SELECT
  USING (company_id = current_setting('app.company_id', true));

-- Owner can insert their own data
CREATE POLICY "entrada_lifecycle_insert_by_company"
  ON entrada_lifecycle FOR INSERT
  WITH CHECK (company_id = current_setting('app.company_id', true));

-- Owner can update their own data
CREATE POLICY "entrada_lifecycle_update_by_company"
  ON entrada_lifecycle FOR UPDATE
  USING (company_id = current_setting('app.company_id', true));

-- Service role bypass for pipelines
CREATE POLICY "entrada_lifecycle_service_role"
  ON entrada_lifecycle FOR ALL
  USING (current_setting('role', true) = 'service_role');

-- Index for dashboard query: unassigned entradas
CREATE INDEX idx_entrada_lifecycle_unassigned
  ON entrada_lifecycle (company_id) WHERE trafico_id IS NULL;
