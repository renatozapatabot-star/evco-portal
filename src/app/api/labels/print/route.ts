/**
 * AGUILA · V1.5 F19 — POST /api/labels/print
 *
 * Vicente taps "Imprimir etiqueta" on the entrada form. We queue the job,
 * ensure a QR short code exists (F1), and return a `pdfUrl` the mobile UI
 * opens — the browser then hands the PDF to the OS print dialog, which
 * talks to the thermal printer.
 *
 * Direct IPP / Zebra driver push is deferred — browser print is the common
 * denominator across Vicente's iPhone, Android, and the bodega iPad.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { z } from 'zod'
import { verifySession } from '@/lib/session'
import { createEntradaQrCode } from '@/lib/qr/codes'
import { logDecision } from '@/lib/decision-logger'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const BodySchema = z.object({
  entradaId: z.string().min(1, 'entradaId requerido').max(64),
  dockId: z.string().max(8).optional().nullable(),
})

function svc() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

function err(code: string, message: string, status: number) {
  return NextResponse.json(
    { data: null, error: { code, message } },
    { status },
  )
}

export async function POST(request: NextRequest) {
  const session = await verifySession(
    request.cookies.get('portal_session')?.value ?? '',
  )
  if (!session) return err('UNAUTHORIZED', 'Sesión inválida', 401)

  const allowedRoles: string[] = ['warehouse', 'admin', 'broker', 'operator']
  if (!allowedRoles.includes(session.role)) {
    return err('FORBIDDEN', 'Rol sin permiso para imprimir', 403)
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return err('VALIDATION_ERROR', 'JSON inválido', 400)
  }

  const parsed = BodySchema.safeParse(body)
  if (!parsed.success) {
    return err(
      'VALIDATION_ERROR',
      parsed.error.issues[0]?.message ?? 'Datos inválidos',
      400,
    )
  }

  const { entradaId, dockId } = parsed.data
  const supabase = svc()

  // Load the warehouse entry + its embarque ownership.
  const { data: entry, error: entryErr } = await supabase
    .from('warehouse_entries')
    .select('id, trafico_id, company_id, trailer_number, dock_assigned, received_at')
    .eq('id', entradaId)
    .maybeSingle<{
      id: string
      trafico_id: string
      company_id: string
      trailer_number: string
      dock_assigned: string | null
      received_at: string | null
    }>()

  if (entryErr || !entry) {
    return err('NOT_FOUND', 'Entrada no encontrada', 404)
  }

  const isInternal =
    session.role === 'admin' ||
    session.role === 'broker' ||
    session.role === 'operator' ||
    session.role === 'warehouse'

  if (!isInternal && entry.company_id !== session.companyId) {
    return err('FORBIDDEN', 'Sin acceso a la entrada', 403)
  }

  // Ensure a QR short code exists — F1 integration.
  const { data: existingQr } = await supabase
    .from('entrada_qr_codes')
    .select('code')
    .eq('trafico_id', entry.trafico_id)
    .eq('company_id', entry.company_id)
    .limit(1)
    .maybeSingle<{ code: string }>()

  let qrCode = existingQr?.code ?? ''
  if (!qrCode) {
    try {
      const result = await createEntradaQrCode({
        traficoId: entry.trafico_id,
        companyId: entry.company_id,
        entradaId: entry.id,
        generatedBy: `${session.companyId}:${session.role}`,
      })
      qrCode = result.code
    } catch (e) {
      return err(
        'INTERNAL_ERROR',
        e instanceof Error ? e.message : 'No se pudo crear QR',
        500,
      )
    }
  }

  // Resolve cliente display name — fall back to company_id if no row.
  const { data: companyRow } = await supabase
    .from('companies')
    .select('name, nombre_comercial, razon_social')
    .eq('company_id', entry.company_id)
    .maybeSingle<{ name?: string | null; nombre_comercial?: string | null; razon_social?: string | null }>()

  const clienteName =
    companyRow?.nombre_comercial ||
    companyRow?.razon_social ||
    companyRow?.name ||
    entry.company_id

  const effectiveDock = dockId ?? entry.dock_assigned ?? null

  // Queue the print job.
  const { data: inserted, error: insErr } = await supabase
    .from('print_queue')
    .insert({
      company_id: entry.company_id,
      template: 'entrada_4x6',
      status: 'pending',
      payload: {
        qrCode,
        traficoRef: entry.trafico_id,
        clienteName,
        dockAssigned: effectiveDock,
        trailerNumber: entry.trailer_number,
        receivedAt: entry.received_at ?? new Date().toISOString(),
        warehouseEntryId: entry.id,
        event: 'label_print_queued',
      },
    })
    .select('id')
    .single()

  if (insErr || !inserted) {
    return err(
      'INTERNAL_ERROR',
      insErr?.message ?? 'No se pudo encolar impresión',
      500,
    )
  }

  await logDecision({
    trafico: entry.trafico_id,
    company_id: entry.company_id,
    decision_type: 'label_print_queued',
    decision: `etiqueta 4x6 encolada (${qrCode})`,
    reasoning: `Vicente solicitó etiqueta térmica para caja ${entry.trailer_number}${effectiveDock ? ` · andén ${effectiveDock}` : ''}.`,
    dataPoints: {
      print_queue_id: inserted.id,
      entrada_id: entry.id,
      qr_code: qrCode,
      template: 'entrada_4x6',
    },
  })

  return NextResponse.json({
    data: {
      id: inserted.id,
      pdfUrl: `/api/labels/${inserted.id}/pdf`,
      qrCode,
    },
    error: null,
  })
}
