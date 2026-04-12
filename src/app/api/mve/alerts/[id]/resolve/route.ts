/**
 * AGUILA · Block 17 — Resolve MVE alert.
 * PATCH /api/mve/alerts/[id]/resolve
 * Marks the alert resolved; records resolver as `${companyId}:${role}`.
 */

import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@supabase/supabase-js'
import { verifySession } from '@/lib/session'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

export async function PATCH(
  _request: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params
  const cookieStore = await cookies()
  const token = cookieStore.get('portal_session')?.value || ''
  const session = await verifySession(token)
  if (!session) {
    return NextResponse.json(
      { data: null, error: { code: 'UNAUTHORIZED', message: 'Sesión inválida' } },
      { status: 401 },
    )
  }
  if (session.role !== 'admin' && session.role !== 'broker' && session.role !== 'operator') {
    return NextResponse.json(
      { data: null, error: { code: 'FORBIDDEN', message: 'Acceso restringido' } },
      { status: 403 },
    )
  }

  const resolvedBy = `${session.companyId}:${session.role}`

  const { data, error } = await supabase
    .from('mve_alerts')
    .update({
      resolved: true,
      resolved_at: new Date().toISOString(),
      resolved_by: resolvedBy,
    })
    .eq('id', id)
    .select('id, resolved, resolved_at, resolved_by')
    .maybeSingle()

  if (error) {
    return NextResponse.json(
      { data: null, error: { code: 'INTERNAL_ERROR', message: error.message } },
      { status: 500 },
    )
  }
  if (!data) {
    return NextResponse.json(
      { data: null, error: { code: 'NOT_FOUND', message: 'Alerta no encontrada' } },
      { status: 404 },
    )
  }
  return NextResponse.json({ data, error: null })
}
