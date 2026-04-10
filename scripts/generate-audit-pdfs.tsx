#!/usr/bin/env npx tsx
/**
 * Generate Auditoría Semanal PDFs for EVCO — standalone script
 * Weeks: March 23-27 and March 30-April 3, 2026
 */
import * as dotenv from 'dotenv'
dotenv.config({ path: new URL('../.env.local', import.meta.url).pathname })
import { createClient } from '@supabase/supabase-js'
import { renderToBuffer } from '@react-pdf/renderer'
import * as fs from 'fs'
import * as path from 'path'

// Import the PDF component with tsx handling the JSX
import { AuditoriaPDF } from '../src/app/api/auditoria-pdf/pdf-document'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const COMPANY_ID = 'evco'
const CLIENT_NAME = 'EVCO PLASTICS DE MEXICO S. DE R.L. DE C.V.'
const CLIENT_CLAVE = '9254'
const CLIENT_RFC = 'EPM001109I74'

// Transport code resolution
const TRANS_MX: Record<string, string> = {
  'TRANS_MEX_584': 'TEXAS CARRIER', 'TRANS_MEX_593': 'DX BORDER FREIGHT', '5': 'TEXAS CARRIER',
}
const TRANS_EXT: Record<string, string> = {
  '1': 'CUSTOMER TRUCK', '2': 'UPS', '3': 'FED-EX',
  'TRANS_EXT_46': 'CUSTOMER TRUCK', 'TRANS_EXT_38': 'STAGECOACH', 'TRANS_EXT_37': 'STAGECOACH',
  'TRANS_EXT_86': 'CUSTOMER TRUCK', 'TRANS_EXT_11': 'FED-EX', '108': 'CUSTOMER TRUCK',
}

interface ReportOpts {
  reportTitle?: string
  reportSubtitle?: string
}

