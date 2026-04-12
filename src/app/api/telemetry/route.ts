import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@supabase/supabase-js'
import { verifySession } from '@/lib/session'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// ── Legacy batch shape (pre-Polish-Pack) ──
interface IncomingEvent {
  event_type?: string
  event_name?: string
  page_path?: string
  session_id?: string
  payload?: Record<string, unknown>
  viewport?: string
  timestamp?: string
}

// ── V1 Polish Pack · Block 0 single-event shape ──
const PolishPackSchema = z.object({
  event: z.string().min(1).max(64),
  entityType: z.string().max(64).optional(),
  entityId: z.string().max(128).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  route: z.string().max(256).optional(),
})

export async function POST(request: NextRequest) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ data: null, error: { code: 'VALIDATION_ERROR', message: 'Invalid JSON' } }, { status: 400 })
  }

  // Resolve session once — Block 0 requires auth, legacy batch path tolerates missing.
  const token = request.cookies.get('portal_session')?.value || ''
  const session = await verifySession(token)
  const operatorId = request.cookies.get('operator_id')?.value || null
  const ua = request.headers.get('user-agent')?.substring(0, 300) || null

  // ── Polish Pack single-event path ──
  if (body && typeof body === 'object' && 'event' in body) {
    if (!session) {
      return NextResponse.json({ data: null, error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } }, { status: 401 })
    }
    const parsed = PolishPackSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ data: null, error: { code: 'VALIDATION_ERROR', message: parsed.error.message } }, { status: 400 })
    }
    const { event, entityType, entityId, metadata, route } = parsed.data
    const userId = `${session.companyId}:${session.role}`
    const referer = request.headers.get('referer') || ''
    const routePath = route || (() => { try { return new URL(referer).pathname } catch { return '/' } })()

    const { error } = await supabase.from('interaction_events').insert({
      event_type: event,
      event_name: event,
      page_path: routePath,
      user_id: userId,
      company_id: session.companyId,
      operator_id: operatorId,
      entity_type: entityType ?? null,
      entity_id: entityId ?? null,
      payload: metadata ?? {},
      user_agent: ua,
    })
    if (error) {
      return NextResponse.json({ data: null, error: { code: 'INTERNAL_ERROR', message: error.message } }, { status: 500 })
    }
    return NextResponse.json({ data: { ok: true }, error: null })
  }

  // ── Legacy batch path ──
  const events: IncomingEvent[] = Array.isArray((body as { events?: unknown })?.events)
    ? ((body as { events: IncomingEvent[] }).events).slice(0, 50)
    : []

  if (events.length === 0) return NextResponse.json({ ok: true })

  const companyId = session?.companyId ?? null
  const userId = session ? `${session.companyId}:${session.role}` : null

  const rows = events.map((e) => ({
    event_type: String(e.event_type || 'unknown').substring(0, 50),
    event_name: e.event_name ? String(e.event_name).substring(0, 100) : null,
    page_path: String(e.page_path || '/').substring(0, 500),
    user_id: userId,
    company_id: companyId,
    operator_id: operatorId,
    session_id: e.session_id ? String(e.session_id).substring(0, 36) : null,
    payload: e.payload && typeof e.payload === 'object' ? e.payload : {},
    user_agent: ua,
    viewport: e.viewport ? String(e.viewport).substring(0, 20) : null,
    created_at: e.timestamp || new Date().toISOString(),
  }))

  const { error } = await supabase.from('interaction_events').insert(rows)
  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
