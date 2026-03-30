CREATE TABLE IF NOT EXISTS documento_solicitudes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trafico_id TEXT NOT NULL,
  doc_type TEXT NOT NULL,
  status TEXT DEFAULT 'solicitado'
    CHECK (status IN ('solicitado','recibido','vencido')),
  solicitado_at TIMESTAMPTZ DEFAULT now(),
  solicitado_a TEXT,
  recibido_at TIMESTAMPTZ,
  escalate_after TIMESTAMPTZ,
  company_id TEXT NOT NULL,
  UNIQUE(trafico_id, doc_type)
);

ALTER TABLE documento_solicitudes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "client_isolation_documento_solicitudes" ON documento_solicitudes
  FOR ALL
  USING (company_id = current_setting('app.client_code', true) OR current_setting('role') = 'service_role');
