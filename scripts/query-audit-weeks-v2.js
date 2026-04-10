#!/usr/bin/env node
/**
 * Query EVCO audit data for two weeks — corrected column names
 * Uses fecha_pago as anchor (matching original PDF format)
 */
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env.local') })
const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const COMPANY_ID = 'evco'
const CLIENT_CLAVE = '9254'

async function queryWeek(from, to, label) {
  console.log(`\n${'='.repeat(80)}`)
  console.log(`WEEK: ${label} (${from} to ${to})`)
  console.log('='.repeat(80))

  // 1. Get traficos by fecha_pago (the audit anchor date)
  const { data: traficos, error: tErr } = await supabase
    .from('traficos')
    .select('trafico, pedimento, regimen, estatus, importe_total, fecha_llegada, fecha_cruce, fecha_pago, transportista_mexicano, transportista_extranjero, descripcion_mercancia, semaforo, fraccion_arancelaria, tipo_cambio, peso_bruto')
    .eq('company_id', COMPANY_ID)
    .gte('fecha_pago', from)
    .lte('fecha_pago', to + 'T23:59:59')
    .order('fecha_pago', { ascending: true })
    .limit(200)

  if (tErr) console.error('Traficos error:', tErr.message)
  console.log(`\nTráficos by fecha_pago: ${(traficos || []).length}`)

  if (!traficos || traficos.length === 0) {
    console.log('  No traficos found for this week.')
    return
  }

  // Get pedimento numbers for factura lookup
  const pedNums = (traficos || []).map(t => t.pedimento).filter(Boolean)
  console.log(`Pedimento numbers: ${pedNums.join(', ')}`)

  // 2. Get facturas for these specific pedimentos (not by date range)
  const { data: facturas, error: fErr } = await supabase
    .from('aduanet_facturas')
    .select('pedimento, valor_usd, igi, dta, iva, proveedor, cove, num_factura, fecha_pago')
    .in('pedimento', pedNums)
    .limit(500)

  if (fErr) console.error('Facturas error:', fErr.message)
  console.log(`Facturas found: ${(facturas || []).length}`)

  // 3. Get entradas by fecha_llegada_mercancia in this week range
  // Also try broader — entradas linked to these traficos
  const traficoNums = (traficos || []).map(t => t.trafico)

  const [entByDate, entByTrafico, provRes] = await Promise.all([
    supabase
      .from('entradas')
      .select('cve_entrada, fecha_llegada_mercancia, descripcion_mercancia, num_pedido, cantidad_bultos, peso_bruto, trafico, cve_proveedor')
      .eq('company_id', COMPANY_ID)
      .gte('fecha_llegada_mercancia', from)
      .lte('fecha_llegada_mercancia', to + 'T23:59:59')
      .order('fecha_llegada_mercancia', { ascending: true })
      .limit(500),

    supabase
      .from('entradas')
      .select('cve_entrada, fecha_llegada_mercancia, descripcion_mercancia, num_pedido, cantidad_bultos, peso_bruto, trafico, cve_proveedor')
      .eq('company_id', COMPANY_ID)
      .in('trafico', traficoNums)
      .order('fecha_llegada_mercancia', { ascending: true })
      .limit(500),

    supabase
      .from('globalpc_proveedores')
      .select('cve_proveedor, nombre')
      .eq('company_id', COMPANY_ID)
      .limit(1000),
  ])

  const entradasByDate = entByDate.data ?? []
  const entradasByTrafico = entByTrafico.data ?? []
  console.log(`Entradas by date range: ${entradasByDate.length}`)
  console.log(`Entradas by trafico link: ${entradasByTrafico.length}`)

  // Merge and deduplicate entradas
  const entMap = new Map()
  for (const e of [...entradasByDate, ...entradasByTrafico]) {
    entMap.set(e.cve_entrada, e)
  }
  // Use date-range entradas as primary (that's what matches the week)
  const entradas = entradasByDate.length > 0 ? entradasByDate : Array.from(entMap.values())
  console.log(`Using ${entradas.length} entradas`)

  const provLookup = new Map()
  for (const p of (provRes.data ?? [])) {
    if (p.cve_proveedor && p.nombre) provLookup.set(p.cve_proveedor, p.nombre.trim())
  }

  // ── Section I: Pedimento Financial Summary ──
  console.log('\n── I. RESUMEN FINANCIERO DE PEDIMENTOS ──')
  console.log('TRÁFICO | PEDIMENTO | CLAVE | RÉGIMEN | FECHA PAGO | T/C | VALOR USD | DTA (MXN) | IGI (MXN) | IVA (MXN) | TOTAL GRAVAMEN | ESTATUS')

  const pedimentos = []
  for (const t of (traficos || [])) {
    if (!t.pedimento) continue
    const pedFact = (facturas || []).filter(f => f.pedimento === t.pedimento)
    const valorUSD = Number(t.importe_total) || pedFact.reduce((s, f) => s + (Number(f.valor_usd) || 0), 0)
    const dtaMXN = pedFact.reduce((s, f) => s + (Number(f.dta) || 0), 0)
    const igiMXN = pedFact.reduce((s, f) => s + (Number(f.igi) || 0), 0)
    const ivaMXN = pedFact.reduce((s, f) => s + (Number(f.iva) || 0), 0)
    const tc = Number(t.tipo_cambio) || 0
    const reg = (t.regimen || '').toUpperCase()
    const claveReg = (reg === 'ITE' || reg === 'ITR') ? 'IN' : 'A1'
    const regimenLabel = (reg === 'ITE' || reg === 'ITR') ? 'Importación' : reg === 'IMD' ? 'Imp. Definitiva' : reg || 'N/A'

    const traficoShort = t.trafico.replace('9254-', '')

    const ped = {
      trafico: t.trafico,
      traficoShort,
      pedimento: t.pedimento,
      clave: claveReg,
      regimen: regimenLabel,
      fechaPago: t.fecha_pago ? t.fecha_pago.split('T')[0] : null,
      fechaCruce: t.fecha_cruce ? t.fecha_cruce.split('T')[0] : null,
      tc,
      valorUSD,
      dtaMXN,
      igiMXN,
      ivaMXN,
      totalGravamen: dtaMXN + igiMXN + ivaMXN,
      estatus: t.estatus || 'En Proceso',
      semaforo: t.semaforo || '',
      transpMX: t.transportista_mexicano || '',
      transpExt: t.transportista_extranjero || '',
      fraccion: t.fraccion_arancelaria || '',
      facturas: pedFact,
    }
    pedimentos.push(ped)

    console.log(`  9254-${traficoShort} | ${ped.pedimento} | ${ped.clave} | ${ped.regimen} | ${ped.fechaPago} | ${ped.tc} | $${valorUSD.toLocaleString('en-US', {minimumFractionDigits: 2})} | $${dtaMXN.toLocaleString()} | $${igiMXN.toLocaleString()} | $${ivaMXN.toLocaleString()} | $${ped.totalGravamen.toLocaleString()} | ${ped.estatus} | Sem: ${ped.semaforo}`)
  }

  const totalValorUSD = pedimentos.reduce((s, p) => s + p.valorUSD, 0)
  const totalDTA = pedimentos.reduce((s, p) => s + p.dtaMXN, 0)
  const totalIGI = pedimentos.reduce((s, p) => s + p.igiMXN, 0)
  const totalIVA = pedimentos.reduce((s, p) => s + p.ivaMXN, 0)
  const totalGravamen = pedimentos.reduce((s, p) => s + p.totalGravamen, 0)
  console.log(`  ──────────`)
  console.log(`  TOTALES: $${totalValorUSD.toLocaleString('en-US', {minimumFractionDigits: 2})} USD | DTA: $${totalDTA.toLocaleString()} | IGI: $${totalIGI.toLocaleString()} | IVA: $${totalIVA.toLocaleString()} | Total: $${totalGravamen.toLocaleString()}`)

  // ── Section II: Proveedor Detail ──
  console.log('\n── II. DETALLE POR PROVEEDOR ──')
  for (const p of pedimentos) {
    console.log(`\n  ${p.trafico} · Pedimento ${p.pedimento} · ${p.facturas.length} línea(s) · ${p.transpMX} / ${p.transpExt}`)
    if (p.facturas.length === 0) {
      console.log(`    (No facturas found in aduanet_facturas for this pedimento)`)
    }
    for (const f of p.facturas) {
      const provName = provLookup.get(f.proveedor) || f.proveedor || 'N/A'
      console.log(`    PRV: ${provName} | Factura: ${f.num_factura || 'N/A'} | COVE: ${f.cove || 'N/A'} | $${Number(f.valor_usd || 0).toLocaleString('en-US', {minimumFractionDigits: 2})} USD | DTA: ${f.dta || 0} | IGI: ${f.igi || 0} | IVA: ${f.iva || 0}`)
    }
  }

  // ── Section III: Remesas by day ──
  console.log('\n── III. REMESAS CRUZADAS ──')
  const entradasByDay = new Map()
  for (const e of entradas) {
    const day = (e.fecha_llegada_mercancia || '').split('T')[0]
    if (!entradasByDay.has(day)) entradasByDay.set(day, [])
    entradasByDay.get(day).push(e)
  }

  let remesaNum = 0
  const totalPeso = entradas.reduce((s, e) => s + (Number(e.peso_bruto) || 0), 0)
  const totalBultos = entradas.reduce((s, e) => s + (Number(e.cantidad_bultos) || 0), 0)
  const days = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']

  for (const [day, ents] of Array.from(entradasByDay.entries()).sort()) {
    const dt = new Date(day + 'T12:00:00')
    const dayName = days[dt.getDay()]
    console.log(`\n  ${dayName} ${dt.getDate()} ${['Ene','Feb','Mar','Abr'][dt.getMonth()]} — ${ents.length} remesas`)
    for (const e of ents) {
      remesaNum++
      const provName = provLookup.get(e.cve_proveedor) || e.cve_proveedor || ''
      console.log(`    ${String(remesaNum).padStart(2, '0')} | ${e.cve_entrada} | ${(e.descripcion_mercancia || '').substring(0, 50)} | Pedido: ${e.num_pedido || 'N/A'} | ${e.cantidad_bultos || 0} bts | ${Number(e.peso_bruto || 0).toLocaleString()} kg | Tráfico: ${e.trafico || 'N/A'}`)
    }
  }
  console.log(`\n  TOTALES: ${totalBultos} bts · ${totalPeso.toLocaleString()} kg · ${entradas.length} remesas`)

  // ── Section IV: Fracciones ──
  console.log('\n── IV. FRACCIONES ARANCELARIAS ──')
  const fraccionMap = new Map()
  for (const t of (traficos || [])) {
    if (!t.fraccion_arancelaria) continue
    const f = fraccionMap.get(t.fraccion_arancelaria) || { fraccion: t.fraccion_arancelaria, valorUSD: 0, count: 0, pedimentos: [] }
    f.valorUSD += Number(t.importe_total) || 0
    f.count++
    if (t.pedimento) f.pedimentos.push(`${t.pedimento} — ${t.trafico}`)
    fraccionMap.set(t.fraccion_arancelaria, f)
  }
  const fracciones = Array.from(fraccionMap.values()).sort((a, b) => b.valorUSD - a.valorUSD)
  for (const f of fracciones) {
    console.log(`  ${f.fraccion} | $${f.valorUSD.toLocaleString()} USD | ${f.count} uso(s) | ${f.pedimentos.join(', ')}`)
  }

  // Also get fraccion data from globalpc_partidas for these traficos
  console.log('\n  Fracciones from globalpc_partidas:')
  const { data: partidas } = await supabase
    .from('globalpc_partidas')
    .select('cve_trafico, fraccion_arancelaria, valor_comercial, descripcion, cve_proveedor')
    .in('cve_trafico', traficoNums)
    .limit(500)

  if (partidas && partidas.length > 0) {
    const partFracMap = new Map()
    for (const pt of partidas) {
      const frac = pt.fraccion_arancelaria || ''
      if (!frac) continue
      const entry = partFracMap.get(frac) || { fraccion: frac, valorUSD: 0, count: 0, traficos: new Set() }
      entry.valorUSD += Number(pt.valor_comercial) || 0
      entry.count++
      if (pt.cve_trafico) entry.traficos.add(pt.cve_trafico)
      partFracMap.set(frac, entry)
    }
    for (const [frac, data] of Array.from(partFracMap.entries()).sort((a, b) => b[1].valorUSD - a[1].valorUSD)) {
      console.log(`    ${frac} | $${data.valorUSD.toLocaleString('en-US', {minimumFractionDigits: 2})} USD | ${data.count} líneas | Tráficos: ${Array.from(data.traficos).join(', ')}`)
    }
  } else {
    console.log('    (No partidas found)')
  }

  // ── Section V: KPIs ──
  console.log('\n── V. KPIs ──')
  const totalPeds = pedimentos.length
  const verdes = pedimentos.filter(p => (p.semaforo || '').toLowerCase().includes('verde')).length
  const rojos = pedimentos.filter(p => (p.semaforo || '').toLowerCase().includes('rojo')).length
  console.log(`  Pedimentos: ${totalPeds}`)
  console.log(`  Valor total: $${totalValorUSD.toLocaleString('en-US', {minimumFractionDigits: 2})} USD`)
  console.log(`  Semáforo: Verde ${verdes}/${totalPeds} · Rojo ${rojos}/${totalPeds}`)
  console.log(`  Remesas: ${entradas.length} · ${totalBultos} bts · ${totalPeso.toLocaleString()} kg`)
  console.log(`  Tráficos: ${pedimentos.map(p => p.traficoShort).join(' · ')}`)

  // Dispatch times
  for (const p of pedimentos) {
    if (p.fechaPago && p.fechaCruce) {
      const diff = Math.round((new Date(p.fechaCruce) - new Date(p.fechaPago)) / (1000*60*60*24))
      console.log(`  Despacho ${p.traficoShort}: ${p.fechaPago} → ${p.fechaCruce} = ${diff} día(s)`)
    } else {
      console.log(`  Despacho ${p.traficoShort}: Pago ${p.fechaPago} / Cruce ${p.fechaCruce} (incompleto)`)
    }
  }
}

