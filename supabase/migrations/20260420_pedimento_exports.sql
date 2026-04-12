-- Block 9 · Pedimento Export Jobs — tracks every export generation
-- attempt against a pedimento. Idempotent ADD/POLICY guards throughout.
-- Patente 3596 · Aduana 240

CREATE TABLE IF NOT EXISTS pedimento_export_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pedimento_id uuid NOT NULL REFERENCES pedimentos(id) ON DELETE CASCADE,
  company_id text NOT NULL,
  format_version text NOT NULL,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','success','failed')),
  file_url text,
  generated_at timestamptz,
  generated_by text,
  error_message text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ped_export_pedimento ON pedimento_export_jobs(pedimento_id);
CREATE INDEX IF NOT EXISTS idx_ped_export_company_status
  ON pedimento_export_jobs(company_id, status);

ALTER TABLE pedimento_export_jobs ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'pedimento_export_jobs'
      AND policyname = 'svc_all_pedimento_export_jobs'
  ) THEN
    CREATE POLICY "svc_all_pedimento_export_jobs" ON pedimento_export_jobs
      FOR ALL USING (auth.role() = 'service_role');
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'pedimento_export_jobs'
      AND policyname = 'pedimento_export_jobs_select_own_company'
  ) THEN
    CREATE POLICY "pedimento_export_jobs_select_own_company" ON pedimento_export_jobs
      FOR SELECT USING (company_id = current_setting('app.company_id', true));
  END IF;
END $$;

-- Events catalog: pedimento_exported (lifecycle).
INSERT INTO events_catalog
  (event_type, category, visibility, display_name_es, description_es, icon_name, color_token)
VALUES
  ('pedimento_exported', 'lifecycle', 'private', 'Pedimento exportado',
   'Archivo de interfaz AduanaNet generado', 'download', 'ACCENT_SILVER')
ON CONFLICT (event_type) DO NOTHING;
