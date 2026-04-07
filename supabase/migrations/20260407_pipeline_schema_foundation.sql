-- ============================================================================
-- CRUZ Pipeline Schema Foundation
-- Build 0: Tables needed for the cradle-to-grave pipeline (Builds 1-7)
-- Patente 3596 · Aduana 240 · Laredo TX
-- ============================================================================

-- ── 0A. audit_log — enforce append-only ──
-- Table may already exist (created outside migrations). Safe to run.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'audit_log') THEN
    CREATE TABLE audit_log (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      action TEXT NOT NULL,
      entity_type TEXT,
      entity_id TEXT,
      user_id TEXT,
      user_name TEXT,
      details JSONB DEFAULT '{}',
      ip_address TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  END IF;
END $$;

ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- Append-only: INSERT allowed, no UPDATE or DELETE
DROP POLICY IF EXISTS "audit_log_insert_only" ON audit_log;
CREATE POLICY "audit_log_insert_only" ON audit_log
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "audit_log_read_authenticated" ON audit_log;
CREATE POLICY "audit_log_read_authenticated" ON audit_log
  FOR SELECT USING (true);

-- No UPDATE or DELETE policies = append-only enforcement

-- ── 0B. doc_requirements — documents required per fracción + régimen ──
CREATE TABLE IF NOT EXISTS doc_requirements (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  fraccion_prefix TEXT NOT NULL,
  regimen TEXT NOT NULL DEFAULT 'A1',
  required_docs TEXT[] NOT NULL DEFAULT '{}',
  conditional_docs TEXT[] DEFAULT '{}',
  conditions JSONB DEFAULT '{}',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(fraccion_prefix, regimen)
);

ALTER TABLE doc_requirements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "doc_requirements_read_all" ON doc_requirements;
CREATE POLICY "doc_requirements_read_all" ON doc_requirements
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "doc_requirements_service_write" ON doc_requirements;
CREATE POLICY "doc_requirements_service_write" ON doc_requirements
  FOR ALL USING (current_setting('role', true) = 'service_role');

-- Seed: baseline doc requirements per régimen
-- A1 = Importación definitiva, IMD = IMMEX definitivo, ITE/ITR = IMMEX temporal
INSERT INTO doc_requirements (fraccion_prefix, regimen, required_docs, conditional_docs, notes) VALUES
  ('DEFAULT', 'A1', ARRAY['FACTURA_COMERCIAL', 'LISTA_EMPAQUE', 'CONOCIMIENTO_EMBARQUE', 'MANIFESTACION_VALOR', 'PEDIMENTO'], ARRAY['CERTIFICADO_ORIGEN', 'NOM', 'PERMISO'], 'Régimen A1 — importación definitiva'),
  ('DEFAULT', 'IMD', ARRAY['FACTURA_COMERCIAL', 'LISTA_EMPAQUE', 'CONOCIMIENTO_EMBARQUE', 'MANIFESTACION_VALOR', 'PEDIMENTO', 'CARTA_PORTE'], ARRAY['CERTIFICADO_ORIGEN', 'NOM', 'PERMISO'], 'Régimen IMD — IMMEX definitivo'),
  ('DEFAULT', 'ITE', ARRAY['FACTURA_COMERCIAL', 'LISTA_EMPAQUE', 'CONOCIMIENTO_EMBARQUE', 'MANIFESTACION_VALOR', 'PEDIMENTO', 'CERTIFICADO_ORIGEN'], ARRAY['NOM', 'PERMISO'], 'Régimen ITE — IMMEX temporal exportación'),
  ('DEFAULT', 'ITR', ARRAY['FACTURA_COMERCIAL', 'LISTA_EMPAQUE', 'CONOCIMIENTO_EMBARQUE', 'MANIFESTACION_VALOR', 'PEDIMENTO', 'CERTIFICADO_ORIGEN'], ARRAY['NOM', 'PERMISO'], 'Régimen ITR — IMMEX temporal retorno')
ON CONFLICT (fraccion_prefix, regimen) DO NOTHING;

-- ── 0C. entradas — add status field for pipeline tracking ──
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'entradas' AND column_name = 'pipeline_status'
  ) THEN
    ALTER TABLE entradas ADD COLUMN pipeline_status TEXT DEFAULT 'pendiente_revision';
  END IF;
END $$;

-- ── 0D. Index for workflow_events processor polling ──
CREATE INDEX IF NOT EXISTS idx_workflow_events_pending_poll
  ON workflow_events (status, created_at)
  WHERE status = 'pending';

-- ============================================================================
-- End of migration
-- ============================================================================
