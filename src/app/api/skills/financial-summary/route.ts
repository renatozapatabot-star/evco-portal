import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifySession } from '@/lib/session'
import { createServerClient } from '@/lib/supabase-server'
import { computeARAging, computeAPAging } from '@/lib/contabilidad/aging'

export const dynamic = 'force-dynamic'

/**
 * AGUILA v10 skill — financial-summary.
 *
 * Returns AR/AP totals + aging buckets. Client-scoped for client role;
 * admin/broker see aggregate across tenants (null companyId per invariant 31).
 * Contabilidad sees scoped to session.companyId.
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

  // Scope rules
  let scope: string | null
  if (session.role === 'client') {
    scope = session.companyId
  } else if (session.role === 'contabilidad') {
    scope = session.companyId
  } else if (session.role === 'admin' || session.role === 'broker') {
    // Owner aggregates unless an explicit company_id was provided.
    scope = body.company_id ?? null
  } else {
    scope = body.company_id ?? null
  }

  const sb = createServerClient()

  try {
    const [ar, ap] = await Promise.all([
      computeARAging(sb, scope),
      computeAPAging(sb, scope),
    ])

    const arOverdue = ar.byBucket.filter(b => b.bucket !== '0-30').reduce((s, b) => s + b.amount, 0)
    const apOverdue = ap.byBucket.filter(b => b.bucket !== '0-30').reduce((s, b) => s + b.amount, 0)

    return NextResponse.json({
      data: {
        scope: scope ?? 'all-tenants',
        cxc: {
          total: ar.total,
          overdue: Math.round(arOverdue),
          count: ar.count,
          currency: ar.currency,
          buckets: ar.byBucket,
        },
        cxp: {
          total: ap.total,
          overdue: Math.round(apOverdue),
          count: ap.count,
          currency: ap.currency,
          buckets: ap.byBucket,
          source_missing: Boolean(ap.sourceMissing),
        },
        net_position: ar.total - ap.total,
      },
      error: null,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ data: null, error: { code: 'COMPUTE_ERROR', message: msg } }, { status: 500 })
  }
}
