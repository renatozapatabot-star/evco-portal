#!/usr/bin/env node
/**
 * CRUZ Full Client Data Sync — EVCO (9254) + MAFESA (4598)
 *
 * Fixes linkage, resolves suppliers, and verifies all data dimensions.
 * Does NOT re-pull from GlobalPC — data is already synced.
 *
 * Phase 1: Entrada→Trafico linkage (both clients)
 * Phase 2: Supplier PRV_XXXX → name resolution
 * Phase 3: Financial verification
 * Phase 4: Comprehensive verification report
 *
 * Usage:
 *   node scripts/full-client-sync.js --dry-run
 *   node scripts/full-client-sync.js
 */

const path = require('path')
const fs = require('fs')
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') })
const { createClient } = require('@supabase/supabase-js')
const mysql = require('mysql2/promise')

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const DRY_RUN = process.argv.includes('--dry-run')
const PORTAL_DATE_FROM = '2024-01-01'

const CLIENTS = [
  { company_id: 'evco', clave: '9254', label: 'EVCO' },
  { company_id: 'mafesa', clave: '4598', label: 'MAFESA' },
]

function getMySQLConfig() {
  return {
    host: process.env.GLOBALPC_DB_HOST,
    port: Number(process.env.GLOBALPC_DB_PORT),
    user: process.env.GLOBALPC_DB_USER,
    password: process.env.GLOBALPC_DB_PASS,
    database: 'bd_demo_38',
    connectTimeout: 15000,
  }
}

function pct(n, total) { return total ? (n / total * 100).toFixed(1) + '%' : '0%' }
function fmtUsd(n) { return '$' + Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' USD' }

// ─── Phase 1: Entrada→Trafico Linkage ───────────────────────

async function linkEntradas(conn, client) {
  console.log(`\n  Phase 1: Entrada→Trafico linkage for ${client.label}...`)

  // Pass 1: sReferenciaCliente split on '-'
  const [traficos] = await conn.execute(`
    SELECT sCveTrafico, sReferenciaCliente
    FROM cb_trafico
    WHERE sCveCliente = ?
      AND sReferenciaCliente IS NOT NULL
      AND sReferenciaCliente != ''
  `, [client.clave])

  const refToTrafico = new Map()
  for (const t of traficos) {
    const refs = String(t.sReferenciaCliente).trim().split('-')
    for (const ref of refs) {
      const trimmed = ref.trim()
      if (trimmed) refToTrafico.set(trimmed, t.sCveTrafico)
    }
  }

  // Validate against actual entradas in MySQL
  const [mysqlEntradas] = await conn.execute(
    'SELECT sCveEntradaBodega FROM cb_entrada_bodega WHERE sCveCliente = ?', [client.clave]
  )
  const validEntradaIds = new Set(mysqlEntradas.map(e => String(e.sCveEntradaBodega).trim()))

  const linkMap = new Map()
  for (const [entradaId, trafico] of refToTrafico) {
    if (validEntradaIds.has(entradaId)) linkMap.set(entradaId, trafico)
  }
  console.log(`    Pass 1: ${linkMap.size} validated links from sReferenciaCliente`)

  // Pass 2: PO number join
  const [poMatches] = await conn.execute(`
    SELECT e.sCveEntradaBodega as cve_entrada, t.sCveTrafico as trafico
    FROM cb_entrada_bodega e
    INNER JOIN cb_trafico t ON (
      e.sNumPedido = t.sNumPedido
      OR FIND_IN_SET(e.sNumPedido, REPLACE(t.sNumPedido, ' ', '')) > 0
    )
    WHERE e.sCveCliente = ? AND t.sCveCliente = ?
      AND e.sNumPedido IS NOT NULL AND e.sNumPedido != ''
      AND t.sNumPedido IS NOT NULL AND t.sNumPedido != ''
  `, [client.clave, client.clave])

  let pass2Additions = 0
  for (const m of poMatches) {
    const key = String(m.cve_entrada).trim()
    if (!linkMap.has(key)) {
      linkMap.set(key, m.trafico)
      pass2Additions++
    }
  }
  console.log(`    Pass 2: ${pass2Additions} additional links from PO join`)
  console.log(`    Total linkage map: ${linkMap.size} entries`)

  // Fetch unlinked Supabase entradas for this client
  const unlinked = []
  let offset = 0
  while (true) {
    const { data } = await supabase
      .from('entradas')
      .select('id, cve_entrada')
      .eq('company_id', client.company_id)
      .is('trafico', null)
      .range(offset, offset + 999)
    if (!data || data.length === 0) break
    unlinked.push(...data)
    offset += data.length
    if (data.length < 1000) break
  }
  console.log(`    Unlinked entradas in Supabase: ${unlinked.length}`)

  // Match
  const toLink = []
  for (const e of unlinked) {
    const trafico = linkMap.get(String(e.cve_entrada))
    if (trafico) toLink.push({ id: e.id, trafico })
  }
  console.log(`    Matches found: ${toLink.length}`)

  if (DRY_RUN) return { linked: toLink.length, total: unlinked.length }

  // Apply updates
  let updated = 0, errors = 0
  for (let i = 0; i < toLink.length; i += 100) {
    const batch = toLink.slice(i, i + 100)
    await Promise.all(batch.map(async ({ id, trafico }) => {
      const { error } = await supabase.from('entradas').update({ trafico }).eq('id', id)
      if (error) errors++
      else updated++
    }))
    if ((i + 100) % 500 === 0) process.stdout.write(`    ${Math.min(i + 100, toLink.length)} / ${toLink.length}\r`)
  }
  console.log(`    Updated: ${updated}, Errors: ${errors}`)
  return { linked: updated, total: unlinked.length, errors }
}

