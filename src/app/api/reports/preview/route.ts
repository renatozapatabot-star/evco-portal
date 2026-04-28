/**
 * Block 3 · Dynamic Report Builder — preview endpoint (20 rows).
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifySession } from '@/lib/session'
import { resolveTenantScope } from '@/lib/api/tenant-scope'
import { runReportPreview } from '@/lib/report-engine'
import { parseReportConfig } from '@/lib/report-config-validator'

// P0-A7: resolve clave_cliente from the verified companyId, never the cookie.
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!SERVICE_ROLE) throw new Error('SUPABASE_SERVICE_ROLE_KEY required for /api/reports/preview')
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, SERVICE_ROLE)

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  const token = request.cookies.get('portal_session')?.value ?? ''
  const session = await verifySession(token)
  if (!session) {
    return NextResponse.json(
      { data: null, error: { code: 'UNAUTHORIZED', message: 'No autenticado' } },
      { status: 401 },
    )
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { data: null, error: { code: 'VALIDATION_ERROR', message: 'JSON inválido' } },
      { status: 400 },
    )
  }
  const parsed = parseReportConfig(body)
  if (!parsed.ok) {
    return NextResponse.json(
      { data: null, error: { code: 'VALIDATION_ERROR', message: parsed.message } },
      { status: 400 },
    )
  }

  const companyId = resolveTenantScope(session, request)
  const { data: companyRow } = companyId
    ? await supabase.from('companies').select('clave_cliente').eq('company_id', companyId).maybeSingle()
    : { data: null }
  const claveCliente = (companyRow?.clave_cliente as string | undefined) ?? null
  const result = await runReportPreview(parsed.config, {
    companyId: companyId || session.companyId,
    role: session.role,
    claveCliente,
  })

  if (!result.ok) {
    return NextResponse.json({ data: result, error: null })
  }
  return NextResponse.json({ data: result, error: null })
}
