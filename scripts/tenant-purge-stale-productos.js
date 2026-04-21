#!/usr/bin/env node
/**
 * PORTAL · Tenant Purge Stale Productos — Block EE · Phase 6.
 *
 * After the retag, each client's globalpc_productos still contains rows
 * that got stamped with that client's company_id historically but never
 * appeared in any partida under their cve_cliente. These are the
 * "Tornillo"-class residual cruft. This script:
 *
 *   1. For each active company, computes the set of `cve_producto` that
 *      appear in their own `globalpc_partidas` (authoritative usage).
 *   2. Identifies globalpc_productos rows with that `company_id` whose
 *      `cve_producto` is NOT in the authoritative set.
 *   3. Exports those rows to CSV before deletion (permanent snapshot).
 *   4. Deletes them in batched DELETEs.
 *
 * Flags:
 *   --dry-run  → compute + snapshot only, no deletion
 *   --company=X → only process one company
 *   --limit=N  → cap deletions per company (default: unlimited)
 *
 * Safety rails:
 *   · CSV snapshot always taken first, even in --dry-run
 *   · Idempotent — re-run is safe (already-deleted rows simply won't match)
 *   · Skips companies where the verified set is empty (no safe signal to purge against)
 *   · Skips productos rows with cve_producto=null
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env.local') })
const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const path = require('path')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
)

const DRY_RUN = process.argv.includes('--dry-run')
const onlyCompany = (process.argv.find(a => a.startsWith('--company=')) || '').split('=')[1]
const limit = parseInt((process.argv.find(a => a.startsWith('--limit=')) || '').split('=')[1], 10) || Infinity

const today = new Date().toISOString().split('T')[0]
const SNAPSHOT_DIR = path.join(__dirname, '.purge-snapshots', today)
fs.mkdirSync(SNAPSHOT_DIR, { recursive: true })

async function fetchAllPaged(base, label) {
  const out = []
  let offset = 0
  const PAGE = 1000
  while (true) {
    const { data, error } = await base.range(offset, offset + PAGE - 1)
    if (error) throw new Error(`${label}: ${error.message}`)
    if (!data || data.length === 0) break
    out.push(...data)
    if (data.length < PAGE) break
    offset += PAGE
    if (offset > 2_000_000) break
  }
  return out
}

async function getVerifiedCves(companyId) {
  // Authoritative = every cve_producto that appears in this company's own
  // globalpc_partidas (post-retag, company_id='<slug>' means TRUE owner).
  const rows = await fetchAllPaged(
    supabase
      .from('globalpc_partidas')
      .select('cve_producto')
      .eq('company_id', companyId)
      .not('cve_producto', 'is', null),
    `verified(${companyId})`,
  )
  const set = new Set()
  for (const r of rows) if (r.cve_producto) set.add(String(r.cve_producto).trim())
  return set
}

async function getCandidateProductos(companyId) {
  // Full productos scan for this company.
  const rows = await fetchAllPaged(
    supabase
      .from('globalpc_productos')
      .select('id, cve_producto, cve_proveedor, descripcion, fraccion, fraccion_source, fraccion_classified_at')
      .eq('company_id', companyId)
      .not('cve_producto', 'is', null),
    `candidates(${companyId})`,
  )
  return rows
}

function writeCsv(filename, rows, headers) {
  const fp = path.join(SNAPSHOT_DIR, filename)
  const out = [headers.join(',')]
  for (const r of rows) {
    out.push(headers.map(h => {
      const v = r[h]
      if (v === null || v === undefined) return ''
      const s = String(v)
      if (/[,"\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`
      return s
    }).join(','))
  }
  fs.writeFileSync(fp, out.join('\n') + '\n')
  return fp
}

async function deleteBatch(ids) {
  // PostgREST DELETE is scoped by .in('id', [...]) — 100 at a time keeps the
  // request URL comfortably under limit.
  let deleted = 0
  const BATCH = 100
  for (let i = 0; i < ids.length; i += BATCH) {
    const slice = ids.slice(i, i + BATCH)
    const { error, count } = await supabase
      .from('globalpc_productos')
      .delete({ count: 'exact' })
      .in('id', slice)
    if (error) {
      console.log(`   ❌ delete batch ${i}: ${error.message}`)
      continue
    }
    deleted += count ?? slice.length
  }
  return deleted
}

async function purgeCompany(companyId, name) {
  console.log(`\n── ${companyId}  (${name})`)

  const [verifiedSet, productos] = await Promise.all([
    getVerifiedCves(companyId),
    getCandidateProductos(companyId),
  ])

  console.log(`   verified cves (from partidas): ${verifiedSet.size}`)
  console.log(`   productos rows:                ${productos.length}`)

  if (verifiedSet.size === 0) {
    console.log(`   ⏭  SKIP — verified set empty (no safe signal to purge against)`)
    return { companyId, skipped: true, reason: 'empty_verified_set' }
  }

  // Classify. A row is safe to purge only if:
  //   1. its cve_producto is NOT in the verified set (authoritative partida usage)
  //   2. AND its fraccion is unset (no human attention — classification would
  //      have flipped fraccion_source and we'd leave that row alone to avoid
  //      discarding classification work)
  //   Rows with a classified fraccion stay, even if the cve isn't in partidas.
  //   That preserves SuperTito-reviewed catalog entries regardless of import
  //   history.
  const kept = []
  const staleKeptForClassification = []
  const stale = []
  for (const p of productos) {
    const cve = String(p.cve_producto).trim()
    if (verifiedSet.has(cve)) { kept.push(p); continue }
    if (p.fraccion && String(p.fraccion).trim().length > 0) {
      staleKeptForClassification.push(p)
      continue
    }
    stale.push(p)
  }

  console.log(`   kept (in partidas): ${kept.length}  ·  kept (classified): ${staleKeptForClassification.length}  ·  stale junk (to purge): ${stale.length}`)

  if (stale.length === 0) {
    console.log(`   ✓ nothing to purge`)
    return { companyId, stale: 0, deleted: 0 }
  }

  // Snapshot stale rows to CSV (always, even on dry-run)
  const csvPath = writeCsv(
    `${companyId}-stale-productos.csv`,
    stale,
    ['id', 'cve_producto', 'cve_proveedor', 'descripcion', 'fraccion', 'fraccion_source', 'fraccion_classified_at'],
  )
  console.log(`   📁 snapshot: ${csvPath}`)

  // Cap to --limit
  const toDelete = stale.slice(0, limit === Infinity ? stale.length : limit)
  if (toDelete.length < stale.length) {
    console.log(`   (capped to --limit=${limit}, leaving ${stale.length - toDelete.length} untouched)`)
  }

  if (DRY_RUN) {
    return { companyId, stale: stale.length, would_delete: toDelete.length, dryRun: true, snapshotPath: csvPath }
  }

  const deleted = await deleteBatch(toDelete.map(p => p.id))
  console.log(`   🗑  deleted: ${deleted.toLocaleString()}`)

  return { companyId, stale: stale.length, deleted, snapshotPath: csvPath }
}

async function main() {
  const t0 = Date.now()
  console.log(`\n🧹 PORTAL Tenant Purge · ${DRY_RUN ? 'DRY-RUN' : 'LIVE'}`)
  console.log(`   snapshot dir: ${SNAPSHOT_DIR}`)
  console.log('═'.repeat(60))

  const { data: companies, error } = await supabase
    .from('companies')
    .select('company_id, name, clave_cliente')
    .eq('active', true)
    .order('company_id')
  if (error) throw new Error(`companies: ${error.message}`)

  const targets = onlyCompany
    ? (companies || []).filter(c => c.company_id === onlyCompany)
    : (companies || [])
  console.log(`Processing ${targets.length} companies\n`)

  const results = []
  for (const c of targets) {
    try {
      const r = await purgeCompany(c.company_id, c.name || '')
      results.push(r)
    } catch (e) {
      console.log(`   ❌ ${c.company_id}: ${e.message}`)
      results.push({ companyId: c.company_id, error: e.message })
    }
  }

  const elapsed = ((Date.now() - t0) / 1000).toFixed(1)
  console.log(`\n${'═'.repeat(60)}`)
  console.log(`${DRY_RUN ? 'Dry-run' : 'Purge'} complete in ${elapsed}s\n`)

  const rows = results.filter(r => !r.error && !r.skipped)
  const totalStale = rows.reduce((s, r) => s + (r.stale || 0), 0)
  const totalDeleted = rows.reduce((s, r) => s + (r.deleted || r.would_delete || 0), 0)
  const skipped = results.filter(r => r.skipped).length

  console.log(`  Companies processed: ${rows.length}`)
  console.log(`  Companies skipped (empty verified): ${skipped}`)
  console.log(`  Total stale rows identified: ${totalStale.toLocaleString()}`)
  console.log(`  Total ${DRY_RUN ? 'would-delete' : 'deleted'}: ${totalDeleted.toLocaleString()}`)
  console.log(`  Snapshots: ${SNAPSHOT_DIR}`)

  // Write summary manifest
  fs.writeFileSync(
    path.join(SNAPSHOT_DIR, '_summary.json'),
    JSON.stringify({ dry_run: DRY_RUN, generated_at: new Date().toISOString(), results }, null, 2),
  )
}

main().catch(err => {
  console.error('\n❌ Fatal:', err.message)
  console.error(err.stack)
  process.exit(1)
})