// ─── Phase 2: Supplier PRV_XXXX Resolution ──────────────────

async function resolveSuppliers(client) {
  console.log(`\n  Phase 2: Supplier resolution for ${client.label}...`)

  // Fetch supplier lookup from Supabase
  const provs = []
  let offset = 0
  while (true) {
    const { data } = await supabase.from('globalpc_proveedores')
      .select('cve_proveedor, nombre')
      .eq('cve_cliente', client.clave)
      .range(offset, offset + 999)
    if (!data || data.length === 0) break
    provs.push(...data)
    offset += data.length
    if (data.length < 1000) break
  }

  const lookup = new Map()
  for (const p of provs) {
    if (p.cve_proveedor && p.nombre) lookup.set(p.cve_proveedor, p.nombre.trim())
  }
  console.log(`    Supplier lookup: ${lookup.size} entries`)

  // Fetch traficos with PRV_ codes in proveedores
  const traficos = []
  offset = 0
  while (true) {
    const { data } = await supabase.from('traficos')
      .select('id, trafico, proveedores')
      .eq('company_id', client.company_id)
      .gte('fecha_llegada', PORTAL_DATE_FROM)
      .like('proveedores', '%PRV_%')
      .range(offset, offset + 999)
    if (!data || data.length === 0) break
    traficos.push(...data)
    offset += data.length
    if (data.length < 1000) break
  }
  console.log(`    Traficos with PRV_ codes: ${traficos.length}`)

  let resolved = 0, updated = 0
  const toUpdate = []
  for (const t of traficos) {
    const raw = String(t.proveedores || '')
    const codes = raw.split(',').map(s => s.trim())
    let changed = false
    const newCodes = codes.map(code => {
      if (code.startsWith('PRV_') && lookup.has(code)) {
        changed = true
        resolved++
        return lookup.get(code)
      }
      return code
    })
    if (changed) {
      toUpdate.push({ id: t.id, proveedores: newCodes.join(', ') })
    }
  }
  console.log(`    Resolvable PRV_ codes: ${resolved} across ${toUpdate.length} traficos`)

  if (DRY_RUN) return { resolved, traficos: toUpdate.length }

  for (let i = 0; i < toUpdate.length; i += 100) {
    const batch = toUpdate.slice(i, i + 100)
    await Promise.all(batch.map(async ({ id, proveedores }) => {
      const { error } = await supabase.from('traficos').update({ proveedores }).eq('id', id)
      if (!error) updated++
    }))
  }
  console.log(`    Updated: ${updated} traficos`)
  return { resolved, updated }
}

