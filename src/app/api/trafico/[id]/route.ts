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

  // Step 1 — Confirm trafico ownership BEFORE any dependent fetch
  // (V1 Clean Visibility 2026-04-24: same IDOR pattern as the page-level
  // /pedimentos/[id] fix). Dependents anchor company_id to the verified
  // owner's row, defense-in-depth even for internal roles.
  let trafQ = supabase.from('traficos').select('*').eq('trafico', traficoId)
  if (!isInternal) trafQ = trafQ.eq('company_id', companyId)
  trafQ = trafQ.gte('fecha_llegada', PORTAL_DATE_FROM)

  const trafRes = await trafQ.maybeSingle()
  if (!trafRes.data) {
    return NextResponse.json({ trafico: null, facturas: [], entradas: [], documents: [] })
  }
  const ownerCompanyId = (trafRes.data as { company_id: string | null }).company_id
  if (!ownerCompanyId) {
    // Hard stop on legacy NULL company_id — never serve dependents
    // without a tenant anchor.
    return NextResponse.json({ trafico: null, facturas: [], entradas: [], documents: [] })
  }

  // Step 2 — Dependents, all anchored to ownerCompanyId.
  let factQ = supabase.from('aduanet_facturas').select('*').eq('referencia', traficoId)
  if (!isInternal) factQ = factQ.eq('clave_cliente', clientClave)
  // aduanet_facturas tracks SAT-side filings keyed by clave_cliente
  // (the GlobalPC clave); company_id is not the join key here. Internal
  // roles see all facturas for this trafico (the trafico itself was
  // already tenant-scoped above).

  const entQ = supabase.from('entradas')
    .select('*')
    .eq('trafico', traficoId)
    .eq('company_id', ownerCompanyId)
    .order('fecha_llegada_mercancia', { ascending: false })

  const docsQ = supabase.from('documents')
    .select('*')
    .eq('trafico_id', traficoId)
    .eq('company_id', ownerCompanyId)

  const [factRes, entRes, docsRes] = await Promise.all([factQ, entQ, docsQ])

  return NextResponse.json({
    trafico: trafRes.data,
    facturas: factRes.data || [],
    entradas: entRes.data || [],
    documents: docsRes.data || [],
  })
}
