import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'
import { randomUUID } from 'crypto'
import { verifySession, type PortalRole } from '@/lib/session'
import { logOperatorAction } from '@/lib/operator-actions'
import {
  TOOL_DEFINITIONS,
  runTool,
  isWriteGatedTool,
  type AguilaCtx,
  type ToolName,
  type ActionProposalResponse,
} from '@/lib/aguila/tools'
import { resolveMentions } from '@/lib/aguila/mentions'
import { logShadow } from '@/lib/aguila/shadow-log'
import { buildClientAIContext, formatClientAIContextPreamble } from '@/lib/ai/client-context'
import {
  getOrCreateConversation,
  loadRecentTurns,
  appendTurn,
  type ConversationTurn,
} from '@/lib/aguila/conversation'
import { pickToolCandidates, filterToolsByName } from '@/lib/aguila/router'
import { deriveSuggestions } from '@/lib/aguila/suggestions'
import { extractDataRefs, EMPTY_DATA_REFS, type DataRefs } from '@/lib/aguila/data-refs'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

const MODEL_TOOL_LOOP = 'claude-haiku-4-5-20251001'
const MODEL_SYNTHESIS = 'claude-sonnet-4-20250514'
const MAX_TOOL_ROUNDS = 4
const MAX_QUESTION_CHARS = 1000

// Shown to clients whenever any Anthropic upstream fails (402/429/500/529,
// billing, timeout, unknown). Calm, reassuring, no system blame. Paired
// with `is_fallback: true` so the UI can render a muted card instead of
// the default answer bubble.
const FALLBACK_ANSWER =
  'El asistente PORTAL estará disponible muy pronto. Mientras tanto, tu operación sigue al corriente. ' +
  'Para preguntas urgentes, contacta a tu agente aduanal.'

function isUpstreamFailure(err: unknown): boolean {
  if (!err) return false
  const e = err as { status?: number; name?: string; message?: string }
  if (typeof e.status === 'number' && [402, 408, 429, 500, 502, 503, 504, 529].includes(e.status)) return true
  if (e.name === 'APIError' || e.name === 'AnthropicError' || e.name === 'TimeoutError') return true
  const msg = (e.message || '').toLowerCase()
  return /credit|billing|rate[_ ]?limit|overloaded|timeout|socket|econn|fetch failed|aborted/.test(msg)
}

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
  operator: `Eres PORTAL, asistente de operaciones aduanales.
Ayudas a Claudia con embarques activos, estatus de pedimentos,
y cadena factura→entrada→pedimento. Responde en español.

${BASE_RULES}`,
  trafico: `Eres PORTAL, asistente de embarque.
Ayudas al equipo de embarque con activos en ruta, despachos,
y seguimiento de embarques. Responde en español.

${BASE_RULES}`,
  contabilidad: `Eres PORTAL, asistente de contabilidad aduanal.
Ayudas a Anabel con cuentas por cobrar, facturas emitidas,
pagos recibidos, y exportación QB. Responde en español.

${BASE_RULES}`,
  warehouse: `Eres PORTAL, asistente de almacén.
Ayudas a Vicente con entradas, ubicaciones en bodega,
recepción de mercancía, y despacho. Responde en español.

${BASE_RULES}`,
  client: `Eres PORTAL, el asistente de inteligencia aduanal de Renato Zapata & Company (Patente 3596, Aduana 240 Nuevo Laredo).

${BASE_RULES}`,
  admin: `Eres PORTAL, el asistente de inteligencia aduanal de Renato Zapata & Company (Patente 3596, Aduana 240 Nuevo Laredo). Acceso multi-cliente de administración.

${BASE_RULES}`,
  broker: `Eres PORTAL, el asistente de inteligencia aduanal de Renato Zapata & Company (Patente 3596, Aduana 240 Nuevo Laredo). Acceso de agente aduanal titular.

${BASE_RULES}`,
}

function systemPromptFor(role: PortalRole): string {
  return ROLE_PROMPTS[role] ?? ROLE_PROMPTS.client
}

const CLASSIFIER_PROMPT = `Clasifica el mensaje en UNA de estas etiquetas y responde solo con la etiqueta:
estatus_trafico, pregunta_pedimento, duda_documento, pregunta_financiera, escalacion, saludo, otro`

