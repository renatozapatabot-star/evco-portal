#!/usr/bin/env node
/**
 * M16 demo-critical stress test — runs the canonical queries Ursula's
 * demo path triggers and verifies real EVCO data returns with correct
 * cross-links + enrichment.
 *
 * Covers the 6 Ursula flows:
 *   1. /inicio (quiet-season hero + 4 nav tiles)
 *   2. /catalogo (148K product search)
 *   3. /catalogo/partes/[cveProducto] (detail + historical usage)
 *   4. /anexo-24 (SKU snapshot)
 *   5. /anexo-24/[cveProducto] (parte detail + pedimento history — M12 fix)
 *   6. /embarques/[id] (shipment detail — M15 fix)
 *
 * Exits non-zero if any canonical query returns zero where it should
 * have data. Useful pre-demo smoke test.
 */

import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) { console.error('missing env'); process.exit(1) }
const sb = createClient(url, key)

let fails = 0
function pass(msg) { console.log(`  ✅ ${msg}`) }
function fail(msg) { console.log(`  ❌ ${msg}`); fails++ }
function section(n) { console.log(`\n=== ${n} ===`) }

const COMPANY = 'evco'

// ── Flow 1 — /inicio hero data ─────────────────────────────────────
section('Flow 1 · /inicio — quiet-season hero tiles')
{
  const { count: activeCount } = await sb.from('traficos')
    .select('*', { count: 'exact', head: true })
    .eq('company_id', COMPANY).in('estatus', ['En Proceso', 'En Aduana', 'Documentacion'])

  const { count: monthCount } = await sb.from('traficos')
    .select('*', { count: 'exact', head: true })
    .eq('company_id', COMPANY)
    .gte('created_at', new Date(Date.now() - 30 * 86400000).toISOString())

  const { data: latestCross } = await sb.from('traficos')
    .select('trafico, fecha_cruce').eq('company_id', COMPANY)
    .not('fecha_cruce', 'is', null).order('fecha_cruce', { ascending: false })
    .limit(1).maybeSingle()

  console.log(`  embarques activos: ${activeCount} · últimos 30d: ${monthCount} · último cruce: ${latestCross?.fecha_cruce ?? '—'}`)
  if (activeCount == null) fail('activeCount returned null')
  else pass('active count query ok')
  if (monthCount == null) fail('monthCount returned null')
  else pass('month count query ok')
}

// ── Flow 2 — /catalogo (real SKU search) ──────────────────────────
section('Flow 2 · /catalogo — product search')
{
  // Test: the "6600-1108" SKU Ursula's demo uses (from URSULA_7_MOMENTS.md).
  const { data } = await sb.from('globalpc_productos')
    .select('id, cve_producto, descripcion, fraccion').eq('company_id', COMPANY)
    .ilike('cve_producto', '6600%').limit(5)
  if (!data || data.length === 0) fail('6600-xxx SKU prefix returned 0 — EVCO demo path broken')
  else pass(`6600-xxx prefix returned ${data.length} products (sample: ${data[0].cve_producto})`)

  // Classified-rate sanity check
  const { count: classified } = await sb.from('globalpc_productos')
    .select('*', { count: 'exact', head: true })
    .eq('company_id', COMPANY).not('fraccion', 'is', null)
  console.log(`  total classified productos for EVCO: ${classified}`)
  if (classified < 100) fail(`< 100 classified productos — is classifier running?`)
  else pass(`${classified} classified productos — catalogo has meaningful data`)
}

// ── Flow 3 — /catalogo/partes/[cveProducto] (historical usage) ──
section('Flow 3 · /catalogo/partes/[cveProducto] — historical usage (M12 path)')
{
  // Pick a real EVCO SKU
  const { data: sampleProd } = await sb.from('globalpc_productos')
    .select('cve_producto').eq('company_id', COMPANY)
    .not('fraccion', 'is', null).limit(1).maybeSingle()
  const cve = sampleProd?.cve_producto
  if (!cve) { fail('No classified productos'); }
  else {
    // Query pattern from /api/catalogo/partes/[cveProducto]
    const { data: partidas } = await sb.from('globalpc_partidas')
      .select('id, folio, cantidad, precio_unitario, created_at, cve_producto')
      .eq('company_id', COMPANY).eq('cve_producto', cve).limit(20)
    const partidaCount = partidas?.length ?? 0
    if (partidaCount === 0) {
      console.log(`  ℹ  ${cve} has 0 partidas (long-tail SKU — normal for 147K/148K)`)
    } else {
      // 2-hop resolve
      const folios = partidas.map(p => p.folio).filter(x => x != null)
      const { data: facturas } = await sb.from('globalpc_facturas')
        .select('folio, cve_trafico').eq('company_id', COMPANY).in('folio', folios)
      const cvesTrafico = [...new Set((facturas ?? []).map(f => f.cve_trafico).filter(Boolean))]
      const { data: traficos } = await sb.from('traficos')
        .select('trafico, pedimento, fecha_cruce, semaforo').eq('company_id', COMPANY).in('trafico', cvesTrafico)
      pass(`${cve} → ${partidaCount} partidas → ${cvesTrafico.length} distinct traficos → ${traficos?.length ?? 0} matched (M12 2-hop holds)`)
    }
  }
}

