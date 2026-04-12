-- V1.5 F2 · QuickBooks export jobs — company_id scoping + RLS + indexes.
-- Anabel's one-click accounting handoff. Generates IIF (or CSV) files from
-- facturas + payment records, uploads to Storage bucket `quickbooks-exports`,
-- and exposes a signed download URL. Runner writes status transitions:
-- pending → running → ready | failed.
-- Patente 3596 · Aduana 240.

CREATE TABLE IF NOT EXISTS quickbooks_export_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id text NOT NULL,
  entity text NOT NULL CHECK (entity IN ('invoices', 'bills', 'customers', 'vendors', 'all')),
  format text NOT NULL DEFAULT 'IIF' CHECK (format IN ('IIF', 'CSV')),
  date_from date,
  date_to date,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'ready', 'failed')),
  file_path text,
  file_bytes integer,
  row_count integer,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  completed_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_quickbooks_export_jobs_company
  ON quickbooks_export_jobs(company_id);
CREATE INDEX IF NOT EXISTS idx_quickbooks_export_jobs_status
  ON quickbooks_export_jobs(status);
CREATE INDEX IF NOT EXISTS idx_quickbooks_export_jobs_created
  ON quickbooks_export_jobs(created_at DESC);

ALTER TABLE quickbooks_export_jobs ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'quickbooks_export_jobs_read_own_company') THEN
    CREATE POLICY quickbooks_export_jobs_read_own_company ON quickbooks_export_jobs
      FOR SELECT TO authenticated
      USING (company_id = current_setting('app.company_id', true));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'quickbooks_export_jobs_service_role_all') THEN
    CREATE POLICY quickbooks_export_jobs_service_role_all ON quickbooks_export_jobs
      FOR ALL TO service_role
      USING (true) WITH CHECK (true);
  END IF;
END $$;
