import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { PORTAL_DATE_FROM } from '@/lib/data'
import { sanitizeIlike } from '@/lib/sanitize'
import { getErrorMessage } from '@/lib/errors'
import { buildClaveMap, resolveCompanyIdSlug } from '@/lib/tenant/resolve-slug'

/**
 * Vapi Custom LLM Adapter
 *
 * Vapi sends OpenAI-compatible requests. This endpoint translates them
 * to Anthropic API calls, reusing the same tools and system prompt as
 * /api/cruz-chat. Returns OpenAI-compatible responses.
 *
 * Auth: shared secret via x-vapi-secret header (server-to-server).
 * Context: hardcoded to Tito (director) — this is a director-only feature.
 */

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || ''
const VAPI_SECRET = process.env.VAPI_PRIVATE_KEY || ''

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Director context — the company Tito's voice endpoint is currently
// operating against. Pinned to EVCO for the Monday 2026-04-20 launch
// because Vapi doesn't yet send a per-call company_id; EVCO is the only
// client with active operations. MAFESA onboarding TODO: thread a
// `company_id` from the Vapi request body here (~4 call sites to touch:
// this fn signature, the POST handler around line 292, data queries
// around line 245, and the cost-log shape around line 402). Until then,
// Tito addressing a MAFESA issue via voice will see EVCO data — he
// knows, he's the only caller. Tagged for post-launch milestone.
async function getDirectorContext(companyIdOverride?: string) {
  const targetCompanyId = companyIdOverride || 'evco'
  const { data } = await supabase
    .from('companies')
    .select('company_id, clave_cliente, name')
    .eq('company_id', targetCompanyId)
    .single()
  return {
    companyId: data?.company_id || targetCompanyId,
    clientClave: data?.clave_cliente || '',
    clientName: data?.name || 'Cliente',
    patente: '3596',
    aduana: '240',
  }
}
// Cached per cold start
let DIRECTOR_CTX: { companyId: string; clientClave: string; clientName: string; patente: string; aduana: string } | null = null

function buildVoiceSystemPrompt(ctx: NonNullable<typeof DIRECTOR_CTX>): string {
  return `Eres CRUZ, el sistema de inteligencia aduanal de Renato Zapata & Company, Laredo, Texas.

IDENTIDAD:
- Hablas como un agente aduanal senior con 20 años de experiencia en Aduana ${ctx.aduana} Nuevo Laredo
- Eres directo, específico, orientado a la acción
- Hablas español siempre — este es un canal de voz
- Términos técnicos en español: pedimento, fracción, embarque, COVE, MVE, IGI, DTA

CLIENTE ACTUAL: ${ctx.clientName} (clave ${ctx.clientClave})

MODO VOZ ACTIVO:
- Responde en 1-3 oraciones máximo. Habla como colega, no como reporte.
- Sin markdown, sin viñetas, sin formato. Lenguaje hablado natural.
- Usa "nosotros" siempre — nunca "yo".
- Cuando apruebes un borrador, confirma el proveedor y monto antes de ejecutar.
- Cuando te pidan un contacto, di el nombre y número claramente.
- Celebra logros con 🦀 solo en momentos importantes.
- Después de resolver, sugiere el siguiente paso: "¿Algo más?"

ACCIONES:
- "aprueba/dale/autoriza" → usa approve_draft. SIEMPRE confirma proveedor + monto antes.
- "cuantos pendientes/como va el dia" → usa get_pending_summary
- "llamame a/el numero de" → usa lookup_contact
- Confirma acciones ANTES de ejecutar. Si el usuario dice "sí/dale/procede", ejecuta.

Formato: USD como $X,XXX, MXN como MX$X,XXX, fechas como "28 mar 2026".
Pedimentos SIEMPRE con espacios: "26 24 3596 6500247".
`
}

