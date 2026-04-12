-- Block 8 · Invoice Bank — extends pedimento_facturas so un-assigned
-- invoices can live in the bank until an operator attaches them to a
-- tráfico. Idempotent ADD COLUMN IF NOT EXISTS — safe to re-run on
-- environments that already applied it.

ALTER TABLE pedimento_facturas
  ADD COLUMN IF NOT EXISTS assigned_to_trafico_id text,
  ADD COLUMN IF NOT EXISTS assigned_at timestamptz,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'unassigned',
  ADD COLUMN IF NOT EXISTS file_url text,
  ADD COLUMN IF NOT EXISTS received_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS company_id text,
  ADD COLUMN IF NOT EXISTS uploaded_by text,
  ADD COLUMN IF NOT EXISTS archived_at timestamptz;

-- Status CHECK (drop/recreate so re-runs pick up newer vocabulary)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'pedimento_facturas_status_chk'
  ) THEN
    ALTER TABLE pedimento_facturas
      ADD CONSTRAINT pedimento_facturas_status_chk
      CHECK (status IN ('unassigned','assigned','archived'));
  END IF;
END $$;

-- Parent FK was NOT NULL on the original schema. Unassigned bank rows
-- have no parent pedimento yet — relax so upload flow can insert.
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'pedimento_facturas'
      AND column_name = 'pedimento_id'
      AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE pedimento_facturas ALTER COLUMN pedimento_id DROP NOT NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_ped_facturas_status_company
  ON pedimento_facturas(status, company_id);
CREATE INDEX IF NOT EXISTS idx_ped_facturas_assigned_trafico
  ON pedimento_facturas(assigned_to_trafico_id)
  WHERE assigned_to_trafico_id IS NOT NULL;

-- Bank-scope RLS policy: operators/broker/admin see company rows.
-- The existing select_via_parent policy stays for assigned rows that
-- join back to a pedimento.
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'pedimento_facturas'
      AND policyname = 'pedimento_facturas_bank_scope'
  ) THEN
    CREATE POLICY pedimento_facturas_bank_scope ON pedimento_facturas
      FOR SELECT USING (
        company_id IS NOT NULL
        AND company_id = current_setting('app.company_id', true)
      );
  END IF;
END $$;

-- Events catalog: invoice lifecycle events.
INSERT INTO events_catalog
  (event_type, category, visibility, display_name_es, description_es, icon_name, color_token)
VALUES
  ('invoice_uploaded', 'lifecycle', 'private', 'Factura cargada',
   'Factura subida al banco de facturas', 'upload', 'ACCENT_SILVER'),
  ('invoice_classified', 'lifecycle', 'private', 'Factura clasificada',
   'Claude Vision extrajo los campos de la factura', 'sparkles', 'ACCENT_SILVER'),
  ('invoice_assigned', 'lifecycle', 'private', 'Factura asignada',
   'Factura asignada a un tráfico', 'link', 'ACCENT_SILVER'),
  ('invoice_archived', 'lifecycle', 'private', 'Factura archivada',
   'Factura archivada (soft delete)', 'archive', 'TEXT_MUTED'),
  ('invoice_deleted', 'lifecycle', 'private', 'Factura eliminada',
   'Factura eliminada del banco', 'trash', 'RED')
ON CONFLICT (event_type) DO NOTHING;
