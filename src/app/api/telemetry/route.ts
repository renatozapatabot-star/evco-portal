import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import crypto from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import { verifySession } from '@/lib/session'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// 1x1 transparent PNG (GIF89a would also work; PNG avoids any AV false positives).
const PIXEL_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
  'base64'
)

const PIXEL_HEADERS = {
  'Content-Type': 'image/png',
  'Content-Length': String(PIXEL_PNG.length),
  'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
  'Pragma': 'no-cache',
}

function pixelResponse() {
  return new NextResponse(PIXEL_PNG, { status: 200, headers: PIXEL_HEADERS })
}

/**
 * GET — email tracking pixel.
 * Block 8 briefing emails embed `<img src=".../api/telemetry?event=..&token=..">`
 * where `token = payload.signature` and `payload = "briefing:<date>:<issued_at>"`
 * signed with SESSION_SECRET (HMAC-SHA256). We log the open to interaction_events
 * and always return a 1x1 PNG regardless of validation outcome (email clients
 * must not see a broken image).
 */
export async function GET(request: NextRequest) {
  const url = new URL(request.url)
  const event = (url.searchParams.get('event') || '').slice(0, 64)
  const token = url.searchParams.get('token') || ''

  if (event !== 'briefing_email_opened' || !token) {
    return pixelResponse()
  }

  const secret = process.env.SESSION_SECRET
  if (!secret) return pixelResponse()

  const dotIdx = token.lastIndexOf('.')
  if (dotIdx < 0) return pixelResponse()
  const payload = token.slice(0, dotIdx)
  const sig = token.slice(dotIdx + 1)

  let valid = false
  try {
    const expected = crypto.createHmac('sha256', secret).update(payload).digest('hex')
    const a = Buffer.from(expected, 'hex')
    const b = Buffer.from(sig, 'hex')
    if (a.length === b.length) valid = crypto.timingSafeEqual(a, b)
  } catch {
    valid = false
  }
  if (!valid) return pixelResponse()

  // Payload shape: "briefing:<subjectDate>:<issuedAtSec>"
  const parts = payload.split(':')
  if (parts[0] !== 'briefing') return pixelResponse()
  const subjectDate = parts[1] || null
  const issuedAt = Number(parts[2] || 0)
  // 14-day TTL — beyond that we still serve the pixel but skip logging.
  if (!issuedAt || Date.now() / 1000 - issuedAt > 14 * 86_400) return pixelResponse()

  try {
    await supabase.from('interaction_events').insert({
      event_type: 'briefing_email_opened',
      event_name: 'briefing_email_opened',
      page_path: '/api/telemetry',
      user_id: 'system:email-pixel',
      payload: { subject_date: subjectDate, issued_at: issuedAt },
      user_agent: request.headers.get('user-agent')?.substring(0, 300) || null,
    })
  } catch {
    // Swallow — pixel must load even if DB write fails.
  }
  return pixelResponse()
}

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

    // Fire-and-forget: telemetry failure (schema drift, service blip) must
    // never break the client page. We log the error server-side so Vercel
    // picks it up but always return 200 to the caller.
    try {
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
        console.error('[telemetry] insert failed:', error.message)
      }
    } catch (e) {
      console.error('[telemetry] insert threw:', e instanceof Error ? e.message : String(e))
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

  // Legacy batch path: same fire-and-forget contract — dropped telemetry is
  // better than a broken page.
  try {
    const { error } = await supabase.from('interaction_events').insert(rows)
    if (error) {
      console.error('[telemetry] batch insert failed:', error.message)
    }
  } catch (e) {
    console.error('[telemetry] batch insert threw:', e instanceof Error ? e.message : String(e))
  }
  return NextResponse.json({ ok: true })
}
