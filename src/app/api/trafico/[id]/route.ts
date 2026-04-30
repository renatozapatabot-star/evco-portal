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
  // never from forgeable cookies (baseline I20). `clave_cliente` for the
  // facturas join is resolved from the verified owner's `companies` row
  // below, NOT from the forgeable `company_clave` cookie.
  const session = await verifySession(request.cookies.get('portal_session')?.value ?? '')
  if (!session) return NextResponse.json({ data: null, error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } }, { status: 401 })
  const isInternal = session.role === 'broker' || session.role === 'admin'
  const companyId = session.companyId
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

  // Resolve clave_cliente from the companies table using the verified
  // ownerCompanyId. Replaces the prior forgeable `company_clave` cookie
  // read (security audit B1 / 2026-04-24 finding F6: any client could
  // set their cookie to another tenant's clave and read SAT facturas).
  const { data: companyRow } = await supabase
    .from('companies')
    .select('clave_cliente')
    .eq('company_id', ownerCompanyId)
    .maybeSingle<{ clave_cliente: string | null }>()
  const verifiedClave = companyRow?.clave_cliente ?? null

  // Step 2 — Dependents, all anchored to verified scoping.
  // aduanet_facturas keys by clave_cliente (GlobalPC clave) per its
  // schema; company_id is not the join key. We anchor to the
  // server-verified clave from companies, not a client cookie.
  let factQ = supabase.from('aduanet_facturas').select('*').eq('referencia', traficoId)
  if (!isInternal) {
    if (!verifiedClave) {
      // No clave on file — fail closed instead of fanning out to all tenants.
      return NextResponse.json({ trafico: trafRes.data, facturas: [], entradas: [], documents: [] })
    }
    factQ = factQ.eq('clave_cliente', verifiedClave)
  }

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
