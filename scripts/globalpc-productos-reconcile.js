#!/usr/bin/env node
/**
 * scripts/globalpc-productos-reconcile.js
 *
 * Reconciles globalpc_productos mirror against GlobalPC MySQL source.
 * Marks rows present in mirror but absent from source as
 * `deleted_at = NOW()` (soft-delete only — historical pedimentos still
 * resolve via this table even after soft-delete).
 *
 * Born from FIX 4 of audit-sync-pipeline-2026-04-29: the mirror has
 * 22,360 stale rows for EVCO 9254 alone because globalpc-sync.js
 * never propagates source DELETEs.
 *
 * Usage:
 *   node scripts/globalpc-productos-reconcile.js                 # dry-run, all active clients
 *   node scripts/globalpc-productos-reconcile.js --apply         # actually write deleted_at
 *   node scripts/globalpc-productos-reconcile.js --clave=9254    # one client only
 *   node scripts/globalpc-productos-reconcile.js --apply --clave=9254
 *
 * Pre-condition: the `deleted_at` column must exist on globalpc_productos.
 * Apply migration `supabase/migrations/20260429_globalpc_productos_deleted_at.sql`
 * before running with --apply.
 *
 * Idempotent: re-runs are safe. Already-soft-deleted rows are skipped
 * (we only mark rows where deleted_at IS NULL).
 *
 * Tenant safety: matches the writer pattern from globalpc-sync.js —
 * iterates active companies from the `companies` table; does NOT
 * touch claves outside that allowlist (those drifts are accepted as
 * residue from prior bulk imports for inactive tenants).
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env.local') })
const mysql = require('mysql2/promise')
const { createClient } = require('@supabase/supabase-js')
const { withSyncLog } = require('./lib/sync-log')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
)

const APPLY = process.argv.includes('--apply')
const SINGLE_CLAVE = (process.argv.find(a => a.startsWith('--clave=')) || '').split('=')[1]

async function buildSourceKeySet(conn, clave) {
  // Source rows for this clave. Key = `${cve_producto}::${cve_proveedor}`
  // because the unique constraint is (cve_producto, cve_cliente, cve_proveedor)
  // and we're already scoped by clave.
  const keys = new Set()
  const PAGE = 5000
  let offset = 0
  while (true) {
    const [rows] = await conn.execute(
      `SELECT sCveClienteProveedorProducto AS cve_producto, sCveProveedor AS cve_proveedor
         FROM cu_cliente_proveedor_producto
        WHERE sCveCliente = ?
        ORDER BY sCveClienteProveedorProducto ASC
        LIMIT ${PAGE} OFFSET ${offset}`,
      [clave],
    )
    if (!rows.length) break
    for (const r of rows) {
      keys.add(`${r.cve_producto || ''}::${r.cve_proveedor || ''}`)
    }
    if (rows.length < PAGE) break
    offset += PAGE
  }
  return keys
}

// Probe whether the deleted_at column exists. Result memoized for the
// process lifetime so we don't double-charge the schema cache. We
// request the column with a bounded HEAD count — this short-circuits
// at parse-time on missing column without scanning rows.
let _hasDeletedAt = null
async function hasDeletedAtColumn() {
  if (_hasDeletedAt !== null) return _hasDeletedAt
  const { error } = await supabase
    .from('globalpc_productos')
    .select('deleted_at', { head: true, count: 'planned' })
    .limit(0)
  if (error && (
    /Could not find the .deleted_at. column/i.test(error.message) ||
    /column .* deleted_at .* does not exist/i.test(error.message)
  )) {
    _hasDeletedAt = false
  } else {
    _hasDeletedAt = !error
  }
  return _hasDeletedAt
}

async function reconcileClient(conn, { clave, companyId }) {
  const t0 = Date.now()
  console.log(`\n── ${companyId} (clave ${clave}) ──`)
  const colExists = await hasDeletedAtColumn()
  if (!colExists) {
    console.log('   (deleted_at column missing — read-only audit mode)')
  }

  // 1. Source key set
  const sourceKeys = await buildSourceKeySet(conn, clave)
  console.log(`   source keys: ${sourceKeys.size.toLocaleString()}`)

  // 2. Stream mirror rows for this clave via keyset pagination on id.
  //    Range-based pagination times out on the 700K-row table; gt(id)
  //    + order(id) lets the index do the heavy lifting.
  const PAGE = 1000
  let lastId = 0
  const staleIds = []
  let scanned = 0
  while (true) {
    let q = supabase
      .from('globalpc_productos')
      .select('id, cve_producto, cve_proveedor')
      .eq('cve_cliente', clave)
      .gt('id', lastId)
      .order('id', { ascending: true })
      .limit(PAGE)
    if (colExists) q = q.is('deleted_at', null) // skip already-soft-deleted
    const { data, error } = await q
    if (error) throw new Error(`mirror read failed: ${error.message}`)
    if (!data || !data.length) break
    for (const row of data) {
      const key = `${row.cve_producto || ''}::${row.cve_proveedor || ''}`
      if (!sourceKeys.has(key)) staleIds.push(row.id)
    }
    scanned += data.length
    lastId = data[data.length - 1].id
    if (data.length < PAGE) break
  }
  console.log(`   mirror scanned: ${scanned.toLocaleString()} active rows`)
  console.log(`   stale (mirror-only): ${staleIds.length.toLocaleString()}`)

  // 3. Mark stale rows
  if (APPLY && !colExists) {
    throw new Error(
      'Migration not applied — globalpc_productos.deleted_at column is missing. ' +
      'Apply supabase/migrations/20260429_globalpc_productos_deleted_at.sql first.'
    )
  }
  if (APPLY && staleIds.length) {
    let marked = 0
    for (let i = 0; i < staleIds.length; i += 500) {
      const slice = staleIds.slice(i, i + 500)
      const { error } = await supabase
        .from('globalpc_productos')
        .update({ deleted_at: new Date().toISOString() })
        .in('id', slice)
      if (error) {
        if (/column .* deleted_at .* does not exist/i.test(error.message) ||
            /Could not find the .deleted_at. column/i.test(error.message)) {
          throw new Error(
            'Migration not applied — globalpc_productos.deleted_at column is missing. ' +
            'Apply supabase/migrations/20260429_globalpc_productos_deleted_at.sql first.'
          )
        }
        throw new Error(`update failed at slice ${i}: ${error.message}`)
      }
      marked += slice.length
    }
    console.log(`   ✓ marked ${marked.toLocaleString()} stale (deleted_at = now())`)
  } else if (staleIds.length) {
    console.log(`   (dry-run — re-run with --apply to mark)`)
  }

  console.log(`   elapsed: ${Math.round((Date.now() - t0) / 1000)}s`)
  return { clave, companyId, sourceKeys: sourceKeys.size, scanned, stale: staleIds.length }
}

async function run() {
  console.log('\n🧹 GLOBALPC PRODUCTOS RECONCILIATION')
  console.log('═'.repeat(50))
  console.log(`mode: ${APPLY ? 'APPLY' : 'DRY-RUN'}`)
  if (SINGLE_CLAVE) console.log(`scope: clave=${SINGLE_CLAVE}`)
  else console.log('scope: all active companies')

  const { data: companies, error: cErr } = await supabase
    .from('companies')
    .select('company_id, clave_cliente, name')
    .eq('active', true)
    .not('clave_cliente', 'is', null)
  if (cErr) throw new Error(`load companies: ${cErr.message}`)
  let targets = companies
  if (SINGLE_CLAVE) targets = targets.filter(c => c.clave_cliente === SINGLE_CLAVE)
  if (!targets.length) {
    console.log('No active companies match scope — nothing to do.')
    return { rows_synced: 0 }
  }
  console.log(`targets: ${targets.length} client(s)`)

  const conn = await mysql.createConnection({
    host: process.env.GLOBALPC_DB_HOST,
    port: parseInt(process.env.GLOBALPC_DB_PORT, 10),
    user: process.env.GLOBALPC_DB_USER,
    password: process.env.GLOBALPC_DB_PASS,
    database: process.env.GLOBALPC_DB_NAME,
    connectTimeout: 15000,
  })

  const summary = []
  let totalStale = 0
  for (const c of targets) {
    try {
      const r = await reconcileClient(conn, { clave: c.clave_cliente, companyId: c.company_id })
      summary.push(r)
      totalStale += r.stale
    } catch (e) {
      console.error(`   ❌ ${c.company_id}: ${e.message}`)
      summary.push({ clave: c.clave_cliente, companyId: c.company_id, error: e.message })
    }
  }
  await conn.end()

  console.log('\n══ SUMMARY ══')
  for (const s of summary) {
    if (s.error) console.log(`  ${s.companyId}: ERROR ${s.error.slice(0, 80)}`)
    else console.log(`  ${s.companyId} (${s.clave}): scanned=${s.scanned} stale=${s.stale}`)
  }
  console.log(`\nTotal stale identified: ${totalStale.toLocaleString()}`)
  if (!APPLY) console.log('Re-run with --apply to soft-delete (set deleted_at = now())')

  return { rows_synced: APPLY ? totalStale : 0 }
}

if (require.main === module) {
  withSyncLog(supabase, { sync_type: 'globalpc_productos_reconcile', company_id: null }, run)
    .catch(e => { console.error(e); process.exit(1) })
}

module.exports = { reconcileClient, buildSourceKeySet }
