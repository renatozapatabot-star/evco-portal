/**
 * GET /api/workflows/findings
 *
 * Returns the active shadow findings for the authenticated tenant.
 * Admin/broker sessions may read a specific tenant via ?companyId=,
 * client sessions are locked to their own `session.companyId`.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase-server'
import { verifySession } from '@/lib/session'
import { isShadowModeCompany } from '@/lib/workflows/scope'
import { listFindings, summarize } from '@/lib/workflows/query'
import type { WorkflowKind } from '@/lib/workflows/types'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

function parseKinds(raw: string | null): WorkflowKind[] | undefined {
  if (!raw) return undefined
  const allowed = new Set<WorkflowKind>(['missing_nom', 'high_value_risk', 'duplicate_shipment'])
  const split = raw.split(',').map((s) => s.trim()).filter(Boolean)
  const narrowed = split.filter((s): s is WorkflowKind => allowed.has(s as WorkflowKind))
  return narrowed.length > 0 ? narrowed : undefined
}

export async function GET(req: NextRequest) {
  const token = req.cookies.get('portal_session')?.value ?? ''
  const session = await verifySession(token)
  if (!session) {
    return NextResponse.json(
      { data: null, error: { code: 'UNAUTHORIZED', message: 'No autorizado' } },
      { status: 401 },
    )
  }

  const sp = req.nextUrl.searchParams
  const internalRoles = new Set(['admin', 'broker', 'operator'])
  const requestedCompany = sp.get('companyId')?.trim() ?? ''
  const companyId =
    requestedCompany && internalRoles.has(session.role)
      ? requestedCompany
      : session.companyId

  if (!isShadowModeCompany(companyId)) {
    // Return an empty envelope rather than 404 — widget should render
    // a calm "no activo" state for non-shadow tenants.
    return NextResponse.json({
      data: {
        company_id: companyId,
        shadow_mode: false,
        findings: [],
        summary: {
          total: 0,
          by_kind: { missing_nom: 0, high_value_risk: 0, duplicate_shipment: 0 },
          by_severity: { info: 0, warning: 0, critical: 0 },
          last_run_at: null,
        },
      },
      error: null,
    })
  }

  const limitRaw = Number.parseInt(sp.get('limit') ?? '40', 10)
  const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(limitRaw, 200) : 40
  const kinds = parseKinds(sp.get('kinds'))
  const includeResolved = sp.get('includeResolved') === 'true'

  const supabase = createServerClient()
  const [findings, summary] = await Promise.all([
    listFindings(supabase, companyId, { limit, kinds, includeResolved }),
    summarize(supabase, companyId),
  ])

  return NextResponse.json({
    data: {
      company_id: companyId,
      shadow_mode: true,
      findings,
      summary,
    },
    error: null,
  })
}
