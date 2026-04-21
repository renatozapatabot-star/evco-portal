/**
 * CRUZ · V1.5 F19 — GET /api/labels/[id]/pdf
 *
 * Re-renders the entrada 4×6" label from the print_queue payload so any
 * device can open + print it. Streaming not needed at 4×6 — buffer is ~30KB.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifySession } from '@/lib/session'
import {
  renderEntradaLabelPdf,
  type EntradaLabelInput,
} from '@/lib/label-templates/entrada'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 30

function svc() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

interface QueuePayload {
  qrCode?: string
  traficoRef?: string
  clienteName?: string
  dockAssigned?: string | null
  trailerNumber?: string | null
  receivedAt?: string | null
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const session = await verifySession(
    request.cookies.get('portal_session')?.value ?? '',
  )
  if (!session) {
    return NextResponse.json(
      { data: null, error: { code: 'UNAUTHORIZED', message: 'Sesión inválida' } },
      { status: 401 },
    )
  }

  const allowedRoles: string[] = ['warehouse', 'admin', 'broker', 'operator']
  if (!allowedRoles.includes(session.role)) {
    return NextResponse.json(
      { data: null, error: { code: 'FORBIDDEN', message: 'Rol sin permiso' } },
      { status: 403 },
    )
  }

  const { id } = await context.params
  if (!id) {
    return NextResponse.json(
      { data: null, error: { code: 'VALIDATION_ERROR', message: 'id requerido' } },
      { status: 400 },
    )
  }

  const supabase = svc()
  const { data: row, error } = await supabase
    .from('print_queue')
    .select('id, company_id, payload, template')
    .eq('id', id)
    .maybeSingle<{
      id: string
      company_id: string
      template: string
      payload: QueuePayload
    }>()

  if (error || !row) {
    return NextResponse.json(
      { data: null, error: { code: 'NOT_FOUND', message: 'Trabajo no encontrado' } },
      { status: 404 },
    )
  }

  const isInternal =
    session.role === 'admin' ||
    session.role === 'broker' ||
    session.role === 'operator' ||
    session.role === 'warehouse'

  if (!isInternal && row.company_id !== session.companyId) {
    return NextResponse.json(
      { data: null, error: { code: 'FORBIDDEN', message: 'Sin acceso' } },
      { status: 403 },
    )
  }

  const p = row.payload ?? {}
  const input: EntradaLabelInput = {
    qrCode: p.qrCode ?? '—',
    traficoRef: p.traficoRef ?? '—',
    clienteName: p.clienteName ?? '—',
    dockAssigned: p.dockAssigned ?? null,
    trailerNumber: p.trailerNumber ?? null,
    receivedAt: p.receivedAt ?? null,
  }

  const pdf = await renderEntradaLabelPdf(input)

  return new NextResponse(new Uint8Array(pdf), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="etiqueta-${input.qrCode}.pdf"`,
      'Cache-Control': 'private, no-store',
    },
  })
}
