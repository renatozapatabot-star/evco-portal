import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { verifySession } from '@/lib/session'
import { PORTAL_DATE_FROM } from '@/lib/data'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // V1 Clean Visibility (2026-04-24): role + companyId from HMAC session,
  // never from forgeable cookies (baseline I20). The `company_clave` cookie
  // remains read because it carries the GlobalPC clave (joined later) —
  // not a tenant-isolation signal on its own.
  const session = await verifySession(request.cookies.get('portal_session')?.value ?? '')
  if (!session) return NextResponse.json({ data: null, error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } }, { status: 401 })
  const isInternal = session.role === 'broker' || session.role === 'admin'
  const companyId = session.companyId
  const clientClave = request.cookies.get('company_clave')?.value ?? ''
  const { id: traficoId } = await params

  // Broker/admin: query by trafico only, no company_id filter (they see all)
  let trafQ = supabase.from('traficos').select('*').eq('trafico', traficoId)
  if (!isInternal) trafQ = trafQ.eq('company_id', companyId)
  trafQ = trafQ.gte('fecha_llegada', PORTAL_DATE_FROM)

  let factQ = supabase.from('aduanet_facturas').select('*').eq('referencia', traficoId)
  if (!isInternal) factQ = factQ.eq('clave_cliente', clientClave)

  const entQ = supabase.from('entradas').select('*').eq('trafico', traficoId)
    .order('fecha_llegada_mercancia', { ascending: false })

  const [trafRes, factRes, entRes, docsRes] = await Promise.all([
    trafQ.maybeSingle(),
    factQ,
    entQ,
    supabase.from('documents').select('*').eq('trafico_id', traficoId),
  ])

  return NextResponse.json({
    trafico: trafRes.data,
    facturas: factRes.data || [],
    entradas: entRes.data || [],
    documents: docsRes.data || [],
  })
}
