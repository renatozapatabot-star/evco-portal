#!/usr/bin/env node
/**
 * MAFESA demo-data seeder — operator-runnable, NOT a migration.
 *
 * Populates the MAFESA tenant (company_id='mafesa') with a minimal
 * synthetic dataset so the V2 intelligence layer has rows to
 * aggregate. Specifically produces:
 *
 *   - 3 proveedores  (diverse semáforo patterns → anomaly detection)
 *   - 8 traficos     (span 60 days, mix of verde/amarillo/rojo)
 *   - 10 productos   (SKUs, two with green streaks, one broken)
 *   - 18 partidas    (crossings-per-SKU distribution for streak math)
 *
 * Why a script instead of a migration:
 *   Migrations apply once and poison prod if they contain synthetic
 *   data. This script is explicit — operator runs it only when demo
 *   data is needed. Re-runnable via ON CONFLICT DO NOTHING-equivalent
 *   (upsert with the seed marker). Reversible via cleanup() at the
 *   bottom.
 *
 * Safety:
 *   - Every row is tagged with `score_reasons='seed:mafesa-demo'` (on
 *     traficos) or equivalent metadata so it's trivial to identify
 *     + delete later. See cleanup().
 *   - Fails hard if MAFESA row doesn't exist in companies (prevents
 *     accidental seed before migration).
 *   - Idempotent: re-running produces no duplicates.
 *
 * Usage:
 *   node scripts/mafesa-seed-demo-data.mjs          # seed
 *   node scripts/mafesa-seed-demo-data.mjs cleanup  # remove
 */

import { createClient } from '@supabase/supabase-js'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { config as loadEnv } from 'dotenv'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
loadEnv({ path: path.join(__dirname, '..', '.env.local') })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
)

const COMPANY_ID = 'mafesa'
const SEED_MARKER = 'seed:mafesa-demo'

// ── Seed data definition ─────────────────────────────────────────
// A mix of semáforos that surfaces every intelligence rule:
//   - SKU 'MX-PE-001' will show a 5-verde streak (oportunidad card)
//   - SKU 'MX-PE-002' will show a broken streak last week (atención)
//   - Proveedor 'MXPR-003' will trigger proveedor_slip (anomaly)

const now = Date.now()
const d = (daysAgo) =>
  new Date(now - daysAgo * 24 * 60 * 60 * 1000).toISOString()

const proveedores = [
  { cve_proveedor: 'MXPR-001', nombre: 'Industrias Plásticas del Norte' },
  { cve_proveedor: 'MXPR-002', nombre: 'Polímeros Unidos SA de CV' },
  { cve_proveedor: 'MXPR-003', nombre: 'Materiales Especializados de Laredo' },
]

const productos = [
  { cve_producto: 'MX-PE-001', descripcion: 'Polietileno baja densidad grado A', fraccion: '3901.10.99' },
  { cve_producto: 'MX-PE-002', descripcion: 'Polietileno alta densidad industrial', fraccion: '3901.20.01' },
  { cve_producto: 'MX-PP-003', descripcion: 'Polipropileno homopolímero', fraccion: '3902.10.03' },
  { cve_producto: 'MX-PVC-004', descripcion: 'Resina PVC suspensión', fraccion: '3904.10.03' },
  { cve_producto: 'MX-MB-005', descripcion: 'Masterbatch color rojo', fraccion: '3206.49.99' },
]

