-- ============================================================================
-- CRUZ: email_intelligence table
-- Stores extracted supplier/fraccion/valor patterns from email history.
-- Fed by study-mode inboxes (eloisa@, claudia@) and full pipeline (ai@).
-- Used by classifier to boost 0%-confidence classifications.
-- 2026-03-30 · Patente 3596 · Aduana 240
-- ============================================================================

CREATE TABLE IF NOT EXISTS email_intelligence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier TEXT,
  fraccion TEXT,
  valor_usd NUMERIC(12,2),
  invoice_number TEXT,
  email_date TIMESTAMPTZ,
  source_inbox TEXT,
  raw_data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS required on every table — no exceptions (Core Invariant #12)
ALTER TABLE email_intelligence ENABLE ROW LEVEL SECURITY;

-- Service role access for pipeline scripts
CREATE POLICY "service_role_full_access_email_intelligence"
  ON email_intelligence
  FOR ALL
  USING (auth.role() = 'service_role');

-- Authenticated users can read (for classifier lookups from API routes)
CREATE POLICY "authenticated_read_email_intelligence"
  ON email_intelligence
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- Index for classifier supplier lookups
CREATE INDEX IF NOT EXISTS idx_email_intelligence_supplier
  ON email_intelligence (supplier);

-- Index for fraccion pattern queries
CREATE INDEX IF NOT EXISTS idx_email_intelligence_fraccion
  ON email_intelligence (fraccion)
  WHERE fraccion IS NOT NULL;

-- Composite index for the classifier fallback query
CREATE INDEX IF NOT EXISTS idx_email_intelligence_supplier_fraccion
  ON email_intelligence (supplier, fraccion)
  WHERE fraccion IS NOT NULL;

COMMENT ON TABLE email_intelligence IS 'Email-extracted supplier/fraccion patterns for classifier learning. Fed by ai@, eloisa@, claudia@ inboxes.';
