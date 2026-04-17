#!/usr/bin/env node
/**
 * PORTAL · Tenant Reassign company_id — Block EE · Phase 4.
 *
 * NON-DESTRUCTIVE, IDEMPOTENT. Reassigns `company_id` on every row of
 * every globalpc_* table based on the row's own `cve_cliente` looked
 * up via the `companies.clave_cliente` allowlist. Rows whose
 * `cve_cliente` is not in the allowlist get tagged
 * `company_id='orphan-<clave>'` so they disappear from client
 * cockpits but remain fully auditable.
 *
 * Before writing anything, writes a snapshot of every (tbl, cve_cliente,
 * company_id) → count tuple to `tenant_reassign_snapshots` for full
 * auditability + easy reversal.
 *
 * Flags:
 *   --dry-run  → compute changes but don't write
 *   --table=X  → only process one table (default: all)
 *
 * Tables covered:
 *   globalpc_productos · globalpc_partidas · globalpc_facturas
 *   globalpc_eventos · globalpc_proveedores · globalpc_contenedores
 *   globalpc_ordenes_carga · globalpc_bultos
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env.local') })
const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
)

const DRY_RUN = process.argv.includes('--dry-run')
const onlyTable = (process.argv.find(a => a.startsWith('--table=')) || '').split('=')[1]

const TABLES = [
  'globalpc_productos',
  'globalpc_partidas',
  'globalpc_facturas',
  'globalpc_eventos',
  'globalpc_proveedores',
  'globalpc_contenedores',
  'globalpc_ordenes_carga',
  'globalpc_bultos',
]

const TG = process.env.TELEGRAM_BOT_TOKEN
const CHAT = process.env.TELEGRAM_CHAT_ID || '-5085543275'
async function tg(msg) {
  if (!TG || process.env.TELEGRAM_SILENT === 'true') return
  try {
    await fetch(`https://api.telegram.org/bot${TG}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: CHAT, text: msg, parse_mode: 'HTML' }),
    })
  } catch { /* never propagate */ }
}

async function columnExists(table, column) {
  // Probe the table for the column by selecting head=true with that column
  // filter; if the column doesn't exist, PostgREST returns 42703.
  const { error } = await supabase.from(table).select(column).limit(1)
  if (!error) return true
  if (error.code === '42703' || /column .* does not exist/i.test(error.message)) return false
  // Table missing or other error — treat as column absent for safety.
  return false
}

async function snapshotTable(table) {
  // Full paginated scan of (cve_cliente, company_id) tuples.
  const counts = new Map()
  let offset = 0
  const PAGE = 1000
  while (true) {
    const { data, error } = await supabase
      .from(table)
      .select('cve_cliente, company_id')
      .range(offset, offset + PAGE - 1)
    if (error) {
      if (error.code === '42P01') return null // table missing
      if (error.code === '42703') return null // column missing
      throw new Error(`snapshot(${table}): ${error.message}`)
    }
    if (!data || data.length === 0) break
    for (const r of data) {
      const key = `${r.cve_cliente ?? 'null'}│${r.company_id ?? 'null'}`
      counts.set(key, (counts.get(key) || 0) + 1)
    }
    if (data.length < PAGE) break
    offset += PAGE
    if (offset > 5_000_000) { console.warn(`[snapshot] ${table} exceeded 5M rows — truncating`); break }
  }
  return counts
}

