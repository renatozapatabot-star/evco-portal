-- ═══════════════════════════════════════════════════════════════
-- AGUILA · eCONTA export queue (trafico → bd_econta_rz MySQL).
--
-- The actual MySQL writer lives in a PM2 script (deferred). This table
-- tracks the export intent + status so the UI can render Pendiente /
-- Exportado / Error without coupling to external DB connection state.
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS trafico_econta_exports (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trafico_id      text NOT NULL,
  company_id      text NOT NULL,
  status          text NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending','exported','error')),
  queued_by       text NOT NULL,
  queued_at       timestamptz NOT NULL DEFAULT now(),
  exported_at     timestamptz,
  econta_ref      text,
  error_message   text,
  attempts        integer NOT NULL DEFAULT 0,
  UNIQUE (trafico_id, status) DEFERRABLE INITIALLY IMMEDIATE
);

CREATE INDEX IF NOT EXISTS idx_trafico_econta_pending
  ON trafico_econta_exports(queued_at ASC)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_trafico_econta_company
  ON trafico_econta_exports(company_id, queued_at DESC);

-- RLS — internal roles read everything, service_role writes. No client
-- exposure: eCONTA is the broker's accounting interface.
ALTER TABLE trafico_econta_exports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS trafico_econta_internal_read ON trafico_econta_exports;
CREATE POLICY trafico_econta_internal_read ON trafico_econta_exports
  FOR SELECT USING (
    current_setting('app.role', true) IN ('operator','admin','broker','contabilidad')
  );

DROP POLICY IF EXISTS trafico_econta_service_all ON trafico_econta_exports;
CREATE POLICY trafico_econta_service_all ON trafico_econta_exports
  FOR ALL USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS trafico_econta_no_delete ON trafico_econta_exports;
CREATE POLICY trafico_econta_no_delete ON trafico_econta_exports
  FOR DELETE USING (false);
