/**
 * AGUILA · Block 13 — POST /api/warehouse/register
 *
 * Receives a multipart form from Vicente's phone. Inserts a warehouse_entries
 * row, uploads any attached photos to the `warehouse-photos` bucket, fires
 * `warehouse_entry_received` onto `workflow_events` so Block 7's corridor map
 * pulses the `rz_warehouse` landmark.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifySession } from '@/lib/session'
import { logDecision } from '@/lib/decision-logger'
import {
  RegisterWarehouseEntrySchema,
  WAREHOUSE_PHOTO_BUCKET,
  buildCorridorEvent,
  buildPhotoPath,
} from '@/lib/warehouse-entries'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

interface TraficoOwnership {
  trafico_id: string
  company_id: string | null
}

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

  let form: FormData
  try {
    form = await request.formData()
  } catch {
    return errorResponse('VALIDATION_ERROR', 'Formulario inválido', 400)
  }

  const rawPhotos = form.getAll('photos').filter((v): v is File => v instanceof File)

  const parsed = RegisterWarehouseEntrySchema.safeParse({
    trafico_id: (form.get('trafico_id') ?? '').toString(),
    trailer_number: (form.get('trailer_number') ?? '').toString(),
    dock_assigned: ((form.get('dock_assigned') as string | null) || null) || null,
    notes: ((form.get('notes') as string | null) || null) || null,
    photo_count: rawPhotos.length,
  })

  if (!parsed.success) {
    return errorResponse(
      'VALIDATION_ERROR',
      parsed.error.issues[0]?.message ?? 'Datos inválidos',
      400,
    )
  }

  const { trafico_id, trailer_number, dock_assigned, notes } = parsed.data

  // Tenant check — trafico must exist and belong to session company (unless internal).
  const { data: trafico, error: trErr } = await supabase
    .from('traficos')
    .select('trafico_id, company_id')
    .eq('trafico_id', trafico_id)
    .maybeSingle<TraficoOwnership>()

  if (trErr || !trafico) {
    return errorResponse('NOT_FOUND', 'Embarque no encontrado', 404)
  }

  const isInternal =
    session.role === 'broker' ||
    session.role === 'admin' ||
    session.role === 'operator' ||
    session.role === 'warehouse'

  const traficoCompanyId = trafico.company_id ?? session.companyId

  if (!isInternal && traficoCompanyId !== session.companyId) {
    return errorResponse('FORBIDDEN', 'Sin acceso al embarque', 403)
  }

  const actor = `${session.companyId}:${session.role}`

  // Insert first so we have entry_id for photo paths.
  const { data: inserted, error: insErr } = await supabase
    .from('warehouse_entries')
    .insert({
      trafico_id,
      company_id: traficoCompanyId,
      trailer_number,
      dock_assigned,
      notes,
      received_by: actor,
      status: 'receiving',
      photo_urls: [],
    })
    .select('id, received_at')
    .single()

  if (insErr || !inserted) {
    return errorResponse(
      'INTERNAL_ERROR',
      insErr?.message ?? 'No se pudo registrar entrada',
      500,
    )
  }

  // Upload photos sequentially — phone connections are flaky; fail partial ok.
  const uploadedPaths: string[] = []
  const nowIso = new Date().toISOString()
  for (let i = 0; i < rawPhotos.length; i++) {
    const file = rawPhotos[i]
    const ext = file.name.split('.').pop() ?? 'jpg'
    const path = buildPhotoPath(
      {
        companyId: traficoCompanyId,
        traficoId: trafico_id,
        entryId: inserted.id,
        index: i,
        extension: ext,
      },
      nowIso,
    )
    const { error: upErr } = await supabase.storage
      .from(WAREHOUSE_PHOTO_BUCKET)
      .upload(path, file, {
        contentType: file.type || 'image/jpeg',
        upsert: false,
      })
    if (!upErr) {
      uploadedPaths.push(path)
    }
  }

  if (uploadedPaths.length > 0) {
    await supabase
      .from('warehouse_entries')
      .update({ photo_urls: uploadedPaths })
      .eq('id', inserted.id)
  }

  await supabase.from('workflow_events').insert(
    buildCorridorEvent(traficoCompanyId, {
      trafico_id,
      entry_id: inserted.id,
      trailer_number,
      dock_assigned,
      photo_count: uploadedPaths.length,
      actor,
    }),
  )

  await logDecision({
    trafico: trafico_id,
    company_id: traficoCompanyId,
    decision_type: 'warehouse_entry_received',
    decision: `recepción registrada (caja ${trailer_number})`,
    reasoning: `Operador ${actor} recibió la caja${dock_assigned ? ` en andén ${dock_assigned}` : ''} con ${uploadedPaths.length} foto(s).`,
    dataPoints: {
      entry_id: inserted.id,
      trailer_number,
      dock_assigned,
      photo_count: uploadedPaths.length,
    },
  })

  return NextResponse.json({
    data: {
      entry_id: inserted.id,
      photo_count: uploadedPaths.length,
      received_at: inserted.received_at,
    },
    error: null,
  })
}
