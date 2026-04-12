-- V1.5 F3 · Monthly close checklist — company_id scoping + RLS + indexes.
-- Anabel's monthly-close cockpit checklist. One row per (company_id, month, item_key).
-- Seeded on demand by lib/contabilidad/close.ts — not here.
-- Patente 3596 · Aduana 240.

CREATE TABLE IF NOT EXISTS monthly_close_checklist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id text NOT NULL,
  month date NOT NULL,
  item_key text NOT NULL,
  item_label text NOT NULL,
  is_done boolean NOT NULL DEFAULT false,
  done_at timestamptz,
  done_by uuid,
  notes text,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, month, item_key)
);

CREATE INDEX IF NOT EXISTS idx_monthly_close_checklist_company_month
  ON monthly_close_checklist(company_id, month);

ALTER TABLE monthly_close_checklist ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'monthly_close_checklist_read_own_company') THEN
    CREATE POLICY monthly_close_checklist_read_own_company ON monthly_close_checklist
      FOR SELECT TO authenticated
      USING (company_id = current_setting('app.company_id', true));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'monthly_close_checklist_update_own_company') THEN
    CREATE POLICY monthly_close_checklist_update_own_company ON monthly_close_checklist
      FOR UPDATE TO authenticated
      USING (company_id = current_setting('app.company_id', true))
      WITH CHECK (company_id = current_setting('app.company_id', true));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'monthly_close_checklist_service_role_all') THEN
    CREATE POLICY monthly_close_checklist_service_role_all ON monthly_close_checklist
      FOR ALL TO service_role
      USING (true) WITH CHECK (true);
  END IF;
END $$;
