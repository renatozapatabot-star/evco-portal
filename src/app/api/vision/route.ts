import { NextRequest, NextResponse } from 'next/server'
import { getErrorMessage } from '@/lib/errors'

const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY

export async function POST(request: NextRequest) {
  if (!ANTHROPIC_KEY) return NextResponse.json({ error: 'ANTHROPIC_API_KEY not set' }, { status: 503 })

  const formData = await request.formData()
  const file = formData.get('file') as File | null
  const extractType = formData.get('type') as string || 'general'

  if (!file) return NextResponse.json({ error: 'No file uploaded' }, { status: 400 })

  const bytes = await file.arrayBuffer()
  const base64 = Buffer.from(bytes).toString('base64')
  const mediaType = file.type || 'image/jpeg'

  const prompts: Record<string, string> = {
    factura: 'Extract all fields from this commercial invoice. Return JSON: {invoice_number, date, supplier_name, supplier_address, buyer_name, items: [{description, quantity, unit_price, total}], subtotal, tax, total, currency, incoterm, payment_terms}',
    packing_list: 'Extract fields from this packing list. Return JSON: {reference, pieces, gross_weight_kg, net_weight_kg, dimensions, items: [{description, quantity, weight}]}',
    bill_of_lading: 'Extract fields from this bill of lading. Return JSON: {bl_number, shipper, consignee, vessel, port_of_loading, port_of_discharge, containers: [{number, seal, weight}], date}',
    pedimento: 'Extract fields from this Mexican customs declaration (pedimento). Return JSON: {pedimento_number, fecha_pago, importador_rfc, patente, aduana, valor_aduana, dta, igi, iva, fracciones: [{fraccion, descripcion, valor}]}',
    general: 'Extract all relevant fields from this customs/trade document. Identify the document type and return structured JSON with all readable fields. Include: document_type, key_identifiers, dates, values, parties involved.',
  }

  const prompt = prompts[extractType] || prompts.general

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': ANTHROPIC_KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2000,
        messages: [{
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64 } },
            { type: 'text', text: prompt }
          ]
        }]
      })
    })

    const data = await res.json()
    const text = data.content?.[0]?.text || ''
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    const extracted = jsonMatch ? JSON.parse(jsonMatch[0]) : null

    return NextResponse.json({
      success: true,
      document_type: extractType,
      extracted: extracted || { raw_text: text },
      confidence: extracted ? 'high' : 'low',
    })
  } catch (error: unknown) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 })
  }
}
