/**
 * AGUILA · Block 16 — AVC generation API.
 */
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@supabase/supabase-js'
import { verifySession } from '@/lib/session'
import { logDecision } from '@/lib/decision-logger'
import { PATENTE, ADUANA } from '@/lib/client-config'
import { generateAVC, AvcValidationError, type AvcInput } from '@/lib/doc-generators/avc'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 30

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

const BUCKET = 'regulatory-docs'

const BodySchema = z.object({
  kind: z.enum(['pdf', 'xml', 'both']).default('both'),
})

interface WarehouseEntryRow {
  id: string
  trafico_id: string
  company_id: string | null
  trailer_number: string
  dock_assigned: string | null
  received_by: string
  received_at: string
  photo_urls: string[] | null
  notes: string | null
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ warehouse_entry_id: string }> },
) {
  const { warehouse_entry_id } = await params
  const entryId = decodeURIComponent(warehouse_entry_id)

  const session = await verifySession(request.cookies.get('portal_session')?.value ?? '')
  if (!session) {
    return NextResponse.json(
      { data: null, error: { code: 'UNAUTHORIZED', message: 'Sesión inválida' } },
      { status: 401 },
    )
  }

  let body: unknown = {}
  try {
    body = await request.json()
  } catch {}
  const parsed = BodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { data: null, error: { code: 'VALIDATION_ERROR', message: 'Parámetros inválidos' } },
      { status: 400 },
    )
  }

  const isInternal = session.role === 'broker' || session.role === 'admin'

  let q = supabase
    .from('warehouse_entries')
    .select('id, trafico_id, company_id, trailer_number, dock_assigned, received_by, received_at, photo_urls, notes')
    .eq('id', entryId)
    .limit(1)
  if (!isInternal) q = q.eq('company_id', session.companyId)

  const { data: rows, error: eErr } = await q
  if (eErr) {
    return NextResponse.json(
      { data: null, error: { code: 'INTERNAL_ERROR', message: eErr.message } },
      { status: 500 },
    )
  }
  const entry = (rows?.[0] ?? null) as WarehouseEntryRow | null
  if (!entry) {
    return NextResponse.json(
      { data: null, error: { code: 'NOT_FOUND', message: 'Entrada de bodega no encontrada' } },
      { status: 404 },
    )
  }

  const companyId = entry.company_id ?? session.companyId
  const input: AvcInput = {
    warehouse_entry_id: entry.id,
    trafico_id: entry.trafico_id,
    company_id: companyId,
    trailer_number: entry.trailer_number,
    dock_assigned: entry.dock_assigned,
    received_by: entry.received_by,
    received_at: entry.received_at,
    photo_count: entry.photo_urls?.length ?? 0,
    notes: entry.notes,
    rfc_importador: 'XAXX010101000',
    patente: PATENTE,
    aduana: ADUANA,
  }

  let generated: { pdf: Buffer; xml: string }
  try {
    generated = await generateAVC(input)
  } catch (e) {
    if (e instanceof AvcValidationError) {
      return NextResponse.json(
        { data: null, error: { code: 'VALIDATION_ERROR', message: `Campo ${e.field}: ${e.message}` } },
        { status: 400 },
      )
    }
    return NextResponse.json(
      { data: null, error: { code: 'INTERNAL_ERROR', message: e instanceof Error ? e.message : 'Error al generar' } },
      { status: 500 },
    )
  }

  const ts = Date.now()
  const basePath = `${companyId}/${entry.trafico_id}/${ts}_avc_${entry.id}`
  const pdfPath = `${basePath}.pdf`
  const xmlPath = `${basePath}.xml`

  const [pdfUp, xmlUp] = await Promise.all([
    supabase.storage.from(BUCKET).upload(pdfPath, new Uint8Array(generated.pdf), {
      contentType: 'application/pdf',
      upsert: false,
    }),
    supabase.storage.from(BUCKET).upload(xmlPath, new Blob([generated.xml], { type: 'application/xml' }), {
      contentType: 'application/xml',
      upsert: false,
    }),
  ])

  if (pdfUp.error || xmlUp.error) {
    return NextResponse.json(
      { data: null, error: { code: 'INTERNAL_ERROR', message: pdfUp.error?.message ?? xmlUp.error?.message ?? 'Storage error' } },
      { status: 500 },
    )
  }

  const pdfUrl = supabase.storage.from(BUCKET).getPublicUrl(pdfPath).data.publicUrl
  const xmlUrl = supabase.storage.from(BUCKET).getPublicUrl(xmlPath).data.publicUrl
  const generado_en = new Date().toISOString()
  const actor = `${session.companyId}:${session.role}`

  await supabase.from('workflow_events').insert({
    workflow: 'regulatory',
    event_type: 'avc_generated',
    trigger_id: entry.trafico_id,
    company_id: companyId,
    payload: { trafico_id: entry.trafico_id, entry_id: entry.id, pdf_url: pdfUrl, xml_url: xmlUrl, actor },
  })

  await logDecision({
    trafico: entry.trafico_id,
    company_id: companyId,
    decision_type: 'avc_generated',
    decision: `AVC generado para entrada ${entry.id}`,
    reasoning: 'Generación local AGUILA; pendiente de submisión a VUCEM/SAT en V2.',
    dataPoints: { pdf_url: pdfUrl, xml_url: xmlUrl, entry_id: entry.id, kind: parsed.data.kind, actor },
  })

  return NextResponse.json({
    data: { pdf_url: pdfUrl, xml_url: xmlUrl, generado_en },
    error: null,
  })
}