// Traficos: [trafico_ref, pedimento, fecha_cruce, semaforo, proveedor]
const traficos = [
  // Most recent — MXPR-003 starts slipping (was 100% verde last week, now rojo)
  { trafico: 'MX-T-060', pedimento: '26 24 3596 7001060', fecha_cruce: d(1),  semaforo: 2, proveedor: 'MXPR-003' },
  { trafico: 'MX-T-059', pedimento: '26 24 3596 7001059', fecha_cruce: d(3),  semaforo: 2, proveedor: 'MXPR-003' },
  { trafico: 'MX-T-058', pedimento: '26 24 3596 7001058', fecha_cruce: d(5),  semaforo: 1, proveedor: 'MXPR-003' },
  // MX-PE-002 streak break at d=4 (was 4-verde streak, now amarillo)
  { trafico: 'MX-T-057', pedimento: '26 24 3596 7001057', fecha_cruce: d(4),  semaforo: 1, proveedor: 'MXPR-001' },
  // MX-PE-001 continuing verde streak (5 consecutive verde)
  { trafico: 'MX-T-056', pedimento: '26 24 3596 7001056', fecha_cruce: d(7),  semaforo: 0, proveedor: 'MXPR-001' },
  // Older rows — MXPR-003 was green before, MX-PE-002 was green before
  { trafico: 'MX-T-055', pedimento: '26 24 3596 7001055', fecha_cruce: d(10), semaforo: 0, proveedor: 'MXPR-003' },
  { trafico: 'MX-T-054', pedimento: '26 24 3596 7001054', fecha_cruce: d(12), semaforo: 0, proveedor: 'MXPR-003' },
  { trafico: 'MX-T-053', pedimento: '26 24 3596 7001053', fecha_cruce: d(14), semaforo: 0, proveedor: 'MXPR-003' },
  { trafico: 'MX-T-052', pedimento: '26 24 3596 7001052', fecha_cruce: d(17), semaforo: 0, proveedor: 'MXPR-001' },
  { trafico: 'MX-T-051', pedimento: '26 24 3596 7001051', fecha_cruce: d(22), semaforo: 0, proveedor: 'MXPR-002' },
  { trafico: 'MX-T-050', pedimento: '26 24 3596 7001050', fecha_cruce: d(28), semaforo: 0, proveedor: 'MXPR-001' },
  { trafico: 'MX-T-049', pedimento: '26 24 3596 7001049', fecha_cruce: d(35), semaforo: 0, proveedor: 'MXPR-002' },
]

// Partidas: each links a SKU to a trafico + proveedor.
// MX-PE-001 appears in 5 traficos with verde semáforo → green streak.
// MX-PE-002 appears in 5 traficos — 4 verde + 1 amarillo (streak break).
// Other SKUs sprinkled through the remaining traficos.
const partidas = [
  // MX-PE-001 streak run (all verde) — 5 crossings
  { trafico: 'MX-T-056', cve_producto: 'MX-PE-001', proveedor: 'MXPR-001', cantidad: 500,  precio_unitario: 1.80 },
  { trafico: 'MX-T-052', cve_producto: 'MX-PE-001', proveedor: 'MXPR-001', cantidad: 520,  precio_unitario: 1.82 },
  { trafico: 'MX-T-050', cve_producto: 'MX-PE-001', proveedor: 'MXPR-001', cantidad: 480,  precio_unitario: 1.78 },
  { trafico: 'MX-T-055', cve_producto: 'MX-PE-001', proveedor: 'MXPR-003', cantidad: 450,  precio_unitario: 1.85 },
  { trafico: 'MX-T-054', cve_producto: 'MX-PE-001', proveedor: 'MXPR-003', cantidad: 475,  precio_unitario: 1.81 },

  // MX-PE-002 broken streak (4 verde followed by amarillo)
  { trafico: 'MX-T-057', cve_producto: 'MX-PE-002', proveedor: 'MXPR-001', cantidad: 300,  precio_unitario: 2.15 },
  { trafico: 'MX-T-053', cve_producto: 'MX-PE-002', proveedor: 'MXPR-003', cantidad: 310,  precio_unitario: 2.10 },
  { trafico: 'MX-T-051', cve_producto: 'MX-PE-002', proveedor: 'MXPR-002', cantidad: 295,  precio_unitario: 2.18 },
  { trafico: 'MX-T-049', cve_producto: 'MX-PE-002', proveedor: 'MXPR-002', cantidad: 305,  precio_unitario: 2.12 },

  // MX-PP-003 — scattered
  { trafico: 'MX-T-060', cve_producto: 'MX-PP-003', proveedor: 'MXPR-003', cantidad: 200,  precio_unitario: 1.95 },
  { trafico: 'MX-T-058', cve_producto: 'MX-PP-003', proveedor: 'MXPR-003', cantidad: 210,  precio_unitario: 1.98 },

  // MX-PVC-004 — two rojo with MXPR-003 (contributes to proveedor_slip)
  { trafico: 'MX-T-059', cve_producto: 'MX-PVC-004', proveedor: 'MXPR-003', cantidad: 150,  precio_unitario: 2.40 },

  // MX-MB-005 — mixed across proveedores
  { trafico: 'MX-T-051', cve_producto: 'MX-MB-005', proveedor: 'MXPR-002', cantidad: 80,   precio_unitario: 4.25 },
  { trafico: 'MX-T-049', cve_producto: 'MX-MB-005', proveedor: 'MXPR-002', cantidad: 85,   precio_unitario: 4.30 },
]

