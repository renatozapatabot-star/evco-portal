-- Block 13 · Warehouse entries (Vicente's mobile-first workflow).
-- Vicente receives trailers on the dock, captures photos, notes damage.
-- Event `warehouse_entry_received` already in events_catalog (Block 1); Block 7's
-- corridor-position already routes it to `rz_warehouse`. Idempotent.

CREATE TABLE IF NOT EXISTS warehouse_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trafico_id text NOT NULL,
  company_id text NOT NULL,
  trailer_number text NOT NULL,
  dock_assigned text,
  received_by text NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now(),
  photo_urls text[] NOT NULL DEFAULT ARRAY[]::text[],
  notes text,
  status text NOT NULL DEFAULT 'receiving' CHECK (status IN ('receiving','staged','released')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_warehouse_trafico
  ON warehouse_entries(trafico_id);
CREATE INDEX IF NOT EXISTS idx_warehouse_status
  ON warehouse_entries(status, company_id);

-- === RLS ===
ALTER TABLE warehouse_entries ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'warehouse_entries_read_own_company') THEN
    CREATE POLICY warehouse_entries_read_own_company ON warehouse_entries
      FOR SELECT TO authenticated
      USING (company_id = current_setting('app.company_id', true));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'warehouse_entries_service_role_all') THEN
    CREATE POLICY warehouse_entries_service_role_all ON warehouse_entries
      FOR ALL TO service_role
      USING (true) WITH CHECK (true);
  END IF;
END $$;
