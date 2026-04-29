#!/usr/bin/env node
/**
 * Full e-Conta sync from MySQL port 33035 → Supabase econta_* mirrors.
 *
 * 2026-04-29 rewrite (FIX 1, audit-sync-pipeline-2026-04-29):
 *   The previous "lowercase every MySQL column and upsert" pattern was
 *   structurally broken — every Supabase econta_* mirror except
 *   econta_cl_aplicaciones renames Hungarian-prefix columns to clean
 *   snake_case (`iConsecutivo` → `consecutivo`, `dFechaPoliza` → `fecha`).
 *   The blind-lowercase produced keys like `iconsecutivo` /
 *   `dfechapoliza` which PostgREST 400'd as unknown columns.
 *
 *   With `ignoreDuplicates: true` the dup-on-PK path skipped existing
 *   rows silently, so the failure mode looked like "count parity
 *   GREEN" while no NEW row had been written for an unknown duration.
 *   The polizas error was just the alphabetically-first symptom.
 *
 *   This rewrite uses explicit per-table MAPPERS that turn one MySQL
 *   row into the exact mirror schema. Each table is wrapped in its
 *   own try/catch so a polizas regression does not block cartera /
 *   facturas from running.
 *
 *   Telegram bypass: this script's notifications are critical (data
 *   freshness on /mi-cuenta + Anabel cockpit) so the global
 *   TELEGRAM_SILENT mute does not apply. Per-script bypass is
 *   surgical — other scripts continue to honor the env var.
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env.local') })
const { createClient } = require('@supabase/supabase-js')
const mysql = require('mysql2/promise')

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const { safeUpsert, safeInsert } = require('./lib/safe-write')
const { withSyncLog } = require('./lib/sync-log')

// FALLBACK_TENANT_ID matches the value used by globalpc-sync.js for
// rows that pre-date per-tenant tenant_id stamping. Mirror data has
// always been stamped with this constant.
const FALLBACK_TENANT_ID = '52762e3c-bd8a-49b8-9a32-296e526b7238'

const TG = process.env.TELEGRAM_BOT_TOKEN
const CHAT = '-5085543275'
async function tg(msg) {
  if (!TG) return
  // FIX 1 (2026-04-29): bypass TELEGRAM_SILENT for this script.
  // econta sync failures must reach a human within minutes — silent
  // mode hid 7+ hours of polizas-write failures from the audit window.
  await fetch(`https://api.telegram.org/bot${TG}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: CHAT, text: msg, parse_mode: 'HTML' }),
  }).catch(() => {})
}

// MXP/MXN normalization is shared across the broker's ETL. Inlined
// here to keep the script self-contained; identical to the helper in
// scripts/globalpc-sync.js.
function normalizeMoneda(m) {
  if (m == null) return m
  const upper = String(m).trim().toUpperCase()
  if (upper === '') return null
  if (upper === 'MXP') return 'MXN'
  return upper
}

// ───────────────────────────────────────────────────────────────────
// Per-table MAPPERS · Hungarian → snake_case projections
// ───────────────────────────────────────────────────────────────────
//
// Each entry maps one MySQL row to one Supabase mirror row.
// Mirror columns absent here are left to the column defaults
// (`tenant_id`, `created_at`, `id` auto-generated).

const MAPPERS = {
  // cg_polizas_contables → econta_polizas
  cg_polizas_contables: r => ({
    consecutivo: r.iConsecutivo,
    cve_oficina: r.iCveOficina,
    fecha: r.dFechaPoliza,
    numero_poliza: r.sNumeroPoliza,
    tipo_poliza: r.eTipoPoliza,
    num_documento: r.sNumDocumento,
    observaciones: r.sObservaciones,
    importe: r.rImporte,
    tenant_id: FALLBACK_TENANT_ID,
  }),

  // cl_cartera → econta_cartera
  cl_cartera: r => ({
    consecutivo: r.iConsecutivo,
    cve_cliente: r.sCveCliente,
    tipo: r.eTipoCargoAbono,
    referencia: r.sReferencia,
    fecha: r.dFecha,
    // CARGO/ABONO are stored in separate columns on the source side;
    // mirror collapses to a single signed amount via the type discriminator.
    importe: r.eTipoCargoAbono === 'CARGO' ? r.rCargo : r.rAbono,
    moneda: normalizeMoneda(r.sTipoMoneda),
    tipo_cambio: r.sTipoCambio,
    tenant_id: FALLBACK_TENANT_ID,
  }),

  // ba_anticipos → econta_anticipos
  ba_anticipos: r => ({
    consecutivo: r.iConsecutivo,
    cve_cliente: r.sCveCliente,
    oficina: r.iCveOficina,
    referencia: r.sReferencia,
    fecha: r.dFecha,
    importe: r.rImporte,
    moneda: normalizeMoneda(r.sCveMoneda),
    tipo_cambio: r.iTipoCambio,
    tenant_id: FALLBACK_TENANT_ID,
  }),

  // ba_egresos → econta_egresos
  ba_egresos: r => ({
    consecutivo: r.iConsecutivo,
    cuenta_contable: r.sCuentaContable,
    forma_egreso: r.eFormaEgreso,
    tipo_egreso: r.sTipoEgreso,
    cve_cliente: r.sCveCliente,
    cve_proveedor: r.sCveProveedor,
    beneficiario: r.sBeneficiario,
    referencia: r.sReferencia,
    fecha: r.dFecha,
    importe: r.rImporte,
    moneda: normalizeMoneda(r.sCveMoneda),
    tipo_cambio: r.iTipoCambio,
    concepto: r.sConcepto,
    tenant_id: FALLBACK_TENANT_ID,
  }),

  // ba_ingresos → econta_ingresos
  ba_ingresos: r => ({
    consecutivo: r.iConsecutivo,
    cuenta_contable: r.sCuentaContable,
    tipo_ingreso: r.sTipoIngreso,
    forma_ingreso: r.eFormaIngreso,
    cve_cliente: r.sCveCliente,
    oficina: r.iConsecutivoOficina,
    referencia: r.sReferencia,
    fecha: r.dFecha,
    importe: r.rImporte,
    tipo_cambio: r.iTipoCambio,
    moneda: normalizeMoneda(r.sCveMoneda),
    concepto: r.sConcepto,
    tenant_id: FALLBACK_TENANT_ID,
  }),

  // factura_aa → econta_facturas
  // tenant scope on the broker side uses sCveClienteEconta (per the
  // 2026-04-29 audit). sCveClientePropia is empty on > 80% of rows.
  factura_aa: r => ({
    consecutivo: r.iConsecutivo,
    cve_oficina: r.iCveOficina,
    cve_cliente: r.sCveClienteEconta,
    serie: r.sSerieSAT,
    folio: r.sFolioSAT,
    tipo_factura: r.bTipoOperacion,
    fecha: r.dFechaHora,
    iva: r.rIVA,
    total: r.rTotal,
    moneda: normalizeMoneda(r.sCveTipoMoneda),
    tipo_cambio: r.rTipoCambio,
    observaciones: r.sComentarios ? String(r.sComentarios).slice(0, 1000) : null,
    tenant_id: FALLBACK_TENANT_ID,
  }),
}

// Tables for which the legacy lowercase pattern still works (mirror
// schema preserves Hungarian column names verbatim — 12-of-12 overlap
// confirmed during FIX 1 diagnosis).
const LEGACY_LOWERCASE_TABLES = new Set([
  'econta_cl_aplicaciones',
])

// MySQL → Supabase target mapping. Tables NOT in this list get skipped
// with a warning so the script never silently drops a source.
//
// cl_aplicaciones is intentionally absent: its mirror table
// (econta_cl_aplicaciones) has no UNIQUE constraint on `iconsecutivo`
// or `consecutivo`, so the legacy lowercase upsert has been failing
// since inception with "no unique or exclusion constraint matching
// the ON CONFLICT specification". The 220-row drift observed in the
// 2026-04-29 audit pre-dates this rewrite. Re-enable here once a
// migration adds the unique constraint or the conflict column is
// resolved (probably composite of `iconsecutivocarteracargo` +
// `iconsecutivocarteraabono`).
const TABLE_TARGETS = [
  { mysql: 'cg_polizas_contables', supabase: 'econta_polizas' },
  { mysql: 'cl_cartera',           supabase: 'econta_cartera' },
  { mysql: 'ba_anticipos',         supabase: 'econta_anticipos' },
  { mysql: 'ba_egresos',           supabase: 'econta_egresos' },
  { mysql: 'ba_ingresos',          supabase: 'econta_ingresos' },
  { mysql: 'factura_aa',           supabase: 'econta_facturas' },
]

async function syncTable(conn, mysqlTable, supabaseTable) {
  const [countRes] = await conn.execute(`SELECT COUNT(*) as c FROM \`${mysqlTable}\``)
  const totalRows = countRes[0].c
  console.log(`  ${mysqlTable} → ${supabaseTable}: ${totalRows.toLocaleString()} rows`)

  if (totalRows === 0) return { written: 0, skipped: false }

  const mapper = MAPPERS[mysqlTable]
  const useLegacy = LEGACY_LOWERCASE_TABLES.has(supabaseTable)
  if (!mapper && !useLegacy) {
    console.warn(`    ⚠ no MAPPER for ${mysqlTable} — skipping (add to MAPPERS or LEGACY_LOWERCASE_TABLES)`)
    return { written: 0, skipped: true }
  }

  const onConflict = useLegacy ? 'iconsecutivo' : 'consecutivo'

  const BATCH = 5000
  let offset = 0, total = 0
  while (true) {
    const [rows] = await conn.execute(`SELECT * FROM \`${mysqlTable}\` LIMIT ${BATCH} OFFSET ${offset}`)
    if (!rows.length) break

    let batch
    if (useLegacy) {
      batch = rows.map(r => {
        const mapped = {}
        for (const [k, v] of Object.entries(r)) mapped[k.toLowerCase()] = v
        return mapped
      })
    } else {
      batch = rows.map(mapper)
    }

    for (let i = 0; i < batch.length; i += 500) {
      const slice = batch.slice(i, i + 500)
      await safeUpsert(supabase, supabaseTable, slice, {
        onConflict,
        ignoreDuplicates: true,
        scriptName: 'full-sync-econta',
      })
    }

    total += rows.length
    offset += BATCH
    process.stdout.write(`\r    ${total.toLocaleString()} / ${totalRows.toLocaleString()}`)
  }

  console.log('')
  return { written: total, skipped: false }
}

async function run() {
  console.log('\n💰 FULL E-CONTA SYNC')
  console.log('═'.repeat(40))

  const conn = await mysql.createConnection({
    host: process.env.ECONTA_DB_HOST,
    port: parseInt(process.env.ECONTA_DB_PORT),
    user: process.env.ECONTA_DB_USER,
    password: process.env.ECONTA_DB_PASS,
    database: process.env.ECONTA_DB_NAME,
    connectTimeout: 15000
  })

  console.log('✅ e-Conta connected\n')
  await tg('💰 <b>e-Conta sync iniciado</b>\n— CRUZ 🦀')

  let totalSynced = 0
  const failed = []
  const skipped = []

  for (const { mysql: mt, supabase: st } of TABLE_TARGETS) {
    try {
      const result = await syncTable(conn, mt, st)
      if (result.skipped) skipped.push(mt)
      else totalSynced += result.written
    } catch (e) {
      // Per-table fence: one bad table no longer kills subsequent ones.
      console.error(`    ❌ ${mt}: ${e.message}`)
      failed.push({ table: mt, error: e.message })
      await tg(`🔴 <b>econta ${mt} falló</b>\n${e.message}\n— CRUZ 🦀`)
    }
  }

  await conn.end()

  console.log(`\n✅ e-Conta sync complete: ${totalSynced.toLocaleString()} rows`)
  if (skipped.length) console.log(`   skipped (no mapper): ${skipped.join(', ')}`)
  if (failed.length) console.log(`   failed: ${failed.map(f => `${f.table}=${f.error.slice(0,60)}`).join('; ')}`)

  const summary = `✅ <b>e-Conta sync completo</b>\n${totalSynced.toLocaleString()} registros` +
    (skipped.length ? `\n⏭ skipped: ${skipped.join(', ')}` : '') +
    (failed.length ? `\n🔴 failed: ${failed.map(f => f.table).join(', ')}` : '') +
    `\n— CRUZ 🦀`
  await tg(summary)

  // Telemetry
  try {
    await safeInsert(supabase, 'scrape_runs', {
      source: 'econta_full',
      started_at: new Date().toISOString(),
      completed_at: new Date().toISOString(),
      records_found: totalSynced,
      records_new: totalSynced,
      status: failed.length ? 'partial' : 'success',
    }, { scriptName: 'full-sync-econta' })
  } catch { /* telemetry — safeInsert already alerted */ }

  if (failed.length) throw new Error(`${failed.length} table(s) failed: ${failed.map(f => f.table).join(', ')}`)
  return { rows_synced: totalSynced }
}

// Export internals so the test suite + future tooling can validate
// MAPPERS without spinning up the full sync.
module.exports = { MAPPERS, normalizeMoneda, TABLE_TARGETS, LEGACY_LOWERCASE_TABLES }

if (require.main === module) {
  withSyncLog(supabase, { sync_type: 'econta_full', company_id: null }, run)
    .catch(e => { console.error(e); process.exit(1) })
}