// ─── Phase 3: Financial Verification ────────────────────────

async function verifyFinancials(client) {
  console.log(`\n  Phase 3: Financial verification for ${client.label}...`)

  // aduanet_facturas
  const aduanet = []
  let offset = 0
  while (true) {
    const { data } = await supabase.from('aduanet_facturas')
      .select('referencia, valor_usd, dta, igi, iva, pedimento')
      .eq('clave_cliente', client.clave)
      .range(offset, offset + 999)
    if (!data || data.length === 0) break
    aduanet.push(...data)
    offset += data.length
    if (data.length < 1000) break
  }

  // Dedup by referencia
  const seen = new Map()
  for (const f of aduanet) {
    const ref = f.referencia || `__nr_${Math.random()}`
    if (!seen.has(ref)) seen.set(ref, f)
  }
  const deduped = [...seen.values()]

  let totalValor = 0, hasDta = 0, hasIgi = 0, hasIva = 0, hasValor = 0
  for (const f of deduped) {
    if (f.valor_usd > 0) { totalValor += Number(f.valor_usd); hasValor++ }
    if (f.dta > 0) hasDta++
    if (f.igi > 0) hasIgi++
    if (f.iva > 0) hasIva++
  }

  const result = {
    raw: aduanet.length,
    deduped: deduped.length,
    duplicates: aduanet.length - deduped.length,
    totalValorUsd: totalValor,
    dtaPct: pct(hasDta, deduped.length),
    igiPct: pct(hasIgi, deduped.length),
    ivaPct: pct(hasIva, deduped.length),
    valorPct: pct(hasValor, deduped.length),
  }
  console.log(`    Facturas: ${result.deduped} (${result.duplicates} dupes removed)`)
  console.log(`    Total valor: ${fmtUsd(totalValor)}`)
  console.log(`    DTA: ${result.dtaPct}, IGI: ${result.igiPct}, IVA: ${result.ivaPct}`)
  return result
}

// ─── Phase 4: Comprehensive Verification ────────────────────

