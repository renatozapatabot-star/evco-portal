-- CRUZ Institutional Memory — 80 years of knowledge, searchable
-- Stores learned patterns per client from operational data,
-- corrections, and manual observations.

CREATE TABLE IF NOT EXISTS cruz_memory (
  id BIGSERIAL PRIMARY KEY,
  company_id TEXT NOT NULL,
  pattern_type TEXT NOT NULL,
  pattern_key TEXT NOT NULL,
  pattern_value TEXT NOT NULL,
  confidence NUMERIC DEFAULT 0.5,
  observations INTEGER DEFAULT 1,
  source TEXT DEFAULT 'operational',
  last_seen TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(company_id, pattern_key)
);

ALTER TABLE cruz_memory ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_cruz_memory" ON cruz_memory
  FOR ALL USING (current_setting('role', true) = 'service_role');

CREATE INDEX IF NOT EXISTS idx_cruz_memory_company ON cruz_memory (company_id, confidence DESC);
CREATE INDEX IF NOT EXISTS idx_cruz_memory_type ON cruz_memory (pattern_type);