// Import the same TOOLS array structure from cruz-chat
// We inline a focused subset for voice — the most commonly used tools
const VOICE_TOOLS = [
  {
    name: 'get_pending_summary',
    description: 'Get count of pending items needing attention today.',
    input_schema: { type: 'object' as const, properties: {} }
  },
  {
    name: 'approve_draft',
    description: 'Approve a pedimento draft by supplier name or draft ID.',
    input_schema: {
      type: 'object' as const,
      properties: {
        supplier_name: { type: 'string', description: 'Supplier name to fuzzy match' },
        draft_id: { type: 'string', description: 'Direct draft UUID' },
      },
    }
  },
  {
    name: 'lookup_contact',
    description: 'Look up phone number for staff or supplier contacts.',
    input_schema: {
      type: 'object' as const,
      properties: {
        name: { type: 'string', description: 'Person name to look up' },
      },
      required: ['name'],
    }
  },
  {
    name: 'query_traficos',
    description: 'Search traficos by criteria.',
    input_schema: {
      type: 'object' as const,
      properties: {
        trafico_id: { type: 'string' },
        estatus: { type: 'string' },
        search: { type: 'string' },
        limit: { type: 'number' },
      }
    }
  },
  {
    name: 'morning_brief',
    description: 'Get today\'s morning briefing.',
    input_schema: { type: 'object' as const, properties: {} }
  },
  {
    name: 'get_summary',
    description: 'Get high-level summary: total traficos, value, compliance.',
    input_schema: { type: 'object' as const, properties: {} }
  },
]