async function verifyAll(client) {
  console.log(`\n  Phase 4: Full verification for ${client.label}...`)

  // Traficos
  const { count: trafCount } = await supabase.from('traficos')
    .select('*', { count: 'exact', head: true })
    .eq('company_id', client.company_id)
    .gte('fecha_llegada', PORTAL_DATE_FROM)

  // Entradas
  const { count: entTotal } = await supabase.from('entradas')
    .select('*', { count: 'exact', head: true })
    .eq('company_id', client.company_id)
  const { count: entLinked } = await supabase.from('entradas')
    .select('*', { count: 'exact', head: true })
    .eq('company_id', client.company_id)
    .not('trafico', 'is', null)
  const { count: ent2024 } = await supabase.from('entradas')
    .select('*', { count: 'exact', head: true })
    .eq('company_id', client.company_id)
    .gte('fecha_llegada_mercancia', PORTAL_DATE_FROM)

  // Facturas
  const { count: facCount } = await supabase.from('globalpc_facturas')
    .select('*', { count: 'exact', head: true })
    .eq('cve_cliente', client.clave)

  // Partidas
  const { count: partCount } = await supabase.from('globalpc_partidas')
    .select('*', { count: 'exact', head: true })
    .eq('cve_cliente', client.clave)

  // Proveedores
  const { count: provCount } = await supabase.from('globalpc_proveedores')
    .select('*', { count: 'exact', head: true })
    .eq('cve_cliente', client.clave)

  // Expediente docs coverage
  const allTraficos = []
  let off = 0
  while (true) {
    const { data } = await supabase.from('traficos')
      .select('trafico')
      .eq('company_id', client.company_id)
      .gte('fecha_llegada', PORTAL_DATE_FROM)
      .range(off, off + 999)
    if (!data || data.length === 0) break
    allTraficos.push(...data)
    off += data.length
    if (data.length < 1000) break
  }

  let trafWithDocs = 0
  for (const t of allTraficos) {
    const { count } = await supabase.from('expediente_documentos')
      .select('*', { count: 'exact', head: true })
      .eq('pedimento_id', t.trafico)
    if (count > 0) trafWithDocs++
  }

  // Supplier resolution check
  const { count: prvCount } = await supabase.from('traficos')
    .select('*', { count: 'exact', head: true })
    .eq('company_id', client.company_id)
    .gte('fecha_llegada', PORTAL_DATE_FROM)
    .like('proveedores', '%PRV_%')

  return {
    traficos: trafCount,
    entradas: { total: entTotal, linked: entLinked, pct2024: ent2024 },
    facturas: facCount,
    partidas: partCount,
    proveedores: provCount,
    docs: { withDocs: trafWithDocs, total: allTraficos.length },
    unresolvedSuppliers: prvCount,
  }
}

// ─── Main ───────────────────────────────────────────────────

