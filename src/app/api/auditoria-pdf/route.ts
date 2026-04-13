import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { renderToBuffer } from '@react-pdf/renderer'
import { verifySession } from '@/lib/session'
import { getDTARates, getExchangeRate, getIVARate } from '@/lib/rates'
import { AuditoriaPDF } from './pdf-document'

const TMEC_REGIMES = new Set(['ITE', 'ITR', 'IMD'])

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

  // Admin/broker can generate a report for any client by passing ?company_id=...
  // Clients can only generate for their own session companyId (override ignored).
  const isInternal = session.role === 'admin' || session.role === 'broker'
  const overrideCompanyId = request.nextUrl.searchParams.get('company_id')
  const companyId = isInternal && overrideCompanyId ? overrideCompanyId : session.companyId

  // When admin overrides the target, look up the target company so the
  // header of the PDF shows the RIGHT client, not the admin's cookies.
  let clientName: string
  let clientClave: string
  let clientRFC: string
  if (isInternal && overrideCompanyId) {
    const { data: target } = await supabase
      .from('companies')
      .select('name, clave_cliente, rfc')
      .eq('company_id', overrideCompanyId)
      .maybeSingle()
    clientName = target?.name ?? overrideCompanyId.toUpperCase()
    clientClave = target?.clave_cliente ?? ''
    clientRFC = target?.rfc ?? ''
  } else {
    const rawName = request.cookies.get('company_name')?.value
    clientName = rawName ? decodeURIComponent(rawName) : companyId.toUpperCase()
    clientClave = request.cookies.get('company_clave')?.value ?? ''
    clientRFC = request.cookies.get('company_rfc')?.value ?? ''
  }

  const from = request.nextUrl.searchParams.get('from')
  const to = request.nextUrl.searchParams.get('to')

  if (!from || !to) {
    return NextResponse.json({ error: 'Parámetros from y to requeridos (YYYY-MM-DD)' }, { status: 400 })
  }

  try {
    // 1. Traficos for the week. Anchor on fecha_pago (authoritative for
    // "pagados esta semana"), but OR in embarques that crossed in the
    // window with no fecha_pago populated yet — those would otherwise
    // be invisible even though they're operationally closed.
    const toEnd = to + 'T23:59:59'
    const [paidRes, crossedNoPagoRes] = await Promise.all([
      supabase
        .from('traficos')
        .select('trafico, pedimento, regimen, estatus, importe_total, fecha_llegada, fecha_cruce, fecha_pago, transportista_mexicano, transportista_extranjero, descripcion_mercancia, semaforo, tipo_cambio, peso_bruto')
        .eq('company_id', companyId)
        .gte('fecha_pago', from)
        .lte('fecha_pago', toEnd)
        .order('fecha_pago', { ascending: true })
        .limit(200),
      supabase
        .from('traficos')
        .select('trafico, pedimento, regimen, estatus, importe_total, fecha_llegada, fecha_cruce, fecha_pago, transportista_mexicano, transportista_extranjero, descripcion_mercancia, semaforo, tipo_cambio, peso_bruto')
        .eq('company_id', companyId)
        .is('fecha_pago', null)
        .gte('fecha_cruce', from)
        .lte('fecha_cruce', toEnd)
        .order('fecha_cruce', { ascending: true })
        .limit(200),
    ])

    // Dedupe by trafico code (paid list takes precedence).
    const seen = new Set<string>()
    const traficos = [...(paidRes.data ?? []), ...(crossedNoPagoRes.data ?? [])]
      .filter((t) => {
        if (!t.trafico || seen.has(t.trafico)) return false
        seen.add(t.trafico)
        return true
      })

    // Count embarques that belong to this broker + company in "Pedimento
    // Pagado" status but have no fecha_pago at all — these never show up
    // in a weekly view. Surface the gap so Tito knows the report isn't
    // hiding work.
    const { count: missingPagoCount } = await supabase
      .from('traficos')
      .select('id', { count: 'exact', head: true })
      .eq('company_id', companyId)
      .eq('estatus', 'Pedimento Pagado')
      .is('fecha_pago', null)
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

    // Live rates — used as fallback when aduanet_facturas has no row
    // for a pedimento (sync often lags 2–3 weeks on recent pedimentos).
    // Never hardcode tc / DTA / IVA (CLAUDE.md financial-config rule).
    const [dtaRates, exchangeRateData, ivaRate] = await Promise.all([
      getDTARates().catch(() => null),
      getExchangeRate().catch(() => null),
      getIVARate().catch(() => null),
    ])
    const liveExchangeRate = exchangeRateData?.rate ?? null
    const liveIVA = ivaRate ?? 0.16

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
      const tc = Number(t.tipo_cambio) || liveExchangeRate || 0
      const reg = (t.regimen || '').toUpperCase()
      const claveReg = reg === 'ITE' || reg === 'ITR' ? 'IN' : 'A1'
      const regimenLabel = (reg === 'ITE' || reg === 'ITR') ? 'Importación' : reg === 'IMD' ? 'Imp. Definitiva' : 'Imp. Definitiva'

      // Tax data — prefer aduanet_facturas (authoritative from SAT pipeline).
      // Aduanet sync lags 2–3 weeks on recent pedimentos, so fall back to
      // computed values using live rates per CLAUDE.md (IVA base =
      // valor_aduana + DTA + IGI, never value * 0.16 flat).
      const adua = aduaByPed.get(t.pedimento)
      let dtaMXN = adua?.dta ?? 0
      let igiMXN = adua?.igi ?? 0
      let ivaMXN = adua?.iva ?? 0
      let taxSource: 'aduanet' | 'computed' | 'pending' = adua ? 'aduanet' : 'pending'

      if (!adua && valorUSD > 0 && tc > 0 && dtaRates) {
        const valorAduanaMXN = Math.round(valorUSD * tc * 100) / 100
        const dtaKey = (reg as keyof typeof dtaRates) in dtaRates ? (reg as keyof typeof dtaRates) : 'A1'
        const dtaCfg = dtaRates[dtaKey] ?? dtaRates.A1
        dtaMXN = dtaCfg.amount
        // T-MEC heuristic: regimes ITE/ITR/IMD benefit from 0% IGI
        // under T-MEC when origin is USA/CAN. Without country resolution
        // here we assume non-TMEC (0% explicit floor) — aduanet will
        // overwrite when it syncs.
        const igiRate = TMEC_REGIMES.has(reg) ? 0 : 0
        igiMXN = Math.round(valorAduanaMXN * igiRate * 100) / 100
        const ivaBase = valorAduanaMXN + dtaMXN + igiMXN
        ivaMXN = Math.round(ivaBase * liveIVA * 100) / 100
        taxSource = 'computed'
      }
      void taxSource

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

    // Section IV — Fracciones arancelarias utilizadas.
    // Three-hop join: globalpc_facturas.numero → globalpc_partidas.folio
    // → globalpc_productos.cve_producto → fraccion. Tenant-scoped on both
    // partidas and productos (company_id filter).
    const fracciones: Array<{ fraccion: string; valorUSD: number; count: number; pedimentos: string[] }> = []
    const folios = gpFacturas.map((f) => f.numero).filter((n): n is string => Boolean(n))
    if (folios.length > 0) {
      const { data: partidaRows } = await supabase
        .from('globalpc_partidas')
        .select('folio, cve_producto, precio_unitario, cantidad')
        .eq('company_id', companyId)
        .in('folio', folios)
        .limit(5000)
      const partidas = partidaRows ?? []

      const cveProductos = Array.from(new Set(
        partidas.map((p) => p.cve_producto).filter((x): x is string => Boolean(x)),
      ))

      const productMap = new Map<string, string>()
      for (let i = 0; i < cveProductos.length; i += 100) {
        const batch = cveProductos.slice(i, i + 100)
        const { data: prodBatch } = await supabase
          .from('globalpc_productos')
          .select('cve_producto, fraccion')
          .eq('company_id', companyId)
          .in('cve_producto', batch)
          .limit(500)
        for (const p of prodBatch ?? []) {
          if (p.cve_producto && p.fraccion) productMap.set(p.cve_producto, p.fraccion)
        }
      }

      // Fold: cve_trafico ← globalpc_facturas ← folio ← partidas
      // → fraccion from productMap.
      const facturaTraficoByFolio = new Map<string, string>()
      for (const f of gpFacturas) {
        if (f.numero && f.cve_trafico) facturaTraficoByFolio.set(f.numero, f.cve_trafico)
      }
      const traficoToPedimento = new Map<string, string>()
      for (const t of traficos) {
        if (t.pedimento) traficoToPedimento.set(t.trafico, t.pedimento)
      }

      const fracAgg = new Map<string, { valorUSD: number; count: number; pedimentos: Set<string> }>()
      for (const p of partidas) {
        const fraccion = p.cve_producto ? productMap.get(p.cve_producto) : null
        if (!fraccion) continue
        const trafico = facturaTraficoByFolio.get(p.folio as string)
        const pedimento = trafico ? traficoToPedimento.get(trafico) : undefined
        const prev = fracAgg.get(fraccion) ?? { valorUSD: 0, count: 0, pedimentos: new Set<string>() }
        prev.valorUSD += (Number(p.precio_unitario) || 0) * (Number(p.cantidad) || 0)
        prev.count += 1
        if (pedimento) prev.pedimentos.add(pedimento)
        fracAgg.set(fraccion, prev)
      }

      for (const [fraccion, v] of fracAgg) {
        fracciones.push({
          fraccion,
          valorUSD: Math.round(v.valorUSD * 100) / 100,
          count: v.count,
          pedimentos: Array.from(v.pedimentos),
        })
      }
      fracciones.sort((a, b) => b.valorUSD - a.valorUSD)
    }

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
      missingPagoCount: missingPagoCount ?? 0,
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
