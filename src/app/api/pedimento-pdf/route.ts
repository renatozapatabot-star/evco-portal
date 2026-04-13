import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { renderToBuffer } from '@react-pdf/renderer'
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

  if (!trafico) return NextResponse.json({ error: 'Tráfico no encontrado' }, { status: 404 })

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
      { error: `Sin facturas sincronizadas para tráfico ${traficoId}. Verificar sync GlobalPC.` },
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
        .select('folio, cve_producto, cantidad, precio_unitario, peso, pais_origen')
        .in('folio', folios)
        .limit(1000)
    : { data: null }

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

  // DTA: prefer aduanet; fall back to fixed rate per régimen from system_config.
  let dta = cbpArr.reduce((s, f) => s + (Number(f.dta) || 0), 0)
  if (!dta && trafico.regimen) {
    try {
      const rates = await getDTARates()
      const entry = rates[trafico.regimen] || rates['A1']
      if (entry?.type === 'fixed') dta = entry.amount
    } catch { /* leave 0 */ }
  }

  // IGI and IVA: only authoritative from aduanet_facturas. No silent fallback.
  const hasCbp = cbpArr.length > 0
  const igi = hasCbp ? cbpArr.reduce((s, f) => s + (Number(f.igi) || 0), 0) : null
  const iva = hasCbp ? cbpArr.reduce((s, f) => s + (Number(f.iva) || 0), 0) : null

  const partidasForPDF = (partidas ?? []).map(p => ({
    fraccion: '',
    descripcion: String(p.cve_producto || ''),
    cantidad: Number(p.cantidad) || 0,
    valorUSD: (Number(p.precio_unitario) || 0) * (Number(p.cantidad) || 0),
  }))

  const today = new Date().toLocaleDateString('es-MX', {
    day: '2-digit', month: 'long', year: 'numeric', timeZone: 'America/Chicago',
  })

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
      dataSource: hasCbp ? 'cbp' : 'commercial-only',
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
