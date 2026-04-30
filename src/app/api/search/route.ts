import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { PORTAL_DATE_FROM } from '@/lib/data'
import { verifySession } from '@/lib/session'
import { sanitizeIlike } from '@/lib/sanitize'
import { resolveProveedorName } from '@/lib/proveedor-names'
import { getActiveCveProductos, activeCvesArray } from '@/lib/anexo24/active-parts'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(request: NextRequest) {
  // Session validation — derive company_id from signed token, never cookies
  const sessionToken = request.cookies.get('portal_session')?.value || ''
  const session = await verifySession(sessionToken)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const isInternal = session.role === 'broker' || session.role === 'admin'
  const companyId = isInternal ? '' : session.companyId
  const clientClave = request.cookies.get('company_clave')?.value ?? ''
  const q = request.nextUrl.searchParams.get('q')?.trim()
  if (!q || q.length < 2) {
    return NextResponse.json({ results: [] })
  }

  // Detect pedimento format: 7 digits → return full chain instead of search results
  if (/^\d{7}$/.test(q)) {
    // Invariant 31 — admin/broker queries don't filter by company.
    const [pedRes, trafRes] = await Promise.all([
      isInternal
        ? supabase.from('aduanet_facturas')
            .select('referencia, pedimento, proveedor, valor_usd, dta, igi, iva, fecha_pago, cove, moneda')
            .ilike('pedimento', `%${sanitizeIlike(q)}%`)
            .limit(1)
        : supabase.from('aduanet_facturas')
            .select('referencia, pedimento, proveedor, valor_usd, dta, igi, iva, fecha_pago, cove, moneda')
            .eq('clave_cliente', clientClave)
            .ilike('pedimento', `%${sanitizeIlike(q)}%`)
            .limit(1),
      isInternal
        ? supabase.from('traficos')
            .select('trafico, estatus, fecha_llegada, fecha_cruce, importe_total, pedimento, descripcion_mercancia')
            .ilike('pedimento', `%${sanitizeIlike(q)}%`)
            .gte('fecha_llegada', PORTAL_DATE_FROM)
            .limit(1)
        : supabase.from('traficos')
            .select('trafico, estatus, fecha_llegada, fecha_cruce, importe_total, pedimento, descripcion_mercancia')
            .eq('company_id', companyId)
            .ilike('pedimento', `%${sanitizeIlike(q)}%`)
            .gte('fecha_llegada', PORTAL_DATE_FROM)
            .limit(1),
    ])

    const pedimento = pedRes.data?.[0]
    const trafico = trafRes.data?.[0]
    const traficoId = trafico?.trafico || pedimento?.referencia

    if (traficoId) {
      const [entRes, docsRes] = await Promise.all([
        supabase.from('entradas')
          .select('cve_entrada, descripcion_mercancia, peso_bruto, fecha_llegada_mercancia, tiene_faltantes, mercancia_danada')
          .eq('trafico', traficoId)
          .limit(50),
        // expediente_documentos uses file_name, not nombre (M15 phantom sweep).
        supabase.from('expediente_documentos')
          .select('doc_type, file_url, uploaded_at, file_name')
          .eq('pedimento_id', traficoId)
          .limit(20),
      ])

      return NextResponse.json({
        type: 'pedimento_chain',
        query: q,
        pedimento: pedimento ? {
          num: pedimento.pedimento,
          fecha_pago: pedimento.fecha_pago,
          valor_usd: pedimento.valor_usd,
          dta: pedimento.dta,
          igi: pedimento.igi,
          iva: pedimento.iva,
          proveedor: pedimento.proveedor,
          cove: pedimento.cove,
        } : null,
        trafico: trafico ? {
          trafico_id: trafico.trafico,
          estatus: trafico.estatus,
          fecha_llegada: trafico.fecha_llegada,
          fecha_cruce: trafico.fecha_cruce,
          valor_usd: trafico.importe_total,
          descripcion: trafico.descripcion_mercancia,
        } : null,
        entradas: (entRes.data || []).map(e => ({
          id: e.cve_entrada,
          descripcion: e.descripcion_mercancia,
          peso: e.peso_bruto,
          fecha: e.fecha_llegada_mercancia,
          incidencia: e.tiene_faltantes || e.mercancia_danada,
        })),
        documentos: (docsRes.data || []).map(d => ({
          tipo: d.doc_type,
          nombre: d.file_name,
          file_url: d.file_url,
          uploaded_at: d.uploaded_at,
        })),
      })
    }
  }

  const safe = sanitizeIlike(q)

  // Active-parts narrow for client searches — only SKUs this client
  // has actually imported. Internal roles (broker/admin) search the
  // full mirror per invariant #31. Fresh tenants with zero partidas
  // get no productos/partidas results (the traficos/entradas/facturas
  // queries still run and can surface early-stage data).
  const activeList = isInternal
    ? []
    : activeCvesArray(await getActiveCveProductos(supabase, companyId))
  const clientHasActive = activeList.length > 0

  const [trafRes, entRes, factRes, prodRes, provRes, partRes] = await Promise.all([
    // Invariant 31 — admin/broker (isInternal) sees all tenants. companyId is
    // '' for those roles, so .eq('company_id', '') would return zero rows.
    (isInternal
      ? supabase.from('traficos')
          .select('trafico, estatus, fecha_llegada, descripcion_mercancia')
          .or(`trafico.ilike.%${safe}%,descripcion_mercancia.ilike.%${safe}%,pedimento.ilike.%${safe}%`)
          .gte('fecha_llegada', PORTAL_DATE_FROM)
          .limit(10)
      : supabase.from('traficos')
          .select('trafico, estatus, fecha_llegada, descripcion_mercancia')
          .eq('company_id', companyId)
          .or(`trafico.ilike.%${safe}%,descripcion_mercancia.ilike.%${safe}%,pedimento.ilike.%${safe}%`)
          .gte('fecha_llegada', PORTAL_DATE_FROM)
          .limit(10)
    ),
    (isInternal
      ? supabase.from('entradas')
          .select('cve_entrada, descripcion_mercancia, fecha_llegada_mercancia, trafico')
          .or(`cve_entrada.ilike.%${safe}%,descripcion_mercancia.ilike.%${safe}%,trafico.ilike.%${safe}%`)
          .limit(10)
      : supabase.from('entradas')
          .select('cve_entrada, descripcion_mercancia, fecha_llegada_mercancia, trafico')
          .eq('company_id', companyId)
          .or(`cve_entrada.ilike.%${safe}%,descripcion_mercancia.ilike.%${safe}%,trafico.ilike.%${safe}%`)
          .limit(10)
    ),
    (isInternal
      ? supabase.from('aduanet_facturas')
          .select('referencia, pedimento, proveedor, valor_usd, fecha_pago')
          .or(`pedimento.ilike.%${safe}%,proveedor.ilike.%${safe}%,referencia.ilike.%${safe}%,num_factura.ilike.%${safe}%`)
          .limit(10)
      : supabase.from('aduanet_facturas')
          .select('referencia, pedimento, proveedor, valor_usd, fecha_pago')
          .eq('clave_cliente', clientClave)
          .or(`pedimento.ilike.%${safe}%,proveedor.ilike.%${safe}%,referencia.ilike.%${safe}%,num_factura.ilike.%${safe}%`)
          .limit(10)
    ),
    // Products — client-scoped for non-internal sessions + further
    // narrowed to the active-parts set so clients only see SKUs
    // they've actually imported. Invariant 13 + 14: never leak cross-
    // tenant; v3.1 adds "don't show parts this client doesn't use."
    // Internal roles bypass both filters per invariant #31.
    (isInternal
      ? supabase.from('globalpc_productos')
          .select('id, descripcion, fraccion, cve_producto')
          .or(`descripcion.ilike.%${safe}%,fraccion.ilike.%${safe}%,cve_producto.ilike.%${safe}%`)
          .limit(8)
      : clientHasActive
        ? supabase.from('globalpc_productos')
            .select('id, descripcion, fraccion, cve_producto')
            .eq('company_id', companyId)
            .in('cve_producto', activeList)
            .or(`descripcion.ilike.%${safe}%,fraccion.ilike.%${safe}%,cve_producto.ilike.%${safe}%`)
            .limit(8)
        : supabase.from('globalpc_productos').select('id, descripcion, fraccion, cve_producto').eq('company_id', companyId).limit(0)
    ),
    // Suppliers — client-scoped.
    (isInternal
      ? supabase.from('globalpc_proveedores')
          .select('cve_proveedor, nombre, id_fiscal')
          .or(`nombre.ilike.%${safe}%,cve_proveedor.ilike.%${safe}%,id_fiscal.ilike.%${safe}%`)
          .limit(8)
      : supabase.from('globalpc_proveedores')
          .select('cve_proveedor, nombre, id_fiscal')
          .eq('company_id', companyId)
          .or(`nombre.ilike.%${safe}%,cve_proveedor.ilike.%${safe}%,id_fiscal.ilike.%${safe}%`)
          .limit(8)
    ),
    // Partidas — searchable by cve_producto only (partidas has no
    // descripcion/fraccion_arancelaria/cve_trafico columns — those live
    // on productos + facturas respectively). The productos search above
    // already surfaces descripción/fracción matches, so partidas here
    // adds coverage for direct SKU code matches that appear in the
    // partida line-items. M15 phantom sweep.
    (isInternal
      ? supabase.from('globalpc_partidas')
          .select('id, folio, cve_producto')
          .ilike('cve_producto', `%${safe}%`)
          .limit(8)
      : supabase.from('globalpc_partidas')
          .select('id, folio, cve_producto')
          .eq('company_id', companyId)
          .ilike('cve_producto', `%${safe}%`)
          .limit(8)
    ),
  ])

  const results = [
    ...(trafRes.data || []).map(t => ({
      type: 'trafico', id: t.trafico, title: t.trafico,
      sub: `${t.estatus} · ${t.descripcion_mercancia?.substring(0, 40) || ''}`,
      date: t.fecha_llegada, view: 'traficos',
    })),
    ...(entRes.data || []).map(e => ({
      type: 'entrada', id: e.cve_entrada, title: e.cve_entrada,
      sub: e.descripcion_mercancia?.substring(0, 50) || '',
      date: e.fecha_llegada_mercancia, view: 'entradas',
    })),
    ...(factRes.data || []).map(f => ({
      type: 'factura', id: f.referencia || f.pedimento, title: f.pedimento || f.referencia || '',
      sub: `${f.proveedor?.substring(0, 35) || ''} · $${Number(f.valor_usd || 0).toLocaleString('en-US', { maximumFractionDigits: 0 })}`,
      date: f.fecha_pago, view: 'pedimentos',
    })),
    ...(prodRes.data || []).map(p => ({
      // Results carry an `anexo24` type tag + an `href` that lands on
      // /anexo-24/[cveProducto] — the canonical SKU detail surface
      // after the 2026-04-18 nav promotion. Consumers that render by
      // `type` can theme these rows with the ClipboardList icon; those
      // that read `href` just navigate. Both work.
      type: 'anexo24',
      id: String(p.id),
      title: p.cve_producto || String(p.id),
      sub: `${p.descripcion?.substring(0, 40) || ''} · ${p.fraccion || 'Sin fracción'}`,
      date: null,
      view: 'anexo24',
      href: p.cve_producto ? `/anexo-24/${encodeURIComponent(p.cve_producto)}` : undefined,
    })),
    ...(provRes.data || []).map(s => ({
      type: 'proveedor',
      id: s.cve_proveedor,
      title: resolveProveedorName(s.cve_proveedor, s.nombre),
      sub: s.id_fiscal || resolveProveedorName(s.cve_proveedor, s.nombre),
      date: null,
      view: 'proveedores',
    })),
    ...(partRes.data || []).map(pt => ({
      type: 'partida', id: pt.cve_producto || String(pt.id), title: pt.cve_producto || `Partida ${pt.id}`,
      sub: `Folio ${pt.folio ?? '—'}`,
      date: null, view: 'traficos',
    })),
  ]

  return NextResponse.json({ type: 'search_results', results, query: q })
}
