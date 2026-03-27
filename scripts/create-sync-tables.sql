-- ============================================================
-- GLOBALPC + ECONTA SYNC TABLES
-- Run in Supabase SQL Editor
-- ============================================================

-- ── globalpc_facturas ──
CREATE TABLE IF NOT EXISTS globalpc_facturas (
  id BIGSERIAL PRIMARY KEY,
  folio BIGINT UNIQUE,
  cve_trafico VARCHAR(15),
  cve_cliente VARCHAR(15),
  cve_proveedor VARCHAR(15),
  numero VARCHAR(50),
  incoterm CHAR(3),
  moneda CHAR(3),
  fecha_facturacion TIMESTAMPTZ,
  valor_comercial DOUBLE PRECISION,
  flete DOUBLE PRECISION,
  seguros DOUBLE PRECISION,
  embalajes DOUBLE PRECISION,
  incrementables DOUBLE PRECISION,
  deducibles DOUBLE PRECISION,
  cove_vucem VARCHAR(20),
  tenant_id UUID DEFAULT '52762e3c-bd8a-49b8-9a32-296e526b7238',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_gpc_facturas_trafico ON globalpc_facturas(cve_trafico);
CREATE INDEX IF NOT EXISTS idx_gpc_facturas_cliente ON globalpc_facturas(cve_cliente);

-- ── globalpc_partidas ──
CREATE TABLE IF NOT EXISTS globalpc_partidas (
  id BIGSERIAL PRIMARY KEY,
  folio BIGINT,
  numero_item INT,
  cve_cliente VARCHAR(15),
  cve_proveedor VARCHAR(15),
  cve_producto VARCHAR(50),
  precio_unitario DOUBLE PRECISION,
  cantidad DOUBLE PRECISION,
  peso DOUBLE PRECISION,
  pais_origen CHAR(3),
  marca VARCHAR(70),
  modelo VARCHAR(70),
  serie VARCHAR(70),
  tenant_id UUID DEFAULT '52762e3c-bd8a-49b8-9a32-296e526b7238',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(folio, numero_item)
);
CREATE INDEX IF NOT EXISTS idx_gpc_partidas_folio ON globalpc_partidas(folio);
CREATE INDEX IF NOT EXISTS idx_gpc_partidas_cliente ON globalpc_partidas(cve_cliente);

-- ── globalpc_eventos ──
CREATE TABLE IF NOT EXISTS globalpc_eventos (
  id BIGSERIAL PRIMARY KEY,
  consecutivo BIGINT UNIQUE,
  cve_trafico VARCHAR(15),
  consecutivo_evento INT,
  fecha TIMESTAMPTZ,
  comentarios TEXT,
  registrado_por VARCHAR(120),
  remesa VARCHAR(15),
  tenant_id UUID DEFAULT '52762e3c-bd8a-49b8-9a32-296e526b7238',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_gpc_eventos_trafico ON globalpc_eventos(cve_trafico);

-- ── globalpc_contenedores ──
CREATE TABLE IF NOT EXISTS globalpc_contenedores (
  id BIGSERIAL PRIMARY KEY,
  consecutivo BIGINT UNIQUE,
  cve_trafico VARCHAR(15),
  numero_caja VARCHAR(15),
  cve_contenedor VARCHAR(10),
  placas VARCHAR(15),
  sello1 VARCHAR(50),
  sello2 VARCHAR(50),
  pais_transporte VARCHAR(3),
  tenant_id UUID DEFAULT '52762e3c-bd8a-49b8-9a32-296e526b7238',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_gpc_contenedores_trafico ON globalpc_contenedores(cve_trafico);

-- ── globalpc_ordenes_carga ──
CREATE TABLE IF NOT EXISTS globalpc_ordenes_carga (
  id BIGSERIAL PRIMARY KEY,
  consecutivo BIGINT UNIQUE,
  fecha TIMESTAMPTZ,
  tipo_orden CHAR(1),
  fecha_salida TIMESTAMPTZ,
  fecha_cruce TIMESTAMPTZ,
  num_caja VARCHAR(15),
  sellos VARCHAR(360),
  cve_transfer VARCHAR(15),
  cve_aduana CHAR(3),
  num_patente VARCHAR(4),
  tenant_id UUID DEFAULT '52762e3c-bd8a-49b8-9a32-296e526b7238',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── globalpc_proveedores ──
CREATE TABLE IF NOT EXISTS globalpc_proveedores (
  id BIGSERIAL PRIMARY KEY,
  cve_proveedor VARCHAR(15),
  cve_cliente VARCHAR(15),
  nombre VARCHAR(120),
  alias VARCHAR(120),
  id_fiscal VARCHAR(50),
  pais CHAR(3),
  ciudad VARCHAR(80),
  calle VARCHAR(80),
  contacto VARCHAR(120),
  email_contacto VARCHAR(120),
  telefono VARCHAR(120),
  tenant_id UUID DEFAULT '52762e3c-bd8a-49b8-9a32-296e526b7238',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(cve_proveedor, cve_cliente)
);
CREATE INDEX IF NOT EXISTS idx_gpc_proveedores_cliente ON globalpc_proveedores(cve_cliente);

-- ── globalpc_productos ──
CREATE TABLE IF NOT EXISTS globalpc_productos (
  id BIGSERIAL PRIMARY KEY,
  cve_producto VARCHAR(50),
  cve_cliente VARCHAR(15),
  cve_proveedor VARCHAR(15),
  descripcion TEXT,
  fraccion VARCHAR(15),
  nico VARCHAR(5),
  umt VARCHAR(5),
  pais_origen CHAR(3),
  tenant_id UUID DEFAULT '52762e3c-bd8a-49b8-9a32-296e526b7238',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(cve_producto, cve_cliente, cve_proveedor)
);
CREATE INDEX IF NOT EXISTS idx_gpc_productos_cliente ON globalpc_productos(cve_cliente);

-- ── globalpc_bultos ──
CREATE TABLE IF NOT EXISTS globalpc_bultos (
  id BIGSERIAL PRIMARY KEY,
  consecutivo BIGINT UNIQUE,
  cve_entrada VARCHAR(15),
  cve_bulto INT,
  cantidad INT,
  descripcion TEXT,
  tenant_id UUID DEFAULT '52762e3c-bd8a-49b8-9a32-296e526b7238',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_gpc_bultos_entrada ON globalpc_bultos(cve_entrada);

-- ── econta_facturas ──
CREATE TABLE IF NOT EXISTS econta_facturas (
  id BIGSERIAL PRIMARY KEY,
  consecutivo BIGINT UNIQUE,
  cve_oficina INT,
  cve_cliente VARCHAR(15),
  serie VARCHAR(10),
  folio INT,
  tipo_factura VARCHAR(10),
  fecha TIMESTAMPTZ,
  subtotal DOUBLE PRECISION,
  iva DOUBLE PRECISION,
  total DOUBLE PRECISION,
  moneda VARCHAR(5),
  tipo_cambio DOUBLE PRECISION,
  observaciones TEXT,
  tenant_id UUID DEFAULT '52762e3c-bd8a-49b8-9a32-296e526b7238',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── econta_facturas_detalle ──
CREATE TABLE IF NOT EXISTS econta_facturas_detalle (
  id BIGSERIAL PRIMARY KEY,
  consecutivo BIGINT,
  consecutivo_factura BIGINT,
  descripcion TEXT,
  importe DOUBLE PRECISION,
  iva DOUBLE PRECISION,
  referencia VARCHAR(50),
  tenant_id UUID DEFAULT '52762e3c-bd8a-49b8-9a32-296e526b7238',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── econta_cartera ──
CREATE TABLE IF NOT EXISTS econta_cartera (
  id BIGSERIAL PRIMARY KEY,
  consecutivo BIGINT UNIQUE,
  cve_cliente VARCHAR(15),
  tipo VARCHAR(10),
  referencia VARCHAR(50),
  fecha TIMESTAMPTZ,
  fecha_vencimiento TIMESTAMPTZ,
  importe DOUBLE PRECISION,
  saldo DOUBLE PRECISION,
  moneda VARCHAR(5),
  tipo_cambio DOUBLE PRECISION,
  observaciones TEXT,
  tenant_id UUID DEFAULT '52762e3c-bd8a-49b8-9a32-296e526b7238',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── econta_aplicaciones ──
CREATE TABLE IF NOT EXISTS econta_aplicaciones (
  id BIGSERIAL PRIMARY KEY,
  consecutivo BIGINT UNIQUE,
  consecutivo_cargo BIGINT,
  consecutivo_abono BIGINT,
  importe DOUBLE PRECISION,
  fecha TIMESTAMPTZ,
  tenant_id UUID DEFAULT '52762e3c-bd8a-49b8-9a32-296e526b7238',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── econta_ingresos ──
CREATE TABLE IF NOT EXISTS econta_ingresos (
  id BIGSERIAL PRIMARY KEY,
  consecutivo BIGINT UNIQUE,
  cuenta_contable VARCHAR(50),
  tipo_ingreso VARCHAR(10),
  forma_ingreso VARCHAR(30),
  cve_cliente VARCHAR(15),
  oficina INT,
  referencia VARCHAR(50),
  fecha TIMESTAMPTZ,
  importe DOUBLE PRECISION,
  tipo_cambio DOUBLE PRECISION,
  moneda VARCHAR(5),
  concepto TEXT,
  tenant_id UUID DEFAULT '52762e3c-bd8a-49b8-9a32-296e526b7238',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── econta_egresos ──
CREATE TABLE IF NOT EXISTS econta_egresos (
  id BIGSERIAL PRIMARY KEY,
  consecutivo BIGINT UNIQUE,
  cuenta_contable VARCHAR(50),
  forma_egreso VARCHAR(30),
  tipo_egreso VARCHAR(10),
  cve_cliente VARCHAR(15),
  cve_proveedor VARCHAR(15),
  beneficiario TEXT,
  referencia VARCHAR(50),
  fecha TIMESTAMPTZ,
  importe DOUBLE PRECISION,
  moneda VARCHAR(5),
  tipo_cambio DOUBLE PRECISION,
  concepto TEXT,
  tenant_id UUID DEFAULT '52762e3c-bd8a-49b8-9a32-296e526b7238',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── econta_anticipos ──
CREATE TABLE IF NOT EXISTS econta_anticipos (
  id BIGSERIAL PRIMARY KEY,
  consecutivo BIGINT UNIQUE,
  cuenta_contable VARCHAR(50),
  cve_cliente VARCHAR(15),
  oficina INT,
  referencia VARCHAR(50),
  fecha TIMESTAMPTZ,
  importe DOUBLE PRECISION,
  moneda VARCHAR(5),
  tipo_cambio DOUBLE PRECISION,
  concepto TEXT,
  tenant_id UUID DEFAULT '52762e3c-bd8a-49b8-9a32-296e526b7238',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── econta_polizas ──
CREATE TABLE IF NOT EXISTS econta_polizas (
  id BIGSERIAL PRIMARY KEY,
  consecutivo BIGINT UNIQUE,
  cve_oficina INT,
  fecha TIMESTAMPTZ,
  numero_poliza VARCHAR(20),
  tipo_poliza CHAR(1),
  num_documento VARCHAR(50),
  observaciones TEXT,
  importe DOUBLE PRECISION,
  tenant_id UUID DEFAULT '52762e3c-bd8a-49b8-9a32-296e526b7238',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── RLS for all new tables ──
DO $$
DECLARE
  t TEXT;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'globalpc_facturas','globalpc_partidas','globalpc_eventos','globalpc_contenedores',
    'globalpc_ordenes_carga','globalpc_proveedores','globalpc_productos','globalpc_bultos',
    'econta_facturas','econta_facturas_detalle','econta_cartera','econta_aplicaciones',
    'econta_ingresos','econta_egresos','econta_anticipos','econta_polizas'
  ]) LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS "service_role_%s" ON %I', t, t);
    EXECUTE format('CREATE POLICY "service_role_%s" ON %I FOR ALL USING (auth.role() = ''service_role'')', t, t);
    EXECUTE format('DROP POLICY IF EXISTS "anon_read_%s" ON %I', t, t);
    EXECUTE format('CREATE POLICY "anon_read_%s" ON %I FOR SELECT USING (true)', t, t);
  END LOOP;
END $$;

SELECT 'All 16 tables created with RLS' AS status;
