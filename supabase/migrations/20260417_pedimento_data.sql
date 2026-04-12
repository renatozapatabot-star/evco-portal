-- AGUILA · Block 6a — Pedimento Data Schema
-- One parent (pedimentos) + 10 child tables covering the GlobalPC 14-tab
-- pedimento editor. FK type matches `traficos.trafico` convention (TEXT).
-- All tables RLS-enabled; idempotent guards throughout.
-- Patente 3596 · Aduana 240

-- =========================================================================
-- PARENT
-- =========================================================================
CREATE TABLE IF NOT EXISTS pedimentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trafico_id text NOT NULL,
  company_id text NOT NULL,
  cliente_id text NOT NULL,
  pedimento_number text,
  patente text NOT NULL DEFAULT '3596',
  aduana text NOT NULL DEFAULT '240',
  pre_validador text DEFAULT '010',
  document_type text,
  regime_type text,
  destination_origin text,
  transport_entry text,
  transport_arrival text,
  transport_exit text,
  exchange_rate numeric(10,4),
  cliente_rfc text,
  validation_signature text,
  bank_signature text,
  sat_transaction_number text,
  bank_operation_number text,
  observations text,
  status text NOT NULL DEFAULT 'borrador'
    CHECK (status IN ('borrador','validado','firmado','pagado','cruzado','cancelado')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (company_id, pedimento_number)
);

CREATE INDEX IF NOT EXISTS idx_pedimentos_trafico ON pedimentos(trafico_id);
CREATE INDEX IF NOT EXISTS idx_pedimentos_company ON pedimentos(company_id);
CREATE INDEX IF NOT EXISTS idx_pedimentos_number  ON pedimentos(pedimento_number);

ALTER TABLE pedimentos ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'pedimentos' AND policyname = 'svc_all_pedimentos'
  ) THEN
    CREATE POLICY "svc_all_pedimentos" ON pedimentos
      FOR ALL USING (auth.role() = 'service_role');
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'pedimentos' AND policyname = 'pedimentos_select_own_company'
  ) THEN
    CREATE POLICY "pedimentos_select_own_company" ON pedimentos
      FOR SELECT USING (company_id = current_setting('app.company_id', true));
  END IF;
END $$;

-- =========================================================================
-- CHILD TABLES (10)
-- =========================================================================
CREATE TABLE IF NOT EXISTS pedimento_destinatarios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pedimento_id uuid NOT NULL REFERENCES pedimentos(id) ON DELETE CASCADE,
  razon_social text,
  rfc text,
  address jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ped_destinatarios_parent ON pedimento_destinatarios(pedimento_id);

CREATE TABLE IF NOT EXISTS pedimento_compensaciones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pedimento_id uuid NOT NULL REFERENCES pedimentos(id) ON DELETE CASCADE,
  compensacion_type text,
  amount numeric(14,2),
  reference text,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ped_compensaciones_parent ON pedimento_compensaciones(pedimento_id);

CREATE TABLE IF NOT EXISTS pedimento_pagos_virtuales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pedimento_id uuid NOT NULL REFERENCES pedimentos(id) ON DELETE CASCADE,
  bank_code text,
  payment_form text,
  amount numeric(14,2),
  reference text,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ped_pagos_parent ON pedimento_pagos_virtuales(pedimento_id);

CREATE TABLE IF NOT EXISTS pedimento_guias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pedimento_id uuid NOT NULL REFERENCES pedimentos(id) ON DELETE CASCADE,
  guia_type text,
  guia_number text,
  carrier text,
  container_number text,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ped_guias_parent ON pedimento_guias(pedimento_id);

CREATE TABLE IF NOT EXISTS pedimento_transportistas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pedimento_id uuid NOT NULL REFERENCES pedimentos(id) ON DELETE CASCADE,
  carrier_type text NOT NULL DEFAULT 'mx'
    CHECK (carrier_type IN ('mx','transfer','foreign')),
  carrier_id text,
  carrier_name text,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ped_transportistas_parent ON pedimento_transportistas(pedimento_id);

CREATE TABLE IF NOT EXISTS pedimento_candados (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pedimento_id uuid NOT NULL REFERENCES pedimentos(id) ON DELETE CASCADE,
  seal_number text,
  verification_status text,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ped_candados_parent ON pedimento_candados(pedimento_id);

CREATE TABLE IF NOT EXISTS pedimento_descargas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pedimento_id uuid NOT NULL REFERENCES pedimentos(id) ON DELETE CASCADE,
  dock_assignment text,
  unloaded_at timestamptz,
  notes text,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ped_descargas_parent ON pedimento_descargas(pedimento_id);

CREATE TABLE IF NOT EXISTS pedimento_cuentas_garantia (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pedimento_id uuid NOT NULL REFERENCES pedimentos(id) ON DELETE CASCADE,
  account_reference text,
  amount numeric(14,2),
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ped_cuentas_parent ON pedimento_cuentas_garantia(pedimento_id);

CREATE TABLE IF NOT EXISTS pedimento_contribuciones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pedimento_id uuid NOT NULL REFERENCES pedimentos(id) ON DELETE CASCADE,
  contribution_type text,
  rate numeric(10,4),
  base numeric(14,2),
  amount numeric(14,2),
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ped_contribuciones_parent ON pedimento_contribuciones(pedimento_id);

-- 10th child: facturas proveedores (link table to aduanet_facturas-style rows
-- captured inline for this pedimento when no aduanet match exists yet)
CREATE TABLE IF NOT EXISTS pedimento_facturas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pedimento_id uuid NOT NULL REFERENCES pedimentos(id) ON DELETE CASCADE,
  supplier_name text,
  supplier_tax_id text,
  invoice_number text,
  invoice_date date,
  currency text,
  amount numeric(14,2),
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ped_facturas_parent ON pedimento_facturas(pedimento_id);

-- =========================================================================
-- RLS on every child table
-- =========================================================================
DO $$
DECLARE
  t text;
  child_tables text[] := ARRAY[
    'pedimento_destinatarios',
    'pedimento_compensaciones',
    'pedimento_pagos_virtuales',
    'pedimento_guias',
    'pedimento_transportistas',
    'pedimento_candados',
    'pedimento_descargas',
    'pedimento_cuentas_garantia',
    'pedimento_contribuciones',
    'pedimento_facturas'
  ];
BEGIN
  FOREACH t IN ARRAY child_tables LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);

    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE tablename = t AND policyname = format('svc_all_%s', t)
    ) THEN
      EXECUTE format(
        'CREATE POLICY %I ON %I FOR ALL USING (auth.role() = ''service_role'')',
        format('svc_all_%s', t), t
      );
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE tablename = t AND policyname = format('%s_select_via_parent', t)
    ) THEN
      EXECUTE format(
        'CREATE POLICY %I ON %I FOR SELECT USING (
           EXISTS (
             SELECT 1 FROM pedimentos p
             WHERE p.id = %I.pedimento_id
               AND p.company_id = current_setting(''app.company_id'', true)
           )
         )',
        format('%s_select_via_parent', t), t, t
      );
    END IF;
  END LOOP;
END $$;

-- =========================================================================
-- Events catalog extension
-- =========================================================================
INSERT INTO events_catalog (event_type, category, visibility, display_name_es, description_es, icon_name, color_token)
VALUES ('pedimento_field_modified', 'lifecycle', 'private', 'Campo de pedimento modificado', 'Operador modificó un campo del pedimento', 'edit', 'ACCENT_SILVER')
ON CONFLICT (event_type) DO NOTHING;
