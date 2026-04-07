-- Build 234: Document Shadow Network — cross-client doc template reuse
-- Patente 3596 · Aduana 240

CREATE TABLE IF NOT EXISTS document_templates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,

  -- Template identity (anonymized — no client data)
  doc_type TEXT NOT NULL,               -- FACTURA_COMERCIAL, COVE, PACKING_LIST, etc.
  supplier_key TEXT NOT NULL,           -- normalized supplier name (lowercase, trimmed)
  product_key TEXT NOT NULL,            -- normalized product description

  -- Template data (reference fields, NOT actual values)
  template_fields JSONB NOT NULL,       -- [{field_name, field_type, example_format, required}]
  typical_turnaround_hours NUMERIC(6,1),
  success_rate_pct NUMERIC(5,1),        -- % of requests fulfilled using this template

  -- Network stats (service_role only — cross-client)
  times_used INTEGER DEFAULT 1,
  clients_served INTEGER DEFAULT 1,
  last_used_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  UNIQUE(doc_type, supplier_key, product_key)
);

ALTER TABLE document_templates ENABLE ROW LEVEL SECURITY;

-- Service role only — templates are anonymized cross-client data
CREATE POLICY "svc_document_templates" ON document_templates
  FOR ALL USING (current_setting('role', true) = 'service_role');

CREATE INDEX idx_doc_templates_lookup ON document_templates(doc_type, supplier_key);
CREATE INDEX idx_doc_templates_product ON document_templates(product_key);

-- ============================================================================
-- doc_prefill_log: tracks when a template was used to pre-fill a request
-- ============================================================================
CREATE TABLE IF NOT EXISTS doc_prefill_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id TEXT NOT NULL,
  template_id UUID REFERENCES document_templates(id),
  trafico TEXT,
  doc_type TEXT NOT NULL,
  supplier TEXT,

  -- Result
  prefill_used BOOLEAN DEFAULT true,    -- did the user use the prefill?
  turnaround_hours NUMERIC(6,1),        -- how long until doc was received
  baseline_turnaround_hours NUMERIC(6,1), -- avg turnaround without prefill

  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE doc_prefill_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "svc_doc_prefill" ON doc_prefill_log
  FOR ALL USING (current_setting('role', true) = 'service_role');

CREATE POLICY "auth_read_prefill" ON doc_prefill_log
  FOR SELECT
  USING (company_id = current_setting('request.jwt.claims', true)::json->>'company_id');

CREATE INDEX idx_prefill_company ON doc_prefill_log(company_id, created_at DESC);
