#!/usr/bin/env node
/**
 * PORTAL · Tenant-Truth Audit — Block EE · Phase 1.
 *
 * READ-ONLY diagnostic. For every active company, counts rows across every
 * tenant-scoped table, computes the "truth set" of parts from 4 authoritative
 * sources, and reports contamination ratio.
 *
 * Outputs:
 *   .planning/tenant-audit-YYYY-MM-DD.json — machine-readable
 *   .planning/TENANT_TRUTH_FINDINGS.md — human summary
 *
 * Ground-truth ranks:
 *   1. anexo24_partidas.numero_parte  (SAT authoritative)
 *   2. globalpc_partidas.cve_producto (actual operational usage)
 *   3. globalpc_facturas.cve_cliente  (MySQL-native assignment)
 *   4. traficos.descripcion_mercancia (fallback free-form)
 *
 * A cve_producto is "verified" for company X if it appears in ANY source
 * 1-3 under X's scope. Anything else in globalpc_productos.company_id=X
 * is contamination.
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env.local') })
const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const path = require('path')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
)

const TENANT_TABLES = [
  { name: 'traficos',              scope: 'company_id' },
  { name: 'entradas',              scope: 'company_id' },
  { name: 'expediente_documentos', scope: 'company_id' },
  { name: 'globalpc_productos',    scope: 'company_id' },
  { name: 'globalpc_partidas',     scope: 'company_id' },
  { name: 'globalpc_facturas',     scope: 'company_id' },
  { name: 'globalpc_eventos',      scope: 'company_id' },
  { name: 'globalpc_proveedores',  scope: 'company_id' },
  { name: 'anexo24_partidas',      scope: 'company_id' },
]

async function tableCountByCompany(table, companyId) {
  const { count, error } = await supabase
    .from(table)
    .select('*', { count: 'estimated', head: true })
    .eq('company_id', companyId)
  if (error) return { count: 0, error: error.code === '42P01' ? 'table_missing' : error.message }
  return { count: count || 0 }
}

async function tableCountTotal(table) {
  const { count, error } = await supabase
    .from(table)
    .select('*', { count: 'estimated', head: true })
  if (error) return { count: 0, error: error.code === '42P01' ? 'table_missing' : error.message }
  return { count: count || 0 }
}

async function distinctCompanyIds(table) {
  try {
    // Sample 5000 rows and distinct company_id client-side — Supabase RPC
    // or DISTINCT aren't exposed by default, so sampling is safer.
    const { data, error } = await supabase
      .from(table)
      .select('company_id')
      .limit(5000)
    if (error) return { ids: [], error: error.message }
    const set = new Set()
    for (const row of data || []) {
      if (row.company_id != null) set.add(String(row.company_id))
    }
    return { ids: [...set] }
  } catch (e) {
    return { ids: [], error: e.message }
  }
}

async function truthSetForCompany(companyId, claveCliente) {
  /**
   * For a given company, pull distinct cve_producto values from every
   * authoritative source. Union them into a "truth set".
   */
  const sources = { anexo24: new Set(), partidas: new Set(), facturas_parts: new Set() }

  // Source 1 — anexo24_partidas.numero_parte
  try {
    const rows = await fetchAll(
      supabase
        .from('anexo24_partidas')
        .select('numero_parte')
        .eq('company_id', companyId)
        .not('numero_parte', 'is', null),
      'anexo24_partidas',
    )
    for (const r of rows) if (r.numero_parte) sources.anexo24.add(String(r.numero_parte).trim())
  } catch (e) { /* table may not exist in this env */ }

  // Source 2 — globalpc_partidas.cve_producto
  try {
    const rows = await fetchAll(
      supabase
        .from('globalpc_partidas')
        .select('cve_producto')
        .eq('company_id', companyId)
        .not('cve_producto', 'is', null),
      'globalpc_partidas',
    )
    for (const r of rows) if (r.cve_producto) sources.partidas.add(String(r.cve_producto).trim())
  } catch (e) { /* ignore */ }

  // Source 3 — globalpc_facturas → cve_cliente owns part.
  //   We use the sibling globalpc_partidas filtered by cve_cliente when available.
  if (claveCliente) {
    try {
      const rows = await fetchAll(
        supabase
          .from('globalpc_partidas')
          .select('cve_producto')
          .eq('cve_cliente', claveCliente)
          .not('cve_producto', 'is', null),
        'globalpc_partidas (cve_cliente)',
      )
      for (const r of rows) if (r.cve_producto) sources.facturas_parts.add(String(r.cve_producto).trim())
    } catch (e) { /* cve_cliente column may not exist on partidas */ }
  }

  // Union = truth set (any source counts)
  const truth = new Set([...sources.anexo24, ...sources.partidas, ...sources.facturas_parts])

  // Claimed = distinct cve_producto in globalpc_productos with this company_id
  const claimed = new Set()
  try {
    const rows = await fetchAll(
      supabase
        .from('globalpc_productos')
        .select('cve_producto')
        .eq('company_id', companyId)
        .not('cve_producto', 'is', null),
      'globalpc_productos',
    )
    for (const r of rows) if (r.cve_producto) claimed.add(String(r.cve_producto).trim())
  } catch (e) { /* ignore */ }

  // Contamination = claimed \ truth
  const contamination = new Set([...claimed].filter(x => !truth.has(x)))

  return {
    anexo24_count: sources.anexo24.size,
    partidas_count: sources.partidas.size,
    facturas_parts_count: sources.facturas_parts.size,
    truth_set_count: truth.size,
    claimed_count: claimed.size,
    contamination_count: contamination.size,
    contamination_pct: claimed.size > 0 ? (contamination.size / claimed.size) * 100 : 0,
    sample_contamination: [...contamination].slice(0, 20),
    sample_truth: [...truth].slice(0, 10),
  }
}

