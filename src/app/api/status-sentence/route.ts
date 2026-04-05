import { NextRequest, NextResponse } from 'next/server'
import { computeStatusSentence } from '@/lib/compute-status-sentence'
import { verifySession } from '@/lib/session'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const session = await verifySession(request.cookies.get('portal_session')?.value || '')
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  try {
    const clientClave = request.cookies.get('company_clave')?.value ?? ''
    const companyId = request.cookies.get('company_id')?.value ?? ''
    const result = await computeStatusSentence(clientClave, companyId)
    return NextResponse.json(result)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to compute status'
    return NextResponse.json(
      { level: 'green', sentence: 'Cargando estado...', count: 0, error: message },
      { status: 500 }
    )
  }
}
