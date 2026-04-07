import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifySession } from '@/lib/session'

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY!
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const DOC_TYPES = [
  'factura_comercial',
  'lista_empaque',
  'conocimiento_embarque',
  'certificado_origen',
  'carta_porte',
  'manifestacion_valor',
  'pedimento',
  'nom',
  'coa',
  'orden_compra',
  'permiso',
  'guia_embarque',
  'otro',
] as const

/**
 * POST /api/ocr-classify
 * Takes an uploaded image/PDF, classifies it using Anthropic Vision,
 * and returns the document type + extracted fields.
 */
export async function POST(req: NextRequest) {
  const session = await verifySession(req.cookies.get('portal_session')?.value || '')
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  const traficoId = formData.get('trafico_id') as string | null

  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

  // Validate file type
  const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
  if (!validTypes.includes(file.type)) {
    return NextResponse.json({ error: 'Tipo de archivo no soportado. Use JPG, PNG, WebP o PDF.' }, { status: 400 })
  }

  // Size limit: 10MB
  if (file.size > 10 * 1024 * 1024) {
    return NextResponse.json({ error: 'Archivo demasiado grande. Máximo 10MB.' }, { status: 400 })
  }

  // Convert to base64
  const buffer = await file.arrayBuffer()
  const base64 = Buffer.from(buffer).toString('base64')
  const mediaType = file.type === 'application/pdf' ? 'image/png' : file.type // Anthropic doesn't accept PDF directly

  // Call Anthropic Vision for classification
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'base64', media_type: mediaType, data: base64 },
          },
          {
            type: 'text',
            text: `Clasifica este documento aduanal. Responde SOLO con JSON válido:
{
  "document_type": "<uno de: ${DOC_TYPES.join(', ')}>",
  "confidence": <0-100>,
  "fields": {
    "invoice_number": "<si aplica>",
    "supplier": "<si visible>",
    "value": "<monto si visible>",
    "currency": "<MXN o USD>",
    "date": "<fecha si visible>",
    "pedimento": "<número si visible>",
    "description": "<descripción breve del contenido>"
  }
}`,
          },
        ],
      }],
    }),
  })

  if (!response.ok) {
    const errText = await response.text()
    return NextResponse.json({ error: 'Error de clasificación: ' + errText.substring(0, 200) }, { status: 500 })
  }

  const aiResponse = await response.json()
  const text = aiResponse.content?.[0]?.text || ''

  // Parse JSON from response
  let classification
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    classification = jsonMatch ? JSON.parse(jsonMatch[0]) : null
  } catch {
    classification = null
  }

  if (!classification) {
    return NextResponse.json({
      document_type: 'otro',
      confidence: 0,
      fields: {},
      message: 'No se pudo clasificar el documento',
    })
  }

  // Log to audit
  await supabase.from('audit_log').insert({
    action: 'document_ocr_classified',
    entity_type: 'document',
    entity_id: traficoId || 'standalone',
    details: {
      filename: file.name,
      document_type: classification.document_type,
      confidence: classification.confidence,
      size_bytes: file.size,
    },
    company_id: req.cookies.get('company_id')?.value || '',
  }).then(() => {}, (e) => console.error('[audit-log] ocr-classify:', e.message))

  // Log cost
  await supabase.from('api_cost_log').insert({
    model: 'claude-sonnet-4-20250514',
    input_tokens: aiResponse.usage?.input_tokens || 0,
    output_tokens: aiResponse.usage?.output_tokens || 0,
    cost_usd: ((aiResponse.usage?.input_tokens || 0) * 0.003 + (aiResponse.usage?.output_tokens || 0) * 0.015) / 1000,
    action: 'ocr_classify',
    client_code: req.cookies.get('company_clave')?.value || '',
    latency_ms: 0,
  }).then(() => {}, (e) => console.error('[audit-log] ocr-classify:', e.message))

  return NextResponse.json({
    document_type: classification.document_type,
    confidence: classification.confidence,
    fields: classification.fields || {},
    trafico_id: traficoId,
    message: `Clasificado como ${classification.document_type} (${classification.confidence}% confianza)`,
  })
}
