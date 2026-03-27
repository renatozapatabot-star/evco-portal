-- ============================================================
-- CRUZ MULTI-TENANT RLS
-- Run in Supabase SQL Editor — one block at a time
-- ============================================================

-- ── BLOCK 1: Add tenant_slug columns ──────────────────────
ALTER TABLE traficos ADD COLUMN IF NOT EXISTS tenant_slug VARCHAR(50);
ALTER TABLE entradas ADD COLUMN IF NOT EXISTS tenant_slug VARCHAR(50);
ALTER TABLE aduanet_facturas ADD COLUMN IF NOT EXISTS tenant_slug VARCHAR(50);
ALTER TABLE documents ADD COLUMN IF NOT EXISTS tenant_slug VARCHAR(50);


-- ── BLOCK 2: Populate tenant_slug ─────────────────────────
UPDATE traficos SET tenant_slug = company_id WHERE tenant_slug IS NULL AND company_id IS NOT NULL;
UPDATE entradas SET tenant_slug = company_id WHERE tenant_slug IS NULL AND company_id IS NOT NULL;
UPDATE aduanet_facturas SET tenant_slug = 'evco' WHERE tenant_slug IS NULL AND clave_cliente = '9254';
UPDATE documents SET tenant_slug = 'evco' WHERE tenant_slug IS NULL;


-- ── BLOCK 3: Create portal_tokens table ───────────────────
CREATE TABLE IF NOT EXISTS portal_tokens (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  token VARCHAR(100) UNIQUE NOT NULL,
  tenant_slug VARCHAR(50) NOT NULL,
  client_name VARCHAR(200),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE,
  active BOOLEAN DEFAULT TRUE
);

INSERT INTO portal_tokens (token, tenant_slug, client_name)
VALUES ('evco-portal-token-2026', 'evco', 'EVCO Plastics de México')
ON CONFLICT (token) DO NOTHING;


-- ── BLOCK 4: Enable RLS ────────────────────────────────────
ALTER TABLE traficos ENABLE ROW LEVEL SECURITY;
ALTER TABLE entradas ENABLE ROW LEVEL SECURITY;
ALTER TABLE aduanet_facturas ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE portal_tokens ENABLE ROW LEVEL SECURITY;


-- ── BLOCK 5: Drop old policies ────────────────────────────
DROP POLICY IF EXISTS "Enable read access for all users" ON traficos;
DROP POLICY IF EXISTS "Enable read access for all users" ON entradas;
DROP POLICY IF EXISTS "Enable read access for all users" ON aduanet_facturas;
DROP POLICY IF EXISTS "Enable read access for all users" ON documents;
DROP POLICY IF EXISTS "service_role_traficos" ON traficos;
DROP POLICY IF EXISTS "service_role_entradas" ON entradas;
DROP POLICY IF EXISTS "service_role_facturas" ON aduanet_facturas;
DROP POLICY IF EXISTS "service_role_documents" ON documents;
DROP POLICY IF EXISTS "anon_read_traficos" ON traficos;
DROP POLICY IF EXISTS "anon_read_entradas" ON entradas;
DROP POLICY IF EXISTS "anon_read_facturas" ON aduanet_facturas;
DROP POLICY IF EXISTS "anon_read_documents" ON documents;
DROP POLICY IF EXISTS "anon_insert_documents" ON documents;
DROP POLICY IF EXISTS "anon_read_tokens" ON portal_tokens;


-- ── BLOCK 6: Create service role policies ─────────────────
CREATE POLICY "service_role_traficos" ON traficos
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "service_role_entradas" ON entradas
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "service_role_facturas" ON aduanet_facturas
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "service_role_documents" ON documents
  FOR ALL USING (auth.role() = 'service_role');


-- ── BLOCK 7: Create anon read policies ────────────────────
CREATE POLICY "anon_read_traficos" ON traficos
  FOR SELECT USING (true);

CREATE POLICY "anon_read_entradas" ON entradas
  FOR SELECT USING (true);

CREATE POLICY "anon_read_facturas" ON aduanet_facturas
  FOR SELECT USING (true);

CREATE POLICY "anon_read_documents" ON documents
  FOR SELECT USING (true);

CREATE POLICY "anon_insert_documents" ON documents
  FOR INSERT WITH CHECK (true);

CREATE POLICY "anon_read_tokens" ON portal_tokens
  FOR SELECT USING (true);


-- ── BLOCK 8: Indexes ──────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_traficos_tenant ON traficos(tenant_slug);
CREATE INDEX IF NOT EXISTS idx_entradas_tenant ON entradas(tenant_slug);
CREATE INDEX IF NOT EXISTS idx_facturas_tenant ON aduanet_facturas(tenant_slug);
CREATE INDEX IF NOT EXISTS idx_documents_tenant ON documents(tenant_slug);


-- ── BLOCK 9: communication_events table ───────────────────
CREATE TABLE IF NOT EXISTS communication_events (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  email_id VARCHAR(100) UNIQUE,
  tenant_slug VARCHAR(50) DEFAULT 'evco',
  from_address TEXT,
  subject TEXT,
  date TEXT,
  traficos_mentioned TEXT[],
  pedimentos_mentioned TEXT[],
  is_urgent BOOLEAN DEFAULT FALSE,
  urgent_keywords TEXT[],
  scanned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE communication_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_comms" ON communication_events;
DROP POLICY IF EXISTS "anon_read_comms" ON communication_events;

CREATE POLICY "service_role_comms" ON communication_events
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "anon_read_comms" ON communication_events
  FOR SELECT USING (true);


-- ── BLOCK 10: Verify ──────────────────────────────────────
SELECT
  t.tablename,
  t.rowsecurity as rls_enabled,
  COUNT(p.policyname) as policy_count
FROM pg_tables t
LEFT JOIN pg_policies p
  ON p.tablename = t.tablename
  AND p.schemaname = 'public'
WHERE t.schemaname = 'public'
  AND t.tablename IN (
    'traficos','entradas','aduanet_facturas',
    'documents','portal_tokens','communication_events'
  )
GROUP BY t.tablename, t.rowsecurity
ORDER BY t.tablename;
