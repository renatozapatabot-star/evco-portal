import { createClient } from '@supabase/supabase-js'
import { getErrorMessage } from '@/lib/errors'
import { NextRequest, NextResponse } from 'next/server'
import { verifySession } from '@/lib/session'
import { detectIntent, getContextData } from '@/lib/chat-context'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function POST(request: NextRequest) {
  const session = await verifySession(request.cookies.get('portal_session')?.value || '')
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const companyId = request.cookies.get('company_id')?.value ?? ''
  const clientClave = request.cookies.get('company_clave')?.value ?? ''
  const rawName = request.cookies.get('company_name')?.value
  const clientName = rawName ? decodeURIComponent(rawName) : ''

  // Resolve RFC from companies table
  const { data: companyRow } = await supabase.from('companies').select('rfc').eq('company_id', companyId).single()
  const clientRfc = companyRow?.rfc ?? ''

  const { messages } = await request.json()
  const lastMsg = messages[messages.length - 1]?.content || ''
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return NextResponse.json({ response: 'ANTHROPIC_API_KEY no configurada.' })

  const intent = detectIntent(lastMsg)
  const context = await getContextData(lastMsg, companyId, clientClave)

  const sys = `Eres CRUZ, el sistema de inteligencia operativa de Renato Zapata & Company, agencia aduanal en Laredo, Texas.
Tienes acceso REAL a datos de ${clientName} (Clave ${clientClave}).

DATOS ACTUALES:
${context}

CAPACIDADES:
- 32,285 tráficos, 64,333 facturas, 315,237 productos, 195,907 eventos de cruce
- Compliance score en tiempo real
- Predicción de semáforo rojo por carrier y día
- Detección de facturas duplicadas
- Alertas de valor (price anomalies)
- T-MEC certificate tracking

HECHOS clientClave:
- Cliente: ${clientName} (RFC: ${clientRfc})
- Patente: 3596 · Aduana: 240 Nuevo Laredo
- MVE deadline: 31 marzo 2026
- Jueves es el día más rápido de cruce
- Viernes es el más lento (~40% más)

REGLAS:
- Responde SIEMPRE en español
- Usa datos reales, NUNCA inventes números
- Sé conciso: máximo 200 palabras
- Intent detectado: ${intent}
- Si el intent es 'action': confirma la acción antes de ejecutar
- Incluye IDs de tráfico en formato ${clientClave}-XXXX cuando sea relevante
- Si mencionas un tráfico, incluye link: /traficos/[id]`

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 600,
        system: sys,
        messages: messages.slice(-8).map((m: { role: string; content: string }) => ({ role: m.role, content: m.content }))
      })
    })
    const data = await res.json()
    return NextResponse.json({ response: data.content?.[0]?.text || 'Sin respuesta', intent })
  } catch (e: unknown) {
    return NextResponse.json({ response: `Error: ${getErrorMessage(e)}` })
  }
}
