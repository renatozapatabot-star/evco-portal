/**
 * POST /api/audit — client-side event reporting.
 *
 * V1 security fix — was previously unauthenticated with body.tenant_slug
 * spoofable. Now:
 *   · Requires a valid portal_session.
 *   · tenant_slug derived from session.companyId, never from body.
 *   · Silent-success preserved (telemetry never breaks UI).
 */
import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { verifySession } from '@/lib/session'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

export async function POST(request: NextRequest) {
  const session = await verifySession(request.cookies.get('portal_session')?.value ?? '')
  if (!session) {
    return NextResponse.json(
      { data: null, error: { code: 'UNAUTHORIZED', message: 'Sesión inválida' } },
      { status: 401 },
    )
  }
  try {
    const body = await request.json()
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown'
    const ua = request.headers.get('user-agent') || ''
    await supabase.from('portal_audit_log').insert({
      event_type: body.event_type,
      tenant_slug: session.companyId,
      path: body.path,
      query: body.query,
      ip_address: ip,
      user_agent: ua.substring(0, 200),
      metadata: body.metadata || {},
    })
    return NextResponse.json({ data: { logged: true }, error: null })
  } catch {
    return NextResponse.json({ data: { logged: false }, error: null })
  }
}
