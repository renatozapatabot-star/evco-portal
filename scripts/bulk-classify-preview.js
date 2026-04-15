#!/usr/bin/env node
/**
 * bulk-classify-preview.js — answers "what would it take to clear the
 * 655K unclassified products backlog?" without writing anything.
 *
 * Strategy tiers (cheapest to most expensive):
 *
 *   Tier 1 · descripcion-exact lookup
 *     For each unclassified row with a non-empty descripcion, find any
 *     ALREADY-classified row with the same descripcion. Copy the fraccion.
 *     Cost: $0. Confidence: high (exact match means same product type).
 *
 *   Tier 2 · (cve_proveedor, descripcion) lookup
 *     Same as Tier 1 but also matches the supplier — even tighter signal.
 *     Catches rows where the same supplier classified the same SKU before.
 *
 *   Tier 3 · cve_producto lookup
 *     If the same cve_producto exists classified anywhere, copy that.
 *
 *   Tier 4 · Haiku AI classification (NOT done in preview — costed only)
 *     Anthropic Haiku ~$0.001/call. For rows none of the above resolve.
 *
 * Output: counts per tier + a sample of top-frequency descripciones
 * that would auto-classify (so Tito can spot-check before greenlighting
 * a real bulk write).
 *
 * Usage:
 *   node scripts/bulk-classify-preview.js
 *   node scripts/bulk-classify-preview.js --company=evco
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '..', '.env.local') })
const { createClient } = require('@supabase/supabase-js')

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
)

const args = process.argv.slice(2)
const companyFlag = args.find(a => a.startsWith('--company='))
const onlyCompany = companyFlag ? companyFlag.split('=')[1] : null

function color(code, str) { return `\x1b[${code}m${str}\x1b[0m` }
const GREEN = (s) => color(32, s)
const YELLOW = (s) => color(33, s)
const DIM = (s) => color(90, s)
const BOLD = (s) => color(1, s)

const HAIKU_COST_PER_CLASSIFICATION_USD = 0.001

;(async () => {
  console.log(BOLD('\nZAPATA AI · Bulk-classify viability preview\n'))
  console.log(DIM(`generated ${new Date().toISOString()}\n`))

  const scope = onlyCompany ? `company_id=${onlyCompany}` : 'portal-wide'
  console.log(`Scope: ${scope}\n`)

  // 1. Pull all classified rows (descripcion + fraccion) into a lookup map.
  console.log(DIM('Building classified-descripcion lookup map…'))
  const descToFraccion = new Map()         // descripcion → fraccion
  const cveProveedorDescToFraccion = new Map() // cve_proveedor::descripcion → fraccion
  const cveProductoToFraccion = new Map()  // cve_producto → fraccion
  let pageSize = 1000, offset = 0, classifiedTotal = 0
  while (true) {
    let q = sb.from('globalpc_productos')
      .select('descripcion, fraccion, cve_producto, cve_proveedor, company_id')
      .not('fraccion', 'is', null).neq('fraccion', '')
      .range(offset, offset + pageSize - 1)
    if (onlyCompany) q = q.eq('company_id', onlyCompany)
    const { data, error } = await q
    if (error) { console.error(error.message); process.exit(2) }
    if (!data || data.length === 0) break
    for (const r of data) {
      classifiedTotal++
      if (r.descripcion && r.descripcion.trim()) {
        const desc = r.descripcion.trim().toUpperCase()
        if (!descToFraccion.has(desc)) descToFraccion.set(desc, r.fraccion)
        if (r.cve_proveedor) {
          const k = `${r.cve_proveedor}::${desc}`
          if (!cveProveedorDescToFraccion.has(k)) cveProveedorDescToFraccion.set(k, r.fraccion)
        }
      }
      if (r.cve_producto) {
        const k = `${r.cve_proveedor ?? '-'}::${r.cve_producto}`
        if (!cveProductoToFraccion.has(k)) cveProductoToFraccion.set(k, r.fraccion)
      }
    }
    offset += data.length
    if (data.length < pageSize) break
    process.stdout.write('.')
  }
  console.log(`\n  ${classifiedTotal.toLocaleString('en-US')} classified rows scanned`)
  console.log(`  ${descToFraccion.size.toLocaleString('en-US')} unique descripcion→fraccion pairs`)
  console.log(`  ${cveProveedorDescToFraccion.size.toLocaleString('en-US')} unique (proveedor, descripcion)→fraccion pairs`)
  console.log(`  ${cveProductoToFraccion.size.toLocaleString('en-US')} unique (proveedor, cve_producto) pairs`)
  console.log()

  // 2. Iterate unclassified, bucket each row by what tier could resolve it.
  console.log(DIM('Probing unclassified rows…'))
  const buckets = { tier1_desc: 0, tier2_provDesc: 0, tier3_cveProd: 0, needAI: 0, unsolvable: 0 }
  const topDescriptions = new Map() // descripcion → count (auto-resolvable)
  pageSize = 1000; offset = 0
  let unclTotal = 0
  while (true) {
    let q = sb.from('globalpc_productos')
      .select('descripcion, cve_producto, cve_proveedor, company_id')
      .or('fraccion.is.null,fraccion.eq.')
      .range(offset, offset + pageSize - 1)
    if (onlyCompany) q = q.eq('company_id', onlyCompany)
    const { data, error } = await q
    if (error) { console.error(error.message); process.exit(2) }
    if (!data || data.length === 0) break
    for (const r of data) {
      unclTotal++
      const desc = r.descripcion?.trim().toUpperCase()
      const cveProv = r.cve_proveedor
      const cveProd = r.cve_producto

      if (cveProv && desc && cveProveedorDescToFraccion.has(`${cveProv}::${desc}`)) {
        buckets.tier2_provDesc++
        topDescriptions.set(desc, (topDescriptions.get(desc) ?? 0) + 1)
        continue
      }
      if (desc && descToFraccion.has(desc)) {
        buckets.tier1_desc++
        topDescriptions.set(desc, (topDescriptions.get(desc) ?? 0) + 1)
        continue
      }
      if (cveProd && cveProductoToFraccion.has(`${cveProv ?? '-'}::${cveProd}`)) {
        buckets.tier3_cveProd++
        continue
      }
      if (desc) {
        buckets.needAI++
      } else {
        buckets.unsolvable++
      }
    }
    offset += data.length
    if (data.length < pageSize) break
    process.stdout.write('.')
  }
  console.log()

  const autoResolvable = buckets.tier1_desc + buckets.tier2_provDesc + buckets.tier3_cveProd

  console.log(`\n${BOLD('Unclassified inventory: ')}${unclTotal.toLocaleString('en-US')}`)
  console.log(`${GREEN('  ' + buckets.tier2_provDesc.toLocaleString('en-US') + ' (' + pct(buckets.tier2_provDesc, unclTotal) + ')')} · Tier 2 — (proveedor, descripcion) exact match`)
  console.log(`${GREEN('  ' + buckets.tier1_desc.toLocaleString('en-US') + ' (' + pct(buckets.tier1_desc, unclTotal) + ')')} · Tier 1 — descripcion exact match`)
  console.log(`${GREEN('  ' + buckets.tier3_cveProd.toLocaleString('en-US') + ' (' + pct(buckets.tier3_cveProd, unclTotal) + ')')} · Tier 3 — cve_producto match`)
  console.log(`${YELLOW('  ' + buckets.needAI.toLocaleString('en-US') + ' (' + pct(buckets.needAI, unclTotal) + ')')} · Tier 4 — needs AI classification`)
  console.log(`${DIM('  ' + buckets.unsolvable.toLocaleString('en-US') + ' (' + pct(buckets.unsolvable, unclTotal) + ')')} · No description / no cve — un-resolvable from row data`)

  console.log(`\n${BOLD('Estimated cost to clear:')}`)
  const aiCostUsd = buckets.needAI * HAIKU_COST_PER_CLASSIFICATION_USD
  console.log(`  $0 — ${autoResolvable.toLocaleString('en-US')} rows resolvable via lookup (${pct(autoResolvable, unclTotal)})`)
  console.log(`  $${aiCostUsd.toFixed(2)} — ${buckets.needAI.toLocaleString('en-US')} rows need Haiku at ~$${HAIKU_COST_PER_CLASSIFICATION_USD}/call`)
  console.log(`  $0 — ${buckets.unsolvable.toLocaleString('en-US')} rows can't be resolved without enriching source data`)

  console.log(`\n${BOLD('Top 10 auto-resolvable descriptions (spot-check before greenlight):')}`)
  const sortedDescs = [...topDescriptions.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10)
  for (const [desc, n] of sortedDescs) {
    const fraccion = descToFraccion.get(desc)
    console.log(`  ${n.toString().padStart(5, ' ')} × ${DIM(fraccion ?? '?')} ${desc.slice(0, 80)}`)
  }

  console.log(`\n${DIM('Next step: review the top-10 above. If the descripcion → fraccion mapping looks wrong on any, that whole category needs human review before bulk write. If they look right, run the (yet-to-be-built) bulk-classify-apply script.')}\n`)
})().catch(err => { console.error('FATAL:', err.message); process.exit(2) })

function pct(n, total) { return total > 0 ? `${((n / total) * 100).toFixed(1)}%` : '0%' }