// Reuse executeTool from cruz-chat — imported inline to avoid circular deps
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function executeTool(name: string, input: Record<string, any>): Promise<string> {
  if (!DIRECTOR_CTX) DIRECTOR_CTX = await getDirectorContext()
  const { companyId, clientClave } = DIRECTOR_CTX
  try {
    switch (name) {
      case 'get_pending_summary': {
        const [draftsRes, decisionsRes, solicitRes, autoRes] = await Promise.all([
          supabase.from('pedimento_drafts')
            .select('id, draft_data, status', { count: 'exact' })
            .in('status', ['draft', 'pending', 'approved_pending'])
            .limit(10),
          supabase.from('agent_decisions')
            .select('id', { count: 'exact' })
            .is('was_correct', null)
            .lte('autonomy_level', 1)
            .limit(1),
          supabase.from('documento_solicitudes')
            .select('id', { count: 'exact' })
            .eq('status', 'solicitado')
            .limit(1),
          supabase.from('cruz_auto_actions')
            .select('id, description, time_saved_minutes')
            .gte('created_at', new Date(new Date().setHours(0, 0, 0, 0)).toISOString())
            .limit(20),
        ])
        const approvals = draftsRes.count || 0
        const decisions = decisionsRes.count || 0
        const followUps = solicitRes.count || 0
        const autoActions = autoRes.data || []
        const totalAuto = autoActions.length
        const totalTimeSaved = autoActions.reduce((s, a: { time_saved_minutes?: number }) => s + (a.time_saved_minutes || 0), 0)
        return JSON.stringify({
          approvals, decisions, follow_ups: followUps,
          total: approvals + decisions + followUps,
          estimated_minutes: approvals * 5 + decisions * 3 + followUps * 8,
          auto_processed_today: totalAuto,
          total_time_saved_minutes: totalTimeSaved,
          pending_drafts: (draftsRes.data || []).map((d: { id: string; draft_data?: { supplier?: string; valor_total_usd?: number } }) => ({
            id: d.id, supplier: d.draft_data?.supplier, valor_usd: d.draft_data?.valor_total_usd,
          })),
        })
      }
      case 'approve_draft': {
        let draftQuery = supabase.from('pedimento_drafts')
          .select('id, status, draft_data')
          .in('status', ['draft', 'pending'])
        if (input.draft_id) draftQuery = draftQuery.eq('id', input.draft_id)
        const { data: candidates } = await draftQuery.limit(20)
        if (!candidates?.length) return JSON.stringify({ error: 'No hay borradores pendientes.' })
        let matches = candidates
        if (input.supplier_name) {
          const needle = (input.supplier_name as string).toLowerCase()
          matches = candidates.filter((d: { draft_data?: { supplier?: string } }) =>
            (d.draft_data?.supplier || '').toLowerCase().includes(needle)
          )
        }
        if (matches.length === 0) {
          return JSON.stringify({ error: `No se encontró borrador de "${input.supplier_name}".`,
            available: candidates.map((d: { id: string; draft_data?: { supplier?: string; valor_total_usd?: number } }) => ({
              id: d.id, supplier: d.draft_data?.supplier, valor_usd: d.draft_data?.valor_total_usd,
            })),
          })
        }
        if (matches.length > 1) {
          return JSON.stringify({ disambiguation: true, message: `Hay ${matches.length} borradores. ¿Cuál?`,
            options: matches.map((d: { id: string; draft_data?: { supplier?: string; valor_total_usd?: number } }) => ({
              id: d.id, supplier: d.draft_data?.supplier, valor_usd: d.draft_data?.valor_total_usd,
            })),
          })
        }
        const draft = matches[0] as { id: string; draft_data?: { supplier?: string; valor_total_usd?: number; company_id?: string } }
        const { error: updateErr } = await supabase
          .from('pedimento_drafts')
          .update({ status: 'approved_pending', reviewed_by: 'tito', updated_at: new Date().toISOString() })
          .eq('id', draft.id)
        if (updateErr) return JSON.stringify({ error: updateErr.message })
        supabase.from('audit_log').insert({
          action: 'draft_approved_voice', actor: 'tito', timestamp: new Date().toISOString(),
          details: { draft_id: draft.id, approved_by: 'tito', supplier: draft.draft_data?.supplier, valor_usd: draft.draft_data?.valor_total_usd, channel: 'voice', status: 'approved_pending' },
        }).then(() => {}, (e) => console.error('[audit-log] vapi draft approved:', e.message))
        if (draft.draft_data?.company_id) {
          // Same defense pattern as telegram-webhook: pedimento_drafts.draft_data
          // company_id may carry a clave; normalize before stamping notification.
          const claveMap = await buildClaveMap(supabase)
          const resolved = resolveCompanyIdSlug(draft.draft_data.company_id, claveMap)
          if (resolved.kind === 'unresolved') {
            console.warn(
              `[vapi-llm] skipping celebration notification: company_id=${String(draft.draft_data.company_id)} unresolvable (${resolved.reason})`,
            )
          } else {
            supabase.from('notifications').insert({
              type: 'approval_complete', severity: 'celebration',
              title: `🦀 Borrador aprobado: ${draft.draft_data?.supplier || 'Desconocido'}`,
              description: 'Patente 3596 honrada. Gracias, Tito.',
              company_id: resolved.slug, read: false,
            }).then(() => {}, (e) => console.error('[audit-log] vapi notification:', e.message))
          }
        }
        return JSON.stringify({ success: true, draft_id: draft.id, supplier: draft.draft_data?.supplier, valor_usd: draft.draft_data?.valor_total_usd, status: 'approved_pending', cancellation_window: '5 seconds' })
      }
      case 'lookup_contact': {
        const STAFF_CONTACTS: Record<string, { name: string; phone: string; title: string }> = {
          eloisa: { name: 'Eloisa', phone: '+528123456789', title: 'Coordinadora' },
          juanjose: { name: 'Juan José', phone: '+528123456790', title: 'Clasificador' },
          tito: { name: 'Tito', phone: '+19566727859', title: 'Director General' },
        }
        const searchName = (input.name as string).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        const staffMatch = Object.values(STAFF_CONTACTS).find(s =>
          s.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').includes(searchName)
        )
        if (staffMatch) return JSON.stringify({ found: true, type: 'staff', ...staffMatch, tel_url: `tel:${staffMatch.phone}` })
        const { data: contacts } = await supabase.from('supplier_contacts')
          .select('supplier_name, contact_name, contact_phone, contact_email')
          .or(`contact_name.ilike.%${sanitizeIlike(input.name)}%,supplier_name.ilike.%${sanitizeIlike(input.name)}%`)
          .limit(5)
        if (contacts?.length) {
          const c = contacts[0] as { supplier_name?: string; contact_name?: string; contact_phone?: string; contact_email?: string }
          return JSON.stringify({ found: true, type: 'supplier', name: c.contact_name || c.supplier_name, phone: c.contact_phone, tel_url: c.contact_phone ? `tel:${c.contact_phone}` : null })
        }
        return JSON.stringify({ found: false, message: `No se encontró contacto para "${input.name}".` })
      }
      case 'query_traficos': {
        let query = supabase.from('traficos').select('trafico, estatus, fecha_llegada, pedimento, descripcion_mercancia, importe_total')
          .eq('company_id', companyId)
        if (input.trafico_id) query = query.eq('trafico', input.trafico_id)
        if (input.estatus) query = query.ilike('estatus', `%${input.estatus}%`)
        if (input.search) { const s = sanitizeIlike(input.search); query = query.or(`descripcion_mercancia.ilike.%${s}%,trafico.ilike.%${s}%,pedimento.ilike.%${s}%`) }
        query = query.gte('fecha_llegada', PORTAL_DATE_FROM).order('fecha_llegada', { ascending: false }).limit(input.limit || 5)
        const { data, error } = await query
        if (error) return JSON.stringify({ error: error.message })
        return JSON.stringify({ count: data?.length, results: data })
      }
      case 'morning_brief': {
        const today = new Date().toISOString().split('T')[0]
        const { data: briefs } = await supabase.from('daily_briefs').select('*').eq('date', today).limit(10)
        if (briefs?.length) return JSON.stringify({ briefs: briefs.map(b => b.brief_data), date: today })
        const { data: active } = await supabase.from('traficos').select('trafico', { count: 'exact', head: true }).neq('estatus', 'Cruzado').gte('fecha_llegada', PORTAL_DATE_FROM)
        const { data: alerts } = await supabase.from('compliance_predictions').select('severity').eq('resolved', false)
        return JSON.stringify({ date: today, active_traficos: active, critical: alerts?.filter((a: { severity: string }) => a.severity === 'critical').length, warnings: alerts?.filter((a: { severity: string }) => a.severity === 'warning').length })
      }
      case 'get_summary': {
        const { data: traf } = await supabase.from('traficos').select('estatus, importe_total').ilike('trafico', `${clientClave}-%`).gte('fecha_llegada', PORTAL_DATE_FROM).limit(5000)
        const traficos = traf || []
        const enProceso = traficos.filter((t: { estatus: string | null }) => t.estatus === 'En Proceso').length
        const cruzados = traficos.filter((t: { estatus: string | null }) => (t.estatus || '').toLowerCase().includes('cruz')).length
        const totalValue = traficos.reduce((s: number, t: { importe_total: number | null }) => s + (Number(t.importe_total) || 0), 0)
        return JSON.stringify({ traficos: { total: traficos.length, enProceso, cruzados }, totalValueUSD: totalValue })
      }
      default:
        return JSON.stringify({ error: `Tool ${name} not available in voice mode.` })
    }
  } catch (err: unknown) {
    return JSON.stringify({ error: getErrorMessage(err) })
  }
}

