-- Block 11 · Mexican bank catalog + PECE payment workflow.
-- 87 banks seeded (Banxico bank codes). `pece_payments` tracks the
-- intent → submitted → confirmed lifecycle per pedimento.
-- Idempotent across all CREATE/INSERT/POLICY blocks.

CREATE TABLE IF NOT EXISTS mexican_banks (
  bank_code text PRIMARY KEY,
  name text NOT NULL,
  swift_code text,
  accepts_pece boolean NOT NULL DEFAULT true,
  notes text
);

CREATE TABLE IF NOT EXISTS pece_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pedimento_id uuid NOT NULL,
  trafico_id text,
  company_id text NOT NULL,
  bank_code text NOT NULL REFERENCES mexican_banks(bank_code),
  amount numeric(14,2) NOT NULL,
  reference text NOT NULL,
  payment_intent_at timestamptz DEFAULT now(),
  submitted_at timestamptz,
  confirmed_at timestamptz,
  confirmation_number text,
  status text NOT NULL DEFAULT 'intent'
    CHECK (status IN ('intent','submitted','confirmed','rejected')),
  created_by text NOT NULL,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_pece_pedimento ON pece_payments(pedimento_id);
CREATE INDEX IF NOT EXISTS idx_pece_company_status ON pece_payments(company_id, status);

ALTER TABLE mexican_banks ENABLE ROW LEVEL SECURITY;
ALTER TABLE pece_payments ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'mexican_banks' AND policyname = 'svc_all_mexican_banks'
  ) THEN
    CREATE POLICY "svc_all_mexican_banks" ON mexican_banks
      FOR ALL USING (auth.role() = 'service_role');
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'mexican_banks' AND policyname = 'mexican_banks_read_all_authenticated'
  ) THEN
    CREATE POLICY "mexican_banks_read_all_authenticated" ON mexican_banks
      FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'pece_payments' AND policyname = 'svc_all_pece_payments'
  ) THEN
    CREATE POLICY "svc_all_pece_payments" ON pece_payments
      FOR ALL USING (auth.role() = 'service_role');
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'pece_payments' AND policyname = 'pece_payments_select_own_company'
  ) THEN
    CREATE POLICY "pece_payments_select_own_company" ON pece_payments
      FOR SELECT USING (company_id = current_setting('app.company_id', true));
  END IF;
END $$;

INSERT INTO mexican_banks (bank_code, name, swift_code, accepts_pece) VALUES
  ('002','BBVA México','BCMRMXMM',true),
  ('014','Santander','BMSXMXMM',true),
  ('021','HSBC','BIMEXMXM',true),
  ('036','Banjercito','BJEMMXMT',true),
  ('040','Banco del Bajío','BAJIMXMM',true),
  ('042','Banca Mifel','MIFEMXMT',true),
  ('044','Scotiabank','MBCOMXMM',true),
  ('058','Banregio','BRGOMXMM',true),
  ('059','Invex','INVEMXMT',true),
  ('060','Bansi','BNSIMXMM',true),
  ('062','Afirme','AFIRMXMT',true),
  ('072','Banorte','MENOMXMT',true),
  ('102','ABC Capital',NULL,true),
  ('103','American Express Bank',NULL,true),
  ('106','Bank of America','BOFAMX2X',true),
  ('108','MUFG Bank México','BOTKMXMX',true),
  ('110','JP Morgan','CHASMXMX',true),
  ('112','BMonex','MONXMXMT',true),
  ('113','Ve por Más','VXBXMXMT',true),
  ('116','ING Bank',NULL,false),
  ('124','Deutsche Bank',NULL,true),
  ('126','Credit Suisse','CSFBMXMX',true),
  ('127','Azteca','AZTKMXMT',true),
  ('128','Autofin',NULL,true),
  ('129','Barclays','BARCMXMM',true),
  ('130','Compartamos','COMPMXMX',true),
  ('132','Multiva','BMULMXMM',true),
  ('133','Actinver','ACTIMXMT',true),
  ('135','Nafin','NAFIMXMT',true),
  ('136','Interacciones',NULL,true),
  ('137','BanCoppel','BCOPMXMT',true),
  ('138','ABC Capital 2',NULL,true),
  ('140','Banco Inmobiliario','BAIMXMM',true),
  ('141','Volkswagen Bank',NULL,true),
  ('143','CIBanco','CIBMXMM',true),
  ('145','BBase',NULL,true),
  ('147','Bankaool',NULL,true),
  ('148','Pagatodo',NULL,true),
  ('149','Forjadores',NULL,true),
  ('150','Inmobiliario Mexicano',NULL,true),
  ('151','Donde',NULL,true),
  ('152','Bancrea',NULL,true),
  ('154','Banco Base',NULL,true),
  ('155','ICBC',NULL,true),
  ('156','Sabadell','BSABMXMX',true),
  ('157','Shinhan',NULL,true),
  ('158','Mizuho','MHCBMXMM',true),
  ('159','Bank of China','BKCHMXMM',true),
  ('160','Banco S3',NULL,true),
  ('166','Banco de México','BDMXMXMM',false),
  ('168','Hipotecaria Federal',NULL,false),
  ('600','Monex',NULL,true),
  ('601','GBM','GBMEMXMT',true),
  ('606','Bulltick',NULL,true),
  ('607','Value',NULL,true),
  ('608','Vector',NULL,true),
  ('610','B&B',NULL,true),
  ('614','Accival',NULL,true),
  ('615','Merrill Lynch',NULL,true),
  ('616','Finamex',NULL,true),
  ('617','Valmex',NULL,true),
  ('618','Unica',NULL,true),
  ('619','MAPFRE',NULL,true),
  ('620','Profuturo',NULL,true),
  ('621','Actinver 2',NULL,true),
  ('622','Actinver 3',NULL,true),
  ('623','Skandia',NULL,true),
  ('626','Intercam','INBKMXMM',true),
  ('627','Opciones Empresariales',NULL,true),
  ('628','CB Intercam',NULL,true),
  ('629','CI Bolsa',NULL,true),
  ('630','Multivalores',NULL,true),
  ('631','CB Actinver',NULL,true),
  ('632','Order',NULL,true),
  ('633','JP Morgan CB',NULL,true),
  ('636','HDI Seguros',NULL,true),
  ('637','Zurich',NULL,true),
  ('638','Nueva Wal-Mart',NULL,true),
  ('640','CB JP Morgan',NULL,true),
  ('642','Reforma CB',NULL,true),
  ('646','STP','STPEMXMX',true),
  ('647','Telecomm',NULL,true),
  ('648','Evercore',NULL,true),
  ('649','Skandia Operadora',NULL,true),
  ('651','Segmty',NULL,true),
  ('652','Asea',NULL,true),
  ('653','Kuspit',NULL,true),
  ('656','Unagra',NULL,true),
  ('659','Opcipre',NULL,true),
  ('901','CLS',NULL,false),
  ('902','Indeval',NULL,false)
ON CONFLICT (bank_code) DO NOTHING;

INSERT INTO events_catalog
  (event_type, category, visibility, display_name_es, description_es, icon_name, color_token)
VALUES
  ('pece_payment_intent', 'lifecycle', 'private', 'Intento de pago PECE',
   'Operador registró intento de pago PECE', 'credit-card', 'ACCENT_SILVER'),
  ('pece_payment_confirmed', 'lifecycle', 'private', 'Pago PECE confirmado',
   'Pago PECE confirmado con folio bancario', 'check-circle', 'ACCENT_SILVER')
ON CONFLICT (event_type) DO NOTHING;
