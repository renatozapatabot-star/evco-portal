-- Structured data extracted from documents by Sonnet
CREATE TABLE IF NOT EXISTS document_extractions (
  id BIGSERIAL PRIMARY KEY,
  doc_id BIGINT UNIQUE,
  doc_type TEXT NOT NULL,
  trafico_id TEXT,
  company_id TEXT,
  extracted_data JSONB NOT NULL,
  confidence NUMERIC DEFAULT 0.85,
  verified BOOLEAN DEFAULT false,
  verified_by TEXT,
  extracted_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE document_extractions ENABLE ROW LEVEL SECURITY;
