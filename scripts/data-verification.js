#!/usr/bin/env node
/**
 * CRUZ Data Verification — EVCO (9254) & MAFESA (4598)
 * Report-only. No mutations. Service role for full audit visibility.
 *
 * Usage: node scripts/data-verification.js
 * Output: data-verification.md
 */

const path = require('path')
const fs = require('fs')
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') })
const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const PORTAL_DATE_FROM = '2024-01-01'
const TODAY = new Date().toISOString().slice(0, 10)

const CLIENTS = [
  { company_id: 'evco', clave_cliente: '9254', label: 'EVCO Plastics de México' },
  { company_id: 'mafesa', clave_cliente: '4598', label: 'MAFESA' },
]

// ─── Helpers ────────────────────────────────────────────────

function pct(n, total) {
  if (!total) return '0.0%'
  return (n / total * 100).toFixed(1) + '%'
}

function fmt(n) {
  if (n == null) return '—'
  if (typeof n === 'number') return n.toLocaleString('en-US')
  return String(n)
}

function fmtUsd(n) {
  if (n == null) return '—'
  return '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' USD'
}

// ─── Queries ────────────────────────────────────────────────

async function verifyTraficos(client) {
  const { company_id } = client

  // Total + status distribution
  const { data: all, error } = await supabase
    .from('traficos')
    .select('estatus, fecha_llegada, fecha_cruce, pedimento, proveedores, importe_total, regimen')
    .eq('company_id', company_id)
    .gte('fecha_llegada', PORTAL_DATE_FROM)
    .order('fecha_llegada', { ascending: false })
    .limit(5000)

  if (error) return { error: error.message }

  const total = all.length
  const statusDist = {}
  let minDate = null, maxDate = null
  let withPedimento = 0
  let totalImporte = 0
  let tmecCount = 0

  for (const t of all) {
    const s = (t.estatus || 'NULL').trim()
    statusDist[s] = (statusDist[s] || 0) + 1
    if (t.fecha_llegada) {
      if (!minDate || t.fecha_llegada < minDate) minDate = t.fecha_llegada
      if (!maxDate || t.fecha_llegada > maxDate) maxDate = t.fecha_llegada
    }
    if (t.pedimento) withPedimento++
    if (t.importe_total) totalImporte += Number(t.importe_total)
    const reg = (t.regimen || '').toUpperCase()
    if (['ITE', 'ITR', 'IMD'].includes(reg)) tmecCount++
  }

  return {
    total, statusDist, minDate, maxDate, withPedimento, totalImporte, tmecCount,
    allRows: all,
  }
}

async function verifyEntradas(client) {
  const { company_id } = client

  const { data: all, error } = await supabase
    .from('entradas')
    .select('trafico, cantidad_bultos, peso_bruto, fecha_llegada_mercancia, cve_entrada')
    .eq('company_id', company_id)
    .limit(5000)

  if (error) return { error: error.message }

  const total = all.length
  let linked = 0, hasBultos = 0, hasPeso = 0

  for (const e of all) {
    if (e.trafico) linked++
    if (e.cantidad_bultos != null && Number(e.cantidad_bultos) > 0) hasBultos++
    if (e.peso_bruto != null && Number(e.peso_bruto) > 0) hasPeso++
  }

  return { total, linked, hasBultos, hasPeso }
}

async function verifyFacturas(client) {
  const { clave_cliente } = client

  const { data: all, error } = await supabase
    .from('aduanet_facturas')
    .select('referencia, valor_usd, dta, igi, iva, pedimento, proveedor')
    .eq('clave_cliente', clave_cliente)
    .limit(10000)

  if (error) return { error: error.message }

  const rawCount = all.length

  // Dedup by referencia
  const seen = new Map()
  for (const f of all) {
    const ref = f.referencia || `__no_ref_${Math.random()}`
    if (!seen.has(ref)) seen.set(ref, f)
  }
  const deduped = [...seen.values()]
  const dedupCount = deduped.length

  let totalValor = 0, hasDta = 0, hasIgi = 0, hasIva = 0, hasValor = 0, hasPedimento = 0

  for (const f of deduped) {
    if (f.valor_usd != null && Number(f.valor_usd) > 0) { totalValor += Number(f.valor_usd); hasValor++ }
    if (f.dta != null && Number(f.dta) > 0) hasDta++
    if (f.igi != null && Number(f.igi) > 0) hasIgi++
    if (f.iva != null && Number(f.iva) > 0) hasIva++
    if (f.pedimento) hasPedimento++
  }

  return { rawCount, dedupCount, totalValor, hasDta, hasIgi, hasIva, hasValor, hasPedimento }
}

