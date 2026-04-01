-- Client notification preferences
CREATE TABLE IF NOT EXISTS client_notification_prefs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id TEXT NOT NULL,
  email TEXT NOT NULL,
  notify_trafico_update BOOLEAN DEFAULT true,
  notify_document_ready BOOLEAN DEFAULT true,
  notify_weekly_report BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE client_notification_prefs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "client_isolation_client_notification_prefs"
  ON client_notification_prefs
  USING (true);

-- Client document templates (permanent docs required per client)
CREATE TABLE IF NOT EXISTS client_document_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id TEXT NOT NULL,
  doc_name TEXT NOT NULL,
  is_permanent BOOLEAN DEFAULT false,
  is_received BOOLEAN DEFAULT false,
  received_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE client_document_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "client_isolation_client_document_templates"
  ON client_document_templates
  USING (true);
