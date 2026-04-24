/**
 * POST /api/workflows/feedback
 *
 * Records a thumbs up/down + optional comment against a finding.
 * Feedback is tenant-scoped, append-only, and the signal the runner
 * uses to blend confidence on future findings of the same pattern
 * family (see src/lib/workflows/feedback.ts).
 *
 * Body: { finding_id, thumbs: 'up' | 'down', comment_es?, status? }
 * `status` is optional — when set to 'acknowledged' | 'dismissed' |
 * 'resolved' the finding row is flipped in the same request so the
 * widget can collapse it immediately.
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerClient } from '@/lib/supabase-server'
import { verifySession } from '@/lib/session'
import { isShadowModeCompany } from '@/lib/workflows/scope'
import { setFindingStatus } from '@/lib/workflows/query'
import type { WorkflowKind } from '@/lib/workflows/types'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const BodySchema = z.object({
  finding_id: z.string().uuid('finding_id must be a UUID'),
  thumbs: z.enum(['up', 'down']),
  comment_es: z.string().trim().max(2000).optional(),
  status: z.enum(['acknowledged', 'dismissed', 'resolved']).optional(),
})

function err(code: string, message: string, status: number) {
  return NextResponse.json({ data: null, error: { code, message } }, { status })
}

export async function POST(req: NextRequest) {
  const token = req.cookies.get('portal_session')?.value ?? ''
  const session = await verifySession(token)
  if (!session) return err('UNAUTHORIZED', 'No autorizado', 401)

  let rawBody: unknown
  try {
    rawBody = await req.json()
  } catch {
    return err('VALIDATION_ERROR', 'Body inválido', 400)
  }

  const parsed = BodySchema.safeParse(rawBody)
  if (!parsed.success) {
    return err('VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Datos inválidos', 400)
  }

  const supabase = createServerClient()

  // Load the finding — every feedback write must attach to a real
  // row and the tenant-scope must match the caller's session. Admin
  // + broker sessions can also leave feedback on any tenant (for
  // calibration/QA) — this mirrors the /api/workflows/findings rule.
  const { data: finding, error: loadError } = await supabase
    .from('workflow_findings')
    .select('id, company_id, kind, signature')
    .eq('id', parsed.data.finding_id)
    .limit(1)
    .maybeSingle()

  if (loadError) return err('INTERNAL_ERROR', 'No pudimos cargar el hallazgo', 500)
  if (!finding) return err('NOT_FOUND', 'Hallazgo no encontrado', 404)

  const internalRoles = new Set(['admin', 'broker', 'operator'])
  const isInternal = internalRoles.has(session.role)
  if (!isInternal && finding.company_id !== session.companyId) {
    return err('FORBIDDEN', 'Acceso denegado', 403)
  }
  if (!isShadowModeCompany(finding.company_id)) {
    return err('FORBIDDEN', 'Workflow no activo para este cliente', 403)
  }

  const { error: insertError } = await supabase.from('workflow_feedback').insert({
    finding_id: finding.id,
    company_id: finding.company_id,
    kind: finding.kind,
    signature: finding.signature,
    actor_id: null,
    actor_role: session.role,
    thumbs: parsed.data.thumbs,
    comment_es: parsed.data.comment_es ?? null,
  })
  if (insertError) return err('INTERNAL_ERROR', 'No pudimos guardar la retro', 500)

  if (parsed.data.status) {
    try {
      await setFindingStatus(
        supabase,
        finding.id,
        finding.company_id,
        parsed.data.status,
        session.role,
      )
    } catch {
      return err('INTERNAL_ERROR', 'Retro guardada, pero no pudimos actualizar el estado', 500)
    }
  }

  return NextResponse.json({
    data: { ok: true, kind: finding.kind as WorkflowKind },
    error: null,
  })
}
