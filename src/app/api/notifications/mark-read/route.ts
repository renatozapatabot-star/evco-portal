import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { verifySession } from '@/lib/session'
import { markNotificationRead } from '@/lib/notifications'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const BodySchema = z.object({ id: z.string().min(1).max(64) })

/**
 * V1 Polish Pack · Block 6 — mark a single notification read.
 * Bell dropdown calls this on click. Scoped by company via the helper.
 */
export async function POST(request: NextRequest) {
  const session = await verifySession(request.cookies.get('portal_session')?.value || '')
  if (!session) {
    return NextResponse.json(
      { data: null, error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } },
      { status: 401 },
    )
  }
  const companyId = session.role === 'client'
    ? session.companyId
    : (request.cookies.get('company_id')?.value || session.companyId)

  let body: unknown
  try { body = await request.json() } catch {
    return NextResponse.json(
      { data: null, error: { code: 'VALIDATION_ERROR', message: 'Invalid JSON' } },
      { status: 400 },
    )
  }
  const parsed = BodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { data: null, error: { code: 'VALIDATION_ERROR', message: parsed.error.message } },
      { status: 400 },
    )
  }

  const result = await markNotificationRead(parsed.data.id, companyId)
  if (!result.ok) {
    return NextResponse.json(
      { data: null, error: { code: 'INTERNAL_ERROR', message: result.error || 'update failed' } },
      { status: 500 },
    )
  }
  return NextResponse.json({ data: { ok: true }, error: null })
}
