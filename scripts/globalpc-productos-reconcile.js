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
 *   node scripts/globalpc-productos-reconcile.js --apply --only 9254,5020   # subset
 *   node scripts/globalpc-productos-reconcile.js --apply --page-size 2000   # smaller pages
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

// --only <clave1,clave2,...>  OR  --only=<clave1,clave2,...>
function parseOnly() {
  const flagIdx = process.argv.findIndex(a => a === '--only' || a.startsWith('--only='))
  if (flagIdx === -1) return null
  const arg = process.argv[flagIdx]
  const raw = arg.includes('=') ? arg.split('=')[1] : process.argv[flagIdx + 1]
  if (!raw) return null
  return raw.split(',').map(s => s.trim()).filter(Boolean)
}
const ONLY_CLAVES = parseOnly()

// --page-size <N>  OR  --page-size=<N>
function parsePageSize() {
  const flagIdx = process.argv.findIndex(a => a === '--page-size' || a.startsWith('--page-size='))
  if (flagIdx === -1) return null
  const arg = process.argv[flagIdx]
  const raw = arg.includes('=') ? arg.split('=')[1] : process.argv[flagIdx + 1]
  const n = parseInt(raw, 10)
  if (!Number.isFinite(n) || n < 100 || n > 50000) return null
  return n
}
const MIRROR_PAGE_OVERRIDE = parsePageSize()
const MIRROR_PAGE_DEFAULT = 5000

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

  // 2. Stream mirror rows for this clave via id-range partitioning.
  //
  //    Why not pure keyset (gt(id, lastId)): when the partial index on
  //    `(cve_cliente) WHERE deleted_at IS NULL` is combined with deep
  //    `id > X` keysets, the planner has to skip past many irrelevant
  //    index entries, and at depth (id > 2M) a single page hits the
  //    30s statement_timeout.
  //
  //    Range-based: walk the id space in fixed-width windows
  //    [lastId, lastId+PAGE). Each query is bounded by the window
  //    size, NOT by the position in the table. We don't filter on
  //    deleted_at server-side (the partial index disagrees with the
  //    keyset plan); since the column was just added in
  //    20260429_globalpc_productos_deleted_at.sql and most rows are
  //    NULL, app-side filtering is cheap.
  //
  //    PAGE here is an id-range width, not a row count. With ~700K
  //    rows in id-range ~0..3M, an average window of 5,000 ids
  //    yields a few hundred rows per request — well under the 30s
  //    timeout per query. Override with --page-size N if needed.
  const PAGE = MIRROR_PAGE_OVERRIDE || MIRROR_PAGE_DEFAULT

  // Try to bound the loop with max(id) for this tenant. For most tenants
  // this resolves in <1s; for some (sparse rows over large id space, no
  // matching index plan) it hits statement_timeout. On error we fall
  // back to walk-forward with empty-window early-stop.
  let maxId = null
  {
    const { data, error } = await supabase
      .from('globalpc_productos')
      .select('id')
      .eq('cve_cliente', clave)
      .order('id', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (error) {
      console.log(`   max(id) lookup failed (${error.message.slice(0, 60)}); using walk-forward with early-stop`)
    } else {
      maxId = data ? data.id : 0
    }
  }

  // Empty-window early-stop bound. If we see this many consecutive
  // empty windows we assume we're past the tenant's last row.
  const EMPTY_STOP = 30

  const staleIds = []
  let scanned = 0
  let pageNum = 0
  let lastId = 0
  let consecutiveEmpty = 0
  let observedMaxId = 0
  // eslint-disable-next-line no-constant-condition
  while (true) {
    if (maxId !== null && lastId > maxId) break
    const pageStart = Date.now()
    const upper = lastId + PAGE
    const { data, error } = await supabase
      .from('globalpc_productos')
      .select('id, cve_producto, cve_proveedor, deleted_at')
      .eq('cve_cliente', clave)
      .gte('id', lastId)
      .lt('id', upper)
      .order('id', { ascending: true })
    if (error) throw new Error(`mirror read failed (page ${pageNum} range ${lastId}..${upper}): ${error.message}`)
    if (data && data.length) {
      consecutiveEmpty = 0
      for (const row of data) {
        if (row.id > observedMaxId) observedMaxId = row.id
        if (colExists && row.deleted_at) continue // already soft-deleted
        const key = `${row.cve_producto || ''}::${row.cve_proveedor || ''}`
        if (!sourceKeys.has(key)) staleIds.push(row.id)
        scanned++
      }
    } else {
      consecutiveEmpty++
      if (maxId === null && consecutiveEmpty >= EMPTY_STOP) break
    }
    const pageMs = Date.now() - pageStart
    if (pageMs > 20000) {
      console.log(`   ⚠ range ${lastId}..${upper} took ${pageMs}ms — consider --page-size ${Math.max(500, Math.floor(PAGE / 2))}`)
    }
    pageNum++
    lastId = upper
  }
  const boundLabel = maxId !== null
    ? `max id ${maxId.toLocaleString()}`
    : `walk-forward, observed max ${observedMaxId.toLocaleString()}, stopped after ${EMPTY_STOP} empty windows`
  console.log(`   mirror scanned: ${scanned.toLocaleString()} active rows across ${pageNum} id-range(s) of ${PAGE.toLocaleString()} (${boundLabel})`)
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
  else if (ONLY_CLAVES && ONLY_CLAVES.length) console.log(`scope: --only ${ONLY_CLAVES.join(',')}`)
  else console.log('scope: all active companies')
  console.log(`mirror page size: ${(MIRROR_PAGE_OVERRIDE || MIRROR_PAGE_DEFAULT).toLocaleString()}${MIRROR_PAGE_OVERRIDE ? ' (override)' : ''}`)

  const { data: companies, error: cErr } = await supabase
    .from('companies')
    .select('company_id, clave_cliente, name')
    .eq('active', true)
    .not('clave_cliente', 'is', null)
  if (cErr) throw new Error(`load companies: ${cErr.message}`)
  let targets = companies
  if (SINGLE_CLAVE) {
    targets = targets.filter(c => c.clave_cliente === SINGLE_CLAVE)
  } else if (ONLY_CLAVES && ONLY_CLAVES.length) {
    const set = new Set(ONLY_CLAVES)
    targets = targets.filter(c => set.has(c.clave_cliente))
    const missing = ONLY_CLAVES.filter(k => !companies.some(c => c.clave_cliente === k))
    if (missing.length) {
      console.log(`   ⚠ --only included claves not in active companies: ${missing.join(',')}`)
    }
  }
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