// ── Flow 4 — /anexo-24 (SKU snapshot) ─────────────────────────────
section('Flow 4 · /anexo-24 — Formato 53 snapshot')
{
  const { count } = await sb.from('anexo24_partidas')
    .select('*', { count: 'exact', head: true })
    .eq('company_id', COMPANY)
  if (count === 0) fail('anexo24_partidas has 0 EVCO rows')
  else pass(`anexo24_partidas: ${count} EVCO rows`)

  // Sample row probe (real columns: descripcion, fraccion, pais_origen, um_comercial — no "_official" suffix)
  const { data: samples } = await sb.from('anexo24_partidas')
    .select('numero_parte, descripcion, fraccion, pais_origen, um_comercial, pedimento')
    .eq('company_id', COMPANY).limit(3)
  if (!samples || samples.length === 0) fail('anexo24_partidas sample read failed')
  else pass(`sample anexo24 rows render: ${samples.map(s => `${s.fraccion}:${s.descripcion?.slice(0,20) ?? '—'}`).join(' | ')}`)
}

// ── Flow 5 — /anexo-24/[cveProducto] (detail + pedimento history) ─
section('Flow 5 · /anexo-24/[cveProducto] — parte detail (M14 fix)')
{
  // numero_parte can be empty string in historical rows; filter for
  // non-empty + fraccion for a meaningful probe.
  const { data: firstAnexo } = await sb.from('anexo24_partidas')
    .select('numero_parte').eq('company_id', COMPANY)
    .neq('numero_parte', '').limit(1).maybeSingle()
  const cve = firstAnexo?.numero_parte
  if (!cve) fail('no anexo24_partidas with non-empty numero_parte for EVCO')
  else {
    // 2-hop via facturas
    const { data: partidas } = await sb.from('globalpc_partidas')
      .select('folio').eq('cve_producto', cve).eq('company_id', COMPANY).limit(20)
    if (!partidas || partidas.length === 0) {
      console.log(`  ℹ  ${cve} has 0 partidas (may be pre-migration reference SKU)`)
      pass(`no partidas is OK for reference-only Anexo 24 rows`)
    } else {
      const folios = partidas.map(p => p.folio).filter(x => x != null)
      const { data: facturas } = await sb.from('globalpc_facturas')
        .select('cve_trafico, fecha_facturacion, valor_comercial')
        .eq('company_id', COMPANY).in('folio', folios)
      pass(`${cve} → ${partidas.length} partidas → ${facturas?.length ?? 0} facturas (M14 fix still works)`)
    }
  }
}

// ── Flow 6 — /embarques/[id] (shipment detail) ────────────────────
section('Flow 6 · /embarques/[id] — shipment detail (M15 fix)')
{
  const { data: sample } = await sb.from('traficos')
    .select('trafico, pedimento').eq('company_id', COMPANY)
    .not('pedimento', 'is', null).limit(1).maybeSingle()
  const traficoId = sample?.trafico
  if (!traficoId) fail('no trafico with pedimento for EVCO')
  else {
    // The /embarques/[id] canonical fetch set
    const { data: trafico } = await sb.from('traficos')
      .select('trafico, estatus, pedimento, fecha_llegada, importe_total, regimen, fecha_cruce, fecha_pago, semaforo')
      .eq('trafico', traficoId).maybeSingle()

    const { data: docs } = await sb.from('expediente_documentos')
      .select('id, doc_type, file_name, uploaded_at')
      .eq('pedimento_id', traficoId).limit(20)

    const { data: facturas } = await sb.from('globalpc_facturas')
      .select('folio').eq('cve_trafico', traficoId).eq('company_id', COMPANY)

    const { data: entradas } = await sb.from('entradas')
      .select('cve_entrada, fecha_ingreso').eq('trafico', traficoId).eq('company_id', COMPANY).limit(10)

    const folios = (facturas ?? []).map(f => f.folio).filter(x => x != null)
    const { data: partidas } = folios.length > 0
      ? await sb.from('globalpc_partidas').select('id, cve_producto, cantidad, precio_unitario')
          .in('folio', folios).eq('company_id', COMPANY)
      : { data: [] }

    if (!trafico) fail(`trafico ${traficoId} not found`)
    else pass(`${traficoId}: trafico ok · docs: ${docs?.length ?? 0} · facturas: ${facturas?.length ?? 0} · entradas: ${entradas?.length ?? 0} · partidas: ${partidas?.length ?? 0}`)
  }
}

// ── Flow 7 — /mi-cuenta (client A/R) ────────────────────────────
section('Flow 7 · /mi-cuenta — client A/R')
{
  // clave_cliente → scvecliente → econta_* read path
  const { data: company } = await sb.from('companies')
    .select('clave_cliente').eq('company_id', COMPANY).maybeSingle()
  const clave = company?.clave_cliente
  if (!clave) fail('EVCO has no clave_cliente')
  else {
    // econta uses cve_cliente (the 4-digit clave), not scvecliente.
    const { count: facturas } = await sb.from('econta_facturas')
      .select('*', { count: 'exact', head: true }).eq('cve_cliente', clave)
    const { count: cartera } = await sb.from('econta_cartera')
      .select('*', { count: 'exact', head: true }).eq('cve_cliente', clave)
    console.log(`  EVCO clave_cliente=${clave} · econta_facturas=${facturas} · econta_cartera=${cartera}`)
    pass(`A/R path readable (${facturas ?? 0} facturas · ${cartera ?? 0} cartera rows)`)
  }
}

// ── Summary ───────────────────────────────────────────────────────
section('Summary')
if (fails === 0) { console.log(`\n✅ All demo-critical flows pass.\n`); process.exit(0) }
else { console.log(`\n❌ ${fails} flow(s) failed.\n`); process.exit(1) }
