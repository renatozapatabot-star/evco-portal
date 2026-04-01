-- CRUZ Intelligence Layer — Session 1D + Session 2
-- Tables: entrada_lifecycle, alerts, deadlines, user_feedback
-- View: trafico_actions
-- Function: get_kpi_intelligence

-- ═══ entrada_lifecycle ═══
CREATE TABLE IF NOT EXISTS entrada_lifecycle (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  entrada_number TEXT UNIQUE NOT NULL,
  company_id TEXT NOT NULL,
  email_received_at TIMESTAMPTZ,
  email_subject TEXT,
  email_from TEXT,
  supplier TEXT,
  bultos INTEGER,
  peso_bruto NUMERIC,
  transportista TEXT,
  part_descriptions TEXT[] DEFAULT '{}',
  trafico_id TEXT,
  trafico_assigned_at TIMESTAMPTZ,
  pedimento TEXT,
  pedimento_transmitted_at TIMESTAMPTZ,
  semaforo INTEGER,
  fecha_cruce TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_entrada_lc_company ON entrada_lifecycle(company_id, email_received_at DESC);
CREATE INDEX IF NOT EXISTS idx_entrada_lc_trafico ON entrada_lifecycle(trafico_id);
ALTER TABLE entrada_lifecycle ENABLE ROW LEVEL SECURITY;
CREATE POLICY "entrada_lc_service" ON entrada_lifecycle FOR ALL USING (auth.role() = 'service_role');

-- ═══ alerts ═══
CREATE TABLE IF NOT EXISTS alerts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  severity TEXT CHECK (severity IN ('emergency','critical','warning','info')),
  action JSONB,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  snoozed_until TIMESTAMPTZ
);
ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "alerts_service" ON alerts FOR ALL USING (auth.role() = 'service_role');

-- ═══ deadlines ═══
CREATE TABLE IF NOT EXISTS deadlines (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id TEXT NOT NULL,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  deadline TIMESTAMPTZ NOT NULL,
  client TEXT,
  notes TEXT,
  completed BOOLEAN DEFAULT FALSE,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE deadlines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "deadlines_service" ON deadlines FOR ALL USING (auth.role() = 'service_role');

-- Seed EVCO deadlines
INSERT INTO deadlines (company_id, type, title, deadline, client, notes)
VALUES
  ('9254','MVE','MVE Formato E2 — EVCO','2026-03-31T23:59:59-06:00','EVCO Plastics de México','Multa $4,790–$7,190 MXN. Art. 59-A'),
  ('9254','ENCARGO','Encargo Conferido — EVCO','2026-04-20T23:59:59-06:00','EVCO Plastics de México','Renovación anual'),
  ('9254','EFIRMA','e.Firma Patente 3596','2026-06-15T23:59:59-06:00','Renato Zapata & Company','Renovar 30 días antes'),
  ('9254','IMMEX','Reporte Anual IMMEX','2026-05-31T23:59:59-06:00','EVCO Plastics de México',NULL)
ON CONFLICT DO NOTHING;

-- ═══ user_feedback ═══
CREATE TABLE IF NOT EXISTS user_feedback (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID,
  company_id TEXT NOT NULL,
  context TEXT,
  answer TEXT,
  url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE user_feedback ENABLE ROW LEVEL SECURITY;
CREATE POLICY "feedback_service" ON user_feedback FOR ALL USING (auth.role() = 'service_role');

-- ═══ Indexes for trafico_actions view performance ═══
CREATE INDEX IF NOT EXISTS idx_traficos_company_estatus ON traficos(company_id, estatus, fecha_llegada DESC);
CREATE INDEX IF NOT EXISTS idx_traficos_semaforo ON traficos(semaforo) WHERE semaforo = 1;
CREATE INDEX IF NOT EXISTS idx_expediente_pedimento ON expediente_documentos(pedimento_id);

-- ═══ trafico_actions view ═══
CREATE OR REPLACE VIEW trafico_actions AS
SELECT
  t.id,
  t.trafico,
  t.company_id,
  t.estatus,
  t.importe_total,
  EXTRACT(DAY FROM (NOW() - t.fecha_llegada))::INTEGER as dias_espera,
  CASE
    WHEN t.semaforo = 1 THEN 'SEMAFORO_ROJO'
    WHEN NOT EXISTS (
      SELECT 1 FROM expediente_documentos ed WHERE ed.pedimento_id = t.pedimento LIMIT 1
    ) AND t.pedimento IS NOT NULL THEN 'SIN_DOCUMENTOS'
    WHEN EXTRACT(DAY FROM (NOW() - t.fecha_llegada)) > 30 THEN 'TRAFICO_DETENIDO'
    WHEN EXTRACT(DAY FROM (NOW() - t.fecha_llegada)) > 7 THEN 'REVISAR_ESTATUS'
    ELSE NULL
  END as primary_action,
  jsonb_build_object(
    'dias_espera', EXTRACT(DAY FROM (NOW() - t.fecha_llegada))::INTEGER,
    'tiene_pedimento', (t.pedimento IS NOT NULL),
    'semaforo', t.semaforo,
    'importe', t.importe_total
  ) as action_context
FROM traficos t
WHERE t.estatus NOT IN ('Cruzado', 'Entregado', 'Cancelado')
AND t.company_id IS NOT NULL;

-- ═══ get_kpi_intelligence function ═══
CREATE OR REPLACE FUNCTION get_kpi_intelligence(p_company_id TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  docs_pending INTEGER := 0;
  entradas_pending INTEGER := 0;
  at_risk INTEGER := 0;
  at_risk_critical INTEGER := 0;
  near_deadline INTEGER := 0;
BEGIN
  SELECT COUNT(*)::INTEGER INTO docs_pending
  FROM expediente_documentos ed
  JOIN traficos t ON t.pedimento = ed.pedimento_id
  WHERE t.company_id = p_company_id AND ed.file_url IS NULL;

  SELECT COUNT(*)::INTEGER INTO entradas_pending
  FROM entrada_lifecycle
  WHERE company_id = p_company_id AND trafico_id IS NULL;

  SELECT COUNT(*)::INTEGER INTO at_risk
  FROM trafico_actions
  WHERE company_id = p_company_id AND primary_action IS NOT NULL;

  SELECT COUNT(*)::INTEGER INTO at_risk_critical
  FROM trafico_actions
  WHERE company_id = p_company_id AND primary_action IN ('SEMAFORO_ROJO','SIN_DOCUMENTOS');

  SELECT COUNT(*)::INTEGER INTO near_deadline
  FROM deadlines
  WHERE company_id = p_company_id AND completed = FALSE
  AND deadline < NOW() + INTERVAL '7 days' AND deadline > NOW();

  RETURN jsonb_build_object(
    'docs_pending', jsonb_build_object('count', docs_pending),
    'entradas_pending', jsonb_build_object('count', entradas_pending),
    'at_risk', jsonb_build_object('count', at_risk, 'critical', at_risk_critical),
    'near_deadline', jsonb_build_object('count', near_deadline),
    'updated_at', NOW()
  );
END;
$$;
