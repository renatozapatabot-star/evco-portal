-- Block 3 · Dynamic Report Builder — template persistence
-- company_id TEXT + created_by TEXT match repo convention (plan §Migration).
-- RLS enabled, all user access goes through server actions (service-role).

CREATE TABLE IF NOT EXISTS report_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id text NOT NULL,
  created_by text NOT NULL,
  name text NOT NULL,
  source_entity text NOT NULL,
  config jsonb NOT NULL,
  scope text NOT NULL DEFAULT 'private' CHECK (scope IN ('private','team','seed')),
  schedule_cron text,
  schedule_recipients text[],
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (company_id, name)
);

CREATE INDEX IF NOT EXISTS idx_report_templates_company ON report_templates(company_id);
CREATE INDEX IF NOT EXISTS idx_report_templates_creator ON report_templates(created_by);
CREATE INDEX IF NOT EXISTS idx_report_templates_scope ON report_templates(scope);

ALTER TABLE report_templates ENABLE ROW LEVEL SECURITY;

-- service_role can do everything; user access goes through server actions + API routes
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename='report_templates' AND policyname='service_role full access'
  ) THEN
    CREATE POLICY "service_role full access" ON report_templates FOR ALL
      USING (current_setting('role', true) = 'service_role');
  END IF;
END $$;
