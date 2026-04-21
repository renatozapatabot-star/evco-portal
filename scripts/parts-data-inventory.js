#!/usr/bin/env node
/**
 * parts-data-inventory.js — schema-aware probe for the 4 tables we'll
 * wire into parte intelligence. Reports:
 *   - row counts (total + EVCO)
 *   - date span
 *   - column list
 *   - NULL-tenant rows (potential leak)
 *   - anon-key readability (RLS posture)
 *
 * Uses the actual column names per Sunday schema context:
 *   globalpc_productos   cve_producto · company_id · created_at
 *   globalpc_partidas    cve_producto · company_id · created_at
 *   classification_log   numero_parte · client_id · ts     (legacy names)
 *   oca_database         fraccion · company_id · last_used · use_count
 *
 * Writes /tmp/parts-data-reality.md
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env.local') })
const fs = require('fs')
const { createClient } = require('@supabase/supabase-js')

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) { console.error('env missing'); process.exit(1) }
const admin = createClient(url, key)
const anon = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)

const EVCO = 'evco'

const SPEC = [
  { table: 'globalpc_productos',  tenant: 'company_id', dateCol: 'created_at' },
  { table: 'globalpc_partidas',   tenant: 'company_id', dateCol: 'created_at' },
  { table: 'classification_log',  tenant: 'client_id',  dateCol: 'ts' },
  { table: 'oca_database',        tenant: 'company_id', dateCol: 'last_used' },
  { table: 'tariff_rates',        tenant: null,         dateCol: null },
]

async function describe(spec) {
  const out = { ...spec, exists: false }

  // Row count + sample
  const total = await admin.from(spec.table).select('*', { count: 'exact', head: true })
  if (total.error) { out.error = total.error.message.slice(0, 140); return out }
  out.exists = true
  out.total_rows = total.count

  const { data: sampleRows } = await admin.from(spec.table).select('*').limit(1)
  if (sampleRows?.[0]) {
    out.columns = Object.keys(sampleRows[0])
    const small = Object.fromEntries(Object.entries(sampleRows[0]).slice(0, 10).map(([k, v]) =>
      [k, typeof v === 'string' ? v.slice(0, 50) : v]))
    out.sample = small
  }

  // EVCO tenant slice
  if (spec.tenant) {
    const { count: evcoCount } = await admin.from(spec.table)
      .select('*', { count: 'exact', head: true }).eq(spec.tenant, EVCO)
    out.evco_rows = evcoCount

    const { count: nullCount } = await admin.from(spec.table)
      .select('*', { count: 'exact', head: true }).is(spec.tenant, null)
    out.null_tenant_rows = nullCount
  }

  // Date span (EVCO only, to keep it relevant)
  if (spec.dateCol && spec.tenant) {
    const [{ data: mn }, { data: mx }] = await Promise.all([
      admin.from(spec.table).select(spec.dateCol).eq(spec.tenant, EVCO).order(spec.dateCol, { ascending: true }).limit(1),
      admin.from(spec.table).select(spec.dateCol).eq(spec.tenant, EVCO).order(spec.dateCol, { ascending: false }).limit(1),
    ])
    out.earliest = mn?.[0]?.[spec.dateCol] ?? null
    out.latest = mx?.[0]?.[spec.dateCol] ?? null

    // 24-month window
    const cutoff = new Date(Date.now() - 730 * 86400_000).toISOString()
    const { count: w24 } = await admin.from(spec.table)
      .select('*', { count: 'exact', head: true })
      .eq(spec.tenant, EVCO)
      .gte(spec.dateCol, cutoff)
    out.evco_last_24mo = w24
  }

  // Anon probe
  try {
    const { count, error } = await anon.from(spec.table).select('*', { count: 'exact', head: true })
    out.anon_readable = !error
    out.anon_rows_visible = error ? null : count
    out.anon_error = error ? error.message.slice(0, 100) : null
  } catch {
    out.anon_readable = false
  }

  return out
}

async function supertitoStats() {
  try {
    const [{ data: agreed }, { data: corr }, { count: total }] = await Promise.all([
      admin.from('classification_log').select('numero_parte', { count: 'exact', head: true }).eq('client_id', EVCO).eq('supertito_agreed', true),
      admin.from('classification_log').select('numero_parte', { count: 'exact', head: true }).eq('client_id', EVCO).not('supertito_correction', 'is', null),
      admin.from('classification_log').select('numero_parte', { count: 'exact', head: true }).eq('client_id', EVCO),
    ])
    // supabase returns count on the .select call directly — reformat
    const agreedCount = (await admin.from('classification_log').select('*', { count: 'exact', head: true }).eq('client_id', EVCO).eq('supertito_agreed', true)).count ?? 0
    const correctionsCount = (await admin.from('classification_log').select('*', { count: 'exact', head: true }).eq('client_id', EVCO).not('supertito_correction', 'is', null)).count ?? 0
    return { agreed: agreedCount, corrections: correctionsCount, total: total ?? 0 }
  } catch (e) {
    return { error: e.message }
  }
}

async function ocaSummary() {
  try {
    const { count } = await admin.from('oca_database').select('*', { count: 'exact', head: true }).eq('company_id', EVCO)
    const { data: uses } = await admin.from('oca_database').select('use_count, last_used').eq('company_id', EVCO)
    const total = count ?? 0
    const avgUse = uses?.length ? (uses.reduce((a, u) => a + (u.use_count || 0), 0) / uses.length).toFixed(1) : 0
    const latest = uses?.length ? uses.reduce((max, u) => (u.last_used && (!max || u.last_used > max) ? u.last_used : max), null) : null
    return { count: total, avg_use_count: Number(avgUse), last_used: latest }
  } catch (e) {
    return { error: e.message }
  }
}

async function partsUsed24mo() {
  // EVCO parts used in partidas last 24mo, distinct count
  try {
    const cutoff = new Date(Date.now() - 730 * 86400_000).toISOString()
    const { data } = await admin.from('globalpc_partidas')
      .select('cve_producto')
      .eq('company_id', EVCO)
      .gte('created_at', cutoff)
      .limit(10000)
    const unique = new Set((data || []).map((r) => r.cve_producto).filter(Boolean))
    return unique.size
  } catch {
    return null
  }
}

;(async () => {
  console.log(`🔎 parts data reality — ${new Date().toISOString()}\n`)

  const results = []
  for (const s of SPEC) {
    process.stdout.write(`  ${s.table}… `)
    const r = await describe(s)
    results.push(r)
    if (!r.exists) {
      console.log(`✗ ${r.error || 'missing'}`)
    } else {
      const anon = r.anon_readable ? '❌ANON' : '🔒'
      const leaks = r.null_tenant_rows ? ` ⚠ ${r.null_tenant_rows}null` : ''
      console.log(`✓ ${r.total_rows}${r.evco_rows !== undefined ? `/${r.evco_rows}evco` : ''}${leaks} ${anon}`)
    }
  }

  const st = await supertitoStats()
  const oca = await ocaSummary()
  const parts24mo = await partsUsed24mo()

  console.log('')
  console.log(`  SuperTito: ${st.error ? 'error' : `${st.agreed} agreed · ${st.corrections} corrections · ${st.total} total`}`)
  console.log(`  EVCO OCA: ${oca.error ? 'error' : `${oca.count} records · avg use ${oca.avg_use_count} · latest ${oca.last_used}`}`)
  console.log(`  EVCO parts used last 24mo: ${parts24mo}`)

  // Write report
  const lines = ['# Parts data reality', '', `**Run:** ${new Date().toISOString()}`, '']
  lines.push('## Table summary')
  lines.push('')
  lines.push('| Table | Total | EVCO | 24mo | Null tenant | Anon | Date span |')
  lines.push('|---|---|---|---|---|---|---|')
  for (const r of results) {
    if (!r.exists) { lines.push(`| \`${r.table}\` | **missing** | — | — | — | — | — |`); continue }
    lines.push(`| \`${r.table}\` | ${r.total_rows} | ${r.evco_rows ?? '—'} | ${r.evco_last_24mo ?? '—'} | ${r.null_tenant_rows ?? 0} | ${r.anon_readable ? '❌ YES' : '✅ blocked'} | ${r.earliest ? r.earliest.slice(0, 10) : '—'} → ${r.latest ? r.latest.slice(0, 10) : '—'} |`)
  }
  lines.push('')

  lines.push('## Columns')
  lines.push('')
  for (const r of results) {
    if (r.exists) {
      lines.push(`### \`${r.table}\``)
      lines.push(`\`${(r.columns || []).join(', ')}\``)
      lines.push('')
    }
  }

  lines.push('## EVCO-specific metrics')
  lines.push('')
  lines.push(`- **EVCO parts total:** ${results.find((r) => r.table === 'globalpc_productos')?.evco_rows ?? '—'}`)
  lines.push(`- **EVCO parts used last 24mo (distinct cve_producto in partidas):** ${parts24mo}`)
  lines.push(`- **EVCO OCA records:** ${oca.count ?? '—'} · avg use_count ${oca.avg_use_count ?? '—'} · latest ${oca.last_used ?? '—'}`)
  lines.push(`- **EVCO classifications total:** ${st.total}`)
  lines.push(`- **SuperTito signal:** ${st.agreed} agreed / ${st.corrections} corrected / ${st.total} total`)
  if (st.total) {
    const agreeRate = Math.round((st.agreed / st.total) * 100)
    lines.push(`- **SuperTito agree rate:** ${agreeRate}%`)
  }
  lines.push('')

  lines.push('## Leak probe summary')
  lines.push('')
  for (const r of results) {
    if (!r.exists) continue
    if (r.null_tenant_rows) lines.push(`- ⚠ \`${r.table}\` has **${r.null_tenant_rows}** rows with NULL \`${r.tenant}\``)
    if (r.anon_readable) lines.push(`- ❌ \`${r.table}\` anon-readable — RLS missing or permissive`)
  }

  fs.writeFileSync('/tmp/parts-data-reality.md', lines.join('\n'))
  console.log(`\n📝 /tmp/parts-data-reality.md`)
})().catch((e) => { console.error(e); process.exit(1) })