export async function POST(req: NextRequest) {
  const startTime = Date.now()

  // Validate shared secret — server-to-server auth
  const vapiSecret = req.headers.get('x-vapi-secret') || ''
  if (!VAPI_SECRET || vapiSecret !== VAPI_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: 'AI not configured' }, { status: 503 })
  }

  // Lazy-load director context from DB
  if (!DIRECTOR_CTX) DIRECTOR_CTX = await getDirectorContext()

  try {
    const body = await req.json()

    // Vapi sends OpenAI-compatible format: { model, messages, stream, ... }
    const vapiMessages = body.messages || []

    // Convert OpenAI messages to Anthropic format
    const anthropicMessages = vapiMessages
      .filter((m: { role: string }) => m.role === 'user' || m.role === 'assistant')
      .map((m: { role: string; content: string }) => ({
        role: m.role,
        content: m.content,
      }))

    if (anthropicMessages.length === 0) {
      return NextResponse.json({
        id: `chatcmpl-${Date.now()}`,
        object: 'chat.completion',
        choices: [{ index: 0, message: { role: 'assistant', content: 'Hola Tito. Soy CRUZ. ¿En qué te ayudo?' }, finish_reason: 'stop' }],
      })
    }

    // Call Anthropic with voice system prompt + tools
    let response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 512,
        system: buildVoiceSystemPrompt(DIRECTOR_CTX!),
        tools: VOICE_TOOLS,
        messages: anthropicMessages,
      }),
    })

    let data = await response.json()

    if (data.error || data.type === 'error') {
      console.error('Vapi LLM - Anthropic error:', JSON.stringify(data))
      return NextResponse.json({
        id: `chatcmpl-${Date.now()}`,
        object: 'chat.completion',
        choices: [{ index: 0, message: { role: 'assistant', content: 'Disculpa, tengo un problema técnico. Intenta de nuevo.' }, finish_reason: 'stop' }],
      })
    }

    // Handle tool use loop — run all tools server-side
    let loopMessages = [...anthropicMessages]
    let loopCount = 0
    while (data.stop_reason === 'tool_use' && loopCount < 5) {
      loopCount++
      const toolUseBlocks = data.content.filter((b: { type: string }) => b.type === 'tool_use')
      const toolResults = await Promise.all(
        toolUseBlocks.map(async (block: { id: string; name: string; input: Record<string, unknown> }) => {
          try {
            const content = await executeTool(block.name, block.input)
            return { type: 'tool_result' as const, tool_use_id: block.id, content }
          } catch (toolErr) {
            return { type: 'tool_result' as const, tool_use_id: block.id, content: JSON.stringify({ error: getErrorMessage(toolErr) }) }
          }
        })
      )

      loopMessages = [
        ...loopMessages,
        { role: 'assistant', content: data.content },
        { role: 'user', content: toolResults },
      ]

      response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 512,
          system: buildVoiceSystemPrompt(DIRECTOR_CTX!),
          tools: VOICE_TOOLS,
          messages: loopMessages,
        }),
      })
      data = await response.json()
      if (data.error || data.type === 'error') break
    }

    // Extract final text
    const text = data.content
      ?.filter((b: { type: string; text?: string }) => b.type === 'text')
      .map((b: { type: string; text?: string }) => b.text)
      .join(' ') || 'No pude procesar tu solicitud.'

    const inputTokens = data.usage?.input_tokens || 0
    const outputTokens = data.usage?.output_tokens || 0

    // Audit log
    supabase.from('api_cost_log').insert({
      model: 'claude-sonnet-4-20250514',
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      cost_usd: (inputTokens * 0.003 + outputTokens * 0.015) / 1000,
      action: 'cruz_voice',
      client_code: DIRECTOR_CTX?.clientClave || '',
      latency_ms: Date.now() - startTime,
    }).then(() => {}, (e) => console.error('[audit-log] vapi cost:', e.message))

    // Conversation log
    const lastUserMsg = anthropicMessages.filter((m: { role: string }) => m.role === 'user').pop()
    supabase.from('cruz_conversations').insert({
      session_id: `voice-${Date.now()}`,
      company_id: DIRECTOR_CTX?.companyId || '',
      user_message: (typeof lastUserMsg?.content === 'string' ? lastUserMsg.content : '').substring(0, 2000),
      cruz_response: text.substring(0, 5000),
      tools_used: loopMessages.filter((m: { role: string; content: unknown }) => m.role === 'assistant' && Array.isArray(m.content))
        .flatMap((m) => (Array.isArray(m.content) ? m.content : []).filter((b: { type: string }) => b.type === 'tool_use').map((b: { name?: string }) => b.name)),
      page_context: 'voice',
      response_time_ms: Date.now() - startTime,
    }).then(() => {}, (e) => console.error('[audit-log] vapi conversation:', e.message))

    // Return OpenAI-compatible response
    return NextResponse.json({
      id: `chatcmpl-${Date.now()}`,
      object: 'chat.completion',
      created: Math.floor(Date.now() / 1000),
      model: 'cruz-voice',
      choices: [{
        index: 0,
        message: { role: 'assistant', content: text },
        finish_reason: 'stop',
      }],
      usage: {
        prompt_tokens: inputTokens,
        completion_tokens: outputTokens,
        total_tokens: inputTokens + outputTokens,
      },
    })
  } catch (err: unknown) {
    console.error('Vapi LLM error:', err)
    return NextResponse.json({
      id: `chatcmpl-${Date.now()}`,
      object: 'chat.completion',
      choices: [{ index: 0, message: { role: 'assistant', content: 'Error interno. Intenta de nuevo.' }, finish_reason: 'stop' }],
    })
  }
}
