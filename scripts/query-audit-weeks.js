#!/usr/bin/env node
/**
 * Query data for two weekly audit reports (March 23-27 and March 30 - April 3, 2026)
 * for EVCO Plastics (clave 9254, company_id evco)
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

  // Parallel queries
  const [trafRes, factRes, entRes, provRes] = await Promise.all([
    supabase
      .from('traficos')
      .select('trafico, pedimento, regimen, estatus, importe_total, moneda, fecha_llegada, fecha_cruce, fecha_pago, transportista_mexicano, transportista_extranjero, proveedor, descripcion_mercancia, semaforo, fraccion_arancelaria, tipo_cambio, peso_bruto')
      .eq('company_id', COMPANY_ID)
      .gte('fecha_llegada', from)
      .lte('fecha_llegada', to + 'T23:59:59')
      .order('fecha_llegada', { ascending: true })
      .limit(200),

    supabase
      .from('aduanet_facturas')
      .select('pedimento, valor_usd, igi, dta, iva, proveedor, cove, factura, fecha_pago, num_factura')
      .eq('clave_cliente', CLIENT_CLAVE)
      .gte('fecha_pago', from)
      .lte('fecha_pago', to + 'T23:59:59')
      .limit(500),

    supabase
      .from('entradas')
      .select('cve_entrada, fecha_llegada_mercancia, descripcion_mercancia, num_pedido, cantidad_bultos, peso_bruto, trafico, proveedor, cve_proveedor')
      .eq('company_id', COMPANY_ID)
      .gte('fecha_llegada_mercancia', from)
      .lte('fecha_llegada_mercancia', to + 'T23:59:59')
      .order('fecha_llegada_mercancia', { ascending: true })
      .limit(500),

    supabase
      .from('globalpc_proveedores')
      .select('cve_proveedor, nombre')
      .eq('company_id', COMPANY_ID)
      .limit(1000),
  ])

  if (trafRes.error) console.error('Traficos error:', trafRes.error.message)
  if (factRes.error) console.error('Facturas error:', factRes.error.message)
  if (entRes.error) console.error('Entradas error:', entRes.error.message)
  if (provRes.error) console.error('Proveedores error:', provRes.error.message)

  const traficos = trafRes.data ?? []
  const facturas = factRes.data ?? []
  const entradas = entRes.data ?? []
  const proveedores = provRes.data ?? []

  // Build supplier lookup
  const provLookup = new Map()
  for (const p of proveedores) {
    if (p.cve_proveedor && p.nombre) provLookup.set(p.cve_proveedor, p.nombre.trim())
  }

  console.log(`\nTráficos found: ${traficos.length}`)
  console.log(`Facturas found: ${facturas.length}`)
  console.log(`Entradas found: ${entradas.length}`)
  console.log(`Proveedores loaded: ${provLookup.size}`)

  // ── Section I: Pedimento financial summary ──
  console.log('\n── I. RESUMEN FINANCIERO DE PEDIMENTOS ──')
  const pedimentoMap = new Map()
  for (const t of traficos) {
    if (!t.pedimento) continue
    const pedFacturas = facturas.filter(f => f.pedimento === t.pedimento)
    const valorUSD = Number(t.importe_total) || pedFacturas.reduce((s, f) => s + (Number(f.valor_usd) || 0), 0)
    const dtaMXN = pedFacturas.reduce((s, f) => s + (Number(f.dta) || 0), 0)
    const igiMXN = pedFacturas.reduce((s, f) => s + (Number(f.igi) || 0), 0)
    const ivaMXN = pedFacturas.reduce((s, f) => s + (Number(f.iva) || 0), 0)
    const tc = Number(t.tipo_cambio) || 0
    const reg = (t.regimen || '').toUpperCase()
    const claveReg = reg === 'ITE' || reg === 'ITR' ? 'IN' : reg === 'IMD' ? 'IN' : 'A1'
    const regimenLabel = reg === 'A1' ? 'Imp. Definitiva' : (reg === 'ITE' || reg === 'ITR') ? 'Importación' : reg || 'N/A'

    // Extract trafico short name (Y4353 part from 9254-Y4353)
    const traficoShort = t.trafico.includes('-') ? t.trafico.split('-').pop() : t.trafico

    pedimentoMap.set(t.pedimento, {
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
      facturas: pedFacturas,
    })
  }

  const pedimentos = Array.from(pedimentoMap.values())
  for (const p of pedimentos) {
    console.log(`  ${p.trafico} | Ped: ${p.pedimento} | ${p.clave} ${p.regimen} | ${p.fechaPago} | T/C: ${p.tc} | $${p.valorUSD.toLocaleString()} USD | DTA: $${p.dtaMXN.toLocaleString()} | IGI: $${p.igiMXN.toLocaleString()} | IVA: $${p.ivaMXN.toLocaleString()} | Total: $${p.totalGravamen.toLocaleString()} | ${p.estatus} | Semáforo: ${p.semaforo}`)
  }

  const totalValorUSD = pedimentos.reduce((s, p) => s + p.valorUSD, 0)
  const totalDTA = pedimentos.reduce((s, p) => s + p.dtaMXN, 0)
  const totalIGI = pedimentos.reduce((s, p) => s + p.igiMXN, 0)
  const totalIVA = pedimentos.reduce((s, p) => s + p.ivaMXN, 0)
  const totalGravamen = pedimentos.reduce((s, p) => s + p.totalGravamen, 0)
  console.log(`  TOTALES: $${totalValorUSD.toLocaleString()} USD | DTA: $${totalDTA.toLocaleString()} | IGI: $${totalIGI.toLocaleString()} | IVA: $${totalIVA.toLocaleString()} | Total Gravamen: $${totalGravamen.toLocaleString()}`)

  // ── Section II: Proveedor detail ──
  console.log('\n── II. DETALLE POR PROVEEDOR ──')
  for (const p of pedimentos) {
    const lineCount = p.facturas.length
    console.log(`\n  ${p.trafico} · Pedimento ${p.pedimento} · ${lineCount} líneas · ${p.transpMX} / ${p.transpExt}`)
    for (const f of p.facturas) {
      const provName = provLookup.get(f.proveedor) || f.proveedor || 'N/A'
      console.log(`    PRV: ${provName} | Factura: ${f.factura || f.num_factura || 'N/A'} | COVE: ${f.cove || 'N/A'} | $${Number(f.valor_usd || 0).toLocaleString()} USD`)
    }
  }

  // ── Section III: Remesas (Entradas) by day ──
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
    const dayNum = dt.getDate()
    const monthNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
    const monthName = monthNames[dt.getMonth()]
    console.log(`\n  ${dayName} ${dayNum} ${monthName} — ${ents.length} remesas`)
    for (const e of ents) {
      remesaNum++
      const provName = provLookup.get(e.cve_proveedor) || e.proveedor || e.cve_proveedor || ''
      console.log(`    ${String(remesaNum).padStart(2, '0')} | ${e.cve_entrada} | ${(e.descripcion_mercancia || '').substring(0, 50)} | Pedido: ${e.num_pedido || 'N/A'} | ${e.cantidad_bultos || 0} bts | ${Number(e.peso_bruto || 0).toLocaleString()} kg | PRV: ${provName}`)
    }
  }
  console.log(`\n  TOTALES: ${totalBultos} bts · ${totalPeso.toLocaleString()} kg · ${entradas.length} remesas`)

  // ── Section IV: Fracciones ──
  console.log('\n── IV. FRACCIONES ARANCELARIAS ──')
  const fraccionMap = new Map()
  for (const t of traficos) {
    if (!t.fraccion_arancelaria) continue
    const f = fraccionMap.get(t.fraccion_arancelaria) || { fraccion: t.fraccion_arancelaria, valorUSD: 0, count: 0, pedimentos: [] }
    f.valorUSD += Number(t.importe_total) || 0
    f.count++
    if (t.pedimento) f.pedimentos.push(`${t.pedimento} — ${t.trafico}`)
    fraccionMap.set(t.fraccion_arancelaria, f)
  }
  const fracciones = Array.from(fraccionMap.values()).sort((a, b) => b.valorUSD - a.valorUSD)
  for (const f of fracciones) {
    const pct = totalValorUSD > 0 ? ((f.valorUSD / totalValorUSD) * 100).toFixed(1) : '0.0'
    console.log(`  ${f.fraccion} | $${f.valorUSD.toLocaleString()} USD | ${pct}% | ${f.count} uso(s) | ${f.pedimentos.join(', ')}`)
  }

  // ── Section V: KPIs ──
  console.log('\n── V. KPI DASHBOARD ──')

  // Dispatch time
  const dispatchTimes = pedimentos.map(p => {
    if (p.fechaPago && p.fechaCruce) {
      const pago = new Date(p.fechaPago)
      const cruce = new Date(p.fechaCruce)
      return Math.max(0, Math.round((cruce - pago) / (1000 * 60 * 60 * 24)))
    }
    return null
  }).filter(d => d !== null)
  const avgDispatch = dispatchTimes.length > 0 ? (dispatchTimes.reduce((a, b) => a + b, 0) / dispatchTimes.length).toFixed(1) : 'N/A'

  // Semaforo
  const totalPeds = pedimentos.length
  const verdes = pedimentos.filter(p => (p.semaforo || '').toLowerCase().includes('verde')).length
  const rojos = pedimentos.filter(p => (p.semaforo || '').toLowerCase().includes('rojo')).length

  const businessDays = 5
  const remesasPerDay = entradas.length > 0 ? (entradas.length / businessDays).toFixed(1) : '0'

  console.log(`  Tiempo promedio despacho: ${avgDispatch} días`)
  console.log(`  Semáforo: Verde ${verdes}/${totalPeds} (${totalPeds > 0 ? ((verdes / totalPeds) * 100).toFixed(0) : 0}%) · Rojo ${rojos}/${totalPeds}`)
  console.log(`  Remesas/día: ${remesasPerDay} (${entradas.length} remesas / ${businessDays} días)`)
  console.log(`  Peso total: ${totalPeso.toLocaleString()} kg`)
  console.log(`  Pedimentos: ${totalPeds}`)
  console.log(`  Valor total importado: $${totalValorUSD.toLocaleString()} USD`)

  // Also check for fecha_pago-based traficos (some may use fecha_pago instead of fecha_llegada)
  console.log('\n── CROSS-CHECK: Traficos by fecha_pago ──')
  const { data: trafByPago } = await supabase
    .from('traficos')
    .select('trafico, pedimento, fecha_pago, fecha_cruce, fecha_llegada, importe_total, estatus')
    .eq('company_id', COMPANY_ID)
    .gte('fecha_pago', from)
    .lte('fecha_pago', to + 'T23:59:59')
    .order('fecha_pago', { ascending: true })
    .limit(200)

  console.log(`  Traficos by fecha_pago: ${(trafByPago || []).length}`)
  for (const t of (trafByPago || [])) {
    console.log(`    ${t.trafico} | Ped: ${t.pedimento} | Pago: ${(t.fecha_pago || '').split('T')[0]} | Cruce: ${(t.fecha_cruce || '').split('T')[0]} | Llegada: ${(t.fecha_llegada || '').split('T')[0]} | $${Number(t.importe_total || 0).toLocaleString()} | ${t.estatus}`)
  }

  // Also check entradas by a broader range in case they cross weekends
  console.log('\n── CROSS-CHECK: Facturas by fecha_pago ──')
  for (const f of facturas) {
    const provName = provLookup.get(f.proveedor) || f.proveedor || 'N/A'
    console.log(`    Ped: ${f.pedimento} | PRV: ${provName} | Fac: ${f.factura || f.num_factura || 'N/A'} | COVE: ${f.cove || 'N/A'} | $${Number(f.valor_usd || 0).toLocaleString()} USD | DTA: ${f.dta} | IGI: ${f.igi} | IVA: ${f.iva}`)
  }

  return { traficos, facturas, entradas, pedimentos, fracciones, totalValorUSD, totalPeso, totalBultos }
}

async function main() {
  try {
    // Week 1: March 23-27, 2026
    const w1 = await queryWeek('2026-03-23', '2026-03-27', 'Marzo 23–27, 2026')

    // Week 2: March 30 - April 3, 2026
    const w2 = await queryWeek('2026-03-30', '2026-04-03', 'Marzo 30 – Abril 3, 2026')

    // If both weeks are empty, try fecha_cruce range for the whole month
    if (w1.traficos.length === 0 && w2.traficos.length === 0) {
      console.log('\n\n⚠️  Both weeks empty by fecha_llegada. Trying fecha_cruce for full March...')
      const { data: marchTraf } = await supabase
        .from('traficos')
        .select('trafico, pedimento, fecha_pago, fecha_cruce, fecha_llegada, importe_total, estatus, regimen')
        .eq('company_id', COMPANY_ID)
        .gte('fecha_cruce', '2026-03-01')
        .lte('fecha_cruce', '2026-03-31T23:59:59')
        .order('fecha_cruce', { ascending: true })
        .limit(200)

      console.log(`Traficos by fecha_cruce in March: ${(marchTraf || []).length}`)
      for (const t of (marchTraf || [])) {
        console.log(`  ${t.trafico} | Ped: ${t.pedimento} | Cruce: ${(t.fecha_cruce || '').split('T')[0]} | Pago: ${(t.fecha_pago || '').split('T')[0]} | Llegada: ${(t.fecha_llegada || '').split('T')[0]} | $${Number(t.importe_total || 0).toLocaleString()} | ${t.estatus} | ${t.regimen}`)
      }

      // Also try full March entradas
      const { data: marchEnt } = await supabase
        .from('entradas')
        .select('cve_entrada, fecha_llegada_mercancia, descripcion_mercancia, num_pedido, cantidad_bultos, peso_bruto, trafico')
        .eq('company_id', COMPANY_ID)
        .gte('fecha_llegada_mercancia', '2026-03-01')
        .lte('fecha_llegada_mercancia', '2026-03-31T23:59:59')
        .order('fecha_llegada_mercancia', { ascending: true })
        .limit(500)

      console.log(`\nEntradas in March: ${(marchEnt || []).length}`)
      for (const e of (marchEnt || []).slice(0, 30)) {
        console.log(`  ${e.cve_entrada} | ${(e.fecha_llegada_mercancia || '').split('T')[0]} | ${(e.descripcion_mercancia || '').substring(0, 40)} | ${e.trafico}`)
      }
      if ((marchEnt || []).length > 30) console.log(`  ... and ${(marchEnt || []).length - 30} more`)

      // Check facturas too
      const { data: marchFact } = await supabase
        .from('aduanet_facturas')
        .select('pedimento, valor_usd, fecha_pago, proveedor, dta, igi, iva, cove')
        .eq('clave_cliente', CLIENT_CLAVE)
        .gte('fecha_pago', '2026-03-01')
        .lte('fecha_pago', '2026-03-31T23:59:59')
        .limit(500)

      console.log(`\nFacturas in March: ${(marchFact || []).length}`)
      for (const f of (marchFact || []).slice(0, 20)) {
        console.log(`  Ped: ${f.pedimento} | $${Number(f.valor_usd || 0).toLocaleString()} | Pago: ${(f.fecha_pago || '').split('T')[0]} | DTA: ${f.dta} | IGI: ${f.igi} | IVA: ${f.iva}`)
      }
    }

    console.log('\n\nDone.')
  } catch (err) {
    console.error('Fatal error:', err)
    process.exit(1)
  }
}

main()
