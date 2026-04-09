import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifySession } from '@/lib/session'
import { logOperatorAction } from '@/lib/operator-actions'
import Anthropic from '@anthropic-ai/sdk'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

const SYSTEM_PROMPT = `Eres CRUZ, el asistente de inteligencia aduanal de Renato Zapata & Company (Patente 3596, Aduana 240 Nuevo Laredo). Cuarta generación de agentes aduanales.

Reglas:
- Responde SIEMPRE en español mexicano profesional
- Máximo 3-4 oraciones — conciso y directo
- Cuando menciones cantidades, incluye la moneda (MXN o USD)
- Cuando menciones tráficos, usa el ID exacto del contexto
- Cuando menciones fechas, usa formato "20 mar 2026"
- Pedimentos SIEMPRE con espacios: "26 24 3596 6500247"
- Si la respuesta no está en el contexto, di honestamente "No tenemos esa información en este momento" y sugiere alternativa
- Usa "nosotros" — nunca "yo"
- Después de responder, sugiere el siguiente paso lógico
- NO inventes datos. NO menciones clientes que no sean el actual.
- Tono: profesional, cálido, confiable. Como un agente aduanal senior de confianza.`

/**
 * CRUZ AI quick-ask endpoint — lightweight Q&A for the cockpit panel.
 * Uses Haiku for speed and cost. Context-scoped to the logged-in company.
 * POST { question: string } → { answer: string }
 */