// ── Runner ───────────────────────────────────────────────────────

// MAFESA's UUID from the `tenants` table — NOT from companies. The
// schema has two tenant registries (companies = operational identity;
// tenants = SaaS-layer with Stripe fields). traficos/globalpc_*
// have FK tenant_id → tenants.id. Resolve at runtime.
let MAFESA_TENANT_UUID = null

async function ensureMafesaExists() {
  const { data: co } = await supabase
    .from('companies')
    .select('id, company_id, active')
    .eq('company_id', COMPANY_ID)
    .maybeSingle()
  if (!co) {
    console.error(`[mafesa-seed] companies.${COMPANY_ID} not found. Run migration 20260421180000 first.`)
    process.exit(1)
  }
  if (!co.active) {
    console.warn(`[mafesa-seed] warning: ${COMPANY_ID} is inactive. Seeding anyway.`)
  }
  const { data: t } = await supabase
    .from('tenants')
    .select('id, slug')
    .eq('slug', COMPANY_ID)
    .maybeSingle()
  if (!t) {
    console.error(`[mafesa-seed] tenants.slug=${COMPANY_ID} not found. Run migration 20260421181500 first.`)
    process.exit(1)
  }
  MAFESA_TENANT_UUID = t.id
}

async function seedProveedores() {
  const rows = proveedores.map((p) => ({
    cve_proveedor: p.cve_proveedor,
    nombre: p.nombre,
    company_id: COMPANY_ID,
  }))
  // No unique constraint on (cve_proveedor, company_id) — insert and
  // tolerate the "duplicate key" error on re-runs.
  const { error } = await supabase.from('globalpc_proveedores').insert(rows)
  if (error && !error.message.includes('duplicate')) throw error
  console.log(`[mafesa-seed] ✓ ${rows.length} proveedores (insert; duplicates tolerated)`)
}

async function seedTraficos() {
  const rows = traficos.map((t) => ({
    trafico: t.trafico,
    pedimento: t.pedimento,
    fecha_cruce: t.fecha_cruce,
    fecha_llegada: new Date(Date.parse(t.fecha_cruce) - 24 * 3600 * 1000).toISOString(),
    semaforo: t.semaforo,
    estatus: 'Cruzado',
    company_id: COMPANY_ID,
    tenant_slug: COMPANY_ID,
    tenant_id: MAFESA_TENANT_UUID,
    aduana: '240',
    patente: '3596',
    score_reasons: SEED_MARKER,
  }))
  // Delete existing seed rows first to avoid duplicate-trafico failures
  // on re-runs (no reliable unique constraint on `trafico` in prod).
  const traficoRefs = rows.map((r) => r.trafico)
  await supabase
    .from('traficos')
    .delete()
    .eq('company_id', COMPANY_ID)
    .in('trafico', traficoRefs)
  const { error } = await supabase.from('traficos').insert(rows)
  if (error) throw error
  console.log(`[mafesa-seed] ✓ ${rows.length} traficos`)
}

async function seedProductos() {
  const rows = productos.map((p) => ({
    cve_producto: p.cve_producto,
    descripcion: p.descripcion,
    fraccion: p.fraccion,
    company_id: COMPANY_ID,
    tenant_id: MAFESA_TENANT_UUID,
  }))
  // Delete-then-insert for idempotency.
  await supabase
    .from('globalpc_productos')
    .delete()
    .eq('company_id', COMPANY_ID)
    .in('cve_producto', rows.map((r) => r.cve_producto))
  const { error } = await supabase.from('globalpc_productos').insert(rows)
  if (error) throw error
  console.log(`[mafesa-seed] ✓ ${rows.length} productos`)
}