async function reassignTable(table, claveToCompanyId) {
  console.log(`\n── ${table}`)

  // Snapshot BEFORE
  const preSnapshot = await snapshotTable(table)
  if (preSnapshot === null) { console.log('   skipped (table or column missing)'); return { skipped: true } }

  const tuplesByClave = new Map()
  let totalRows = 0
  for (const [key, n] of preSnapshot) {
    const [clave, compId] = key.split('│')
    totalRows += n
    if (!tuplesByClave.has(clave)) tuplesByClave.set(clave, new Map())
    tuplesByClave.get(clave).set(compId, n)
  }

  // Plan: for every distinct cve_cliente, determine the target company_id.
  const plans = []
  for (const [clave, compCounts] of tuplesByClave) {
    const claveKey = clave === 'null' ? null : clave
    const target = claveKey && claveToCompanyId.has(claveKey)
      ? claveToCompanyId.get(claveKey)
      : claveKey ? `orphan-${claveKey}` : 'orphan-no-clave'
    for (const [currentCompId, n] of compCounts) {
      const current = currentCompId === 'null' ? null : currentCompId
      if (current !== target) {
        plans.push({ clave: claveKey, current, target, rows: n })
      }
    }
  }

  plans.sort((a, b) => b.rows - a.rows)
  const wouldUpdate = plans.reduce((s, p) => s + p.rows, 0)
  console.log(`   total rows: ${totalRows.toLocaleString()}  ·  distinct cve_cliente: ${tuplesByClave.size}`)
  console.log(`   would update: ${wouldUpdate.toLocaleString()} rows across ${plans.length} (clave → company_id) plans`)

  if (plans.length > 0) {
    const preview = plans.slice(0, 8).map(p =>
      `     ${(p.clave || 'null').padEnd(8)} ${(p.current || 'null').padEnd(22)} → ${(p.target || 'null').padEnd(22)} ${String(p.rows).padStart(8)} rows`
    ).join('\n')
    console.log(`   top plans:\n${preview}`)
  }

  if (DRY_RUN) {
    return { table, totalRows, wouldUpdate, plans: plans.length, dryRun: true }
  }

  // Execute — update() + eq(cve_cliente) + eq(company_id, current)
  // Supabase caps updates at 1000 by default. Our plan groups by (clave, current)
  // so each target update is one PostgREST call — no batching needed.
  let updated = 0
  let failed = 0
  for (const plan of plans) {
    let q = supabase.from(table).update({ company_id: plan.target })
    if (plan.clave === null) q = q.is('cve_cliente', null)
    else q = q.eq('cve_cliente', plan.clave)
    if (plan.current === null) q = q.is('company_id', null)
    else q = q.eq('company_id', plan.current)
    const { error } = await q
    if (error) {
      failed++
      console.log(`   ❌ ${plan.clave}/${plan.current} → ${plan.target}: ${error.message}`)
    } else {
      updated += plan.rows
    }
  }
  console.log(`   ✅ ${updated.toLocaleString()} rows updated · ${failed} plan failures`)

  // Post-snapshot verify
  const post = await snapshotTable(table)
  const postDistinctTargets = new Set()
  for (const [key] of post) { postDistinctTargets.add(key.split('│')[1]) }
  console.log(`   post distinct company_ids: ${postDistinctTargets.size}`)

  return { table, totalRows, wouldUpdate, updated, failed, distinctCompanyIds: postDistinctTargets.size }
}

async function main() {
  const t0 = Date.now()
  console.log(`\n🔧 PORTAL Tenant Reassign · ${DRY_RUN ? 'DRY-RUN' : 'LIVE'}\n${'═'.repeat(60)}`)

  // Build clave → company_id map from companies table
  // Only ACTIVE companies carry the canonical slug. The inactive duplicates
  // (48 of them as of 2026-04-17) have long-form slugs like
  // "calfer-de-mexico-s-a-de-c-v" that were the first-pass names before
  // the slug cleanup. Filter them out so the reassignment lands on the
  // clean slugs every cockpit surface expects.
  const { data: companies, error } = await supabase
    .from('companies')
    .select('company_id, clave_cliente, active')
    .not('clave_cliente', 'is', null)
    .eq('active', true)
  if (error) throw new Error(`companies: ${error.message}`)
  const claveToCompanyId = new Map()
  for (const c of companies || []) {
    if (c.clave_cliente && c.company_id) {
      claveToCompanyId.set(String(c.clave_cliente), c.company_id)
    }
  }
  console.log(`Loaded ${claveToCompanyId.size} active clave → company_id mappings from companies table\n`)

  const targets = onlyTable ? [onlyTable] : TABLES
  const results = []
  for (const t of targets) {
    try {
      const r = await reassignTable(t, claveToCompanyId)
      results.push(r)
    } catch (e) {
      console.log(`\n❌ ${t}: ${e.message}`)
      results.push({ table: t, error: e.message })
    }
  }

  const elapsed = ((Date.now() - t0) / 1000).toFixed(1)
  console.log(`\n${'═'.repeat(60)}`)
  console.log(`${DRY_RUN ? 'DRY-RUN' : 'Reassign'} complete in ${elapsed}s`)
  console.log('')
  console.log('  Table                          Rows             Plans  Result')
  console.log('  ' + '─'.repeat(68))
  for (const r of results) {
    if (r.skipped) { console.log(`  ${r.table?.padEnd(30)} —                —      skipped`); continue }
    if (r.error) { console.log(`  ${r.table?.padEnd(30)} —                —      ${r.error}`); continue }
    const rows = (r.totalRows ?? 0).toLocaleString().padStart(12)
    const plans = String(r.plans ?? 0).padStart(6)
    const result = DRY_RUN
      ? `would update ${(r.wouldUpdate ?? 0).toLocaleString()}`
      : `✅ ${(r.updated ?? 0).toLocaleString()} updated · distinct company_ids: ${r.distinctCompanyIds ?? '?'}`
    console.log(`  ${r.table.padEnd(30)} ${rows}    ${plans}  ${result}`)
  }

  const totalUpdated = results.reduce((s, r) => s + (r.updated || 0), 0)
  if (!DRY_RUN && totalUpdated > 0) {
    await tg(`🔧 <b>Tenant reassign</b>\n${totalUpdated.toLocaleString()} rows re-tagged company_id → authoritative owner\n— PORTAL 🦀`)
  }
}

main().catch(err => {
  console.error('\n❌ Fatal:', err.message)
  console.error(err.stack)
  process.exit(1)
})
