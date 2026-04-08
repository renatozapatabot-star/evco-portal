import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { renderToBuffer } from '@react-pdf/renderer'
import { verifySession } from '@/lib/session'
import { AuditoriaPDF } from './pdf-document'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Transport code resolution (known from historical data)
const TRANS_MX: Record<string, string> = {
  'TRANS_MEX_584': 'TEXAS CARRIER',
  'TRANS_MEX_593': 'DX BORDER FREIGHT',
  '5': 'TEXAS CARRIER',
}
const TRANS_EXT: Record<string, string> = {
  '1': 'CUSTOMER TRUCK',
  '2': 'UPS',
  '3': 'FED-EX',
  'TRANS_EXT_46': 'CUSTOMER TRUCK',
  'TRANS_EXT_38': 'STAGECOACH',
  'TRANS_EXT_37': 'STAGECOACH',
  'TRANS_EXT_86': 'CUSTOMER TRUCK',
  'TRANS_EXT_11': 'FED-EX',
  '108': 'CUSTOMER TRUCK',
}

/**
 * GET /api/auditoria-pdf?from=2026-03-23&to=2026-03-27
 *
 * Generates the dark-themed "Auditoría Semanal" PDF.
 * Queries by fecha_pago. Uses globalpc_facturas for per-invoice detail.
 */
