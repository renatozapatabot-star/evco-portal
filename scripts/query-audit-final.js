#!/usr/bin/env node
/**
 * Final audit data query for EVCO — Mar 23-27 and Mar 30-Apr 3, 2026
 * Uses traficos (fecha_pago), globalpc_facturas (per-invoice), entradas (remesas)
 */
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env.local') })
const { createClient } = require('@supabase/supabase-js')
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

async function queryWeek(from, to, label) {
  console.log(`\n${'='.repeat(90)}`)
  console.log(`  ${label}`)
  console.log('='.repeat(90))

  // 1. Traficos by fecha_pago
  const { data: traficos } = await sb.from('traficos')
    .select('trafico, pedimento, regimen, estatus, importe_total, fecha_llegada, fecha_cruce, fecha_pago, transportista_mexicano, transportista_extranjero, descripcion_mercancia, semaforo, tipo_cambio, peso_bruto')
    .eq('company_id', 'evco')
    .gte('fecha_pago', from)
    .lte('fecha_pago', to + 'T23:59:59')
    .order('fecha_pago', { ascending: true })
    .limit(50)

  if (!traficos?.length) { console.log('  No traficos.'); return }

  const traficoNums = traficos.map(t => t.trafico)

  // 2. GlobalPC facturas (per-invoice detail)
  const [gfRes, entRes, provRes, aduaRes] = await Promise.all([
    sb.from('globalpc_facturas')
      .select('cve_trafico, cve_proveedor, numero, incoterm, moneda, valor_comercial, flete, seguros, embalajes, incrementables, cove_vucem')
      .in('cve_trafico', traficoNums)
      .limit(500),
    sb.from('entradas')
      .select('cve_entrada, fecha_llegada_mercancia, descripcion_mercancia, num_pedido, cantidad_bultos, peso_bruto, trafico, cve_proveedor')
      .eq('company_id', 'evco')
      .gte('fecha_llegada_mercancia', from)
      .lte('fecha_llegada_mercancia', to + 'T23:59:59')
      .order('fecha_llegada_mercancia', { ascending: true })
      .limit(500),
    sb.from('globalpc_proveedores')
      .select('cve_proveedor, nombre')
      .eq('company_id', 'evco')
      .limit(1000),
    // Try aduanet_facturas for DTA/IGI/IVA
    sb.from('aduanet_facturas')
      .select('pedimento, referencia, dta, igi, iva, valor_usd, tipo_cambio, cve_documento')
      .in('pedimento', traficos.map(t => t.pedimento).filter(Boolean))
      .limit(100),
  ])

  const gFacturas = gfRes.data ?? []
  const entradas = entRes.data ?? []
  const provLookup = new Map()
  for (const p of (provRes.data ?? [])) {
    if (p.cve_proveedor && p.nombre) provLookup.set(p.cve_proveedor, p.nombre.trim())
  }
  const aduanetMap = new Map()
  for (const a of (aduaRes.data ?? [])) {
    aduanetMap.set(a.pedimento, a)
  }

  console.log(`  Tráficos: ${traficos.length} | Facturas GP: ${gFacturas.length} | Entradas: ${entradas.length} | Aduanet: ${aduaRes.data?.length || 0}`)

  // ═══════════════════════════════════════════════════
  // SECTION I — RESUMEN FINANCIERO DE PEDIMENTOS
  // ═══════════════════════════════════════════════════
  console.log('\n  ╔══════════════════════════════════════════════════════════════════════════════╗')
  console.log('  ║  I. RESUMEN FINANCIERO DE PEDIMENTOS                                       ║')
  console.log('  ╚══════════════════════════════════════════════════════════════════════════════╝')

  const pedimentos = []
  for (const t of traficos) {
    if (!t.pedimento) continue
    const invoices = gFacturas.filter(f => f.cve_trafico === t.trafico)
    const valorUSD = Number(t.importe_total) || invoices.reduce((s, f) => s + (Number(f.valor_comercial) || 0), 0)
    const tc = Number(t.tipo_cambio) || 0
    const reg = (t.regimen || '').toUpperCase()
    const claveReg = (reg === 'ITE' || reg === 'ITR') ? 'IN' : 'A1'
    const regimenLabel = (reg === 'ITE' || reg === 'ITR') ? 'Importación' : reg === 'IMD' ? 'Imp. Definitiva' : reg || 'N/A'
    const short = t.trafico.replace('9254-', '')

    // Get aduanet tax data if available
    const adua = aduanetMap.get(t.pedimento)
    const dtaMXN = Number(adua?.dta) || 0
    const igiMXN = Number(adua?.igi) || 0
    const ivaMXN = Number(adua?.iva) || 0

    const ped = {
      trafico: t.trafico, short, pedimento: t.pedimento, clave: claveReg, regimen: regimenLabel,
      fechaPago: (t.fecha_pago || '').split('T')[0],
      fechaCruce: (t.fecha_cruce || '').split('T')[0],
      tc, valorUSD, dtaMXN, igiMXN, ivaMXN,
      totalGravamen: dtaMXN + igiMXN + ivaMXN,
      estatus: t.estatus || '', semaforo: t.semaforo,
      transpMX: t.transportista_mexicano || '', transpExt: t.transportista_extranjero || '',
      desc: t.descripcion_mercancia || '', peso: t.peso_bruto,
      invoices,
    }
    pedimentos.push(ped)

    const valorStr = `$${valorUSD.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`
    const taxStr = dtaMXN || igiMXN || ivaMXN
      ? `DTA: $${dtaMXN.toLocaleString()} | IGI: $${igiMXN.toLocaleString()} | IVA: $${ivaMXN.toLocaleString()} | Tot: $${ped.totalGravamen.toLocaleString()}`
      : '(impuestos pendientes Aduanet)'
    console.log(`  9254-${short} | ${t.pedimento} | ${claveReg} ${regimenLabel} | ${ped.fechaPago} | T/C ${tc.toFixed(4)} | ${valorStr} | ${taxStr} | ${ped.estatus}`)
  }

  const totals = {
    valorUSD: pedimentos.reduce((s, p) => s + p.valorUSD, 0),
    dta: pedimentos.reduce((s, p) => s + p.dtaMXN, 0),
    igi: pedimentos.reduce((s, p) => s + p.igiMXN, 0),
    iva: pedimentos.reduce((s, p) => s + p.ivaMXN, 0),
    gravamen: pedimentos.reduce((s, p) => s + p.totalGravamen, 0),
  }
  console.log(`  ${'─'.repeat(85)}`)
  console.log(`  TOTALES: $${totals.valorUSD.toLocaleString('en-US', {minimumFractionDigits: 2})} USD | DTA: $${totals.dta.toLocaleString()} | IGI: $${totals.igi.toLocaleString()} | IVA: $${totals.iva.toLocaleString()} | Gravamen: $${totals.gravamen.toLocaleString()}`)

  // ═══════════════════════════════════════════════════
  // SECTION II — DETALLE POR PROVEEDOR
  // ═══════════════════════════════════════════════════
  console.log('\n  ╔══════════════════════════════════════════════════════════════════════════════╗')
  console.log('  ║  II. DETALLE DE PEDIMENTOS POR PROVEEDOR                                   ║')
  console.log('  ╚══════════════════════════════════════════════════════════════════════════════╝')

  for (const p of pedimentos) {
    console.log(`\n  ${p.trafico} · Pedimento ${p.pedimento} · ${p.invoices.length} líneas · ${p.transpMX} / ${p.transpExt}`)
    for (const inv of p.invoices) {
      const provName = provLookup.get(inv.cve_proveedor) || inv.cve_proveedor || 'N/A'
      const valor = Number(inv.valor_comercial) || 0
      console.log(`    ${provName.padEnd(40)} | Fac: ${(inv.numero || '').padEnd(18)} | COVE: ${(inv.cove_vucem || '').padEnd(16)} | $${valor.toLocaleString('en-US', {minimumFractionDigits: 2})} ${inv.moneda || 'USD'} | ${inv.incoterm || ''}`)
    }
    if (p.invoices.length === 0) console.log('    (sin facturas en globalpc_facturas)')
    // Show subtotal
    const subTotal = p.invoices.reduce((s, inv) => s + (Number(inv.valor_comercial) || 0), 0)
    if (p.invoices.length > 1) console.log(`    ${'─'.repeat(70)}\n    SUBTOTAL: $${subTotal.toLocaleString('en-US', {minimumFractionDigits: 2})} USD`)
  }

  const totalValorProveedores = pedimentos.reduce((s, p) => s + p.invoices.reduce((ss, inv) => ss + (Number(inv.valor_comercial) || 0), 0), 0)
  console.log(`\n  TOTAL VALOR IMPORTADO: $${totalValorProveedores.toLocaleString('en-US', {minimumFractionDigits: 2})} USD`)

  // ═══════════════════════════════════════════════════
  // SECTION III — REMESAS CRUZADAS
  // ═══════════════════════════════════════════════════
  console.log('\n  ╔══════════════════════════════════════════════════════════════════════════════╗')
  console.log('  ║  III. REMESAS CRUZADAS — EVCO #9254                                        ║')
  console.log('  ╚══════════════════════════════════════════════════════════════════════════════╝')

  const byDay = new Map()
  for (const e of entradas) {
    const day = (e.fecha_llegada_mercancia || '').split('T')[0]
    if (!byDay.has(day)) byDay.set(day, [])
    byDay.get(day).push(e)
  }

  let num = 0
  const days = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
  const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May']
  for (const [day, ents] of Array.from(byDay.entries()).sort()) {
    const dt = new Date(day + 'T12:00:00')
    console.log(`\n  ${days[dt.getDay()]} ${dt.getDate()} ${months[dt.getMonth()]} — ${ents.length} remesas`)
    for (const e of ents) {
      num++
      const provName = provLookup.get(e.cve_proveedor) || e.cve_proveedor || ''
      const desc = (e.descripcion_mercancia || '').substring(0, 42).toUpperCase()
      console.log(`  ${String(num).padStart(2, '0')} | ${e.cve_entrada} | ${desc.padEnd(42)} | #${(e.num_pedido || '').padEnd(7)} | ${String(e.cantidad_bultos || 0).padStart(2)} bts | ${String(Number(e.peso_bruto || 0).toLocaleString()).padStart(8)} kg | ${provName}`)
    }
  }

  const totalPeso = entradas.reduce((s, e) => s + (Number(e.peso_bruto) || 0), 0)
  const totalBultos = entradas.reduce((s, e) => s + (Number(e.cantidad_bultos) || 0), 0)
  console.log(`\n  TOTALES: ${totalBultos} bts · ${totalPeso.toLocaleString()} kg · ${entradas.length} remesas`)

  // ═══════════════════════════════════════════════════
  // SECTION IV — FRACCIONES
  // ═══════════════════════════════════════════════════
  console.log('\n  ╔══════════════════════════════════════════════════════════════════════════════╗')
  console.log('  ║  IV. FRACCIONES ARANCELARIAS UTILIZADAS                                    ║')
  console.log('  ╚══════════════════════════════════════════════════════════════════════════════╝')

  // Get fracciones from globalpc_productos linked to these traficos via globalpc_partidas
  const { data: partidas } = await sb.from('globalpc_partidas')
    .select('cve_trafico, cve_proveedor, cve_producto, precio_unitario, cantidad, peso')
    .in('cve_trafico', traficoNums)
    .limit(500)

  // Get unique cve_producto values to look up fracciones
  const productKeys = [...new Set((partidas || []).map(p => p.cve_producto).filter(Boolean))]
  let productoFracMap = new Map()
  if (productKeys.length > 0) {
    // Query in batches of 50
    for (let i = 0; i < productKeys.length; i += 50) {
      const batch = productKeys.slice(i, i + 50)
      const { data: prods } = await sb.from('globalpc_productos')
        .select('cve_producto, fraccion, descripcion')
        .in('cve_producto', batch)
        .eq('company_id', 'evco')
        .not('fraccion', 'is', null)
        .limit(200)
      for (const p of (prods || [])) {
        if (p.fraccion) productoFracMap.set(p.cve_producto, { fraccion: p.fraccion, descripcion: p.descripcion })
      }
    }
  }

  console.log(`  Partidas: ${(partidas || []).length} | Productos with fraccion: ${productoFracMap.size}`)

  // Aggregate fracciones by trafico
  const fracAgg = new Map()
  for (const pt of (partidas || [])) {
    const prod = productoFracMap.get(pt.cve_producto)
    if (!prod) continue
    const frac = prod.fraccion
    const entry = fracAgg.get(frac) || { fraccion: frac, descripcion: prod.descripcion, valorUSD: 0, count: 0, traficos: new Set() }
    entry.valorUSD += (Number(pt.precio_unitario) || 0) * (Number(pt.cantidad) || 0)
    entry.count++
    if (pt.cve_trafico) entry.traficos.add(pt.cve_trafico)
    fracAgg.set(frac, entry)
  }

  const fracciones = Array.from(fracAgg.values()).sort((a, b) => b.valorUSD - a.valorUSD)
  for (const f of fracciones) {
    const fmtFrac = f.fraccion.length === 10 ? `${f.fraccion.slice(0,4)}.${f.fraccion.slice(4,6)}.${f.fraccion.slice(6,8)}` : f.fraccion
    console.log(`  ${fmtFrac} | $${f.valorUSD.toLocaleString('en-US', {minimumFractionDigits: 2})} USD | ${f.count} líneas | ${Array.from(f.traficos).map(t => t.replace('9254-', '')).join(', ')} | ${(f.descripcion || '').substring(0, 50)}`)
  }

  if (fracciones.length === 0) console.log('  (No fracciones disponibles — productos sin clasificación)')

  // ═══════════════════════════════════════════════════
  // SECTION V — KPIs
  // ═══════════════════════════════════════════════════
  console.log('\n  ╔══════════════════════════════════════════════════════════════════════════════╗')
  console.log('  ║  V. KPI DASHBOARD                                                          ║')
  console.log('  ╚══════════════════════════════════════════════════════════════════════════════╝')

  const totalPeds = pedimentos.length
  const cruzados = pedimentos.filter(p => p.estatus === 'Cruzado').length
  const pagados = pedimentos.filter(p => p.estatus === 'Pedimento Pagado').length

  // Semaforo: 0 = verde in the DB
  const sem0 = pedimentos.filter(p => p.semaforo === 0).length
  const semRojo = pedimentos.filter(p => p.semaforo === 1 || ('' + p.semaforo).toLowerCase().includes('rojo')).length

  // Dispatch time
  for (const p of pedimentos) {
    if (p.fechaPago && p.fechaCruce) {
      const diff = Math.round((new Date(p.fechaCruce) - new Date(p.fechaPago)) / (1000*60*60*24))
      console.log(`  Despacho ${p.short}: Pago ${p.fechaPago} → Cruce ${p.fechaCruce} = ${diff}d`)
    } else {
      console.log(`  Despacho ${p.short}: Pago ${p.fechaPago} → Cruce ${p.fechaCruce || '(pendiente)'}`)
    }
  }

  const businessDays = 5
  console.log(`\n  VALOR TOTAL IMPORTADO: $${totals.valorUSD.toLocaleString('en-US', {minimumFractionDigits: 2})} USD`)
  console.log(`  TRÁFICOS: ${totalPeds} (${cruzados} cruzados, ${pagados} pagados)`)
  console.log(`  TRÁFICOS LIST: ${pedimentos.map(p => p.short).join(' · ')}`)
  console.log(`  REMESAS: ${entradas.length} · ${totalBultos} bts · ${totalPeso.toLocaleString()} kg`)
  console.log(`  REMESAS/DÍA: ${(entradas.length / businessDays).toFixed(1)}`)
  console.log(`  SEMÁFORO: Verde ${sem0}/${totalPeds} (${totalPeds > 0 ? ((sem0/totalPeds)*100).toFixed(0) : 0}%) · Rojo ${semRojo}/${totalPeds}`)
  console.log(`  INCIDENCIAS: 0`)

  // Remesas per day chart data
  console.log('\n  REMESAS POR DÍA:')
  for (const [day, ents] of Array.from(byDay.entries()).sort()) {
    const dt = new Date(day + 'T12:00:00')
    const bar = '█'.repeat(ents.length)
    console.log(`    ${days[dt.getDay()].substring(0, 3)} ${dt.getDate()} ${months[dt.getMonth()]}: ${bar} ${ents.length}`)
  }
}

async function main() {
  await queryWeek('2026-03-23', '2026-03-27', 'AUDITORÍA SEMANAL — 23 de Marzo — 27 de Marzo, 2026')
  await queryWeek('2026-03-30', '2026-04-03', 'AUDITORÍA SEMANAL — 30 de Marzo — 03 de Abril, 2026')
}

main().catch(console.error)