/**
 * PORTAL ask endpoint with live Supabase tool calls.
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
    // Phase 3 memory — the UI may echo back a prior conversationId or
    // sessionId so follow-ups resolve against prior turns. Both are
    // optional; if absent, we mint a session-id-per-request (no prior
    // context available, but the envelope still gets created so the
    // NEXT turn has memory).
    const bodySessionId = typeof body.sessionId === 'string' ? body.sessionId.slice(0, 128) : null
    // Phase 4 streaming — opt-in via `{stream: true}`. When set, the
    // response is NDJSON with `meta`/`tool`/`delta`/`suggestions`/
    // `data`/`done` events. Default (omitted or false) keeps the
    // legacy single-JSON response shape for back-compat.
    const streamMode = body.stream === true

    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      return NextResponse.json({ answer: FALLBACK_ANSWER, is_fallback: true })
    }

    const role = session.role as PortalRole
    const companyId = session.companyId
    const operatorId = req.cookies.get('operator_id')?.value || null
    const ctx: AguilaCtx = { companyId, role, userId: operatorId, operatorId, supabase }
    // Client role gets personalized context prepended to the system
    // prompt (company name, active shipments, recent pedimentos,
    // incomplete expedientes) — so Ursula's questions are answered
    // against HER data, not a generic response. Other roles already
    // have tool-use to fetch context on demand; clients benefit from
    // having the shape up-front.
    let systemPrompt = systemPromptFor(role)
    if (role === 'client') {
      try {
        const clientCtx = await buildClientAIContext(supabase, companyId)
        systemPrompt = `${formatClientAIContextPreamble(clientCtx)}\n\n${systemPrompt}`
      } catch {
        // Context build failure is non-fatal — AI still responds with
        // the generic client prompt. Logged server-side via standard
        // error handling.
      }
    }

    const anthropic = new Anthropic({ apiKey, timeout: 30_000 })

    // ------------------------------------------------------------
    // Phase 3 memory — resolve conversation envelope + prior turns
    // ------------------------------------------------------------
    // Session-id fallback: if the UI didn't send one, scope it to this
    // user + company so follow-up requests in the same auth session
    // can re-land on the same envelope if the UI starts passing it.
    const sessionId = bodySessionId || `${companyId}:${operatorId ?? 'anon'}:${messageId}`
    let conversationId: string | null = null
    let priorTurns: ConversationTurn[] = []
    try {
      const conv = await getOrCreateConversation(supabase, {
        companyId, operatorId, sessionId, role,
      })
      conversationId = conv.conversationId
      if (conversationId && !conv.created) {
        priorTurns = await loadRecentTurns(supabase, conversationId, companyId, 6)
      }
    } catch {
      // Memory is an enhancement, not a blocker. If the conversation
      // store is unreachable (new table not yet applied on this env,
      // Supabase timeout, etc.) the ask degrades to single-shot mode
      // silently — no answer is worse than no memory.
    }

    // ------------------------------------------------------------
    // Pre-pass: parse @mentions + topic classification (parallel)
    // ------------------------------------------------------------
    const [mentionResult, topicClass] = await Promise.all([
      resolveMentions(question, role),
      classifyTopic(anthropic, question).catch(() => null),
    ])

    const recipientRole = mentionResult.recipients[0]?.role ?? 'operator'

    // Phase 4 router — narrow TOOL_DEFINITIONS to a role-appropriate
    // subset so Haiku never sees the schema for tools it won't pick.
    // Saves ~70% of tool-schema tokens per round. `saludo` returns []
    // → we omit `tools` entirely and Haiku chats without tool-use.
    const routed = pickToolCandidates(question, role, topicClass)
    const toolsArgument = routed.tools.length > 0
      ? filterToolsByName(TOOL_DEFINITIONS, routed.tools)
      : undefined

    // ------------------------------------------------------------
    // Haiku tool-calling loop
    // ------------------------------------------------------------
    // Prior turns are sent as plain role+content — tool-result blocks
    // from earlier rounds aren't re-sent (they'd bloat input tokens
    // and Haiku has already produced the polished-synthesis text we
    // persisted, so the model has what it needs for continuity).
    const messages: Anthropic.MessageParam[] = [
      ...priorTurns.map<Anthropic.MessageParam>(t => ({ role: t.role, content: t.content })),
      { role: 'user', content: buildUserTurn(question, role, companyId, mentionResult.rejected) },
    ]

    // ================================================================
    // Phase 4 streaming branch — NDJSON response with progressive
    // events. Short-circuits the non-stream path below.
    // ================================================================
    if (streamMode) {
      return streamingAskResponse({
        anthropic, systemPrompt, messages, toolsArgument,
        ctx, conversationId, sessionId, companyId, operatorId, role,
        mentionResult, recipientRole, topicClass, messageId, started, question,
      })
    }

    const toolsCalled: ToolName[] = []
    // Raw JSON-stringified tool results, kept for data-ref extraction
    // (pedimento / fracción / amount chips in the UI). Capped individually
    // to 8KB; total cap via the number of rounds × tool calls.
    const toolResultTexts: string[] = []
    let finalText = ''
    let forbiddenHit = false

    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
      const resp = await anthropic.messages.create({
        model: MODEL_TOOL_LOOP,
        max_tokens: 800,
        system: systemPrompt,
        ...(toolsArgument ? { tools: toolsArgument } : {}),
        messages,
      })

      messages.push({ role: 'assistant', content: resp.content })

      if (resp.stop_reason !== 'tool_use') {
        for (const block of resp.content) {
          if (block.type === 'text') finalText = block.text.trim()
        }
        break
      }

      // No tools in scope (saludo, chit-chat): Haiku asked for a tool
      // but we never sent any schema. Break rather than loop forever.
      if (!toolsArgument) break

      const toolResults: Anthropic.ToolResultBlockParam[] = []
      for (const block of resp.content) {
        if (block.type !== 'tool_use') continue
        const toolName = block.name as ToolName
        toolsCalled.push(toolName)
        const result = await runTool(toolName, block.input, ctx)
        if (result.forbidden) forbiddenHit = true
        const resultJson = JSON.stringify(result.result).slice(0, 8000)
        toolResultTexts.push(resultJson)
        toolResults.push({
          type: 'tool_result',
          tool_use_id: block.id,
          content: resultJson,
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
    const synthStarted = Date.now()
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
      // V1 cost tracking — Sonnet synthesis is the dominant token spend per ask
      const inT = synth.usage?.input_tokens ?? 0
      const outT = synth.usage?.output_tokens ?? 0
      void supabase.from('api_cost_log').insert({
        model: MODEL_SYNTHESIS,
        input_tokens: inT,
        output_tokens: outT,
        cost_usd: (inT * 0.003 + outT * 0.015) / 1000,
        action: 'cruz_ai_synthesis',
        client_code: session.companyId,
        latency_ms: Date.now() - synthStarted,
      }).then(() => {}, () => {})
    } catch (err) {
      if (isUpstreamFailure(err)) {
        console.error('[cruz-ai] synthesis upstream failure', {
          status: (err as { status?: number })?.status,
          name: (err as { name?: string })?.name,
          message: err instanceof Error ? err.message : String(err),
        })
        // If Haiku already produced preliminary text, keep it and let the
        // caller render normally. If not, fall through to outer catch
        // by re-throwing so the client gets the calm fallback card.
        if (!finalText) throw err
      } else {
        throw err
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

    // Phase 3 memory — persist this turn so the NEXT ask in this session
    // sees it. Fire-and-forget so a slow write doesn't add latency; the
    // answer is already shaped and safe to return.
    if (conversationId) {
      void appendTurn(supabase, conversationId, companyId, 'user', question, {
        metadata: { message_id: messageId, topic_class: topicClass },
      }).then(() => {}, () => {})
      void appendTurn(supabase, conversationId, companyId, 'assistant', answer, {
        toolsCalled: toolsCalled.map(String),
        metadata: { message_id: messageId, topic_class: topicClass, is_fallback: false },
      }).then(() => {}, () => {})
    }

    // Phase 4 — proactive follow-ups + extracted chips. These are cheap
    // and deterministic; always compute even on the non-stream path.
    const suggestions = deriveSuggestions({
      toolsCalled,
      topicClass,
      hasFallback: false,
    })
    const dataRefs: DataRefs = extractDataRefs([answer, ...toolResultTexts])

    return NextResponse.json({ answer, conversationId, sessionId, suggestions, data: dataRefs })
  } catch (err) {
    // Log full error server-side for diagnosis; return a calm 200 so the
    // client UI treats this as a soft fallback (muted card, no error
    // bubble, no retry button). Matches the contract documented in
    // CLAUDE.md: "Users never see a hanging spinner or English stack trace."
    console.error('[cruz-ai/ask] error', {
      status: (err as { status?: number })?.status,
      name: (err as { name?: string })?.name,
      message: err instanceof Error ? err.message : String(err),
    })
    void logShadow({
      messageId,
      senderRole: 'client',
      topicClass: 'error',
      responseTimeMs: Date.now() - started,
      resolved: false,
      metadata: { error: err instanceof Error ? err.message : String(err) },
    })
    return NextResponse.json({ answer: FALLBACK_ANSWER, is_fallback: true }, { status: 200 })
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

// ---------------------------------------------------------------------------
// Phase 4 — streaming NDJSON response
// ---------------------------------------------------------------------------

interface StreamingAskInput {
  anthropic: Anthropic
  systemPrompt: string
  messages: Anthropic.MessageParam[]
  toolsArgument: Anthropic.Tool[] | undefined
  ctx: AguilaCtx
  conversationId: string | null
  sessionId: string
  companyId: string
  operatorId: string | null
  role: PortalRole
  mentionResult: Awaited<ReturnType<typeof resolveMentions>>
  recipientRole: PortalRole
  topicClass: string | null
  messageId: string
  started: number
  question: string
}

function streamingAskResponse(input: StreamingAskInput): Response {
  const encoder = new TextEncoder()
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const emit = (evt: Record<string, unknown>) => {
        controller.enqueue(encoder.encode(JSON.stringify(evt) + '\n'))
      }

      const toolsCalled: ToolName[] = []
      const toolResultTexts: string[] = []
      let finalText = ''
      let forbiddenHit = false
      let answer = ''
      let fallback = false

      try {
        emit({
          type: 'meta',
          conversationId: input.conversationId,
          sessionId: input.sessionId,
          topicClass: input.topicClass,
        })

        // ---- Haiku tool loop (same as non-stream path) ----
        for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
          const resp = await input.anthropic.messages.create({
            model: MODEL_TOOL_LOOP,
            max_tokens: 800,
            system: input.systemPrompt,
            ...(input.toolsArgument ? { tools: input.toolsArgument } : {}),
            messages: input.messages,
          })
          input.messages.push({ role: 'assistant', content: resp.content })

          if (resp.stop_reason !== 'tool_use') {
            for (const block of resp.content) {
              if (block.type === 'text') finalText = block.text.trim()
            }
            break
          }
          if (!input.toolsArgument) break

          const toolResults: Anthropic.ToolResultBlockParam[] = []
          for (const block of resp.content) {
            if (block.type !== 'tool_use') continue
            const toolName = block.name as ToolName
            toolsCalled.push(toolName)
            emit({ type: 'tool', name: toolName })
            const result = await runTool(toolName, block.input, input.ctx)
            if (result.forbidden) forbiddenHit = true
            // Phase 6 — write-gated tools return a flat `{ awaiting_commit: true, ... }`
            // envelope that promotes to a client `action` event. The UI renders a
            // 5-second countdown banner and calls /api/cruz-ai/actions/commit or
            // /cancel at the deadline. Shape is guaranteed by isWriteGatedTool +
            // ActionProposalResponse — the cast is safe.
            if (isWriteGatedTool(toolName)) {
              const envelope = result.result as ActionProposalResponse
              if (envelope?.awaiting_commit && envelope.action_id) {
                emit({
                  type: 'action',
                  action_id: envelope.action_id,
                  kind: envelope.kind,
                  summary_es: envelope.summary_es,
                  commit_deadline_at: envelope.commit_deadline_at,
                  cancel_window_ms: envelope.cancel_window_ms,
                })
              }
            }
            const resultJson = JSON.stringify(result.result).slice(0, 8000)
            toolResultTexts.push(resultJson)
            toolResults.push({
              type: 'tool_result',
              tool_use_id: block.id,
              content: resultJson,
              is_error: !!result.error,
            })
          }
          input.messages.push({ role: 'user', content: toolResults })
        }

        // ---- Sonnet synthesis, streamed ----
        const toolTranscript = input.messages
          .filter(m => m.role === 'user' || m.role === 'assistant')
          .map(m => summarizeMessage(m))
          .filter(Boolean)
          .join('\n')

        answer = finalText || 'No pude generar una respuesta.'
        const synthStarted = Date.now()
        try {
          const synth = input.anthropic.messages.stream({
            model: MODEL_SYNTHESIS,
            max_tokens: 400,
            system: input.systemPrompt,
            messages: [{
              role: 'user',
              content: `PREGUNTA DEL USUARIO: ${input.question}\n\nDATOS OBTENIDOS POR LAS HERRAMIENTAS:\n${toolTranscript}\n\nRespuesta preliminar de Haiku: "${finalText}"\n\nEscribe la respuesta final en español, máximo 4 oraciones, usando solo los datos obtenidos. Si alguna herramienta devolvió "forbidden", responde que no tienes permiso.`,
            }],
          })

          let streamedText = ''
          for await (const event of synth) {
            if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
              streamedText += event.delta.text
              emit({ type: 'delta', text: event.delta.text })
            }
          }
          const finalMsg = await synth.finalMessage()
          if (streamedText.trim()) answer = streamedText.trim()
          const inT = finalMsg.usage?.input_tokens ?? 0
          const outT = finalMsg.usage?.output_tokens ?? 0
          void supabase.from('api_cost_log').insert({
            model: MODEL_SYNTHESIS,
            input_tokens: inT,
            output_tokens: outT,
            cost_usd: (inT * 0.003 + outT * 0.015) / 1000,
            action: 'cruz_ai_synthesis',
            client_code: input.companyId,
            latency_ms: Date.now() - synthStarted,
          }).then(() => {}, () => {})
        } catch (err) {
          if (isUpstreamFailure(err) && finalText) {
            // keep Haiku's preliminary text, don't fall back
          } else {
            throw err
          }
        }

        // ---- Suggestions + data refs ----
        const suggestions = deriveSuggestions({
          toolsCalled, topicClass: input.topicClass, hasFallback: false,
        })
        const dataRefs = extractDataRefs([answer, ...toolResultTexts])
        emit({ type: 'suggestions', items: suggestions })
        emit({ type: 'data', refs: dataRefs })
      } catch (err) {
        console.error('[cruz-ai/ask stream] error', {
          status: (err as { status?: number })?.status,
          name: (err as { name?: string })?.name,
          message: err instanceof Error ? err.message : String(err),
        })
        answer = FALLBACK_ANSWER
        fallback = true
      } finally {
        const responseTimeMs = Date.now() - input.started

        void logOperatorAction({
          operatorId: input.operatorId || undefined,
          actionType: 'aguila_ai_query',
          companyId: input.companyId,
          payload: {
            message_id: input.messageId,
            question: input.question.slice(0, 500),
            answer: answer.slice(0, 500),
            role: input.role,
            tools_called: toolsCalled,
            topic_class: input.topicClass,
            stream: true,
          },
          durationMs: responseTimeMs,
        })
        if (toolsCalled.includes('query_financiero')) {
          void logOperatorAction({
            operatorId: input.operatorId || undefined,
            actionType: 'aguila_financiero_read',
            companyId: input.companyId,
            payload: { message_id: input.messageId, role: input.role },
          })
        }
        void logShadow({
          messageId: input.messageId,
          userId: input.operatorId,
          operatorId: input.operatorId,
          senderRole: input.role,
          recipientRole: input.recipientRole,
          topicClass: forbiddenHit ? 'pregunta_financiera' : input.topicClass,
          companyId: input.companyId,
          toolsCalled,
          responseTimeMs,
          escalated: input.mentionResult.escalated,
          resolved: !!answer && !fallback,
          questionExcerpt: input.question,
          answerExcerpt: answer,
          metadata: {
            rejected_mentions: input.mentionResult.rejected,
            recipients: input.mentionResult.recipients.map(r => r.handle),
            stream: true,
          },
        })

        if (input.conversationId && !fallback) {
          void appendTurn(supabase, input.conversationId, input.companyId, 'user', input.question, {
            metadata: { message_id: input.messageId, topic_class: input.topicClass, stream: true },
          }).then(() => {}, () => {})
          void appendTurn(supabase, input.conversationId, input.companyId, 'assistant', answer, {
            toolsCalled: toolsCalled.map(String),
            metadata: { message_id: input.messageId, topic_class: input.topicClass, is_fallback: false, stream: true },
          }).then(() => {}, () => {})
        }

        emit({
          type: 'done',
          answer,
          conversationId: input.conversationId,
          sessionId: input.sessionId,
          fallback,
        })
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'application/x-ndjson; charset=utf-8',
      'Cache-Control': 'no-store, no-transform',
      'X-Accel-Buffering': 'no',
    },
  })
}