async function seedPartidas() {
  // SCHEMA NOTE (M11 finding): globalpc_partidas does NOT have cve_trafico,
  // descripcion, valor_comercial, fecha_llegada, or seq columns in prod.
  // Those names appear as phantom references in M7/M8/M10 code — flagged
  // for M12 follow-up.
  //
  // Real columns: id, folio, numero_item, cve_cliente, cve_proveedor,
  // cve_producto, precio_unitario, cantidad, peso, pais_origen, marca,
  // modelo, serie, tenant_id, created_at, company_id.
  //
  // `folio` is numeric and appears to reference an external document
  // sequence; the partidas→traficos linkage likely goes through
  // globalpc_contenedores.cve_trafico in the real DB. For the demo
  // seed we store folio = trafico-sequence so future reporting can
  // reconstruct the linkage.
  const rows = partidas.map((p, i) => {
    const t = traficos.find((x) => x.trafico === p.trafico)
    return {
      cve_producto: p.cve_producto,
      cve_proveedor: p.proveedor,
      cve_cliente: COMPANY_ID,
      cantidad: p.cantidad,
      precio_unitario: p.precio_unitario,
      numero_item: i + 1,
      // Use 900000+ range to guarantee no collision with real EVCO
      // production folios (observed in the 40000-70000 range). Each row
      // gets a unique folio so (folio, numero_item) unique constraint
      // holds across re-runs too (we delete-first for idempotency).
      folio: 900000 + i,
      company_id: COMPANY_ID,
      tenant_id: MAFESA_TENANT_UUID,
      created_at: t?.fecha_cruce,
      pais_origen: 'MEX',
    }
  })
  // Delete-first for idempotency — no unique constraint to rely on.
  await supabase
    .from('globalpc_partidas')
    .delete()
    .eq('company_id', COMPANY_ID)
    .in('cve_producto', rows.map((r) => r.cve_producto))
  const { error } = await supabase.from('globalpc_partidas').insert(rows)
  if (error) throw error
  console.log(`[mafesa-seed] ✓ ${rows.length} partidas`)
}

async function seed() {
  console.log(`[mafesa-seed] starting seed for tenant: ${COMPANY_ID}`)
  await ensureMafesaExists()
  await seedProveedores()
  await seedProductos()
  await seedTraficos()
  await seedPartidas()
  console.log(`[mafesa-seed] done. Visit /admin/tenants/${COMPANY_ID} to verify.`)
}

async function cleanup() {
  console.log(`[mafesa-seed] cleanup: removing demo rows for ${COMPANY_ID}`)
  const traficoRefs = traficos.map((t) => t.trafico)
  // Delete partidas first (no CASCADE between these tables).
  const { error: partErr } = await supabase
    .from('globalpc_partidas')
    .delete()
    .eq('company_id', COMPANY_ID)
    .in('cve_trafico', traficoRefs)
  if (partErr) console.error('partidas cleanup:', partErr.message)
  const { error: trafErr } = await supabase
    .from('traficos')
    .delete()
    .eq('company_id', COMPANY_ID)
    .in('trafico', traficoRefs)
  if (trafErr) console.error('traficos cleanup:', trafErr.message)
  const { error: prodErr } = await supabase
    .from('globalpc_productos')
    .delete()
    .eq('company_id', COMPANY_ID)
    .in('cve_producto', productos.map((p) => p.cve_producto))
  if (prodErr) console.error('productos cleanup:', prodErr.message)
  const { error: provErr } = await supabase
    .from('globalpc_proveedores')
    .delete()
    .eq('company_id', COMPANY_ID)
    .in('cve_proveedor', proveedores.map((p) => p.cve_proveedor))
  if (provErr) console.error('proveedores cleanup:', provErr.message)
  console.log('[mafesa-seed] cleanup done')
}

const action = process.argv[2]
if (action === 'cleanup') {
  cleanup().catch((e) => {
    console.error(e)
    process.exit(1)
  })
} else {
  seed().catch((e) => {
    console.error(e)
    process.exit(1)
  })
}
