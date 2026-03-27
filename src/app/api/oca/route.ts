import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  const { product, material, uso, opinionNum } = await request.json()
  if (!product?.trim()) return NextResponse.json({ error: 'Descripción del producto requerida' }, { status: 400 })

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'ANTHROPIC_API_KEY no configurada. Agregar al .env.local' }, { status: 500 })

  const prompt = `Eres un experto en clasificación arancelaria de México con 20 años de experiencia.
Clasifica el siguiente producto bajo la TIGIE (Tarifa de los Impuestos Generales de Importación y Exportación de México).

PRODUCTO: ${product}
${material ? `MATERIAL/COMPOSICIÓN: ${material}` : ''}
${uso ? `USO/APLICACIÓN: ${uso}` : ''}

CONTEXTO: Este producto será importado a México por EVCO Plastics de México S. de R.L. de C.V.
(RFC EPM001109I74) desde Estados Unidos de América.

Responde ÚNICAMENTE con un JSON válido con esta estructura exacta:
{
  "fraccion": "XXXX.XX.XX",
  "descripcion": "Descripción oficial en TIGIE",
  "arancel": "X%",
  "tmec": "0% (con certificado USMCA válido)",
  "analisis": "Análisis de 2-3 oraciones explicando la clasificación",
  "fundamento": "LIGIE Regla X; TIGIE Capítulo XX; Nota X"
}

No incluyas texto fuera del JSON.`

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: 'claude-sonnet-4-20250514', max_tokens: 800, messages: [{ role: 'user', content: prompt }] }),
    })
    const data = await res.json()
    const text = data.content?.[0]?.text || ''
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('No se pudo parsear la respuesta')
    return NextResponse.json(JSON.parse(jsonMatch[0]))
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
