/**
 * Block 9 · Pedimento Interface Export API.
 *
 * POST /api/pedimento/[id]/export
 *   body: { format: 'aduanet_m3_v1_placeholder' }
 *
 * Pipeline:
 *   1. verifySession + tenant scope
 *   2. Load pedimento + all child rows + partidas (via service role so RLS
 *      joined queries cannot silently return empty)
 *   3. Run validation → 400 if blocking errors
 *   4. Serialize via pure function (`pedimento-export.ts`)
 *   5. Upload to `pedimento-exports` bucket
 *   6. Insert pedimento_export_jobs row (status: success|failed)
 *   7. Fire `pedimento_exported` workflow_event
 *   8. logDecision for SAT audit trail
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@supabase/supabase-js'
import { verifySession } from '@/lib/session'
import { logDecision } from '@/lib/decision-logger'
import {
  buildExportStoragePath,
  exportPedimentoAduanetPlaceholder,
  getBlockingErrors,
  EXPORT_FORMAT_VERSION,
} from '@/lib/pedimento-export'
import type {
  PedimentoRow,
  DestinatarioRow,
  CompensacionRow,
  PagoVirtualRow,
  GuiaRow,
  TransportistaRow,
  CandadoRow,
  DescargaRow,
  CuentaGarantiaRow,
  ContribucionRow,
  PedimentoFacturaRow,
  FullPedimento,
  PedimentoPartidaLite,
} from '@/lib/pedimento-types'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

const BodySchema = z.object({
  format: z.literal('aduanet_m3_v1_placeholder').optional(),
})

const EXPORT_BUCKET = 'pedimento-exports'

// Partida enrichment now routes via partidasByTrafico (the canonical 2-hop
// helper). M16 phantom sweep: partidas has no fraccion/valor_comercial;
// both resolve via productos + cantidad × precio_unitario.

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await verifySession(request.cookies.get('portal_session')?.value ?? '')
  if (!session) {
    return NextResponse.json(
      { data: null, error: { code: 'UNAUTHORIZED', message: 'Sesión inválida' } },
      { status: 401 },
    )
  }

  const { id: pedimentoId } = await params

  let body: unknown = {}
  try {
    body = await request.json()
  } catch {
    // empty body is acceptable — defaults to placeholder format
  }
  const parsed = BodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { data: null, error: { code: 'VALIDATION_ERROR', message: 'Formato inválido' } },
      { status: 400 },
    )
  }

  const { data: pedRow, error: pedErr } = await supabase
    .from('pedimentos')
    .select('*')
    .eq('id', pedimentoId)
    .maybeSingle<PedimentoRow>()
  if (pedErr || !pedRow) {
    return NextResponse.json(
      { data: null, error: { code: 'NOT_FOUND', message: 'Pedimento no encontrado' } },
      { status: 404 },
    )
  }

  const isInternal = session.role === 'broker' || session.role === 'admin'
  if (!isInternal && pedRow.company_id !== session.companyId) {
    return NextResponse.json(
      { data: null, error: { code: 'FORBIDDEN', message: 'Sin acceso al pedimento' } },
      { status: 403 },
    )
  }

  const companyId = pedRow.company_id
  const actor = `${session.companyId}:${session.role}`

  const { partidasByTrafico } = await import('@/lib/queries/partidas-by-trafico')

  const [
    destinatarios, compensaciones, pagos, guias, transportistas,
    candados, descargas, cuentas, contribuciones, facturas, partidasEnriched,
  ] = await Promise.all([
    supabase.from('pedimento_destinatarios').select('*').eq('pedimento_id', pedimentoId),
    supabase.from('pedimento_compensaciones').select('*').eq('pedimento_id', pedimentoId),
    supabase.from('pedimento_pagos_virtuales').select('*').eq('pedimento_id', pedimentoId),
    supabase.from('pedimento_guias').select('*').eq('pedimento_id', pedimentoId),
    supabase.from('pedimento_transportistas').select('*').eq('pedimento_id', pedimentoId),
    supabase.from('pedimento_candados').select('*').eq('pedimento_id', pedimentoId),
    supabase.from('pedimento_descargas').select('*').eq('pedimento_id', pedimentoId),
    supabase.from('pedimento_cuentas_garantia').select('*').eq('pedimento_id', pedimentoId),
    supabase.from('pedimento_contribuciones').select('*').eq('pedimento_id', pedimentoId),
    supabase.from('pedimento_facturas').select('*').eq('pedimento_id', pedimentoId),
    partidasByTrafico(supabase, companyId, pedRow.trafico_id, { limit: 2000 }),
  ])

  const partidas: PedimentoPartidaLite[] = partidasEnriched.map(p => ({
    fraccion: p.fraccion,
    cantidad: p.cantidad,
    pais_origen: p.pais_origen,
    valor_comercial: p.valor_comercial,
  }))

  const full: FullPedimento = {
    parent: pedRow,
    destinatarios: (destinatarios.data as DestinatarioRow[] | null) ?? [],
    compensaciones: (compensaciones.data as CompensacionRow[] | null) ?? [],
    pagos_virtuales: (pagos.data as PagoVirtualRow[] | null) ?? [],
    guias: (guias.data as GuiaRow[] | null) ?? [],
    transportistas: (transportistas.data as TransportistaRow[] | null) ?? [],
    candados: (candados.data as CandadoRow[] | null) ?? [],
    descargas: (descargas.data as DescargaRow[] | null) ?? [],
    cuentas_garantia: (cuentas.data as CuentaGarantiaRow[] | null) ?? [],
    contribuciones: (contribuciones.data as ContribucionRow[] | null) ?? [],
    facturas: (facturas.data as PedimentoFacturaRow[] | null) ?? [],
    partidas,
  }

  const blocking = getBlockingErrors(full)
  if (blocking.length > 0) {
    await supabase.from('pedimento_export_jobs').insert({
      pedimento_id: pedimentoId,
      company_id: companyId,
      format_version: EXPORT_FORMAT_VERSION,
      status: 'failed',
      generated_by: actor,
      error_message: `Validación falló: ${blocking.length} error(es)`,
    })
    return NextResponse.json(
      {
        data: null,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'El pedimento tiene errores bloqueantes. Corrige antes de exportar.',
          details: blocking,
        },
      },
      { status: 400 },
    )
  }

  const timestamp = Date.now()
  const storagePath = buildExportStoragePath({ companyId, pedimentoId, timestamp })
  const payload = exportPedimentoAduanetPlaceholder(full)

  const { error: uploadErr } = await supabase.storage
    .from(EXPORT_BUCKET)
    .upload(storagePath, new TextEncoder().encode(payload), {
      contentType: 'application/json',
      upsert: false,
    })

  if (uploadErr) {
    await supabase.from('pedimento_export_jobs').insert({
      pedimento_id: pedimentoId,
      company_id: companyId,
      format_version: EXPORT_FORMAT_VERSION,
      status: 'failed',
      generated_by: actor,
      error_message: `Storage: ${uploadErr.message}`,
    })
    return NextResponse.json(
      { data: null, error: { code: 'INTERNAL_ERROR', message: uploadErr.message } },
      { status: 500 },
    )
  }

  const fileUrl = supabase.storage.from(EXPORT_BUCKET).getPublicUrl(storagePath).data.publicUrl
  const generatedAt = new Date(timestamp).toISOString()

  const { data: jobRow, error: jobErr } = await supabase
    .from('pedimento_export_jobs')
    .insert({
      pedimento_id: pedimentoId,
      company_id: companyId,
      format_version: EXPORT_FORMAT_VERSION,
      status: 'success',
      file_url: fileUrl,
      generated_at: generatedAt,
      generated_by: actor,
    })
    .select('id')
    .single()

  if (jobErr || !jobRow) {
    return NextResponse.json(
      { data: null, error: { code: 'INTERNAL_ERROR', message: jobErr?.message ?? 'Insert falló' } },
      { status: 500 },
    )
  }

  await supabase.from('workflow_events').insert({
    workflow: 'pedimento',
    event_type: 'pedimento_exported',
    trigger_id: pedRow.trafico_id,
    company_id: companyId,
    payload: {
      pedimento_id: pedimentoId,
      format_version: EXPORT_FORMAT_VERSION,
      file_url: fileUrl,
      export_job_id: jobRow.id,
      actor,
    },
  })

  await logDecision({
    trafico: pedRow.trafico_id,
    company_id: companyId,
    decision_type: 'pedimento_exported',
    decision: `pedimento ${pedRow.pedimento_number ?? pedimentoId} exportado (${EXPORT_FORMAT_VERSION})`,
    reasoning: `Generación de archivo de interfaz por ${actor}`,
    dataPoints: { pedimento_id: pedimentoId, export_job_id: jobRow.id, file_url: fileUrl },
  })

  return NextResponse.json({
    data: {
      job_id: jobRow.id,
      file_url: fileUrl,
      format_version: EXPORT_FORMAT_VERSION,
      generated_at: generatedAt,
    },
    error: null,
  })
}