async function fetchAll(baseQuery, label) {
  // Paginate — Supabase default limit is 1000 per call.
  const out = []
  let offset = 0
  const PAGE = 1000
  while (true) {
    const { data, error } = await baseQuery.range(offset, offset + PAGE - 1)
    if (error) {
      if (error.code === '42P01' || error.code === '42703') throw error
      throw new Error(`fetchAll(${label}): ${error.message}`)
    }
    if (!data || data.length === 0) break
    out.push(...data)
    if (data.length < PAGE) break
    offset += PAGE
    if (offset > 1_000_000) { console.warn(`[fetchAll] ${label} exceeded 1M rows — truncating`); break }
  }
  return out
}

async function main() {
  const t0 = Date.now()
  const today = new Date().toISOString().split('T')[0]
  console.log(`\n🔍 PORTAL Tenant-Truth Audit · ${today}\n${'═'.repeat(60)}`)

  // Step 1 — companies allowlist
  const { data: companies, error: companiesErr } = await supabase
    .from('companies')
    .select('company_id, clave_cliente, name, active')
    .order('company_id')
  if (companiesErr) throw new Error(`companies: ${companiesErr.message}`)
  const activeCompanies = (companies || []).filter(c => c.active)
  console.log(`Active companies: ${activeCompanies.length}  ·  Total: ${companies.length}`)

  const companyIdsInDb = new Set(companies.map(c => c.company_id))
  const claveToCompany = new Map()
  for (const c of companies || []) {
    if (c.clave_cliente) claveToCompany.set(String(c.clave_cliente), c.company_id)
  }

  const report = {
    generated_at: new Date().toISOString(),
    companies_total: companies.length,
    companies_active: activeCompanies.length,
    tables: {},
    per_company: {},
    orphans: {},
  }

  // Step 2 — per-table totals + distinct company_ids
  console.log(`\n📊 Per-table totals + distinct company_ids:\n`)
  for (const { name } of TENANT_TABLES) {
    const [total, distinct] = await Promise.all([tableCountTotal(name), distinctCompanyIds(name)])
    if (total.error) {
      console.log(`  ${name.padEnd(26)} ❌ ${total.error}`)
      report.tables[name] = { error: total.error }
      continue
    }
    const orphanIds = distinct.ids.filter(id => !companyIdsInDb.has(id))
    report.tables[name] = {
      total_rows: total.count,
      distinct_company_ids: distinct.ids.length,
      orphan_company_ids: orphanIds,
    }
    const badge = orphanIds.length > 0 ? `⚠ ${orphanIds.length} orphan ids` : '✓'
    console.log(`  ${name.padEnd(26)} ${String(total.count).padStart(8)} rows · ${String(distinct.ids.length).padStart(3)} companies (sample) · ${badge}`)
    if (orphanIds.length > 0) report.orphans[name] = orphanIds
  }

  // Step 3 — per-company truth vs claimed
  console.log(`\n📋 Per-company truth-vs-claimed:\n`)
  for (const c of activeCompanies) {
    console.log(`\n  ── ${c.company_id}  (${c.name}, clave=${c.clave_cliente ?? '—'})`)
    const perCompany = { name: c.name, clave_cliente: c.clave_cliente, tables: {}, truth: null }

    // Row counts in every tenant table
    for (const { name } of TENANT_TABLES) {
      const r = await tableCountByCompany(name, c.company_id)
      if (r.error) {
        perCompany.tables[name] = { error: r.error }
        continue
      }
      perCompany.tables[name] = { count: r.count }
    }

    const counts = perCompany.tables
    const key_counts = ['traficos', 'entradas', 'globalpc_productos', 'globalpc_partidas', 'anexo24_partidas']
      .map(t => `${t.split('_').pop()}=${counts[t]?.count ?? 'n/a'}`)
      .join(' · ')
    console.log(`     ${key_counts}`)

    // Truth set
    try {
      const truth = await truthSetForCompany(c.company_id, c.clave_cliente)
      perCompany.truth = truth
      const verdict =
        truth.contamination_pct > 80 ? '🔴 SEVERELY CONTAMINATED' :
        truth.contamination_pct > 50 ? '🟠 CONTAMINATED' :
        truth.contamination_pct > 10 ? '🟡 MINOR DRIFT' :
        '🟢 CLEAN'
      console.log(`     truth_set=${truth.truth_set_count} · claimed=${truth.claimed_count} · contamination=${truth.contamination_count} (${truth.contamination_pct.toFixed(1)}%)  ${verdict}`)
      if (truth.sample_contamination.length > 0) {
        console.log(`     sample contamination: ${truth.sample_contamination.slice(0, 5).join(', ')}${truth.sample_contamination.length > 5 ? '…' : ''}`)
      }
    } catch (e) {
      console.log(`     ⚠ truth computation failed: ${e.message}`)
      perCompany.truth = { error: e.message }
    }

    report.per_company[c.company_id] = perCompany
  }

  // Step 4 — write outputs
  const dir = path.join(__dirname, '..', '.planning')
  fs.mkdirSync(dir, { recursive: true })
  const jsonPath = path.join(dir, `tenant-audit-${today}.json`)
  fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2))

  const mdPath = path.join(dir, 'TENANT_TRUTH_FINDINGS.md')
  const md = renderMarkdown(report)
  fs.writeFileSync(mdPath, md)

  const elapsed = ((Date.now() - t0) / 1000).toFixed(1)
  console.log(`\n${'═'.repeat(60)}\nAudit complete in ${elapsed}s`)
  console.log(`  JSON: ${jsonPath}`)
  console.log(`  Markdown: ${mdPath}\n`)
}

