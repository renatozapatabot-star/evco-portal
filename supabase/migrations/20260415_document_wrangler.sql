-- CRUZ Build 210: Document Wrangler — escalation tracking
-- Adds escalation_level to documento_solicitudes for multi-tier follow-up

ALTER TABLE documento_solicitudes
  ADD COLUMN IF NOT EXISTS escalation_level INTEGER DEFAULT 0;

-- Index for the wrangler query (status + escalation level)
CREATE INDEX IF NOT EXISTS idx_doc_sol_wrangler
  ON documento_solicitudes(status, escalation_level)
  WHERE status = 'solicitado';
