import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { PORTAL_DATE_FROM } from '@/lib/data'
import { verifySession } from '@/lib/session'
import { sanitizeIlike } from '@/lib/sanitize'
import { resolveProveedorName } from '@/lib/proveedor-names'

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
        supabase.from('expediente_documentos')
          .select('doc_type, file_url, uploaded_at, nombre')
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
          nombre: d.nombre,
          file_url: d.file_url,
          uploaded_at: d.uploaded_at,
        })),
      })
    }
  }

  const safe = sanitizeIlike(q)
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
    // Phase 1A: Search products by description or fraccion
    supabase.from('globalpc_productos')
      .select('id, descripcion, fraccion, cve_producto')
      .or(`descripcion.ilike.%${safe}%,fraccion.ilike.%${safe}%,cve_producto.ilike.%${safe}%`)
      .limit(8),
    // Phase 1A: Search suppliers by name or RFC
    supabase.from('globalpc_proveedores')
      .select('cve_proveedor, nombre, id_fiscal')
      .or(`nombre.ilike.%${safe}%,cve_proveedor.ilike.%${safe}%,id_fiscal.ilike.%${safe}%`)
      .limit(8),
    // Phase 1A: Search partidas by description
    supabase.from('globalpc_partidas')
      .select('id, cve_trafico, descripcion, fraccion_arancelaria')
      .or(`descripcion.ilike.%${safe}%,fraccion_arancelaria.ilike.%${safe}%,cve_trafico.ilike.%${safe}%`)
      .limit(8),
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
      type: 'producto', id: String(p.id), title: p.cve_producto || String(p.id),
      sub: `${p.descripcion?.substring(0, 40) || ''} · ${p.fraccion || 'Sin fracción'}`,
      date: null, view: 'fracciones',
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
      type: 'partida', id: pt.cve_trafico || String(pt.id), title: pt.cve_trafico || `Partida ${pt.id}`,
      sub: `${pt.descripcion?.substring(0, 40) || ''} · ${pt.fraccion_arancelaria || ''}`,
      date: null, view: 'traficos',
    })),
  ]

  return NextResponse.json({ type: 'search_results', results, query: q })
}
