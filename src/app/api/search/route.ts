import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const COMPANY_ID = 'evco'
const CLAVE = '9254'

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get('q')?.trim()
  if (!q || q.length < 2) {
    return NextResponse.json({ results: [] })
  }

  const [trafRes, entRes, factRes] = await Promise.all([
    supabase.from('traficos')
      .select('trafico, estatus, fecha_llegada, descripcion_mercancia')
      .eq('company_id', COMPANY_ID)
      .or(`trafico.ilike.%${q}%,descripcion_mercancia.ilike.%${q}%,pedimento.ilike.%${q}%`)
      .limit(5),
    supabase.from('entradas')
      .select('cve_entrada, descripcion_mercancia, fecha_llegada_mercancia, trafico')
      .eq('company_id', COMPANY_ID)
      .or(`cve_entrada.ilike.%${q}%,descripcion_mercancia.ilike.%${q}%,trafico.ilike.%${q}%`)
      .limit(5),
    supabase.from('aduanet_facturas')
      .select('referencia, pedimento, proveedor, valor_usd, fecha_pago')
      .eq('clave_cliente', CLAVE)
      .or(`pedimento.ilike.%${q}%,proveedor.ilike.%${q}%,referencia.ilike.%${q}%,num_factura.ilike.%${q}%`)
      .limit(5),
  ])

  const results = [
    ...(trafRes.data || []).map(t => ({
      type: 'trafico', id: t.trafico, title: t.trafico,
      sub: `${t.estatus} · ${t.descripcion_mercancia?.substring(0, 40) || '—'}`,
      date: t.fecha_llegada, view: 'traficos',
    })),
    ...(entRes.data || []).map(e => ({
      type: 'entrada', id: e.cve_entrada, title: e.cve_entrada,
      sub: e.descripcion_mercancia?.substring(0, 50) || '—',
      date: e.fecha_llegada_mercancia, view: 'entradas',
    })),
    ...(factRes.data || []).map(f => ({
      type: 'factura', id: f.referencia || f.pedimento, title: f.pedimento || f.referencia || '—',
      sub: `${f.proveedor?.substring(0, 35) || '—'} · $${Number(f.valor_usd || 0).toLocaleString('en-US', { maximumFractionDigits: 0 })}`,
      date: f.fecha_pago, view: 'pedimentos',
    })),
  ]

  return NextResponse.json({ results, query: q })
}
