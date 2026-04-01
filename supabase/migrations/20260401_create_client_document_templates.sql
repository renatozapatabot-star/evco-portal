-- Client document templates: permanent docs on file per client
-- Used by completeness scoring to auto-credit clients with standing documents

CREATE TABLE IF NOT EXISTS client_document_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id TEXT NOT NULL,
  document_type TEXT NOT NULL,
  document_name TEXT NOT NULL,
  file_url TEXT,
  is_permanent BOOLEAN DEFAULT true,
  expiry_date DATE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, document_type)
);

ALTER TABLE client_document_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all_client_document_templates"
  ON client_document_templates FOR ALL
  USING (true) WITH CHECK (true);
