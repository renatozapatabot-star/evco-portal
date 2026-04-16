/**
 * CRUZ · Block 16 — DODA generation API.
 *
 * POST /api/regulatory/doda/[pedimento_id]
 *   body: { kind: 'pdf' | 'xml' | 'both' }
 *
 * `[pedimento_id]` carries the embarque id (route segment preserved for plan
 * compatibility). Pipeline: verifySession → fetch trafico → call pure
 * generateDODA → upload both to `regulatory-docs` → emit workflow_event →
 * log decision.
 */
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@supabase/supabase-js'
import { verifySession } from '@/lib/session'
import { logDecision } from '@/lib/decision-logger'
import { PATENTE, ADUANA } from '@/lib/client-config'
import { generateDODA, DodaValidationError, type DodaInput } from '@/lib/doc-generators/doda'
import { notifyMensajeria } from '@/lib/mensajeria/notify'

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

interface TraficoRow {
  trafico: string
  company_id: string | null
  pedimento: string | null
  fecha_pago: string | null
  importe_total: number | null
  peso_bruto: number | null
  transportista_mexicano: string | null
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ pedimento_id: string }> },
) {
  const { pedimento_id } = await params
  const traficoId = decodeURIComponent(pedimento_id)

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
  } catch {
    // empty body defaults to kind='both'
  }
  const parsed = BodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { data: null, error: { code: 'VALIDATION_ERROR', message: 'Parámetros inválidos' } },
      { status: 400 },
    )
  }

  const isInternal = session.role === 'broker' || session.role === 'admin'

  let q = supabase
    .from('traficos')
    .select('trafico, company_id, pedimento, fecha_pago, importe_total, peso_bruto, transportista_mexicano')
    .eq('trafico', traficoId)
    .limit(1)
  if (!isInternal) q = q.eq('company_id', session.companyId)

  const { data: traficos, error: tErr } = await q
  if (tErr) {
    return NextResponse.json(
      { data: null, error: { code: 'INTERNAL_ERROR', message: tErr.message } },
      { status: 500 },
    )
  }
  const trafico = (traficos?.[0] ?? null) as TraficoRow | null
  if (!trafico) {
    return NextResponse.json(
      { data: null, error: { code: 'NOT_FOUND', message: 'Embarque no encontrado' } },
      { status: 404 },
    )
  }

  const companyId = trafico.company_id ?? session.companyId
  const input: DodaInput = {
    pedimento_number: trafico.pedimento ?? '',
    trafico_id: trafico.trafico,
    company_id: companyId,
    rfc_importador: 'XAXX010101000',
    rfc_agente: 'RZY850101000',
    patente: PATENTE,
    aduana: ADUANA,
    fecha_pago: trafico.fecha_pago,
    valor_aduana_mxn: trafico.importe_total,
    valor_comercial_usd: trafico.importe_total,
    peso_bruto_kg: trafico.peso_bruto,
    tipo_operacion: 'IMP',
    transporte: {
      placas: null,
      caja: null,
      transportista: trafico.transportista_mexicano,
    },
  }

  let generated: { pdf: Buffer; xml: string }
  try {
    generated = await generateDODA(input)
  } catch (e) {
    if (e instanceof DodaValidationError) {
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
  const basePath = `${companyId}/${traficoId}/${ts}_doda`
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
    event_type: 'doda_generated',
    trigger_id: trafico.trafico,
    company_id: companyId,
    payload: { trafico_id: trafico.trafico, pdf_url: pdfUrl, xml_url: xmlUrl, actor },
  })

  await logDecision({
    trafico: trafico.trafico,
    company_id: companyId,
    decision_type: 'doda_generated',
    decision: `DODA generada para embarque ${trafico.trafico}`,
    reasoning: 'Generación local CRUZ; pendiente de submisión a VUCEM/SAT en V2.',
    dataPoints: { pdf_url: pdfUrl, xml_url: xmlUrl, kind: parsed.data.kind, actor },
  })

  await notifyMensajeria({
    companyId,
    subject: `DODA generado · ${trafico.trafico}`,
    body: `DODA generado para tráfico ${trafico.trafico}${trafico.pedimento ? ` · pedimento ${trafico.pedimento}` : ''}. Revisión disponible en ZAPATA.`,
    traficoId: trafico.trafico,
    internalOnly: true,
    actor: { role: session.role, name: actor },
  })

  return NextResponse.json({
    data: { pdf_url: pdfUrl, xml_url: xmlUrl, generado_en },
    error: null,
  })
}
