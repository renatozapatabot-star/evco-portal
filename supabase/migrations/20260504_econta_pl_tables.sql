-- econta P&L sync targets — factura_aa, cl_cartera, ba_ingresos, ba_egresos
-- Sourced from bd_econta_rz (MySQL). Column names are lowercased from Hungarian originals.
-- Internal accounting only — no client-side exposure.

-- ============================================================
-- econta_facturas (from factura_aa) — honorarios + pedimento totals
-- ============================================================
CREATE TABLE IF NOT EXISTS public.econta_facturas (
  iconsecutivo              bigint       NOT NULL,
  sreferencia               text         NOT NULL,
  scveclientepropia         text,
  scveclienteeconta         text,
  snombrecliente            text,
  srfccliente               text,
  spedimento                text,
  spatente                  text,
  scveaduana                text,
  icveoficina               integer,
  dfechahora                timestamptz,
  dfechaingreso             timestamptz,
  btipooperacion            text,
  rtotal                    numeric,
  rtotalcfd                 numeric,
  rhonorarios               numeric,
  rretenciones              numeric,
  rretencionesiva           numeric,
  riva                      numeric,
  rvaloraduanapedimento     numeric,
  rigipedimento             numeric,
  rivapedimento             numeric,
  rdtapedimento             numeric,
  rprevalidacionpedimento   numeric,
  rbasehonorarios           numeric,
  rtipocambio               numeric,
  scvetipomoneda            text,
  bfacturapagada            text,
  beliminado                smallint,
  bestatus                  smallint,
  synced_at                 timestamptz  DEFAULT now(),
  PRIMARY KEY (iconsecutivo, sreferencia)
);
CREATE INDEX IF NOT EXISTS idx_econta_facturas_fecha ON public.econta_facturas (dfechahora DESC);
CREATE INDEX IF NOT EXISTS idx_econta_facturas_cliente ON public.econta_facturas (scveclientepropia);
CREATE INDEX IF NOT EXISTS idx_econta_facturas_pedimento ON public.econta_facturas (spedimento);
ALTER TABLE public.econta_facturas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS econta_facturas_auth_read ON public.econta_facturas;
CREATE POLICY econta_facturas_auth_read ON public.econta_facturas FOR SELECT TO authenticated USING (true);

-- ============================================================
-- econta_cartera (from cl_cartera) — CxC per client
-- ============================================================
CREATE TABLE IF NOT EXISTS public.econta_cartera (
  iconsecutivo              bigint       PRIMARY KEY,
  scvecliente               text,
  scvecorresponsal          text,
  icveoficina               integer,
  dfecha                    timestamptz,
  etipocargoabono           text,
  sclavecargoabono          text,
  sreferencia               text,
  rcargo                    numeric,
  rabono                    numeric,
  stipomoneda               text,
  stipocambio               numeric,
  sserie                    text,
  sfolio                    text,
  spedimento                text,
  spatente                  text,
  iconsecutivofacturas      bigint,
  iconsecutivoingresos      bigint,
  iconsecutivopolizas       bigint,
  iconsecutivoegresos       bigint,
  synced_at                 timestamptz  DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_econta_cartera_cliente ON public.econta_cartera (scvecliente);
CREATE INDEX IF NOT EXISTS idx_econta_cartera_fecha ON public.econta_cartera (dfecha DESC);
CREATE INDEX IF NOT EXISTS idx_econta_cartera_tipo ON public.econta_cartera (etipocargoabono);
CREATE INDEX IF NOT EXISTS idx_econta_cartera_factura ON public.econta_cartera (iconsecutivofacturas);
ALTER TABLE public.econta_cartera ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS econta_cartera_auth_read ON public.econta_cartera;
CREATE POLICY econta_cartera_auth_read ON public.econta_cartera FOR SELECT TO authenticated USING (true);

-- ============================================================
-- econta_ingresos (from ba_ingresos) — pagos recibidos
-- ============================================================
CREATE TABLE IF NOT EXISTS public.econta_ingresos (
  iconsecutivo              bigint       PRIMARY KEY,
  scvecliente               text,
  icveoficina               integer,
  sreferencia               text,
  dfecha                    date,
  rimporte                  numeric,
  rimporteanticipo          numeric,
  rimportepagofactura       numeric,
  itipocambio               numeric,
  scvemoneda                text,
  eformaingreso             text,
  stipoingreso              text,
  scveformapago             text,
  snumoperacion             text,
  sconcepto                 text,
  beliminado                smallint,
  dfechaingreso             timestamptz,
  synced_at                 timestamptz  DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_econta_ingresos_cliente ON public.econta_ingresos (scvecliente);
CREATE INDEX IF NOT EXISTS idx_econta_ingresos_fecha ON public.econta_ingresos (dfecha DESC);
CREATE INDEX IF NOT EXISTS idx_econta_ingresos_ref ON public.econta_ingresos (sreferencia);
ALTER TABLE public.econta_ingresos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS econta_ingresos_auth_read ON public.econta_ingresos;
CREATE POLICY econta_ingresos_auth_read ON public.econta_ingresos FOR SELECT TO authenticated USING (true);

-- ============================================================
-- econta_egresos (from ba_egresos) — pagos out
-- ============================================================
CREATE TABLE IF NOT EXISTS public.econta_egresos (
  iconsecutivo              bigint       PRIMARY KEY,
  scvecliente               text,
  scveproveedor             text,
  sbeneficiario             text,
  iconsecutivooficina       integer,
  eformaegreso              text,
  stipoegreso               text,
  sreferencia               text,
  dfecha                    date,
  rimporte                  numeric,
  itipocambio               numeric,
  scvemoneda                text,
  sconcepto                 text,
  beliminado                smallint,
  dfechaingreso             timestamptz,
  synced_at                 timestamptz  DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_econta_egresos_cliente ON public.econta_egresos (scvecliente);
CREATE INDEX IF NOT EXISTS idx_econta_egresos_proveedor ON public.econta_egresos (scveproveedor);
CREATE INDEX IF NOT EXISTS idx_econta_egresos_fecha ON public.econta_egresos (dfecha DESC);
ALTER TABLE public.econta_egresos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS econta_egresos_auth_read ON public.econta_egresos;
CREATE POLICY econta_egresos_auth_read ON public.econta_egresos FOR SELECT TO authenticated USING (true);
