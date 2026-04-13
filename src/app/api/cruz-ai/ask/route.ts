import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'
import { randomUUID } from 'crypto'
import { verifySession, type PortalRole } from '@/lib/session'
import { logOperatorAction } from '@/lib/operator-actions'
import { TOOL_DEFINITIONS, runTool, type AguilaCtx, type ToolName } from '@/lib/aguila/tools'
import { resolveMentions } from '@/lib/aguila/mentions'
import { logShadow } from '@/lib/aguila/shadow-log'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

const MODEL_TOOL_LOOP = 'claude-haiku-4-5-20251001'
const MODEL_SYNTHESIS = 'claude-sonnet-4-20250514'
const MAX_TOOL_ROUNDS = 4
const MAX_QUESTION_CHARS = 1000

const BASE_RULES = `Reglas:
- Responde SIEMPRE en español mexicano profesional
- Máximo 4 oraciones — conciso y directo
- Usa las herramientas disponibles para obtener datos reales. No adivines.
- Si una herramienta devuelve "forbidden", responde: "No tengo permiso para mostrarte esa información."
- Cuando menciones cantidades, incluye la moneda (MXN o USD)
- Pedimentos SIEMPRE con espacios: "26 24 3596 6500247"
- Fracciones con puntos: "3901.20.01"
- Si no hay datos suficientes, di "No tenemos esa información en este momento"
- Usa "nosotros" — nunca "yo"
- Tono: profesional, cálido, confiable.`

const ROLE_PROMPTS: Record<PortalRole, string> = {
  operator: `Eres AGUILA, asistente de operaciones aduanales.
Ayudas a Claudia con tráficos activos, estatus de pedimentos,
y cadena factura→entrada→pedimento. Responde en español.

${BASE_RULES}`,
  contabilidad: `Eres AGUILA, asistente de contabilidad aduanal.
Ayudas a Anabel con cuentas por cobrar, facturas emitidas,
pagos recibidos, y exportación QB. Responde en español.

${BASE_RULES}`,
  warehouse: `Eres AGUILA, asistente de almacén.
Ayudas a Vicente con entradas, ubicaciones en bodega,
recepción de mercancía, y despacho. Responde en español.

${BASE_RULES}`,
  client: `Eres AGUILA, el asistente de inteligencia aduanal de Renato Zapata & Company (Patente 3596, Aduana 240 Nuevo Laredo).

${BASE_RULES}`,
  admin: `Eres AGUILA, el asistente de inteligencia aduanal de Renato Zapata & Company (Patente 3596, Aduana 240 Nuevo Laredo). Acceso multi-cliente de administración.

${BASE_RULES}`,
  broker: `Eres AGUILA, el asistente de inteligencia aduanal de Renato Zapata & Company (Patente 3596, Aduana 240 Nuevo Laredo). Acceso de agente aduanal titular.

${BASE_RULES}`,
}

function systemPromptFor(role: PortalRole): string {
  return ROLE_PROMPTS[role] ?? ROLE_PROMPTS.client
}

const CLASSIFIER_PROMPT = `Clasifica el mensaje en UNA de estas etiquetas y responde solo con la etiqueta:
estatus_trafico, pregunta_pedimento, duda_documento, pregunta_financiera, escalacion, saludo, otro`

/**
 * AGUILA AI ask endpoint with live Supabase tool calls.
 * POST { question: string } → { answer: string }
 */
