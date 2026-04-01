import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { PORTAL_DATE_FROM } from '@/lib/data'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(request: NextRequest) {
  const companyId = request.cookies.get('company_id')?.value ?? 'evco'
  const clientClave = request.cookies.get('company_clave')?.value ?? 'evco'
  const q = request.nextUrl.searchParams.get('q')?.trim()
  if (!q || q.length < 2) {
    return NextResponse.json({ results: [] })
  }

  // Detect pedimento format: 7 digits → return full chain instead of search results
  if (/^\d{7}$/.test(q)) {
    const [pedRes, trafRes] = await Promise.all([
      supabase.from('aduanet_facturas')
        .select('referencia, pedimento, proveedor, valor_usd, dta, igi, iva, fecha_pago, cove, moneda')
        .eq('clave_cliente', clientClave)
        .ilike('pedimento', `%${q}%`)
        .limit(1),
      supabase.from('traficos')
        .select('trafico, estatus, fecha_llegada, fecha_cruce, importe_total, pedimento, descripcion_mercancia')
        .eq('company_id', companyId)
        .ilike('pedimento', `%${q}%`)
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
          .eq('company_id', companyId)
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

  const [trafRes, entRes, factRes] = await Promise.all([
    supabase.from('traficos')
      .select('trafico, estatus, fecha_llegada, descripcion_mercancia')
      .eq('company_id', companyId)
      .or(`trafico.ilike.%${q}%,descripcion_mercancia.ilike.%${q}%,pedimento.ilike.%${q}%`)
      .gte('fecha_llegada', PORTAL_DATE_FROM)
      .limit(5),
    supabase.from('entradas')
      .select('cve_entrada, descripcion_mercancia, fecha_llegada_mercancia, trafico')
      .eq('company_id', companyId)
      .or(`cve_entrada.ilike.%${q}%,descripcion_mercancia.ilike.%${q}%,trafico.ilike.%${q}%`)
      .limit(5),
    supabase.from('aduanet_facturas')
      .select('referencia, pedimento, proveedor, valor_usd, fecha_pago')
      .eq('clave_cliente', clientClave)
      .or(`pedimento.ilike.%${q}%,proveedor.ilike.%${q}%,referencia.ilike.%${q}%,num_factura.ilike.%${q}%`)
      .limit(5),
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
  ]

  return NextResponse.json({ type: 'search_results', results, query: q })
}