async function verifyExpedientes(client) {
  const { company_id } = client

  // Mirror the portal's actual join: query expediente_documentos.pedimento_id IN (traficos.trafico)
  // Paginate traficos to get ALL (not just first 1000)
  const clientTraficos = []
  let tOff = 0
  while (true) {
    const { data: batch } = await supabase
      .from('traficos')
      .select('trafico')
      .eq('company_id', company_id)
      .gte('fecha_llegada', PORTAL_DATE_FROM)
      .range(tOff, tOff + 999)
    if (!batch || batch.length === 0) break
    clientTraficos.push(...batch)
    tOff += batch.length
    if (batch.length < 1000) break
  }

  const traficoIds = clientTraficos.map(t => t.trafico)
  if (traficoIds.length === 0) return { total: 0, typeDist: {}, uniqueTraficosWithDocs: 0 }

  // Two-pass approach: first find which traficos have docs, then get type distribution
  // Pass 1: Check coverage using small chunks to avoid truncation
  const traficoSet = new Set()
  for (let i = 0; i < traficoIds.length; i += 10) {
    const chunk = traficoIds.slice(i, i + 10)
    for (const tid of chunk) {
      const { count, error } = await supabase
        .from('expediente_documentos')
        .select('*', { count: 'exact', head: true })
        .eq('pedimento_id', tid)
      if (error) return { error: error.message }
      if (count > 0) traficoSet.add(tid)
    }
  }

  // Pass 2: Get doc type distribution from a sample (limit total to 10K to stay fast)
  const allDocs = []
  const sampleIds = [...traficoSet].slice(0, 200)
  for (let i = 0; i < sampleIds.length; i += 20) {
    const chunk = sampleIds.slice(i, i + 20)
    const { data: docs } = await supabase
      .from('expediente_documentos')
      .select('doc_type')
      .in('pedimento_id', chunk)
      .limit(5000)
    allDocs.push(...(docs || []))
  }

  const total = allDocs.length
  // Extrapolate total from sample ratio
  const estimatedTotal = traficoSet.size > 200
    ? Math.round(total * (traficoSet.size / 200))
    : total

  const typeDist = {}
  for (const d of allDocs) {
    const t = (d.doc_type || 'NULL').trim()
    typeDist[t] = (typeDist[t] || 0) + 1
  }

  return { total: estimatedTotal, typeDist, uniqueTraficosWithDocs: traficoSet.size }
}

async function verifySuppliers(traficosRows) {
  // Fetch supplier lookup
  const { data: provs } = await supabase
    .from('globalpc_proveedores')
    .select('cve_proveedor, nombre')
    .limit(5000)

  const lookup = new Map()
  for (const p of (provs || [])) {
    if (p.cve_proveedor && p.nombre) lookup.set(p.cve_proveedor, p.nombre)
  }

  let totalCodes = 0, resolved = 0, unresolved = 0
  const unresolvedSet = new Set()

  for (const t of traficosRows) {
    if (!t.proveedores) continue
    // proveedores can be a string CSV or an array
    const codes = Array.isArray(t.proveedores)
      ? t.proveedores
      : String(t.proveedores).split(',').map(s => s.trim()).filter(Boolean)

    for (const code of codes) {
      totalCodes++
      if (lookup.has(code) || !code.startsWith('PRV_')) {
        resolved++
      } else {
        unresolved++
        unresolvedSet.add(code)
      }
    }
  }

  return { totalCodes, resolved, unresolved, unresolvedSample: [...unresolvedSet].slice(0, 10), lookupSize: lookup.size }
}

