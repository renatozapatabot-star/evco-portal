import { NextRequest, NextResponse } from 'next/server'
import { CLIENT_NAME, CLIENT_RFC } from '@/lib/client-config'

const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || 'http://localhost:11434'

export async function POST(request: NextRequest) {
  const { product, material, uso, opinionNum } = await request.json()
  if (!product?.trim()) return NextResponse.json({ error: 'Descripción del producto requerida' }, { status: 400 })

  const prompt = `Eres un experto en clasificación arancelaria de México con 20 años de experiencia.
Clasifica el siguiente producto bajo la TIGIE (Tarifa de los Impuestos Generales de Importación y Exportación de México).

PRODUCTO: ${product}
${material ? `MATERIAL/COMPOSICIÓN: ${material}` : ''}
${uso ? `USO/APLICACIÓN: ${uso}` : ''}

CONTEXTO: Este producto será importado a México por ${CLIENT_NAME}
(RFC ${CLIENT_RFC}) desde Estados Unidos de América.

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
    const res = await fetch(`${OLLAMA_BASE_URL}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'qwen3:32b', prompt, stream: false }),
    })
    const data = await res.json()
    const text = data.response || ''
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('No se pudo parsear la respuesta del modelo')
    return NextResponse.json(JSON.parse(jsonMatch[0]))
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
