/**
 * POST /api/briefings/:id/dismiss — marks a client_briefings row
 * dismissed_at = NOW() if the signed session owns it.
 *
 * Fire-and-forget from the UI; errors don't surface to the user
 * (the briefing just reappears on next page load if the write fails).
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifySession } from '@/lib/session'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

export async function POST(
  request: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const session = await verifySession(request.cookies.get('portal_session')?.value ?? '')
  if (!session) {
    return NextResponse.json(
      { data: null, error: { code: 'UNAUTHORIZED', message: 'Sesión inválida' } },
      { status: 401 },
    )
  }
  const { id } = await ctx.params
  if (!id) {
    return NextResponse.json(
      { data: null, error: { code: 'VALIDATION_ERROR', message: 'id required' } },
      { status: 400 },
    )
  }

  const { error } = await supabase
    .from('client_briefings')
    .update({ dismissed_at: new Date().toISOString() })
    .eq('id', id)
    .eq('company_id', session.companyId)

  if (error) {
    return NextResponse.json(
      { data: null, error: { code: 'INTERNAL_ERROR', message: error.message } },
      { status: 500 },
    )
  }
  return NextResponse.json({ data: { dismissed: true }, error: null })
}
