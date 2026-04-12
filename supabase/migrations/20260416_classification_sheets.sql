-- Block 5 — Classification sheet generator
-- Idempotent. Adds 2 nullable columns to globalpc_productos,
-- creates classification_sheet_configs (per-cliente default) and
-- classification_sheets (history w/ full config snapshot).

ALTER TABLE globalpc_productos
  ADD COLUMN IF NOT EXISTS umc text,
  ADD COLUMN IF NOT EXISTS certificado_origen_tmec boolean DEFAULT false;

CREATE TABLE IF NOT EXISTS classification_sheet_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id text NOT NULL,
  company_id text NOT NULL,
  grouping_mode text NOT NULL DEFAULT 'fraction_umc_country',
  ordering_mode text NOT NULL DEFAULT 'fraction_asc',
  specific_description text NOT NULL DEFAULT 'none',
  restriction_print_mode text NOT NULL DEFAULT 'separate_annex',
  print_toggles jsonb NOT NULL DEFAULT '{}'::jsonb,
  email_recipients text[] DEFAULT ARRAY[]::text[],
  is_default boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (cliente_id, company_id)
);

CREATE TABLE IF NOT EXISTS classification_sheets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trafico_id text NOT NULL,
  cliente_id text NOT NULL,
  company_id text NOT NULL,
  generated_by text NOT NULL,
  config jsonb NOT NULL,
  partidas_count integer NOT NULL,
  total_value numeric(14,2),
  pdf_url text,
  excel_url text,
  sent_to_recipients text[] DEFAULT ARRAY[]::text[],
  generated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_class_cfg_cliente ON classification_sheet_configs(cliente_id);
CREATE INDEX IF NOT EXISTS idx_class_cfg_company ON classification_sheet_configs(company_id);
CREATE INDEX IF NOT EXISTS idx_class_sheets_trafico ON classification_sheets(trafico_id);
CREATE INDEX IF NOT EXISTS idx_class_sheets_company ON classification_sheets(company_id);

ALTER TABLE classification_sheet_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE classification_sheets ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'classification_sheet_configs'
      AND policyname = 'service_role full access'
  ) THEN
    CREATE POLICY "service_role full access" ON classification_sheet_configs
      FOR ALL USING (current_setting('role', true) = 'service_role');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'classification_sheets'
      AND policyname = 'service_role full access'
  ) THEN
    CREATE POLICY "service_role full access" ON classification_sheets
      FOR ALL USING (current_setting('role', true) = 'service_role');
  END IF;
END $$;
