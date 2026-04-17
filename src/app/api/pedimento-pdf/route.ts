import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { loadPdfRenderer } from '@/lib/pdf/lazy'
import { PATENTE, ADUANA } from '@/lib/client-config'
import { verifySession } from '@/lib/session'
import { getDTARates, getExchangeRate } from '@/lib/rates'
import { resolveProveedorName } from '@/lib/proveedor-names'
import { PedimentoPDF } from './pdf-document'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export const dynamic = 'force-dynamic'
export const maxDuration = 30

// Calm bilingual sync-delay responder. Browser taps (Accept: text/html)
// get a branded Spanish page; fetch/XHR clients get sanitized JSON with
// no internal system names. Never leaks "GlobalPC", "Supabase", etc.
function syncDelayResponse(request: NextRequest, status: 404 | 422): NextResponse {
  const accept = request.headers.get('accept') ?? ''
  const wantsHtml = accept.includes('text/html')
  const title = status === 404 ? 'Embarque no encontrado' : 'Aún sincronizando este pedimento'
  const message = status === 404
    ? 'No encontramos este embarque en tu cuenta. Puede ser que aún no esté sincronizado o que el número sea distinto.'
    : 'Estamos sincronizando la factura de este pedimento. Por favor intenta en unos minutos.'

  if (wantsHtml) {
    const html = `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>${title} · CRUZ</title>
  <style>
    :root { color-scheme: dark; }
    html, body { margin: 0; padding: 0; background: #05070B; color: #E6EDF3;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Inter, sans-serif; }
    .wrap { min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 24px; }
    .card { max-width: 480px; width: 100%; background: rgba(255,255,255,0.04);
      border: 1px solid rgba(255,255,255,0.08); border-radius: 20px; padding: 32px;
      backdrop-filter: blur(20px); box-shadow: 0 10px 30px rgba(0,0,0,0.4); }
    h1 { margin: 0 0 12px; font-size: 20px; font-weight: 600; letter-spacing: -0.01em; color: #E6EDF3; }
    p { margin: 0 0 16px; font-size: 14px; line-height: 1.55; color: rgba(230,237,243,0.82); }
    .meta { font-size: 12px; color: rgba(148,163,184,0.8); margin-top: 16px; }
    .meta a { color: #C9A84C; text-decoration: none; }
    .actions { display: flex; gap: 12px; margin-top: 24px; flex-wrap: wrap; }
    button { min-height: 60px; padding: 0 22px; font-size: 14px; font-weight: 600;
      border-radius: 12px; border: 1px solid rgba(201,168,76,0.3); background: rgba(201,168,76,0.12);
      color: #E6EDF3; cursor: pointer; }
    .foot { margin-top: 20px; font-size: 10px; letter-spacing: 0.12em; text-transform: uppercase;
      color: rgba(122,126,134,0.55); font-family: ui-monospace, 'JetBrains Mono', monospace; }
  </style>
</head>
<body>
  <main class="wrap">
    <section class="card" role="status" aria-live="polite">
      <h1>${title}</h1>
      <p>${message}</p>
      <p class="meta">Si persiste, contáctanos por WhatsApp al <a href="https://wa.me/18005551941">+1 (800) 555-1941</a>
        o por correo a <a href="mailto:soporte@renatozapata.com">soporte@renatozapata.com</a>.</p>
      <div class="actions">
        <button type="button" onclick="history.back()">Volver</button>
      </div>
      <div class="foot">Patente 3596 · Aduana 240 · Laredo TX · Est. 1941</div>
    </section>
  </main>
</body>
</html>`
    return new NextResponse(html, {
      status,
      headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
    })
  }

  return NextResponse.json(
    {
      error: status === 404 ? 'not_found' : 'sync_in_progress',
      message,
      retry_suggested: status === 422,
    },
    { status, headers: { 'Cache-Control': 'no-store' } }
  )
}

function unauthorizedResponse(request: NextRequest): NextResponse {
  const accept = request.headers.get('accept') ?? ''
  if (accept.includes('text/html')) {
    return NextResponse.redirect(new URL('/login', request.url))
  }
  return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
}

export async function GET(request: NextRequest) {
  const sessionToken = request.cookies.get('portal_session')?.value ?? ''
  const session = await verifySession(sessionToken)
  if (!session) return unauthorizedResponse(request)

  const companyId = request.cookies.get('company_id')?.value ?? ''
  const clientClave = request.cookies.get('company_clave')?.value ?? ''
  const clientName = decodeURIComponent(request.cookies.get('company_name')?.value ?? 'Cliente')

  const traficoId = request.nextUrl.searchParams.get('trafico')
  if (!traficoId) return syncDelayResponse(request, 404)

  const { data: trafico } = await supabase
    .from('traficos')
    .select('trafico, pedimento, regimen, descripcion_mercancia, fecha_pago, fecha_llegada, tipo_cambio, company_id')
    .eq('trafico', traficoId)
    .eq('company_id', companyId)
    .single()

  if (!trafico) return syncDelayResponse(request, 404)

  // Primary: commercial invoices mirrored from the upstream broker system.
  const { data: globalFacturas } = await supabase
    .from('globalpc_facturas')
    .select('folio, cve_proveedor, cve_cliente, numero, moneda, valor_comercial, fecha_facturacion, flete, seguros, embalajes, incrementables, incoterm')
    .eq('cve_trafico', traficoId)
    .eq('company_id', companyId)
    .limit(100)

  // Secondary: CBP payment data (last ~30 days only, by pedimento number).
  // We join by pedimento here — referencia is the upstream code, pedimento
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
    return syncDelayResponse(request, 422)
  }

  const gfArr = globalFacturas ?? []
  const cbpArr = cbpFacturas ?? []

  // Proveedor display name: resolveProveedorName() guarantees a human
  // string (no raw PRV_#### codes leak into the PDF). Prefer the
  // globalpc_proveedores lookup; fall back to the aduanet-scraped name,
  // then the coalesced placeholder.
  const proveedorCve = gfArr[0]?.cve_proveedor ?? null
  let proveedorCanonical: string | null = null
  if (proveedorCve) {
    const { data: prov } = await supabase
      .from('globalpc_proveedores')
      .select('nombre, alias')
      .eq('cve_proveedor', proveedorCve)
      .eq('cve_cliente', clientClave)
      .maybeSingle()
    proveedorCanonical = prov?.nombre || prov?.alias || null
  }
  if (!proveedorCanonical && cbpArr[0]?.proveedor) {
    proveedorCanonical = String(cbpArr[0].proveedor)
  }
  const proveedorDisplay = resolveProveedorName(proveedorCve, proveedorCanonical)

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
      proveedor: proveedorDisplay,
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