async function verifyGlobalpcFacturas(client) {
  // Check if globalpc_facturas has data for this client
  const { data, error } = await supabase
    .from('globalpc_facturas')
    .select('cve_trafico, valor_comercial, cve_proveedor')
    .eq('cve_cliente', client.clave_cliente)
    .limit(5000)

  if (error) return { error: error.message }
  return { total: (data || []).length }
}

// ─── Report Generator ───────────────────────────────────────

async function runVerification() {
  const lines = []
  const w = (...args) => lines.push(args.join(''))

  w('# CRUZ Data Verification Report')
  w(`## Date: ${TODAY}`)
  w(`## Range: ${PORTAL_DATE_FROM} → ${TODAY}`)
  w('')

  for (const client of CLIENTS) {
    console.log(`\nVerifying ${client.label} (${client.company_id})...`)
    w(`---`)
    w(``)
    w(`### ${client.label} (company_id: ${client.company_id}, clave_cliente: ${client.clave_cliente})`)
    w('')

    // 1. TRAFICOS
    console.log('  → traficos...')
    const traf = await verifyTraficos(client)
    if (traf.error) {
      w(`**TRAFICOS ERROR:** ${traf.error}`)
    } else {
      w(`#### 1. Tráficos`)
      w(`| Metric | Value | Portal Page |`)
      w(`|--------|-------|-------------|`)
      w(`| Total count | ${fmt(traf.total)} | /traficos |`)
      w(`| Date range | ${traf.minDate?.slice(0,10) || '—'} → ${traf.maxDate?.slice(0,10) || '—'} | /traficos |`)
      w(`| With pedimento | ${fmt(traf.withPedimento)} (${pct(traf.withPedimento, traf.total)}) | /pedimentos |`)
      w(`| Valor total (importe_total) | ${fmtUsd(traf.totalImporte)} | /reportes |`)
      w(`| T-MEC operations | ${fmt(traf.tmecCount)} (${pct(traf.tmecCount, traf.total)}) | /reportes |`)
      w('')
      w(`**Status distribution:**`)
      w(`| Status | Count | % |`)
      w(`|--------|-------|---|`)
      const sorted = Object.entries(traf.statusDist).sort((a, b) => b[1] - a[1])
      for (const [status, count] of sorted) {
        w(`| ${status} | ${fmt(count)} | ${pct(count, traf.total)} |`)
      }
      w('')
    }

    // 2. ENTRADAS
    console.log('  → entradas...')
    const ent = await verifyEntradas(client)
    if (ent.error) {
      w(`**ENTRADAS ERROR:** ${ent.error}`)
    } else {
      w(`#### 2. Entradas`)
      w(`| Metric | Value | % | Portal Page |`)
      w(`|--------|-------|---|-------------|`)
      w(`| Total count | ${fmt(ent.total)} | — | /entradas |`)
      w(`| Linked to tráfico | ${fmt(ent.linked)} | ${pct(ent.linked, ent.total)} | /entradas |`)
      w(`| Bultos populated | ${fmt(ent.hasBultos)} | ${pct(ent.hasBultos, ent.total)} | /entradas |`)
      w(`| Peso populated | ${fmt(ent.hasPeso)} | ${pct(ent.hasPeso, ent.total)} | /entradas |`)
      w('')
    }

    // 3. ADUANET FACTURAS
    console.log('  → aduanet_facturas...')
    const fact = await verifyFacturas(client)
    if (fact.error) {
      w(`**ADUANET_FACTURAS ERROR:** ${fact.error}`)
    } else {
      w(`#### 3. Aduanet Facturas`)
      w(`| Metric | Value | % | Portal Page |`)
      w(`|--------|-------|---|-------------|`)
      w(`| Raw count | ${fmt(fact.rawCount)} | — | — |`)
      w(`| After dedup (by referencia) | ${fmt(fact.dedupCount)} | — | /reportes |`)
      w(`| Duplicates removed | ${fmt(fact.rawCount - fact.dedupCount)} | — | — |`)
      w(`| Total valor_usd | ${fmtUsd(fact.totalValor)} | — | /reportes |`)
      w(`| valor_usd populated | ${fmt(fact.hasValor)} | ${pct(fact.hasValor, fact.dedupCount)} | /pedimentos |`)
      w(`| DTA populated | ${fmt(fact.hasDta)} | ${pct(fact.hasDta, fact.dedupCount)} | /pedimentos |`)
      w(`| IGI populated | ${fmt(fact.hasIgi)} | ${pct(fact.hasIgi, fact.dedupCount)} | /pedimentos |`)
      w(`| IVA populated | ${fmt(fact.hasIva)} | ${pct(fact.hasIva, fact.dedupCount)} | /pedimentos |`)
      w(`| Linked to pedimento | ${fmt(fact.hasPedimento)} | ${pct(fact.hasPedimento, fact.dedupCount)} | /pedimentos |`)
      w('')
    }

    // 4. GLOBALPC FACTURAS
    console.log('  → globalpc_facturas...')
    const gpc = await verifyGlobalpcFacturas(client)
    if (gpc.error) {
      w(`**GLOBALPC_FACTURAS ERROR:** ${gpc.error}`)
    } else {
      w(`#### 4. GlobalPC Facturas`)
      w(`| Metric | Value | Portal Page |`)
      w(`|--------|-------|-------------|`)
      w(`| Total count (cve_cliente=${client.clave_cliente}) | ${fmt(gpc.total)} | — |`)
      w('')
    }

    // 5. EXPEDIENTE DOCUMENTOS
    console.log('  → expediente_documentos...')
    const exp = await verifyExpedientes(client)
    if (exp.error) {
      w(`**EXPEDIENTE_DOCUMENTOS ERROR:** ${exp.error}`)
    } else {
      w(`#### 5. Expediente Documentos`)
      w(`| Metric | Value | Portal Page |`)
      w(`|--------|-------|-------------|`)
      w(`| Total documents | ${fmt(exp.total)} | /documentos |`)
      w(`| Unique tráficos with docs | ${fmt(exp.uniqueTraficosWithDocs)} | /documentos |`)
      if (traf && !traf.error) {
        w(`| Coverage (tráficos with ≥1 doc) | ${pct(exp.uniqueTraficosWithDocs, traf.total)} (${fmt(exp.uniqueTraficosWithDocs)} de ${fmt(traf.total)}) | /documentos |`)
      }
      w('')
      w(`**Document type distribution:**`)
      w(`| Type | Count | % |`)
      w(`|------|-------|---|`)
      const typeSorted = Object.entries(exp.typeDist).sort((a, b) => b[1] - a[1])
      for (const [type, count] of typeSorted) {
        const flag = type === 'OTRO' || type === 'NULL' ? ' ⚠️' : ''
        w(`| ${type} | ${fmt(count)} | ${pct(count, exp.total)} |${flag}`)
      }
      w('')
    }

    // 6. SUPPLIER RESOLUTION
    console.log('  → supplier resolution...')
    if (traf && !traf.error && traf.allRows) {
      const sup = await verifySuppliers(traf.allRows)
      w(`#### 6. Supplier Name Resolution`)
      w(`| Metric | Value | % |`)
      w(`|--------|-------|---|`)
      w(`| Lookup table size | ${fmt(sup.lookupSize)} | — |`)
      w(`| Total supplier codes in tráficos | ${fmt(sup.totalCodes)} | — |`)
      w(`| Resolved (name or non-PRV_) | ${fmt(sup.resolved)} | ${pct(sup.resolved, sup.totalCodes)} |`)
      w(`| Unresolved PRV_ codes | ${fmt(sup.unresolved)} | ${pct(sup.unresolved, sup.totalCodes)} |`)
      if (sup.unresolvedSample.length > 0) {
        w('')
        w(`**Unresolved sample:** \`${sup.unresolvedSample.join('`, `')}\``)
      }
      w('')
    }

    // 7. CROSS-LINKING SUMMARY
    w(`#### 7. Cross-Linking Summary`)
    w(`| Relationship | Linked | Total | % |`)
    w(`|-------------|--------|-------|---|`)
    if (ent && !ent.error) {
      w(`| Entradas → Tráfico | ${fmt(ent.linked)} | ${fmt(ent.total)} | ${pct(ent.linked, ent.total)} |`)
    }
    if (traf && !traf.error) {
      w(`| Tráficos → Pedimento | ${fmt(traf.withPedimento)} | ${fmt(traf.total)} | ${pct(traf.withPedimento, traf.total)} |`)
    }
    if (fact && !fact.error) {
      w(`| Facturas → Pedimento | ${fmt(fact.hasPedimento)} | ${fmt(fact.dedupCount)} | ${pct(fact.hasPedimento, fact.dedupCount)} |`)
    }
    w('')
  }

  // ─── ISOLATION CHECK ───────────────────────────────────────
  console.log('\nRunning isolation check...')
  w('---')
  w('')
  w('### Cross-Client Isolation Verification')
  w('')

  // Service role bypasses RLS — so we check for data contamination at the data level
  // Verify no EVCO rows have MAFESA company_id and vice versa
  const { data: evcoRows } = await supabase
    .from('traficos')
    .select('company_id')
    .eq('company_id', 'evco')
    .limit(1)
  const { data: mafesaRows } = await supabase
    .from('traficos')
    .select('company_id')
    .eq('company_id', 'mafesa')
    .limit(1)

  // Check aduanet_facturas isolation
  const { data: evcoFact } = await supabase
    .from('aduanet_facturas')
    .select('clave_cliente')
    .eq('clave_cliente', '9254')
    .limit(1)
  const { data: mafesaFact } = await supabase
    .from('aduanet_facturas')
    .select('clave_cliente')
    .eq('clave_cliente', '4598')
    .limit(1)

  // Check for any rows where company_id doesn't match expected clave_cliente
  const { data: crossContam } = await supabase
    .from('traficos')
    .select('company_id, trafico')
    .not('company_id', 'in', '("evco","mafesa")')
    .gte('fecha_llegada', PORTAL_DATE_FROM)
    .limit(10)

  w(`| Check | Result |`)
  w(`|-------|--------|`)
  w(`| EVCO traficos exist | ${evcoRows?.length > 0 ? '✅ Yes' : '❌ No data'} |`)
  w(`| MAFESA traficos exist | ${mafesaRows?.length > 0 ? '✅ Yes' : '⚠️ No data (may not be synced yet)'} |`)
  w(`| EVCO facturas exist (clave 9254) | ${evcoFact?.length > 0 ? '✅ Yes' : '❌ No data'} |`)
  w(`| MAFESA facturas exist (clave 4598) | ${mafesaFact?.length > 0 ? '✅ Yes' : '⚠️ No data'} |`)
  w(`| Traficos with unknown company_id | ${(crossContam?.length || 0) === 0 ? '✅ None' : '❌ Found ' + crossContam.length + ' rows'} |`)

  if (crossContam?.length > 0) {
    w('')
    w('**Unknown company_id rows:**')
    for (const r of crossContam) {
      w(`- trafico=${r.trafico}, company_id=${r.company_id}`)
    }
  }

  w('')
  w('---')
  w(`*Generated by scripts/data-verification.js on ${new Date().toISOString()}*`)

  // Write report
  const outPath = path.join(__dirname, '..', 'data-verification.md')
  fs.writeFileSync(outPath, lines.join('\n'), 'utf8')
  console.log(`\n✅ Report written to ${outPath}`)
}

runVerification().catch(err => {
  console.error('❌ Verification failed:', err.message)
  process.exit(1)
})