async function generateWeekPDF(from: string, to: string, label: string, opts?: ReportOpts) {
  console.log(`\nGenerating: ${label}`)

  // 1. Traficos by fecha_pago
  const { data: traficos } = await supabase
    .from('traficos')
    .select('trafico, pedimento, regimen, estatus, importe_total, fecha_llegada, fecha_cruce, fecha_pago, transportista_mexicano, transportista_extranjero, descripcion_mercancia, semaforo, tipo_cambio, peso_bruto')
    .eq('company_id', COMPANY_ID)
    .gte('fecha_pago', from)
    .lte('fecha_pago', to + 'T23:59:59')
    .order('fecha_pago', { ascending: true })
    .limit(200)

  if (!traficos?.length) {
    console.log('  No traficos found.')
    return
  }

  const traficoNums = traficos.map(t => t.trafico)
  const pedNums = traficos.map(t => t.pedimento).filter(Boolean)

  // 2. Parallel queries
  const [gpFactRes, entRes, provRes, aduaRes] = await Promise.all([
    supabase.from('globalpc_facturas')
      .select('cve_trafico, cve_proveedor, numero, incoterm, moneda, valor_comercial, flete, seguros, embalajes, incrementables, cove_vucem')
      .in('cve_trafico', traficoNums).limit(500),
    supabase.from('entradas')
      .select('cve_entrada, fecha_llegada_mercancia, descripcion_mercancia, num_pedido, cantidad_bultos, peso_bruto, trafico, cve_proveedor')
      .eq('company_id', COMPANY_ID)
      .gte('fecha_llegada_mercancia', from).lte('fecha_llegada_mercancia', to + 'T23:59:59')
      .order('fecha_llegada_mercancia', { ascending: true }).limit(500),
    // Placeholder for proveedores - will query after we know which codes we need
    Promise.resolve({ data: [] }),
    pedNums.length > 0
      ? supabase.from('aduanet_facturas')
          .select('pedimento, referencia, dta, igi, iva, valor_usd, tipo_cambio, cve_documento, proveedor, cove, num_factura, fecha_pago')
          .in('pedimento', pedNums).limit(500)
      : Promise.resolve({ data: [] as any[] }),
  ])

  const gpFacturas = gpFactRes.data ?? []
  const entradas = entRes.data ?? []
  const aduaFacturas = (aduaRes.data ?? []) as any[]

  // Collect all unique cve_proveedor codes from facturas and entradas
  const allProvCodes = new Set<string>()
  for (const f of gpFacturas) if (f.cve_proveedor) allProvCodes.add(f.cve_proveedor)
  for (const e of entradas) if (e.cve_proveedor) allProvCodes.add(e.cve_proveedor)

  // Query proveedores by specific codes (avoids Supabase 1000-row limit)
  const provLookup = new Map<string, string>()
  const provCodes = Array.from(allProvCodes)
  for (let i = 0; i < provCodes.length; i += 50) {
    const batch = provCodes.slice(i, i + 50)
    const { data: provBatch } = await supabase
      .from('globalpc_proveedores')
      .select('cve_proveedor, nombre')
      .in('cve_proveedor', batch)
      .limit(200)
    for (const p of (provBatch ?? [])) {
      if (p.cve_proveedor && p.nombre) provLookup.set(p.cve_proveedor, p.nombre.trim())
    }
  }

  console.log(`  Tráficos: ${traficos.length}, GP Facturas: ${gpFacturas.length}, Entradas: ${entradas.length}, Aduanet: ${aduaFacturas.length}, Proveedores: ${provLookup.size}/${allProvCodes.size}`)

  // Build pedimento summaries
  const pedimentos: Array<{
    trafico: string; pedimento: string; clave: string; regimen: string
    fechaPago: string | null; fechaCruce: string | null; tc: number; valorUSD: number
    dtaMXN: number; igiMXN: number; ivaMXN: number; totalGravamen: number
    estatus: string; transpMX: string; transpExt: string
    gpFacts: typeof gpFacturas; aduaFacts: typeof aduaFacturas
  }> = []

  for (const t of traficos) {
    if (!t.pedimento) continue
    const gpFacts = gpFacturas.filter(f => f.cve_trafico === t.trafico)
    const valorUSD = Number(t.importe_total) || gpFacts.reduce((s, f) => s + (Number(f.valor_comercial) || 0), 0)
    const tc = Number(t.tipo_cambio) || 0
    const reg = (t.regimen || '').toUpperCase()
    const claveReg = (reg === 'ITE' || reg === 'ITR') ? 'IN' : 'A1'
    const regimenLabel = (reg === 'ITE' || reg === 'ITR') ? 'Importación' : 'Imp. Definitiva'

    const pedAduaFacts = aduaFacturas.filter(f => f.pedimento === t.pedimento)
    const dtaMXN = pedAduaFacts.reduce((s: number, f: any) => s + (Number(f.dta) || 0), 0)
    const igiMXN = pedAduaFacts.reduce((s: number, f: any) => s + (Number(f.igi) || 0), 0)
    const ivaMXN = pedAduaFacts.reduce((s: number, f: any) => s + (Number(f.iva) || 0), 0)

    pedimentos.push({
      trafico: t.trafico, pedimento: t.pedimento, clave: claveReg, regimen: regimenLabel,
      fechaPago: t.fecha_pago ? t.fecha_pago.split('T')[0] : null,
      fechaCruce: t.fecha_cruce ? t.fecha_cruce.split('T')[0] : null,
      tc, valorUSD, dtaMXN, igiMXN, ivaMXN, totalGravamen: dtaMXN + igiMXN + ivaMXN,
      estatus: t.estatus || '', transpMX: TRANS_MX[t.transportista_mexicano || ''] || t.transportista_mexicano || '',
      transpExt: TRANS_EXT[t.transportista_extranjero || ''] || t.transportista_extranjero || '',
      gpFacts, aduaFacts: pedAduaFacts,
    })
  }

  const totalValorUSD = pedimentos.reduce((s, p) => s + p.valorUSD, 0)
  const totalDTA = pedimentos.reduce((s, p) => s + p.dtaMXN, 0)
  const totalIGI = pedimentos.reduce((s, p) => s + p.igiMXN, 0)
  const totalIVA = pedimentos.reduce((s, p) => s + p.ivaMXN, 0)
  const totalGravamen = pedimentos.reduce((s, p) => s + p.totalGravamen, 0)

  // Entradas by day
  const entradasByDay = new Map<string, typeof entradas>()
  for (const e of entradas) {
    const day = (e.fecha_llegada_mercancia || '').split('T')[0]
    if (!entradasByDay.has(day)) entradasByDay.set(day, [])
    entradasByDay.get(day)!.push(e)
  }

  // Format helpers
  const fmtEs = (d: string) => {
    const months = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
    const dt = new Date(d + 'T12:00:00')
    return `${String(dt.getDate()).padStart(2, '0')} de ${months[dt.getMonth()]}, ${dt.getFullYear()}`
  }
  const fmtShort = (d: string) => {
    const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
    const dt = new Date(d + 'T12:00:00')
    return `${dt.getDate()} ${months[dt.getMonth()]} ${dt.getFullYear()}`
  }

  const traficosListStr = pedimentos.map(p => p.trafico.replace(/^\d+-/, '')).join(' · ')
  const totalPeso = entradas.reduce((s, e) => s + (Number(e.peso_bruto) || 0), 0)
  const totalBultos = entradas.reduce((s, e) => s + (Number(e.cantidad_bultos) || 0), 0)

  // Supplier detail
  const supplierDetail = pedimentos.map(ped => {
    const header = `${ped.trafico} · Pedimento ${ped.pedimento} · ${ped.gpFacts.length} líneas · ${ped.transpMX} / ${ped.transpExt}`
    const rows = ped.gpFacts.map(f => ({
      trafico: ped.trafico, pedimento: ped.pedimento,
      fechaPago: ped.fechaPago || '', fechaCruce: ped.fechaCruce || '',
      proveedor: provLookup.get(f.cve_proveedor || '') || f.cve_proveedor || '',
      factura: f.numero || '', cove: f.cove_vucem || '',
      valorUSD: Number(f.valor_comercial) || 0,
      transpMX: ped.transpMX, transpExt: ped.transpExt, estatus: 'OK',
    }))
    return { pedimentoHeader: header, rows }
  })

  const data = {
    from, to,
    dateRangeLabel: `${fmtShort(from)} – ${fmtShort(to)}`,
    dateRangeLong: `${fmtEs(from)} — ${fmtEs(to)}`,
    reportTitle: opts?.reportTitle,
    reportSubtitle: opts?.reportSubtitle,
    clientName: CLIENT_NAME, clientClave: CLIENT_CLAVE, clientRFC: CLIENT_RFC,
    emittedDate: fmtEs(new Date().toISOString().split('T')[0]),
    totalValorUSD, pedimentoCount: pedimentos.length, traficosListStr,
    remesaCount: entradas.length, totalPeso, totalBultos, incidencias: 0,
    pedimentos: pedimentos.map(p => ({
      trafico: p.trafico, pedimento: p.pedimento, clave: p.clave, regimen: p.regimen,
      fechaPago: p.fechaPago, tc: p.tc, valorUSD: p.valorUSD,
      dtaMXN: p.dtaMXN, igiMXN: p.igiMXN, ivaMXN: p.ivaMXN,
      totalGravamen: p.totalGravamen, estatus: p.estatus,
    })),
    totalDTA, totalIGI, totalIVA, totalGravamen,
    supplierDetail,
    entradasByDay: Array.from(entradasByDay.entries()).sort().map(([day, ents]) => ({ day, entradas: ents })),
    fracciones: [],
  }

  console.log(`  Rendering PDF...`)
  const buffer = await renderToBuffer(AuditoriaPDF({ data }))
  const uint8 = new Uint8Array(buffer)

  const outDir = path.resolve(__dirname, '../output')
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true })

  const filename = `AUDITORIA_${CLIENT_CLAVE}_${from}_${to}.pdf`
  const outPath = path.join(outDir, filename)
  fs.writeFileSync(outPath, uint8)
  console.log(`  ✅ Saved: ${outPath} (${(uint8.length / 1024).toFixed(0)} KB)`)
}

async function main() {
  await generateWeekPDF('2026-03-23', '2026-03-27', 'Semana Mar 23–27, 2026')
  await generateWeekPDF('2026-03-30', '2026-04-03', 'Semana Mar 30–Abr 3, 2026')
  await generateWeekPDF('2026-03-01', '2026-03-31', 'Mes de Marzo 2026', {
    reportTitle: 'AUDITORÍA MENSUAL',
    reportSubtitle: 'Reporte de Embarques — Marzo 2026',
  })
  console.log('\nDone!')
  process.exit(0)
}

main().catch(err => { console.error(err); process.exit(1) })
