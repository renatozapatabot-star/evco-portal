-- CRUZ Shadow Mode — observe-only intelligence tables
-- shadow_classifications: Sonnet-powered email classification
-- staff_corrections: human corrections for accuracy tracking

CREATE TABLE IF NOT EXISTS shadow_classifications (
  id BIGSERIAL PRIMARY KEY,
  email_id TEXT NOT NULL,
  from_address TEXT,
  subject TEXT,
  classification TEXT,
  confidence NUMERIC,
  sonnet_response JSONB,
  staff_action TEXT,
  matched_at TIMESTAMPTZ,
  accuracy NUMERIC,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Prevent duplicate classification of same email
CREATE UNIQUE INDEX IF NOT EXISTS idx_shadow_class_email_id
  ON shadow_classifications (email_id);

CREATE TABLE IF NOT EXISTS staff_corrections (
  id BIGSERIAL PRIMARY KEY,
  correction_type TEXT,
  original_value TEXT,
  corrected_value TEXT,
  corrected_by TEXT,
  trafico TEXT,
  context JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS — service role only (scripts, not portal)
ALTER TABLE shadow_classifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_corrections ENABLE ROW LEVEL SECURITY;