export async function POST(req: NextRequest) {
  try {
    // 1. Verify session
    const sessionToken = req.cookies.get('portal_session')?.value || ''
    const session = await verifySession(sessionToken)
    if (!session) {
      return NextResponse.json(
        { answer: 'Sesión no válida. Por favor inicia sesión de nuevo.' },
        { status: 401 },
      )
    }

    // 2. Parse request
    const body = await req.json()
    const question = (body.question || '').toString().trim().slice(0, 1000)
    if (!question) {
      return NextResponse.json(
        { answer: 'Por favor escribe una pregunta.' },
        { status: 400 },
      )
    }

    const companyId = session.companyId
    const role = session.role

    // For admin/broker with non-client company_id, allow but note it
    const isInternal = role === 'admin' || role === 'broker'

    // 3. Build company-scoped context — ALL queries filtered by company_id
    const contextLines: string[] = []
    contextLines.push(`Cliente: ${companyId}`)
    contextLines.push(`Rol del usuario: ${role}`)
    contextLines.push(`Fecha actual: ${new Date().toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric', timeZone: 'America/Chicago' })}`)
    contextLines.push('')

    // Only fetch client data if we have a real company_id
    if (companyId && companyId !== 'admin' && companyId !== 'internal') {
      const [trafRes, entRes, draftsRes] = await Promise.allSettled([
        supabase.from('traficos')
          .select('trafico, descripcion_mercancia, estatus, fecha_llegada, fecha_cruce, importe_total, pedimento, proveedores, regimen')
          .eq('company_id', companyId)
          .gte('fecha_llegada', '2024-01-01')
          .order('fecha_llegada', { ascending: false })
          .limit(20),
        supabase.from('entradas')
          .select('cve_entrada, descripcion_mercancia, fecha_llegada_mercancia, cantidad_bultos, peso_bruto, trafico')
          .eq('company_id', companyId)
          .order('fecha_llegada_mercancia', { ascending: false })
          .limit(10),
        supabase.from('pedimento_drafts')
          .select('id, trafico_id, status, created_at')
          .eq('company_id', companyId)
          .in('status', ['draft', 'pending'])
          .order('created_at', { ascending: false })
          .limit(5),
      ])

      if (trafRes.status === 'fulfilled' && trafRes.value.data?.length) {
        const traficos = trafRes.value.data
        const enProceso = traficos.filter(t => t.estatus === 'En Proceso').length
        const cruzados = traficos.filter(t => t.estatus === 'Cruzado').length
        const pagados = traficos.filter(t => t.estatus === 'Pedimento Pagado').length

        contextLines.push(`RESUMEN: ${traficos.length} tráficos recientes — ${enProceso} en proceso, ${pagados} pedimento pagado, ${cruzados} cruzados`)
        contextLines.push('')
        contextLines.push('TRÁFICOS RECIENTES:')
        for (const t of traficos.slice(0, 12)) {
          const valor = t.importe_total ? `$${Number(t.importe_total).toLocaleString('en-US', { minimumFractionDigits: 2 })} USD` : 'sin valor'
          const fecha = t.fecha_cruce || t.fecha_llegada || 'sin fecha'
          const ped = t.pedimento ? ` — pedimento: ${t.pedimento}` : ''
          contextLines.push(`  • ${t.trafico} — ${t.estatus} — ${valor} — ${t.descripcion_mercancia || 'sin descripción'} — ${fecha}${ped}`)
        }
        contextLines.push('')
      }

      if (entRes.status === 'fulfilled' && entRes.value.data?.length) {
        contextLines.push(`ENTRADAS RECIENTES (${entRes.value.data.length}):`)
        for (const e of entRes.value.data.slice(0, 5)) {
          contextLines.push(`  • ${e.cve_entrada} — ${e.descripcion_mercancia || 'sin descripción'} — ${e.cantidad_bultos || 0} bultos · ${e.peso_bruto || 0} kg — ${e.fecha_llegada_mercancia || 'sin fecha'}`)
        }
        contextLines.push('')
      }

      if (draftsRes.status === 'fulfilled' && draftsRes.value.data?.length) {
        contextLines.push(`BORRADORES DE PEDIMENTO PENDIENTES (${draftsRes.value.data.length}):`)
        for (const d of draftsRes.value.data) {
          contextLines.push(`  • Borrador — tráfico ${d.trafico_id || 'sin asignar'} — estatus: ${d.status}`)
        }
        contextLines.push('')
      }
    } else if (isInternal) {
      contextLines.push('(Sesión administrativa — sin datos de cliente específico. Responde preguntas generales sobre aduanas.)')
    }

    const contextBlock = contextLines.join('\n')

    // 4. Call Anthropic Haiku
    let answer = 'Lo siento, hubo un problema procesando tu pregunta. Por favor intenta de nuevo.'

    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      return NextResponse.json({
        answer: 'CRUZ AI no está disponible en este momento. Contacta a soporte.',
      })
    }

    try {
      const anthropic = new Anthropic({ apiKey })
      const response = await anthropic.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 400,
        system: SYSTEM_PROMPT,
        messages: [
          {
            role: 'user',
            content: `CONTEXTO DEL CLIENTE:\n\n${contextBlock}\n\nPREGUNTA:\n${question}\n\nResponde en español, máximo 3-4 oraciones, basándote ÚNICAMENTE en el contexto anterior.`,
          },
        ],
      })

      const block = response.content?.[0]
      if (block && block.type === 'text') {
        answer = block.text.trim()
      }
    } catch (llmError: unknown) {
      const errMsg = llmError instanceof Error ? llmError.message : String(llmError)
      console.error('[cruz-ai/ask] LLM error:', errMsg)

      if (errMsg.includes('credit balance') || errMsg.includes('billing')) {
        answer = 'CRUZ AI no está disponible temporalmente — créditos de API agotados. Tu pregunta fue registrada y será respondida cuando se restablezca el servicio.'
      } else if (errMsg.includes('rate_limit') || errMsg.includes('overloaded')) {
        answer = 'CRUZ AI está ocupado en este momento. Por favor intenta de nuevo en unos segundos.'
      }
      // For other errors, keep the default "hubo un problema" message
    }

    // 5. Log the interaction
    const operatorId = req.cookies.get('operator_id')?.value
    logOperatorAction({
      operatorId: operatorId || undefined,
      actionType: 'cruz_ai_query',
      companyId,
      payload: {
        question: question.slice(0, 500),
        answer: answer.slice(0, 500),
        company_id: companyId,
        role,
      },
    }).catch(() => {}) // fire-and-forget

    return NextResponse.json({ answer })
  } catch (err) {
    console.error('[cruz-ai/ask] unexpected error:', err)
    return NextResponse.json(
      { answer: 'Lo siento, hubo un problema técnico. Por favor intenta de nuevo en un momento.' },
      { status: 500 },
    )
  }
}
