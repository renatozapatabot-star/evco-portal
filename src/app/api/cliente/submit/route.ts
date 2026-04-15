/**
 * POST /api/cliente/submit
 *
 * Lightweight intake endpoint for the 2 client-facing forms:
 *   · /cliente/nuevo-embarque  (action="nuevo_embarque")
 *   · /cliente/reportar-problema (action="reportar_problema")
 *
 * Previously both forms POSTed to /api/cockpit-insight, which is a GET-only
 * AI synthesis endpoint. Submissions were silently discarded. V1 marathon
 * batch 2 routes them to this dedicated endpoint that writes an audit_log
 * entry + a row in `client_requests` so operators can see them.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { z } from 'zod'
import { verifySession } from '@/lib/session'
import { notifyMensajeria } from '@/lib/mensajeria/notify'
import { sanitizeError } from '@/lib/api/sanitize-error'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

const BodySchema = z.object({
  action: z.enum(['nuevo_embarque', 'reportar_problema']),
  data: z.record(z.string(), z.unknown()),
})

export async function POST(request: NextRequest) {
  const session = await verifySession(request.cookies.get('portal_session')?.value ?? '')
  if (!session) {
    return NextResponse.json(
      { data: null, error: { code: 'UNAUTHORIZED', message: 'Sesión inválida' } },
      { status: 401 },
    )
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { data: null, error: { code: 'VALIDATION_ERROR', message: 'Cuerpo inválido' } },
      { status: 400 },
    )
  }

  const parsed = BodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { data: null, error: { code: 'VALIDATION_ERROR', message: parsed.error.issues.map((i) => i.message).join('; ') } },
      { status: 400 },
    )
  }

  const { action, data } = parsed.data
  const companyId = session.companyId
  const requestId = crypto.randomUUID()

  try {
    // Write to client_requests if the table exists; fall back to audit_log.
    const clientRequestPayload = {
      id: requestId,
      company_id: companyId,
      request_type: action,
      status: 'new',
      data,
      submitted_at: new Date().toISOString(),
    }
    const { error: insertErr } = await supabase
      .from('client_requests')
      .insert(clientRequestPayload)
    if (insertErr) {
      // Table may not exist in all deploys — fallback to audit_log
      await supabase.from('audit_log').insert({
        company_id: companyId,
        table_name: 'client_requests',
        action: action,
        record_id: requestId,
        details: data,
      })
    }

    // Notify internal operators via Chat so they see the request immediately.
    const subject = action === 'nuevo_embarque'
      ? `Nuevo embarque solicitado · ${companyId}`
      : `Problema reportado · ${companyId}`
    const summary = typeof (data as { descripcion?: string }).descripcion === 'string'
      ? (data as { descripcion: string }).descripcion.slice(0, 200)
      : 'Ver detalles en el portal del cliente'
    await notifyMensajeria({
      companyId,
      subject,
      body: summary,
      internalOnly: true,
      actor: { role: session.role, name: `${companyId}:${session.role}` },
    })

    return NextResponse.json({
      data: { id: requestId, status: 'received' },
      error: null,
    })
  } catch (err) {
    return NextResponse.json(
      { data: null, error: sanitizeError(err) },
      { status: 500 },
    )
  }
}
