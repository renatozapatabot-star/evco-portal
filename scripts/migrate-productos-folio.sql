-- Migration: Add globalpc_folio column to globalpc_productos
-- Fixes key mismatch where cb_producto_factura.iFolio was stored as cve_producto
-- The correct key is cu_cliente_proveedor_producto.sCveClienteProveedorProducto
-- globalpc_folio stores the cb_producto_factura.iFolio cross-reference separately

-- 1. Add the missing column
ALTER TABLE globalpc_productos ADD COLUMN IF NOT EXISTS globalpc_folio BIGINT;
ALTER TABLE globalpc_productos ADD COLUMN IF NOT EXISTS company_id TEXT DEFAULT 'evco';

-- 2. Index for folio lookups (invoice line items → product catalog)
CREATE INDEX IF NOT EXISTS idx_gpc_productos_folio ON globalpc_productos(globalpc_folio);

-- 3. Clean up mismatched records where iFolio was jammed into cve_producto
-- These are numeric-only cve_producto values from the bad full-sync-productos.js run
-- Real product codes from cu_cliente_proveedor_producto are alphanumeric strings
DELETE FROM globalpc_productos
WHERE cve_producto ~ '^\d+$'
  AND LENGTH(cve_producto) > 4
  AND cve_proveedor IS NULL;

-- 4. Also add risk_score to traficos if missing (for Task 3)
ALTER TABLE traficos ADD COLUMN IF NOT EXISTS risk_score INTEGER;
CREATE INDEX IF NOT EXISTS idx_traficos_risk_score ON traficos(risk_score);

SELECT 'Migration complete — globalpc_folio + risk_score columns added' AS status;
