-- Ghost Pedimento observability table
-- Tracks every email-intake pipeline run for monitoring and debugging
-- CRUZ — Patente 3596

CREATE TABLE IF NOT EXISTS ghost_pedimento_runs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  referencia TEXT,
  draft_id UUID,
  company_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'success',  -- 'success' | 'failed' | 'partial'
  confianza TEXT,                           -- 'alta' | 'media' | 'baja'
  flags_count INTEGER DEFAULT 0,
  extraction_tokens INTEGER DEFAULT 0,
  classification_tokens INTEGER DEFAULT 0,
  duration_ms INTEGER DEFAULT 0,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE ghost_pedimento_runs ENABLE ROW LEVEL SECURITY;

-- Service role: full access (scripts write via service key)
CREATE POLICY "ghost_runs_service_role"
  ON ghost_pedimento_runs FOR ALL
  USING (auth.role() = 'service_role');

-- Authenticated users: read own company data only
CREATE POLICY "ghost_runs_select_own_company"
  ON ghost_pedimento_runs FOR SELECT
  USING (company_id = current_setting('app.company_id', true));

-- Index for dashboard queries
CREATE INDEX idx_ghost_runs_company_created
  ON ghost_pedimento_runs (company_id, created_at DESC);

CREATE INDEX idx_ghost_runs_status
  ON ghost_pedimento_runs (status, created_at DESC);
