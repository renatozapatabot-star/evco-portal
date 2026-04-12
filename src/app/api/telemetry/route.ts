import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifySession } from '@/lib/session'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const OK = NextResponse.json({ ok: true })

interface IncomingEvent {
  event_type?: string
  event_name?: string
  page_path?: string
  session_id?: string
  payload?: Record<string, unknown>
  viewport?: string
  timestamp?: string
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const events: IncomingEvent[] = Array.isArray(body.events)
      ? body.events.slice(0, 50)
      : []

    if (events.length === 0) return OK

    // Auth enrichment — non-blocking, never rejects
    let companyId: string | null = null
    let operatorId: string | null = null
    try {
      const token = request.cookies.get('portal_session')?.value || ''
      const session = await verifySession(token)
      if (session) companyId = session.companyId
      operatorId = request.cookies.get('operator_id')?.value || null
    } catch {
      // Silent — proceed without enrichment
    }

    const ua = request.headers.get('user-agent')?.substring(0, 300) || null

    const rows = events.map((e) => ({
      event_type: String(e.event_type || 'unknown').substring(0, 50),
      event_name: e.event_name ? String(e.event_name).substring(0, 100) : null,
      page_path: String(e.page_path || '/').substring(0, 500),
      company_id: companyId,
      operator_id: operatorId,
      session_id: e.session_id ? String(e.session_id).substring(0, 36) : null,
      payload: e.payload && typeof e.payload === 'object' ? e.payload : {},
      user_agent: ua,
      viewport: e.viewport ? String(e.viewport).substring(0, 20) : null,
      created_at: e.timestamp || new Date().toISOString(),
    }))

    await supabase.from('interaction_events').insert(rows)
  } catch {
    // Silent — telemetry never breaks the client
  }

  return OK
}
