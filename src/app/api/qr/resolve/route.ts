/**
 * AGUILA · V1.5 F1 — POST /api/qr/resolve
 *
 * Vicente taps "Escanear QR" at the warehouse gate. This endpoint looks up
 * the short code, scopes to the session's company_id, stamps scan metadata,
 * and emits warehouse_entry_received onto workflow_events so the corridor
 * map pulses `rz_warehouse`.
 *
 * Response shape follows the CRUZ handler contract:
 *   { data: { traficoId, entradaId, trafico: { ref, cliente } } | null,
 *     error: { code, message } | null }
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { z } from 'zod'
import { verifySession } from '@/lib/session'
import { logDecision } from '@/lib/decision-logger'
import { resolveEntradaQrCode, parseScanPayload } from '@/lib/qr/codes'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

const BodySchema = z.object({
  code: z.string().min(4).max(256),
  location: z.string().max(64).optional(),
})

const ALLOWED_ROLES = new Set(['warehouse', 'operator', 'broker', 'admin'])

function errorResponse(code: string, message: string, status: number) {
  return NextResponse.json(
    { data: null, error: { code, message } },
    { status },
  )
}

export async function POST(request: NextRequest) {
  const session = await verifySession(
    request.cookies.get('portal_session')?.value ?? '',
  )
  if (!session) {
    return errorResponse('UNAUTHORIZED', 'Sesión inválida', 401)
  }
  if (!ALLOWED_ROLES.has(session.role)) {
    return errorResponse('FORBIDDEN', 'Sin permiso para escanear', 403)
  }

  let json: unknown
  try {
    json = await request.json()
  } catch {
    return errorResponse('VALIDATION_ERROR', 'Cuerpo inválido', 400)
  }

  const parsed = BodySchema.safeParse(json)
  if (!parsed.success) {
    return errorResponse(
      'VALIDATION_ERROR',
      parsed.error.issues[0]?.message ?? 'Datos inválidos',
      400,
    )
  }

  const rawCode = parseScanPayload(parsed.data.code)
  if (!rawCode) {
    return errorResponse('VALIDATION_ERROR', 'Código no reconocido', 400)
  }

  const scannedBy = `${session.companyId}:${session.role}`
  const location = parsed.data.location?.trim() || 'bodega-escaner'

  const outcome = await resolveEntradaQrCode({
    code: rawCode,
    scannedBy,
    location,
    companyId: session.companyId,
    client: supabase,
  })

  if (outcome.error) {
    const status =
      outcome.error.code === 'NOT_FOUND' ? 404 :
      outcome.error.code === 'FORBIDDEN' ? 403 : 500
    return errorResponse(outcome.error.code, outcome.error.message, status)
  }

  // Fetch a lightweight summary so the client can render a confirmation
  // toast ("TRF-001 · EVCO Plastics") before redirecting.
  const { data: traficoRow } = await supabase
    .from('traficos')
    .select('trafico_id, cliente, company_id')
    .eq('trafico_id', outcome.data.traficoId)
    .maybeSingle<{ trafico_id: string; cliente: string | null; company_id: string | null }>()

  await logDecision({
    trafico: outcome.data.traficoId,
    company_id: outcome.data.companyId,
    decision_type: 'qr_scan_resolved',
    decision: `QR escaneado en ${location}`,
    reasoning: `${scannedBy} escaneó etiqueta ${rawCode} en ${location}.`,
    dataPoints: {
      qr_code: rawCode,
      location,
      entrada_id: outcome.data.entradaId,
    },
  })

  return NextResponse.json({
    data: {
      traficoId: outcome.data.traficoId,
      entradaId: outcome.data.entradaId,
      trafico: {
        ref: traficoRow?.trafico_id ?? outcome.data.traficoId,
        cliente: traficoRow?.cliente ?? null,
      },
    },
    error: null,
  })
}
