-- Trafico timeline: audit log of all events for a tráfico
CREATE TABLE IF NOT EXISTS trafico_timeline (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trafico_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  content TEXT NOT NULL,
  content_es TEXT,
  severity TEXT DEFAULT 'info',
  source TEXT DEFAULT 'system',
  created_by TEXT DEFAULT 'system',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_timeline_trafico
  ON trafico_timeline(trafico_id, created_at DESC);

ALTER TABLE trafico_timeline ENABLE ROW LEVEL SECURITY;

-- RLS: service role can do anything; authenticated users read via API
CREATE POLICY "service_role_all" ON trafico_timeline
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Status change trigger on traficos
CREATE OR REPLACE FUNCTION log_timeline_status_change()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.estatus != OLD.estatus OR
     (NEW.estatus IS NOT NULL AND OLD.estatus IS NULL) THEN
    INSERT INTO trafico_timeline (
      trafico_id, event_type, content, content_es,
      severity, metadata
    ) VALUES (
      NEW.trafico,
      'status_changed',
      'Status changed to ' || COALESCE(NEW.estatus, 'unknown'),
      'Estado cambió a ' || COALESCE(NEW.estatus, 'desconocido'),
      CASE NEW.estatus
        WHEN 'Cruzado' THEN 'success'
        WHEN 'Detenido' THEN 'error'
        ELSE 'info'
      END,
      jsonb_build_object(
        'old_status', OLD.estatus,
        'new_status', NEW.estatus,
        'company_id', NEW.company_id
      )
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_timeline_status ON traficos;
CREATE TRIGGER trg_timeline_status
  AFTER UPDATE ON traficos
  FOR EACH ROW
  EXECUTE FUNCTION log_timeline_status_change();