export async function POST(req: NextRequest) {
  const started = Date.now()
  const messageId = randomUUID()

  try {
    const sessionToken = req.cookies.get('portal_session')?.value || ''
    const session = await verifySession(sessionToken)
    if (!session) {
      return NextResponse.json(
        { answer: 'Sesión no válida. Por favor inicia sesión de nuevo.' },
        { status: 401 },
      )
    }

    const body = await req.json().catch(() => ({}))
    const question = String(body.question || '').trim().slice(0, MAX_QUESTION_CHARS)
    if (!question) {
      return NextResponse.json(
        { answer: 'Por favor escribe una pregunta.' },
        { status: 400 },
      )
    }

    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      return NextResponse.json({
        answer: 'AGUILA AI no está disponible en este momento. Contacta a soporte.',
      })
    }

    const role = session.role as PortalRole
    const companyId = session.companyId
    const operatorId = req.cookies.get('operator_id')?.value || null
    const ctx: AguilaCtx = { companyId, role, userId: operatorId, operatorId, supabase }
    const systemPrompt = systemPromptFor(role)

    const anthropic = new Anthropic({ apiKey, timeout: 30_000 })

    // ------------------------------------------------------------
    // Pre-pass: parse @mentions + topic classification (parallel)
    // ------------------------------------------------------------
    const [mentionResult, topicClass] = await Promise.all([
      resolveMentions(question, role),
      classifyTopic(anthropic, question).catch(() => null),
    ])

    const recipientRole = mentionResult.recipients[0]?.role ?? 'operator'

    // ------------------------------------------------------------
    // Haiku tool-calling loop
    // ------------------------------------------------------------
    const messages: Anthropic.MessageParam[] = [
      { role: 'user', content: buildUserTurn(question, role, companyId, mentionResult.rejected) },
    ]

    const toolsCalled: ToolName[] = []
    let finalText = ''
    let forbiddenHit = false

    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
      const resp = await anthropic.messages.create({
        model: MODEL_TOOL_LOOP,
        max_tokens: 800,
        system: systemPrompt,
        tools: TOOL_DEFINITIONS,
        messages,
      })

      messages.push({ role: 'assistant', content: resp.content })

      if (resp.stop_reason !== 'tool_use') {
        for (const block of resp.content) {
          if (block.type === 'text') finalText = block.text.trim()
        }
        break
      }

      const toolResults: Anthropic.ToolResultBlockParam[] = []
      for (const block of resp.content) {
        if (block.type !== 'tool_use') continue
        const toolName = block.name as ToolName
        toolsCalled.push(toolName)
        const result = await runTool(toolName, block.input, ctx)
        if (result.forbidden) forbiddenHit = true
        toolResults.push({
          type: 'tool_result',
          tool_use_id: block.id,
          content: JSON.stringify(result.result).slice(0, 8000),
          is_error: !!result.error,
        })
      }
      messages.push({ role: 'user', content: toolResults })
    }

    // ------------------------------------------------------------
    // Sonnet synthesis pass (polished Spanish answer)
    // ------------------------------------------------------------
    const toolTranscript = messages
      .filter(m => m.role === 'user' || m.role === 'assistant')
      .map(m => summarizeMessage(m))
      .filter(Boolean)
      .join('\n')

    let answer = finalText || 'No pude generar una respuesta.'
    try {
      const synth = await anthropic.messages.create({
        model: MODEL_SYNTHESIS,
        max_tokens: 400,
        system: systemPrompt,
        messages: [{
          role: 'user',
          content: `PREGUNTA DEL USUARIO: ${question}\n\nDATOS OBTENIDOS POR LAS HERRAMIENTAS:\n${toolTranscript}\n\nRespuesta preliminar de Haiku: "${finalText}"\n\nEscribe la respuesta final en español, máximo 4 oraciones, usando solo los datos obtenidos. Si alguna herramienta devolvió "forbidden", responde que no tienes permiso.`,
        }],
      })
      const block = synth.content?.[0]
      if (block && block.type === 'text') answer = block.text.trim()
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      if (msg.includes('credit balance') || msg.includes('billing')) {
        answer = 'AGUILA AI no está disponible temporalmente — créditos de API agotados.'
      } else if (msg.includes('rate_limit') || msg.includes('overloaded')) {
        answer = 'AGUILA AI está ocupado. Intenta de nuevo en unos segundos.'
      }
    }

    // ------------------------------------------------------------
    // Audit + shadow log
    // ------------------------------------------------------------
    const responseTimeMs = Date.now() - started

    void logOperatorAction({
      operatorId: operatorId || undefined,
      actionType: 'aguila_ai_query',
      companyId,
      payload: {
        message_id: messageId,
        question: question.slice(0, 500),
        answer: answer.slice(0, 500),
        role,
        tools_called: toolsCalled,
        topic_class: topicClass,
      },
      durationMs: responseTimeMs,
    })
    if (toolsCalled.includes('query_financiero')) {
      void logOperatorAction({
        operatorId: operatorId || undefined,
        actionType: 'aguila_financiero_read',
        companyId,
        payload: { message_id: messageId, role },
      })
    }

    void logShadow({
      messageId,
      userId: operatorId,
      operatorId,
      senderRole: role,
      recipientRole,
      topicClass: forbiddenHit ? 'pregunta_financiera' : topicClass,
      companyId,
      toolsCalled,
      responseTimeMs,
      escalated: mentionResult.escalated,
      resolved: !!finalText || !!answer,
      questionExcerpt: question,
      answerExcerpt: answer,
      metadata: {
        rejected_mentions: mentionResult.rejected,
        recipients: mentionResult.recipients.map(r => r.handle),
      },
    })

    return NextResponse.json({ answer })
  } catch (err) {
    console.error('[aguila-ai/ask] error:', err)
    void logShadow({
      messageId,
      senderRole: 'client',
      topicClass: 'error',
      responseTimeMs: Date.now() - started,
      resolved: false,
      metadata: { error: err instanceof Error ? err.message : String(err) },
    })
    return NextResponse.json(
      { answer: 'Lo siento, hubo un problema técnico. Por favor intenta de nuevo.' },
      { status: 500 },
    )
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildUserTurn(
  question: string,
  role: PortalRole,
  companyId: string,
  rejectedMentions: string[],
): string {
  const scopeLine = role === 'client' || role === 'warehouse'
    ? `Alcance: solo company_id ${companyId}.`
    : `Alcance: acceso multi-cliente (rol ${role}).`
  const rejectedLine = rejectedMentions.length > 0
    ? `\nMenciones rechazadas (el usuario no puede mencionar a otros clientes): ${rejectedMentions.join(', ')}`
    : ''
  return `${scopeLine}${rejectedLine}\n\nPregunta del usuario:\n${question}\n\nUsa las herramientas disponibles para obtener datos reales antes de responder.`
}

async function classifyTopic(anthropic: Anthropic, question: string): Promise<string | null> {
  const resp = await anthropic.messages.create({
    model: MODEL_TOOL_LOOP,
    max_tokens: 20,
    system: CLASSIFIER_PROMPT,
    messages: [{ role: 'user', content: question }],
  })
  const block = resp.content?.[0]
  if (block?.type === 'text') return block.text.trim().toLowerCase().split(/\s+/)[0] || null
  return null
}

function summarizeMessage(m: Anthropic.MessageParam): string {
  if (typeof m.content === 'string') return `[${m.role}] ${m.content.slice(0, 300)}`
  const parts: string[] = []
  for (const block of m.content) {
    if (block.type === 'text') parts.push(block.text.slice(0, 300))
    else if (block.type === 'tool_use') parts.push(`tool_call:${block.name}(${JSON.stringify(block.input).slice(0, 200)})`)
    else if (block.type === 'tool_result') {
      const c = typeof block.content === 'string' ? block.content : JSON.stringify(block.content)
      parts.push(`tool_result: ${c.slice(0, 400)}`)
    }
  }
  return parts.length ? `[${m.role}] ${parts.join(' | ')}` : ''
}