export async function GET(request: NextRequest) {
  const session = await verifySession(request.cookies.get('portal_session')?.value || '')
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const companyId = session.companyId
  const rawName = request.cookies.get('company_name')?.value
  const clientName = rawName ? decodeURIComponent(rawName) : companyId.toUpperCase()
  const clientClave = request.cookies.get('company_clave')?.value ?? ''
  const clientRFC = request.cookies.get('company_rfc')?.value ?? ''

  const from = request.nextUrl.searchParams.get('from')
  const to = request.nextUrl.searchParams.get('to')

  if (!from || !to) {
    return NextResponse.json({ error: 'Parámetros from y to requeridos (YYYY-MM-DD)' }, { status: 400 })
  }

  try {
    // 1. Traficos by fecha_pago (anchor for weekly audit)
    const { data: traficosRaw } = await supabase
      .from('traficos')
      .select('trafico, pedimento, regimen, estatus, importe_total, fecha_llegada, fecha_cruce, fecha_pago, transportista_mexicano, transportista_extranjero, descripcion_mercancia, semaforo, tipo_cambio, peso_bruto')
      .eq('company_id', companyId)
      .gte('fecha_pago', from)
      .lte('fecha_pago', to + 'T23:59:59')
      .order('fecha_pago', { ascending: true })
      .limit(200)

    const traficos = traficosRaw ?? []
    const traficoNums = traficos.map(t => t.trafico)
    const pedNums = traficos.map(t => t.pedimento).filter(Boolean)

    // 2. Parallel: globalpc_facturas, entradas, proveedores, aduanet_facturas
    const [gpFactRes, entRes, provRes, aduaRes] = await Promise.all([
      traficoNums.length > 0
        ? supabase
            .from('globalpc_facturas')
            .select('cve_trafico, cve_proveedor, numero, incoterm, moneda, valor_comercial, flete, seguros, embalajes, incrementables, cove_vucem')
            .in('cve_trafico', traficoNums)
            .limit(500)
        : Promise.resolve({ data: [] }),

      supabase
        .from('entradas')
        .select('cve_entrada, fecha_llegada_mercancia, descripcion_mercancia, num_pedido, cantidad_bultos, peso_bruto, trafico, cve_proveedor')
        .eq('company_id', companyId)
        .gte('fecha_llegada_mercancia', from)
        .lte('fecha_llegada_mercancia', to + 'T23:59:59')
        .order('fecha_llegada_mercancia', { ascending: true })
        .limit(500),

      // Placeholder - proveedores queried after facturas load
      Promise.resolve({ data: [] }),

      pedNums.length > 0
        ? supabase
            .from('aduanet_facturas')
            .select('pedimento, referencia, dta, igi, iva, valor_usd, tipo_cambio, cve_documento, proveedor, cove, num_factura, fecha_pago')
            .in('pedimento', pedNums)
            .limit(500)
        : Promise.resolve({ data: [] }),
    ])

    const gpFacturas = gpFactRes.data ?? []
    const entradas = entRes.data ?? []
    const aduaFacturas = aduaRes.data ?? []

    // Collect unique proveedor codes, then batch-query names (avoids 1000-row limit)
    const allProvCodes = new Set<string>()
    for (const f of gpFacturas) if (f.cve_proveedor) allProvCodes.add(f.cve_proveedor)
    for (const e of entradas) if (e.cve_proveedor) allProvCodes.add(e.cve_proveedor)

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

    // Aduanet facturas by pedimento (aggregated tax data)
    const aduaByPed = new Map<string, { dta: number; igi: number; iva: number }>()
    for (const a of aduaFacturas) {
      const existing = aduaByPed.get(a.pedimento) || { dta: 0, igi: 0, iva: 0 }
      existing.dta += Number(a.dta) || 0
      existing.igi += Number(a.igi) || 0
      existing.iva += Number(a.iva) || 0
      aduaByPed.set(a.pedimento, existing)
    }

    // Build pedimento summaries
    const pedimentoMap = new Map<string, {
      trafico: string; pedimento: string; clave: string; regimen: string
      fechaPago: string | null; fechaCruce: string | null; tc: number; valorUSD: number
      dtaMXN: number; igiMXN: number; ivaMXN: number; totalGravamen: number
      estatus: string; transpMX: string; transpExt: string
      gpFacturas: typeof gpFacturas; aduaFacturas: typeof aduaFacturas
    }>()

    for (const t of traficos) {
      if (!t.pedimento) continue
      const gpFacts = gpFacturas.filter(f => f.cve_trafico === t.trafico)

      // Value: prefer importe_total, fallback to summing globalpc_facturas
      const valorUSD = Number(t.importe_total) || gpFacts.reduce((s, f) => s + (Number(f.valor_comercial) || 0), 0)
      const tc = Number(t.tipo_cambio) || 17.5
      const reg = (t.regimen || '').toUpperCase()
      const claveReg = reg === 'ITE' || reg === 'ITR' ? 'IN' : 'A1'
      const regimenLabel = (reg === 'ITE' || reg === 'ITR') ? 'Importación' : reg === 'IMD' ? 'Imp. Definitiva' : 'Imp. Definitiva'

      // Tax data from aduanet (may be empty for recent pedimentos)
      const adua = aduaByPed.get(t.pedimento)
      const dtaMXN = adua?.dta || 0
      const igiMXN = adua?.igi || 0
      const ivaMXN = adua?.iva || 0

      const transpMX = TRANS_MX[t.transportista_mexicano || ''] || t.transportista_mexicano || ''
      const transpExt = TRANS_EXT[t.transportista_extranjero || ''] || t.transportista_extranjero || ''

      const pedAduaFacts = aduaFacturas.filter(f => f.pedimento === t.pedimento)

      pedimentoMap.set(t.pedimento, {
        trafico: t.trafico,
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
        transpMX,
        transpExt,
        gpFacturas: gpFacts,
        aduaFacturas: pedAduaFacts,
      })
    }

    const pedimentos = Array.from(pedimentoMap.values())

    // Totals
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

    // Format dates
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

    // Supplier detail (grouped by pedimento)
    // Prefer aduanet_facturas (has tax data, proveedor as name), fallback to globalpc_facturas
    const supplierDetail: Array<{
      pedimentoHeader: string
      rows: Array<{
        trafico: string; pedimento: string; fechaPago: string; fechaCruce: string
        proveedor: string; factura: string; cove: string; valorUSD: number
        transpMX: string; transpExt: string; estatus: string
      }>
    }> = []

    for (const ped of pedimentos) {
      const header = `${ped.trafico} · Pedimento ${ped.pedimento} · ${ped.gpFacturas.length} líneas · ${ped.transpMX} / ${ped.transpExt}`

      let rows: Array<{
        trafico: string; pedimento: string; fechaPago: string; fechaCruce: string
        proveedor: string; factura: string; cove: string; valorUSD: number
        transpMX: string; transpExt: string; estatus: string
      }>

      if (ped.aduaFacturas.length > 0) {
        // Use aduanet_facturas (proveedor is already a name)
        rows = ped.aduaFacturas.map(f => ({
          trafico: ped.trafico,
          pedimento: ped.pedimento,
          fechaPago: ped.fechaPago || '',
          fechaCruce: ped.fechaCruce || '',
          proveedor: f.proveedor || '',
          factura: f.num_factura || '',
          cove: f.cove || '',
          valorUSD: Number(f.valor_usd) || 0,
          transpMX: ped.transpMX,
          transpExt: ped.transpExt,
          estatus: 'OK',
        }))
      } else {
        // Fallback to globalpc_facturas (proveedor is a code, needs resolution)
        rows = ped.gpFacturas.map(f => ({
          trafico: ped.trafico,
          pedimento: ped.pedimento,
          fechaPago: ped.fechaPago || '',
          fechaCruce: ped.fechaCruce || '',
          proveedor: provLookup.get(f.cve_proveedor || '') || f.cve_proveedor || '',
          factura: f.numero || '',
          cove: f.cove_vucem || '',
          valorUSD: Number(f.valor_comercial) || 0,
          transpMX: ped.transpMX,
          transpExt: ped.transpExt,
          estatus: 'OK',
        }))
      }

      supplierDetail.push({ pedimentoHeader: header, rows })
    }

    // Fracciones: not available for most recent traficos (would need globalpc_productos join)
    // Aggregate from aduanet_facturas cve_documento for regime classification
    const fracciones: Array<{ fraccion: string; valorUSD: number; count: number; pedimentos: string[] }> = []

    const data = {
      from,
      to,
      dateRangeLabel: `${fmtShort(from)} – ${fmtShort(to)}`,
      dateRangeLong: `${fmtEs(from)} — ${fmtEs(to)}`,
      clientName,
      clientClave,
      clientRFC,
      emittedDate: fmtEs(new Date().toISOString().split('T')[0]),
      totalValorUSD,
      pedimentoCount: pedimentos.length,
      traficosListStr,
      remesaCount: entradas.length,
      totalPeso,
      totalBultos,
      incidencias: 0,
      pedimentos: pedimentos.map(p => ({
        trafico: p.trafico,
        pedimento: p.pedimento,
        clave: p.clave,
        regimen: p.regimen,
        fechaPago: p.fechaPago,
        tc: p.tc,
        valorUSD: p.valorUSD,
        dtaMXN: p.dtaMXN,
        igiMXN: p.igiMXN,
        ivaMXN: p.ivaMXN,
        totalGravamen: p.totalGravamen,
        estatus: p.estatus,
      })),
      totalDTA,
      totalIGI,
      totalIVA,
      totalGravamen,
      supplierDetail,
      entradasByDay: Array.from(entradasByDay.entries()).sort().map(([day, ents]) => ({
        day,
        entradas: ents,
      })),
      fracciones,
    }

    const buffer = await renderToBuffer(AuditoriaPDF({ data }))
    const uint8 = new Uint8Array(buffer)

    const filename = `AUDITORIA_${clientClave}_${from}_${to}.pdf`

    return new NextResponse(uint8, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error generando PDF'
    console.error('[auditoria-pdf]', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
