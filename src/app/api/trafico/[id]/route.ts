import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const companyId = request.cookies.get('company_id')?.value ?? 'evco'
  const clientClave = request.cookies.get('company_clave')?.value ?? '9254'
  const { id: traficoId } = await params

  const [trafRes, factRes, entRes, docsRes] = await Promise.all([
    supabase.from('traficos').select('*')
      .eq('trafico', traficoId).eq('company_id', companyId).single(),
    supabase.from('aduanet_facturas').select('*')
      .eq('referencia', traficoId).eq('clave_cliente', clientClave),
    supabase.from('entradas').select('*')
      .eq('trafico', traficoId).eq('company_id', companyId)
      .order('fecha_llegada_mercancia', { ascending: false }),
    supabase.from('documents').select('*').eq('trafico_id', traficoId),
  ])

  return NextResponse.json({
    trafico: trafRes.data,
    facturas: factRes.data || [],
    entradas: entRes.data || [],
    documents: docsRes.data || [],
  })
}