async function main() {
  try {
    // Week 1: March 23-27 (last business week of March before the final one)
    await queryWeek('2026-03-23', '2026-03-27', 'Marzo 23–27, 2026')
    // Week 2: March 30 - April 3 (last business week)
    await queryWeek('2026-03-30', '2026-04-03', 'Abril 3, 2026 (Mar 30–Abr 3)')

    // Also get historical fracciones for context in Section IV
    console.log('\n\n── HISTORICAL FRACCION USAGE (for Section IV context) ──')
    const { data: histFrac } = await supabase
      .from('traficos')
      .select('fraccion_arancelaria, pedimento, importe_total, fecha_pago, trafico')
      .eq('company_id', COMPANY_ID)
      .not('fraccion_arancelaria', 'is', null)
      .order('fecha_pago', { ascending: false })
      .limit(200)

    if (histFrac) {
      const fracHist = new Map()
      for (const t of histFrac) {
        const frac = t.fraccion_arancelaria
        const entry = fracHist.get(frac) || { count: 0, totalUSD: 0, pedimentos: [] }
        entry.count++
        entry.totalUSD += Number(t.importe_total) || 0
        if (entry.pedimentos.length < 8) entry.pedimentos.push({ ped: t.pedimento, valor: Number(t.importe_total) || 0, fecha: (t.fecha_pago || '').split('T')[0] })
        fracHist.set(frac, entry)
      }
      for (const [frac, data] of Array.from(fracHist.entries()).sort((a, b) => b[1].count - a[1].count).slice(0, 10)) {
        console.log(`  ${frac} — ${data.count} usos · $${data.totalUSD.toLocaleString('en-US', {minimumFractionDigits: 2})} USD total`)
        for (const p of data.pedimentos.slice(0, 5)) {
          console.log(`    ${p.ped} | ${p.fecha} | $${p.valor.toLocaleString('en-US', {minimumFractionDigits: 2})}`)
        }
      }
    }

    console.log('\nDone.')
  } catch (err) {
    console.error('Fatal:', err)
    process.exit(1)
  }
}

main()
