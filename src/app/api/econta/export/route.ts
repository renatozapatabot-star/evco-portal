/**
 * POST /api/econta/export
 *
 * Queue one or more tráficos for export to bd_econta_rz (eCONTA MySQL).
 * The actual MySQL writer runs as a PM2 script reading this queue —
 * this endpoint only records the operator's intent + tenant scope.
 *
 * Body: { trafico_id } or { trafico_ids: [...] }
 * Idempotent: if a pending row already exists for the tráfico, returns
 * the existing queue entry instead of inserting a duplicate.
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@supabase/supabase-js'
import { verifySession } from '@/lib/session'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

const INTERNAL_ROLES = new Set(['operator', 'admin', 'broker', 'contabilidad'])

const BodySchema = z.union([
  z.object({ trafico_id: z.string().min(1).max(128) }),
  z.object({ trafico_ids: z.array(z.string().min(1).max(128)).min(1).max(100) }),
])

function err(code: string, message: string, status: number) {
  return NextResponse.json({ data: null, error: { code, message } }, { status })
}

export async function POST(req: NextRequest) {
  const session = await verifySession(req.cookies.get('portal_session')?.value ?? '')
  if (!session) return err('UNAUTHORIZED', 'Sesión inválida', 401)
  if (!INTERNAL_ROLES.has(session.role)) {
    return err('FORBIDDEN', 'Solo roles internos', 403)
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return err('VALIDATION_ERROR', 'JSON inválido', 400)
  }
  const parsed = BodySchema.safeParse(body)
  if (!parsed.success) {
    return err('VALIDATION_ERROR', parsed.error.issues.map((i) => i.message).join('; '), 400)
  }

  const ids = 'trafico_id' in parsed.data
    ? [parsed.data.trafico_id]
    : parsed.data.trafico_ids

  // Tenant-scope the tráficos — operators/admin can export across clients,
  // but every row still carries the original trafico company_id so the
  // eCONTA writer can route correctly.
  const { data: traficos, error: tErr } = await supabase
    .from('traficos')
    .select('trafico, company_id')
    .in('trafico', ids)
  if (tErr) return err('DB_ERROR', tErr.message, 500)
  const found = new Map<string, string>()
  for (const t of (traficos ?? []) as { trafico: string; company_id: string | null }[]) {
    if (t.company_id) found.set(t.trafico, t.company_id)
  }

  const missing = ids.filter((id) => !found.has(id))

  // Skip tráficos that already have a pending export.
  const { data: existingPending } = await supabase
    .from('trafico_econta_exports')
    .select('trafico_id, id, queued_at')
    .eq('status', 'pending')
    .in('trafico_id', ids)
  const alreadyQueued = new Map(
    ((existingPending ?? []) as { trafico_id: string; id: string; queued_at: string }[])
      .map((r) => [r.trafico_id, r]),
  )

  const toInsert = ids
    .filter((id) => found.has(id) && !alreadyQueued.has(id))
    .map((id) => ({
      trafico_id: id,
      company_id: found.get(id)!,
      status: 'pending' as const,
      queued_by: `${session.companyId}:${session.role}`,
    }))

  let inserted: Array<{ id: string; trafico_id: string; queued_at: string }> = []
  if (toInsert.length > 0) {
    const { data: insData, error: insErr } = await supabase
      .from('trafico_econta_exports')
      .insert(toInsert)
      .select('id, trafico_id, queued_at')
    if (insErr) return err('DB_ERROR', insErr.message, 500)
    inserted = (insData ?? []) as Array<{ id: string; trafico_id: string; queued_at: string }>
  }

  return NextResponse.json({
    data: {
      queued: inserted.length,
      already_pending: alreadyQueued.size,
      missing: missing.length,
      results: [
        ...inserted.map((r) => ({ trafico_id: r.trafico_id, status: 'queued' as const, id: r.id })),
        ...Array.from(alreadyQueued.values()).map((r) => ({ trafico_id: r.trafico_id, status: 'already_pending' as const, id: r.id })),
        ...missing.map((id) => ({ trafico_id: id, status: 'missing' as const })),
      ],
    },
    error: null,
  })
}

export async function GET(req: NextRequest) {
  const session = await verifySession(req.cookies.get('portal_session')?.value ?? '')
  if (!session) return err('UNAUTHORIZED', 'Sesión inválida', 401)
  if (!INTERNAL_ROLES.has(session.role)) return err('FORBIDDEN', 'Solo roles internos', 403)

  const sp = req.nextUrl.searchParams
  const statusFilter = sp.get('status')
  const limit = Math.min(Math.max(Number.parseInt(sp.get('limit') ?? '50', 10) || 50, 1), 200)

  let query = supabase
    .from('trafico_econta_exports')
    .select('id, trafico_id, company_id, status, queued_at, exported_at, error_message, attempts')
    .order('queued_at', { ascending: false })
    .limit(limit)
  if (statusFilter && ['pending', 'exported', 'error'].includes(statusFilter)) {
    query = query.eq('status', statusFilter)
  }

  const { data, error } = await query
  if (error) return err('DB_ERROR', error.message, 500)
  return NextResponse.json({ data: data ?? [], error: null })
}
