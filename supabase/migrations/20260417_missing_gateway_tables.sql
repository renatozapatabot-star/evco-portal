-- Create tables referenced in /api/data ALLOWED_TABLES but not yet existing
-- Audit finding 3.6: globalpc_productos and econta_facturas_detalle missing

-- globalpc_productos: product catalog synced from GlobalPC
CREATE TABLE IF NOT EXISTS globalpc_productos (
  id bigint generated always as identity primary key,
  cve_producto text,
  cve_proveedor text,
  cve_trafico text,
  fraccion text,
  descripcion text,
  descripcion_ingles text,
  cantidad numeric,
  unidad text,
  valor_unitario numeric,
  valor_total numeric,
  peso_neto numeric,
  pais_origen text,
  company_id text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

ALTER TABLE globalpc_productos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "client_isolation_globalpc_productos" ON globalpc_productos
  FOR ALL USING (true);

CREATE INDEX IF NOT EXISTS idx_globalpc_productos_company ON globalpc_productos (company_id);
CREATE INDEX IF NOT EXISTS idx_globalpc_productos_fraccion ON globalpc_productos (fraccion);
CREATE INDEX IF NOT EXISTS idx_globalpc_productos_proveedor ON globalpc_productos (cve_proveedor);

-- econta_facturas_detalle: invoice line items from e-Conta
CREATE TABLE IF NOT EXISTS econta_facturas_detalle (
  id bigint generated always as identity primary key,
  factura_id bigint,
  clave_producto text,
  descripcion text,
  cantidad numeric,
  valor_unitario numeric,
  importe numeric,
  descuento numeric default 0,
  iva numeric default 0,
  company_id text,
  created_at timestamptz default now()
);

ALTER TABLE econta_facturas_detalle ENABLE ROW LEVEL SECURITY;

CREATE POLICY "client_isolation_econta_facturas_detalle" ON econta_facturas_detalle
  FOR ALL USING (true);

CREATE INDEX IF NOT EXISTS idx_econta_facturas_detalle_factura ON econta_facturas_detalle (factura_id);
