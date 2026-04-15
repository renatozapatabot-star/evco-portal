/**
 * ZAPATA AI · V1.5 F15 — GET /api/embarques/suggest
 *
 * Returns historical pattern suggestions for cliente names that match the
 * given prefix. Used by a silver-glass combobox on the new-embarque form
 * (form wiring deferred — form does not yet exist in the portal).
 *
 * Query params:
 *   prefix  — required, ≥3 chars (ilike-safe)
 *   limit   — optional, 1..10, default 5
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifySession } from '@/lib/session'
import { suggestClientePatterns, clampLimit } from '@/lib/traficos/suggest'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

export async function GET(request: NextRequest) {
  const session = await verifySession(request.cookies.get('portal_session')?.value ?? '')
  if (!session) {
    return NextResponse.json(
      { data: null, error: { code: 'UNAUTHORIZED', message: 'Sesión inválida' } },
      { status: 401 },
    )
  }

  const url = new URL(request.url)
  const prefix = (url.searchParams.get('prefix') ?? '').trim()
  const limitRaw = Number(url.searchParams.get('limit'))

  if (prefix.length < 3) {
    return NextResponse.json(
      {
        data: null,
        error: { code: 'VALIDATION_ERROR', message: 'prefix requiere al menos 3 caracteres' },
      },
      { status: 400 },
    )
  }

  // Cliente-role sessions only see their own company; operators/admins/brokers
  // see the full cliente roster they're authorised for (RLS is the hard wall).
  const scopeCompanyId: string | null =
    session.role === 'client'
      ? session.companyId
      : (request.cookies.get('company_id')?.value ?? null)

  const suggestions = await suggestClientePatterns(
    supabase,
    scopeCompanyId,
    prefix,
    clampLimit(limitRaw),
  )

  // Best-effort telemetry — never blocks the response.
  try {
    await supabase.from('interaction_events').insert({
      event_type: 'trafico_suggest_queried',
      event_name: 'trafico_suggest_queried',
      page_path: '/api/embarques/suggest',
      user_id: `${session.companyId}:${session.role}`,
      company_id: scopeCompanyId,
      payload: {
        event: 'trafico_suggest_queried',
        prefix_len: prefix.length,
        result_count: suggestions.length,
      },
    })
  } catch {
    // telemetry failures never break the UX
  }

  return NextResponse.json(
    { data: { suggestions }, error: null },
    { headers: { 'Cache-Control': 'private, max-age=15' } },
  )
}
