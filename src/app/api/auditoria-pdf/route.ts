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

/**
 * GET /api/auditoria-pdf?from=2026-03-30&to=2026-04-03
 *
 * Generates the dark-themed "Auditoría Semanal" PDF matching the EVCO format.
 * Requires authentication. Scoped to the logged-in company.
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
    // Parallel data fetch for the date range
    const [trafRes, factRes, entRes, provRes] = await Promise.all([
      // Traficos with pedimentos in range
      supabase
        .from('traficos')
        .select('trafico, pedimento, regimen, estatus, importe_total, moneda, fecha_llegada, fecha_cruce, fecha_pago, transportista_mexicano, proveedor, descripcion_mercancia, semaforo, fraccion_arancelaria, tipo_cambio')
        .eq('company_id', companyId)
        .gte('fecha_llegada', from)
        .lte('fecha_llegada', to + 'T23:59:59')
        .order('fecha_llegada', { ascending: true })
        .limit(200),

      // Aduanet facturas for these pedimentos
      supabase
        .from('aduanet_facturas')
        .select('pedimento, valor_usd, igi, dta, iva, proveedor, cove, factura, fecha_pago')
        .eq('clave_cliente', clientClave)
        .gte('fecha_pago', from)
        .lte('fecha_pago', to + 'T23:59:59')
        .limit(500),

      // Entradas (remesas) in range
      supabase
        .from('entradas')
        .select('cve_entrada, fecha_llegada_mercancia, descripcion_mercancia, num_pedido, cantidad_bultos, peso_bruto, trafico, proveedor')
        .eq('company_id', companyId)
        .gte('fecha_llegada_mercancia', from)
        .lte('fecha_llegada_mercancia', to + 'T23:59:59')
        .order('fecha_llegada_mercancia', { ascending: true })
        .limit(500),

      // Supplier lookup
      supabase
        .from('globalpc_proveedores')
        .select('cve_proveedor, nombre')
        .eq('company_id', companyId)
        .limit(1000),
    ])

    const traficos = trafRes.data ?? []
    const facturas = factRes.data ?? []
    const entradas = entRes.data ?? []
    const provLookup = new Map<string, string>()
    for (const p of (provRes.data ?? [])) {
      if (p.cve_proveedor && p.nombre) provLookup.set(p.cve_proveedor, p.nombre.trim())
    }

    // Build pedimento summaries
    const pedimentoMap = new Map<string, {
      trafico: string; pedimento: string; clave: string; regimen: string
      fechaPago: string | null; tc: number; valorUSD: number
      dtaMXN: number; igiMXN: number; ivaMXN: number; totalGravamen: number
      estatus: string; facturas: typeof facturas
    }>()

    for (const t of traficos) {
      if (!t.pedimento) continue
      const pedFacturas = facturas.filter(f => f.pedimento === t.pedimento)
      const valorUSD = Number(t.importe_total) || pedFacturas.reduce((s, f) => s + (Number(f.valor_usd) || 0), 0)
      const dtaMXN = pedFacturas.reduce((s, f) => s + (Number(f.dta) || 0), 0)
      const igiMXN = pedFacturas.reduce((s, f) => s + (Number(f.igi) || 0), 0)
      const ivaMXN = pedFacturas.reduce((s, f) => s + (Number(f.iva) || 0), 0)
      const tc = Number(t.tipo_cambio) || 17.5
      const reg = (t.regimen || '').toUpperCase()
      const claveReg = reg === 'ITE' || reg === 'ITR' ? 'IN' : reg === 'IMD' ? 'IN' : 'A1'

      pedimentoMap.set(t.pedimento, {
        trafico: t.trafico,
        pedimento: t.pedimento,
        clave: claveReg,
        regimen: reg === 'A1' ? 'Imp. Definitiva' : reg === 'ITE' || reg === 'ITR' ? 'Importación' : 'Imp. Definitiva',
        fechaPago: t.fecha_pago,
        tc,
        valorUSD,
        dtaMXN,
        igiMXN,
        ivaMXN,
        totalGravamen: dtaMXN + igiMXN + ivaMXN,
        estatus: t.estatus || 'En Proceso',
        facturas: pedFacturas,
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

    // Fracciones used
    const fraccionMap = new Map<string, { fraccion: string; valorUSD: number; count: number; pedimentos: string[] }>()
    type FraccionEntry = { fraccion: string; valorUSD: number; count: number; pedimentos: string[] }
    for (const t of traficos) {
      if (!t.fraccion_arancelaria) continue
      const f: FraccionEntry = fraccionMap.get(t.fraccion_arancelaria) || { fraccion: t.fraccion_arancelaria, valorUSD: 0, count: 0, pedimentos: [] as string[] }
      f.valorUSD += Number(t.importe_total) || 0
      f.count++
      if (t.pedimento) f.pedimentos.push(`${t.pedimento} → ${t.trafico}`)
      fraccionMap.set(t.fraccion_arancelaria, f)
    }

    // Format dates for header
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

    const traficosListStr = traficos.filter(t => t.pedimento).map(t => t.trafico.split('-')[1] || t.trafico).join(' · ')
    const totalPeso = entradas.reduce((s, e) => s + (Number(e.peso_bruto) || 0), 0)
    const totalBultos = entradas.reduce((s, e) => s + (Number(e.cantidad_bultos) || 0), 0)

    // Supplier detail (grouped by pedimento)
    const supplierDetail: Array<{
      pedimentoHeader: string
      rows: Array<{
        trafico: string; pedimento: string; fechaPago: string; fechaCruce: string
        proveedor: string; factura: string; cove: string; valorUSD: number
        transpMX: string; transpExt: string; estatus: string
      }>
    }> = []

    for (const ped of pedimentos) {
      const traf = traficos.find(t => t.pedimento === ped.pedimento)
      const transpMX = traf?.transportista_mexicano || ''
      const header = `${ped.trafico} · Pedimento ${ped.pedimento} · ${transpMX}`

      const rows = ped.facturas.map(f => ({
        trafico: ped.trafico,
        pedimento: ped.pedimento,
        fechaPago: (f.fecha_pago || '').split('T')[0],
        fechaCruce: (traf?.fecha_cruce || '').split('T')[0],
        proveedor: provLookup.get(f.proveedor || '') || f.proveedor || '',
        factura: f.factura || '',
        cove: f.cove || '',
        valorUSD: Number(f.valor_usd) || 0,
        transpMX,
        transpExt: '',
        estatus: 'OK',
      }))

      if (rows.length > 0) {
        supplierDetail.push({ pedimentoHeader: header, rows })
      }
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
      // KPIs
      totalValorUSD,
      pedimentoCount: pedimentos.length,
      traficosListStr,
      remesaCount: entradas.length,
      totalPeso,
      totalBultos,
      incidencias: 0,
      // Section I: Pedimentos
      pedimentos,
      totalDTA,
      totalIGI,
      totalIVA,
      totalGravamen,
      // Section II: Supplier detail
      supplierDetail,
      // Section III: Entradas by day
      entradasByDay: Array.from(entradasByDay.entries()).map(([day, ents]) => ({
        day,
        entradas: ents,
      })),
      // Section IV: Fracciones
      fracciones: Array.from(fraccionMap.values()).sort((a, b) => b.valorUSD - a.valorUSD),
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
