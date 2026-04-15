import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { loadPdfRenderer } from '@/lib/pdf/lazy'
import { PATENTE, ADUANA } from '@/lib/client-config'
import { verifySession } from '@/lib/session'
import { getDTARates, getExchangeRate } from '@/lib/rates'
import { PedimentoPDF } from './pdf-document'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export const dynamic = 'force-dynamic'
export const maxDuration = 30

export async function GET(request: NextRequest) {
  const sessionToken = request.cookies.get('portal_session')?.value ?? ''
  const session = await verifySession(sessionToken)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const companyId = request.cookies.get('company_id')?.value ?? ''
  const clientClave = request.cookies.get('company_clave')?.value ?? ''
  const clientName = decodeURIComponent(request.cookies.get('company_name')?.value ?? 'Cliente')

  const traficoId = request.nextUrl.searchParams.get('trafico')
  if (!traficoId) return NextResponse.json({ error: 'Missing trafico param' }, { status: 400 })

  const { data: trafico } = await supabase
    .from('traficos')
    .select('trafico, pedimento, regimen, descripcion_mercancia, fecha_pago, fecha_llegada, tipo_cambio, company_id')
    .eq('trafico', traficoId)
    .eq('company_id', companyId)
    .single()

  if (!trafico) return NextResponse.json({ error: 'Embarque no encontrado' }, { status: 404 })

  // Primary: commercial invoices from GlobalPC (full history).
  const { data: globalFacturas } = await supabase
    .from('globalpc_facturas')
    .select('folio, cve_proveedor, cve_cliente, numero, moneda, valor_comercial, fecha_facturacion, flete, seguros, embalajes, incrementables, incoterm')
    .eq('cve_trafico', traficoId)
    .eq('company_id', companyId)
    .limit(100)

  // Secondary: CBP payment data (last ~30 days only, by pedimento number).
  // We join by pedimento here — referencia is the GlobalPC-style code, pedimento
  // is the canonical CBP key and is what aduanet-puppeteer-scraper writes.
  const { data: cbpFacturas } = trafico.pedimento
    ? await supabase
        .from('aduanet_facturas')
        .select('dta, igi, iva, tipo_cambio, proveedor, valor_usd')
        .eq('pedimento', trafico.pedimento)
        .eq('clave_cliente', clientClave)
        .limit(100)
    : { data: null }

  if ((!globalFacturas || globalFacturas.length === 0) && (!cbpFacturas || cbpFacturas.length === 0)) {
    return NextResponse.json(
      { error: `Sin facturas sincronizadas para embarque ${traficoId}. Verificar sync GlobalPC.` },
      { status: 422 }
    )
  }

  const gfArr = globalFacturas ?? []
  const cbpArr = cbpFacturas ?? []

  // Proveedor display name: globalpc_proveedores (cve_proveedor, cve_cliente) → nombre.
  // Fall back to cve_proveedor code, then aduanet-scraped string, then '—'.
  let proveedorDisplay = ''
  const proveedorCve = gfArr[0]?.cve_proveedor
  if (proveedorCve) {
    const { data: prov } = await supabase
      .from('globalpc_proveedores')
      .select('nombre, alias')
      .eq('cve_proveedor', proveedorCve)
      .eq('cve_cliente', clientClave)
      .maybeSingle()
    proveedorDisplay = prov?.nombre || prov?.alias || proveedorCve
  }
  if (!proveedorDisplay && cbpArr[0]?.proveedor) proveedorDisplay = String(cbpArr[0].proveedor)

  // Partidas: join globalpc_partidas.folio ∈ facturas.folio[].
  const folios = gfArr.map(f => f.folio).filter(Boolean)
  const { data: partidas } = folios.length > 0
    ? await supabase
        .from('globalpc_partidas')
        .select('folio, cve_producto, cve_cliente, cantidad, precio_unitario, peso, pais_origen')
        .in('folio', folios)
        .limit(1000)
    : { data: null }

  // Enrich partidas with descripcion + fraccion from globalpc_productos.
  const partidaArr = (partidas ?? []) as Array<{
    folio: number | null
    cve_producto: string | null
    cve_cliente: string | null
    cantidad: number | null
    precio_unitario: number | null
    peso: number | null
    pais_origen: string | null
  }>
  const cves = Array.from(new Set(partidaArr.map(p => p.cve_producto).filter((c): c is string => !!c)))
  const productMap = new Map<string, { descripcion: string | null; fraccion: string | null }>()
  if (cves.length > 0) {
    const { data: prods } = await supabase
      .from('globalpc_productos')
      .select('cve_producto, cve_cliente, descripcion, fraccion')
      .in('cve_producto', cves)
      .limit(2000)
    for (const p of (prods ?? []) as Array<{ cve_producto: string | null; cve_cliente: string | null; descripcion: string | null; fraccion: string | null }>) {
      productMap.set(`${p.cve_cliente ?? ''}|${p.cve_producto ?? ''}`, { descripcion: p.descripcion, fraccion: p.fraccion })
    }
  }

  // --- Financial aggregation ---
  // Valor Comercial USD from globalpc_facturas (authoritative commercial invoice).
  const valorUSD = gfArr
    .filter(f => (f.moneda || 'USD').toUpperCase() === 'USD')
    .reduce((s, f) => s + (Number(f.valor_comercial) || 0), 0)

  // Tipo de cambio: prefer aduanet (real filing rate), then trafico.tipo_cambio, then live Banxico.
  let tipoCambio = Number(cbpArr[0]?.tipo_cambio) || Number(trafico.tipo_cambio) || 0
  if (!tipoCambio) {
    try { tipoCambio = (await getExchangeRate()).rate } catch { tipoCambio = 0 }
  }

  // Three-way DTA/IGI/IVA strategy:
  //   1. Real CBP data from aduanet_facturas if present (authoritative)
  //   2. Fall back to estimator (DTA from régimen, IGI from per-fracción tariff_rates)
  //   3. Otherwise show "Pendiente" labels in the PDF
  const hasCbp = cbpArr.length > 0
  let dta = cbpArr.reduce((s, f) => s + (Number(f.dta) || 0), 0)
  let igi: number | null = hasCbp ? cbpArr.reduce((s, f) => s + (Number(f.igi) || 0), 0) : null
  let iva: number | null = hasCbp ? cbpArr.reduce((s, f) => s + (Number(f.iva) || 0), 0) : null
  let dataSource: 'cbp' | 'commercial-only' | 'estimated' | 'estimated-partial' = hasCbp ? 'cbp' : 'commercial-only'

  if (!hasCbp) {
    // Estimator path: build per-partida MXN values and call the customs lib.
    const valorAduanaMxn = valorUSD * tipoCambio
    const partidasForEstimate = partidaArr.map(p => {
      const enr = productMap.get(`${p.cve_cliente ?? ''}|${p.cve_producto ?? ''}`)
      const valorPartidaUsd = (Number(p.precio_unitario) || 0) * (Number(p.cantidad) || 0)
      return {
        fraccion: enr?.fraccion ?? null,
        valor_partida_mxn: valorPartidaUsd * tipoCambio,
      }
    })
    try {
      const { estimateIgiIva } = await import('@/lib/customs/estimate-igi-iva')
      const est = await estimateIgiIva(supabase, {
        regimen: trafico.regimen,
        valor_aduana_mxn: valorAduanaMxn,
        partidas: partidasForEstimate,
      })
      if (est.dta > 0) dta = est.dta
      if (est.igi != null) igi = est.igi
      if (est.iva != null) iva = est.iva
      dataSource = est.source === 'unknown' ? 'commercial-only' : est.source
    } catch {
      // Estimator unavailable — leave as commercial-only.
    }
  }

  const partidasForPDF = partidaArr.map(p => {
    const enr = productMap.get(`${p.cve_cliente ?? ''}|${p.cve_producto ?? ''}`)
    return {
      fraccion: enr?.fraccion ?? '',
      descripcion: enr?.descripcion ?? String(p.cve_producto || ''),
      cantidad: Number(p.cantidad) || 0,
      valorUSD: (Number(p.precio_unitario) || 0) * (Number(p.cantidad) || 0),
    }
  })

  const today = new Date().toLocaleDateString('es-MX', {
    day: '2-digit', month: 'long', year: 'numeric', timeZone: 'America/Chicago',
  })

  const { renderToBuffer } = await loadPdfRenderer()
  const buffer = await renderToBuffer(
    PedimentoPDF({
      clientName,
      patente: PATENTE,
      aduana: ADUANA,
      date: today,
      pedimento: trafico.pedimento || 'Sin asignar',
      trafico: traficoId,
      fechaPago: trafico.fecha_pago,
      fechaLlegada: trafico.fecha_llegada,
      regimen: trafico.regimen,
      proveedor: proveedorDisplay || '—',
      descripcion: trafico.descripcion_mercancia || '',
      valorUSD,
      dta,
      igi,
      iva,
      tipoCambio,
      partidas: partidasForPDF,
      dataSource,
    })
  )

  const filename = `Pedimento-${(trafico.pedimento || traficoId).replace(/\s/g, '_')}-${clientClave}.pdf`

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  })
}
