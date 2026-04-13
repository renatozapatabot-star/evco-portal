/**
 * V1 Polish Pack · Block 5 — send supplier doc request.
 *
 * POST /api/solicitations/send
 *
 * Session-scoped (verifySession). Tenant-scoped writes.
 *   1. Validate embarque ownership for non-internal roles
 *   2. Send email via Resend (sistema@renatozapata.com — domain must be verified)
 *   3. Insert one documento_solicitudes row per doc type (upsert on UNIQUE(trafico_id, doc_type))
 *   4. Emit workflow_events row `docs.solicitation_sent` with populated
 *      missing_document_types array — upstream of the empty-array bug
 *      fixed earlier tonight
 *   5. Log to operational_decisions via decision-logger
 *
 * Never throws. Returns { data, error } discriminated union.
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { Resend } from 'resend'
import { verifySession } from '@/lib/session'
import { createServerClient } from '@/lib/supabase-server'
import { logDecision } from '@/lib/decision-logger'

const SENDER = 'Renato Zapata & Company <sistema@renatozapata.com>'

const RequestSchema = z.object({
  traficoId: z.string().min(1).max(120),
  docTypes: z.array(z.string().min(1).max(60)).min(1).max(20),
  recipientEmail: z.string().email(),
  recipientName: z.string().max(200).optional().default(''),
  subject: z.string().min(1).max(300),
  body: z.string().min(1).max(10_000),
})

type Ok = { data: { solicitationId: string; sent: number }; error: null }
type Err = { data: null; error: { code: string; message: string } }

function err(code: string, message: string, status: number): NextResponse<Err> {
  return NextResponse.json({ data: null, error: { code, message } }, { status })
}

export async function POST(request: NextRequest): Promise<NextResponse<Ok | Err>> {
  const token = request.cookies.get('portal_session')?.value ?? ''
  const session = await verifySession(token)
  if (!session) {
    return err('UNAUTHORIZED', 'Sesión inválida', 401)
  }

  const raw = await request.json().catch((e: unknown) => {
    if (process.env.NODE_ENV !== 'production') {
      // eslint-disable-next-line no-console
      console.warn('[solicitations/send] bad JSON', e)
    }
    return null
  })
  if (raw === null) {
    return err('VALIDATION_ERROR', 'Cuerpo JSON inválido', 400)
  }

  const parsed = RequestSchema.safeParse(raw)
  if (!parsed.success) {
    return err('VALIDATION_ERROR', parsed.error.issues.map((i) => i.message).join('; '), 400)
  }
  const input = parsed.data

  const supabase = createServerClient()
  const isInternal = session.role === 'broker' || session.role === 'admin'

  // Tenant scope check — non-internal callers can only request on their own embarques.
  let scopeQ = supabase.from('traficos').select('trafico, company_id').eq('trafico', input.traficoId)
  if (!isInternal) scopeQ = scopeQ.eq('company_id', session.companyId)
  const { data: scopeRow, error: scopeErr } = await scopeQ.maybeSingle()
  if (scopeErr) return err('DB_ERROR', scopeErr.message, 500)
  if (!scopeRow) return err('NOT_FOUND', 'Embarque no encontrado', 404)
  const companyId = (scopeRow.company_id as string | null) ?? session.companyId

  // Send the email first. If the provider rejects, abort before any DB
  // writes — we do not want orphaned "solicitado" rows without outreach.
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    return err('CONFIG_ERROR', 'RESEND_API_KEY no configurado', 500)
  }

  const resend = new Resend(apiKey)
  const sendRes = await resend.emails.send({
    from: SENDER,
    to: [input.recipientEmail],
    subject: input.subject,
    text: input.body,
  })

  if (sendRes.error) {
    return err('EMAIL_ERROR', `Resend: ${sendRes.error.message}`, 502)
  }

  // Upsert one row per doc type. UNIQUE(trafico_id, doc_type) keeps
  // re-sends idempotent on the same embarque + doc pair.
  const actorId = `${session.companyId}:${session.role}`
  const nowIso = new Date().toISOString()
  const rows = input.docTypes.map((docType) => ({
    trafico_id: input.traficoId,
    doc_type: docType,
    company_id: companyId,
    status: 'solicitado',
    solicitado_at: nowIso,
    solicitado_a: input.recipientEmail,
    recipient_email: input.recipientEmail,
    recipient_name: input.recipientName || null,
    message: input.body,
    doc_types: input.docTypes,
    channel: ['email'],
  }))

  const { data: upserted, error: upsertErr } = await supabase
    .from('documento_solicitudes')
    .upsert(rows, { onConflict: 'trafico_id,doc_type' })
    .select('id')

  if (upsertErr) {
    // Email sent but DB write failed. Flag this loudly — dev only warn,
    // prod gets the error response; caller won't retry email from the UI.
    if (process.env.NODE_ENV !== 'production') {
      // eslint-disable-next-line no-console
      console.error('[solicitations/send] upsert failed after email sent', upsertErr)
    }
    return err('DB_WRITE_FAILED', upsertErr.message, 500)
  }

  const primaryId = (upserted?.[0]?.id as string | undefined) ?? ''

  // Workflow event — populated missing_document_types so the processor
  // finally sees a non-empty array (this was the upstream bug).
  const { error: eventErr } = await supabase.from('workflow_events').insert({
    workflow: 'docs',
    event_type: 'docs.solicitation_sent',
    trigger_id: input.traficoId,
    company_id: companyId,
    payload: {
      trafico_id: input.traficoId,
      missing_document_types: input.docTypes,
      recipient_email: input.recipientEmail,
      solicitation_id: primaryId,
      actor: actorId,
    },
  })
  if (eventErr && process.env.NODE_ENV !== 'production') {
    // eslint-disable-next-line no-console
    console.warn('[solicitations/send] workflow_events insert failed', eventErr)
  }

  await logDecision({
    trafico: input.traficoId,
    company_id: companyId,
    decision_type: 'solicitation_sent',
    decision: `Solicitud de ${input.docTypes.length} doc(s) enviada a ${input.recipientEmail}`,
    reasoning: `Compuesto manualmente por ${actorId}`,
    dataPoints: {
      actor: actorId,
      doc_types: input.docTypes,
      recipient: input.recipientEmail,
      solicitation_id: primaryId,
    },
  })

  return NextResponse.json({
    data: { solicitationId: primaryId, sent: input.docTypes.length },
    error: null,
  })
}
