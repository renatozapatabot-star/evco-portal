/**
 * Block 3 · Dynamic Report Builder — full build endpoint (cap 5000).
 */
import { NextRequest, NextResponse } from 'next/server'
import { verifySession } from '@/lib/session'
import { runReportQuery } from '@/lib/report-engine'
import { parseReportConfig } from '@/lib/report-config-validator'

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

  const claveCliente = request.cookies.get('company_clave')?.value ?? null
  const result = await runReportQuery(parsed.config, {
    companyId: session.companyId,
    role: session.role,
    claveCliente,
  })
  return NextResponse.json({ data: result, error: null })
}
