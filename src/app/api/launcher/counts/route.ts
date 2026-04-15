/**
 * GET /api/launcher/counts
 *
 * Returns the per-tool "pending work" counts surfaced as red-dot badges in
 * the LauncherTray and on the `+ TOOLS` button in TopNav.
 *
 * Role-scoped:
 *   - admin / broker → cross-tenant aggregate (invariant 31)
 *   - everyone else  → own company_id
 *
 * Cached 30s (private) so opening/closing the tray repeatedly doesn't
 * thrash Supabase. Counts that take >2s soft-fall to null instead of
 * blocking the response.
 */

import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifySession } from '@/lib/session'

export const dynamic = 'force-dynamic'

const TIMEOUT_MS = 2000

interface LauncherCountsPayload {
  clasificador: number | null
  llamadas: number | null
  auditoria: number | null
}

function withTimeout<T>(p: PromiseLike<T>, ms: number, fallback: T): Promise<T> {
  return Promise.race([
    Promise.resolve(p).catch(() => fallback),
    new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms)),
  ])
}

export async function GET(request: NextRequest) {
  const sessionToken = request.cookies.get('portal_session')?.value ?? ''
  const session = await verifySession(sessionToken)
  if (!session) {
    return NextResponse.json(
      { data: null, error: { code: 'UNAUTHORIZED', message: 'Sesión inválida' } },
      { status: 401 },
    )
  }

  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const isInternal = session.role === 'admin' || session.role === 'broker'
  const companyId = session.companyId
  const sevenDaysAgoIso = new Date(Date.now() - 7 * 86_400_000).toISOString()

  // Build scoped queries. For internal roles we omit the company_id
  // filter (per invariant 31 — admin sees all tenants).
  const productosQ = isInternal
    ? sb.from('globalpc_productos').select('id', { count: 'exact', head: true }).or('fraccion.is.null,fraccion.eq.')
    : sb.from('globalpc_productos').select('id', { count: 'exact', head: true }).eq('company_id', companyId).or('fraccion.is.null,fraccion.eq.')

  const llamadasQ = isInternal
    ? sb.from('call_transcripts').select('id', { count: 'exact', head: true }).gte('transcribed_at', sevenDaysAgoIso)
    : sb.from('call_transcripts').select('id', { count: 'exact', head: true }).eq('company_id', companyId).gte('transcribed_at', sevenDaysAgoIso)

  // audit_suggestions is a broker-wide table — only meaningful for admin/broker.
  const auditQ = isInternal
    ? sb.from('audit_suggestions').select('id', { count: 'exact', head: true }).eq('status', 'pending')
    : null

  const [prodRes, callRes, auditRes] = await Promise.all([
    withTimeout(productosQ, TIMEOUT_MS, { count: null, error: null } as { count: number | null; error: unknown }),
    withTimeout(llamadasQ, TIMEOUT_MS, { count: null, error: null } as { count: number | null; error: unknown }),
    auditQ
      ? withTimeout(auditQ, TIMEOUT_MS, { count: null, error: null } as { count: number | null; error: unknown })
      : Promise.resolve({ count: null, error: null }),
  ])

  const payload: LauncherCountsPayload = {
    clasificador: prodRes?.error ? null : (prodRes?.count ?? null),
    llamadas: callRes?.error ? null : (callRes?.count ?? null),
    auditoria: auditRes?.error ? null : (auditRes?.count ?? null),
  }

  return NextResponse.json(
    { data: payload, error: null },
    { headers: { 'Cache-Control': 'private, max-age=30' } },
  )
}
