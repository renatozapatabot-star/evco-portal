/**
 * AGUILA · Block 16 — Carta Porte generation API.
 */
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@supabase/supabase-js'
import { verifySession } from '@/lib/session'
import { logDecision } from '@/lib/decision-logger'
import {
  generateCartaPorte,
  CartaPorteValidationError,
  type CartaPorteInput,
} from '@/lib/doc-generators/carta-porte'

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
  peso_bruto: number | null
  importe_total: number | null
  descripcion_mercancia: string | null
  proveedores: string | null
  transportista_mexicano: string | null
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ trafico_id: string }> },
) {
  const { trafico_id } = await params
  const traficoId = decodeURIComponent(trafico_id)

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
    .from('traficos')
    .select('trafico, company_id, pedimento, peso_bruto, importe_total, descripcion_mercancia, proveedores, transportista_mexicano')
    .eq('trafico', traficoId)
    .limit(1)
  if (!isInternal) q = q.eq('company_id', session.companyId)

  const { data: rows, error: tErr } = await q
  if (tErr) {
    return NextResponse.json(
      { data: null, error: { code: 'INTERNAL_ERROR', message: tErr.message } },
      { status: 500 },
    )
  }
  const trafico = (rows?.[0] ?? null) as TraficoRow | null
  if (!trafico) {
    return NextResponse.json(
      { data: null, error: { code: 'NOT_FOUND', message: 'Embarque no encontrado' } },
      { status: 404 },
    )
  }

  const companyId = trafico.company_id ?? session.companyId
  const input: CartaPorteInput = {
    trafico_id: trafico.trafico,
    pedimento_number: trafico.pedimento,
    company_id: companyId,
    rfc_emisor: 'RZY850101000',
    rfc_receptor: 'XAXX010101000',
    fecha_emision: new Date().toISOString(),
    origen: {
      rfc: 'USA-ORIGIN',
      domicilio: 'Origen en Estados Unidos',
      pais: 'USA',
    },
    destino: {
      rfc: 'XAXX010101000',
      domicilio: 'Av. Industria, Nuevo Laredo, Tamaulipas',
      pais: 'MEX',
    },
    transporte: {
      tipo: 'autotransporte',
      placas: null,
      configuracion_vehicular: 'T3S2',
    },
    mercancia: {
      descripcion: trafico.descripcion_mercancia ?? 'Mercancía general',
      peso_kg: trafico.peso_bruto ?? 1,
      valor_mxn: trafico.importe_total ?? 0,
      fraccion_arancelaria: null,
    },
  }

  let generated: { pdf: Buffer; xml: string }
  try {
    generated = await generateCartaPorte(input)
  } catch (e) {
    if (e instanceof CartaPorteValidationError) {
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
  const basePath = `${companyId}/${traficoId}/${ts}_carta_porte`
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
    event_type: 'carta_porte_generated',
    trigger_id: trafico.trafico,
    company_id: companyId,
    payload: { trafico_id: trafico.trafico, pdf_url: pdfUrl, xml_url: xmlUrl, actor },
  })

  await logDecision({
    trafico: trafico.trafico,
    company_id: companyId,
    decision_type: 'carta_porte_generated',
    decision: `Carta Porte generada para embarque ${trafico.trafico}`,
    reasoning: 'Generación local AGUILA; pendiente de submisión a VUCEM/SAT en V2.',
    dataPoints: { pdf_url: pdfUrl, xml_url: xmlUrl, kind: parsed.data.kind, actor },
  })

  return NextResponse.json({
    data: { pdf_url: pdfUrl, xml_url: xmlUrl, generado_en },
    error: null,
  })
}
