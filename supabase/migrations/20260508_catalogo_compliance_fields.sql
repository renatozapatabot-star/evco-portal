-- ═══════════════════════════════════════════════════════════════
-- AGUILA · Catálogo de Productos — compliance fields.
--
-- Adds regulatory metadata to globalpc_productos so the catalog can
-- drive NOM / SEDUE / SEMARNAT expiry alerts and PROSEC/COVE checks
-- without a separate table. Keeps the tenant isolation RLS already
-- defined on globalpc_productos.
-- ═══════════════════════════════════════════════════════════════

-- Unit of measure — SAT standard codes (Mexican tariff conventions).
ALTER TABLE globalpc_productos
  ADD COLUMN IF NOT EXISTS umc text
    CHECK (umc IS NULL OR umc IN ('KG','PZA','M','M2','M3','LT'));

-- Product classification tipo — constrains free-text drift, matches
-- the operator dropdown in Catálogo.
ALTER TABLE globalpc_productos
  ADD COLUMN IF NOT EXISTS tipo text
    CHECK (tipo IS NULL OR tipo IN (
      'ensamble','empaque','rack','refaccion','vehiculo',
      'maq_eqp','miscelaneo','lamina','gasolina','diesel'
    ));

-- NOM compliance (one primary NOM per row — multi-NOM stays in
-- classification_log.nom_required as an array).
ALTER TABLE globalpc_productos
  ADD COLUMN IF NOT EXISTS nom_numero   text,
  ADD COLUMN IF NOT EXISTS nom_expiry   date;

-- SEDUE / environmental permit (e.g. hazardous/restricted goods).
ALTER TABLE globalpc_productos
  ADD COLUMN IF NOT EXISTS sedue_permit text,
  ADD COLUMN IF NOT EXISTS sedue_expiry date;

-- SEMARNAT certificate (wildlife, wood, regulated substances).
ALTER TABLE globalpc_productos
  ADD COLUMN IF NOT EXISTS semarnat_cert   text,
  ADD COLUMN IF NOT EXISTS semarnat_expiry date;

-- Fiscal flags.
ALTER TABLE globalpc_productos
  ADD COLUMN IF NOT EXISTS cove_bloqueada   boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS prosec_elegible  boolean NOT NULL DEFAULT false;

-- Partial indexes for the vencimientos dashboard — only non-null
-- expiries are relevant, keeps the indexes tiny.
CREATE INDEX IF NOT EXISTS idx_globalpc_productos_nom_expiry
  ON globalpc_productos(company_id, nom_expiry)
  WHERE nom_expiry IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_globalpc_productos_sedue_expiry
  ON globalpc_productos(company_id, sedue_expiry)
  WHERE sedue_expiry IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_globalpc_productos_semarnat_expiry
  ON globalpc_productos(company_id, semarnat_expiry)
  WHERE semarnat_expiry IS NOT NULL;
