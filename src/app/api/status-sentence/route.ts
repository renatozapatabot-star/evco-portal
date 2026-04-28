import { NextRequest, NextResponse } from 'next/server'
import { computeStatusSentence } from '@/lib/compute-status-sentence'
import { verifySession } from '@/lib/session'
import { resolveTenantScope } from '@/lib/api/tenant-scope'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const session = await verifySession(request.cookies.get('portal_session')?.value || '')
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  try {
    const companyId = resolveTenantScope(session, request)
    if (!companyId) return NextResponse.json({ error: 'Tenant scope required' }, { status: 400 })
    // clientClave parameter is legacy / unused inside computeStatusSentence;
    // pass empty string. Tenant gate is companyId.
    const result = await computeStatusSentence('', companyId)
    return NextResponse.json(result)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to compute status'
    return NextResponse.json(
      { level: 'green', sentence: 'Cargando estado...', count: 0, error: message },
      { status: 500 }
    )
  }
}