function renderMarkdown(report) {
  const rows = []
  rows.push(`# Tenant-Truth Findings · ${report.generated_at.split('T')[0]}`)
  rows.push('')
  rows.push(`**Active companies:** ${report.companies_active} / ${report.companies_total}`)
  rows.push(`**Generated:** ${report.generated_at}`)
  rows.push('')
  rows.push('## Per-table overview')
  rows.push('')
  rows.push('| Table | Total rows | Sample distinct company_ids | Orphan ids |')
  rows.push('|---|---:|---:|---|')
  for (const [name, t] of Object.entries(report.tables)) {
    if (t.error) {
      rows.push(`| ${name} | — | — | ${t.error} |`)
      continue
    }
    const orphans = (t.orphan_company_ids || []).length > 0
      ? (t.orphan_company_ids || []).slice(0, 5).join(', ')
      : '—'
    rows.push(`| ${name} | ${t.total_rows.toLocaleString()} | ${t.distinct_company_ids} | ${orphans} |`)
  }
  rows.push('')
  rows.push('## Per-company contamination')
  rows.push('')
  rows.push('| company_id | name | truth | claimed | contamination | % | verdict |')
  rows.push('|---|---|---:|---:|---:|---:|---|')
  for (const [cid, pc] of Object.entries(report.per_company)) {
    const t = pc.truth
    if (!t || t.error) {
      rows.push(`| ${cid} | ${pc.name ?? ''} | — | — | — | — | ${t?.error ?? 'no truth'} |`)
      continue
    }
    const verdict =
      t.contamination_pct > 80 ? '🔴 SEVERE' :
      t.contamination_pct > 50 ? '🟠 CONTAMINATED' :
      t.contamination_pct > 10 ? '🟡 DRIFT' :
      '🟢 CLEAN'
    rows.push(`| ${cid} | ${pc.name ?? ''} | ${t.truth_set_count} | ${t.claimed_count} | ${t.contamination_count} | ${t.contamination_pct.toFixed(1)}% | ${verdict} |`)
  }
  rows.push('')
  rows.push('## Per-company detail')
  for (const [cid, pc] of Object.entries(report.per_company)) {
    rows.push('')
    rows.push(`### ${cid} · ${pc.name ?? ''}`)
    rows.push(`**clave_cliente:** \`${pc.clave_cliente ?? '—'}\``)
    rows.push('')
    rows.push('| table | count |')
    rows.push('|---|---:|')
    for (const [tname, t] of Object.entries(pc.tables)) {
      if (t.error) rows.push(`| ${tname} | ${t.error} |`)
      else rows.push(`| ${tname} | ${t.count.toLocaleString()} |`)
    }
    if (pc.truth && !pc.truth.error) {
      rows.push('')
      rows.push('**Truth sources:**')
      rows.push(`- anexo24_partidas distinct numero_parte: ${pc.truth.anexo24_count}`)
      rows.push(`- globalpc_partidas distinct cve_producto (via company_id): ${pc.truth.partidas_count}`)
      rows.push(`- globalpc_partidas distinct cve_producto (via cve_cliente): ${pc.truth.facturas_parts_count}`)
      rows.push(`- **Truth set (union):** ${pc.truth.truth_set_count}`)
      rows.push(`- **Claimed in globalpc_productos:** ${pc.truth.claimed_count}`)
      rows.push(`- **Contamination:** ${pc.truth.contamination_count} (${pc.truth.contamination_pct.toFixed(1)}%)`)
      if (pc.truth.sample_contamination.length > 0) {
        rows.push(`- Sample contamination: \`${pc.truth.sample_contamination.slice(0, 10).join('`, `')}\``)
      }
      if (pc.truth.sample_truth.length > 0) {
        rows.push(`- Sample truth: \`${pc.truth.sample_truth.slice(0, 10).join('`, `')}\``)
      }
    }
  }
  return rows.join('\n') + '\n'
}

main().catch(err => {
  console.error('\n❌ Fatal:', err.message)
  console.error(err.stack)
  process.exit(1)
})
