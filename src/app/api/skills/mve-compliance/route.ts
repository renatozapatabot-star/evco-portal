import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifySession } from '@/lib/session'
import { createServerClient } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'

/**
 * ZAPATA AI v10 skill — mve-compliance.
 *
 * Returns MVE alert counts + recent items for the requested scope.
 * Client sees own company only; operator/admin can optionally pass
 * a company_id, else aggregate across tenants (broker view).
 *
 * Response shape: `{ data, error }` per core-invariants rule 1.
 */

export async function POST(req: NextRequest) {
  const cookieStore = await cookies()
  const token = cookieStore.get('portal_session')?.value ?? ''
  const session = await verifySession(token)
  if (!session) return NextResponse.json({ data: null, error: { code: 'UNAUTHORIZED', message: 'Sesión requerida' } }, { status: 401 })

  let body: { company_id?: string } = {}
  try { body = await req.json() } catch { /* ignore */ }

  const scope =
    session.role === 'client' ? session.companyId
    : body.company_id ?? null

  const sb = createServerClient()

  const baseCritical = sb.from('mve_alerts')
    .select('id, rule_code, trafico_id, severity, created_at, resolved')
    .eq('severity', 'critical')
    .eq('resolved', false)
    .order('created_at', { ascending: false })
    .limit(20)
  const basePending = sb.from('mve_alerts')
    .select('id', { count: 'exact', head: true })
    .eq('resolved', false)
  const criticalQ = scope ? baseCritical.eq('company_id', scope) : baseCritical
  const pendingQ = scope ? basePending.eq('company_id', scope) : basePending

  const [criticalRes, pendingRes] = await Promise.all([criticalQ, pendingQ])

  if (criticalRes.error) return NextResponse.json({ data: null, error: { code: 'DB_ERROR', message: criticalRes.error.message } }, { status: 500 })

  const rows = (criticalRes.data ?? []) as Array<{ id: string; rule_code: string | null; trafico_id: string | null; severity: string; created_at: string; resolved: boolean }>
  const critical_count = rows.length
  const total_pending = pendingRes.count ?? 0

  return NextResponse.json({
    data: {
      scope: scope ?? 'all-tenants',
      critical_count,
      total_pending,
      alerts: rows.map((r) => ({
        id: r.id,
        rule_code: r.rule_code,
        trafico_id: r.trafico_id,
        severity: r.severity,
        created_at: r.created_at,
      })),
    },
    error: null,
  })
}