async function run() {
  console.log(DRY_RUN ? '🔍 DRY RUN\n' : '🔧 LIVE RUN\n')
  console.log('═══════════════════════════════════════════')
  console.log('  CRUZ Full Client Data Sync')
  console.log('  EVCO (9254) + MAFESA (4598)')
  console.log('═══════════════════════════════════════════')

  const conn = await mysql.createConnection(getMySQLConfig())
  const results = {}

  for (const client of CLIENTS) {
    console.log(`\n━━━ ${client.label} (${client.company_id}, clave ${client.clave}) ━━━`)

    // Phase 1
    results[client.label] = {}
    results[client.label].linkage = await linkEntradas(conn, client)

    // Phase 2
    results[client.label].suppliers = await resolveSuppliers(client)

    // Phase 3
    results[client.label].financials = await verifyFinancials(client)

    // Phase 4
    results[client.label].verification = await verifyAll(client)
  }

  await conn.end()

  // ─── Generate Report ─────────────────────────────────────

  const lines = []
  const w = (...a) => lines.push(a.join(''))

  w('# CRUZ Data Verification Report — Final')
  w(`## Date: ${new Date().toISOString().slice(0, 10)}`)
  w(`## Range: ${PORTAL_DATE_FROM} → today`)
  w(`## Mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE'}`)
  w('')

  for (const client of CLIENTS) {
    const r = results[client.label]
    const v = r.verification
    const f = r.financials

    w('---')
    w('')
    w(`### ${client.label} (company_id: ${client.company_id}, clave: ${client.clave})`)
    w('')
    w('| Dimension | Value | Status |')
    w('|-----------|-------|--------|')

    // Traficos
    const trafStatus = v.traficos > 0 ? '🟢' : '🔴'
    w(`| Tráficos (2024+) | ${v.traficos} | ${trafStatus} |`)

    // Entradas
    const entLinkPct = pct(v.entradas.linked, v.entradas.total)
    const entStatus = v.entradas.linked / v.entradas.total > 0.3 ? '🟢' : v.entradas.linked > 0 ? '🟡' : '🔴'
    w(`| Entradas total | ${v.entradas.total} | ${trafStatus} |`)
    w(`| Entradas 2024+ | ${v.entradas.pct2024} | ${trafStatus} |`)
    w(`| Entradas linked | ${v.entradas.linked} (${entLinkPct}) | ${entStatus} |`)

    // Facturas
    const facStatus = v.facturas > 0 ? '🟢' : '🔴'
    w(`| GlobalPC Facturas | ${v.facturas} | ${facStatus} |`)
    w(`| Aduanet Facturas (deduped) | ${f.deduped} (${f.duplicates} dupes) | ${f.deduped > 0 ? '🟢' : '🟡'} |`)
    w(`| Total valor_usd | ${fmtUsd(f.totalValorUsd)} | ${f.totalValorUsd > 0 ? '🟢' : '🔴'} |`)
    w(`| DTA populated | ${f.dtaPct} | ${parseFloat(f.dtaPct) > 50 ? '🟢' : '🟡'} |`)
    w(`| IGI populated | ${f.igiPct} | ${parseFloat(f.igiPct) > 20 ? '🟢' : '🟡'} |`)
    w(`| IVA populated | ${f.ivaPct} | ${parseFloat(f.ivaPct) > 50 ? '🟢' : '🟡'} |`)

    // Partidas
    w(`| Partidas (line items) | ${v.partidas} | ${v.partidas > 0 ? '🟢' : '🔴'} |`)

    // Proveedores
    w(`| Proveedores | ${v.proveedores} | ${v.proveedores > 0 ? '🟢' : '🔴'} |`)
    const suppStatus = v.unresolvedSuppliers === 0 ? '🟢' : v.unresolvedSuppliers < v.traficos * 0.3 ? '🟡' : '🔴'
    w(`| Tráficos with unresolved PRV_ | ${v.unresolvedSuppliers} | ${suppStatus} |`)

    // Documents
    const docPct = pct(v.docs.withDocs, v.docs.total)
    const docStatus = v.docs.withDocs / v.docs.total > 0.95 ? '🟢' : v.docs.withDocs / v.docs.total > 0.8 ? '🟡' : '🔴'
    w(`| Expediente coverage | ${docPct} (${v.docs.withDocs} / ${v.docs.total}) | ${docStatus} |`)

    w('')

    if (r.linkage.linked > 0) {
      w(`**Linkage:** ${DRY_RUN ? 'Would link' : 'Linked'} ${r.linkage.linked} entradas to traficos`)
      w('')
    }
    if (r.suppliers.resolved > 0) {
      w(`**Suppliers:** ${DRY_RUN ? 'Would resolve' : 'Resolved'} ${r.suppliers.resolved} PRV_ codes across ${r.suppliers.updated || r.suppliers.traficos} traficos`)
      w('')
    }
  }

  // Client isolation check
  w('---')
  w('')
  w('### Client Isolation')
  w('')
  w('| Check | Result |')
  w('|-------|--------|')

  const { count: evcoInMafesa } = await supabase.from('traficos')
    .select('*', { count: 'exact', head: true })
    .eq('company_id', 'mafesa')
    .like('trafico', '9254-%')
  const { count: mafesaInEvco } = await supabase.from('traficos')
    .select('*', { count: 'exact', head: true })
    .eq('company_id', 'evco')
    .like('trafico', '4598-%')

  w(`| EVCO data in MAFESA | ${evcoInMafesa === 0 ? '🟢 None' : '🔴 ' + evcoInMafesa + ' rows!'} |`)
  w(`| MAFESA data in EVCO | ${mafesaInEvco === 0 ? '🟢 None' : '🔴 ' + mafesaInEvco + ' rows!'} |`)

  w('')
  w('---')
  w(`*Generated by scripts/full-client-sync.js on ${new Date().toISOString()}*`)

  const outPath = path.join(__dirname, '..', 'data-verification.md')
  fs.writeFileSync(outPath, lines.join('\n'), 'utf8')
  console.log(`\n\n✅ Report written to ${outPath}`)
}

run().catch(err => {
  console.error('❌ Fatal:', err.message)
  process.exit(1)
})
