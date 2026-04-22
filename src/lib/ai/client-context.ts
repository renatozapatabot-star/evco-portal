/**
 * buildClientAIContext — per-client context bundle that gets injected
 * into the CRUZ AI system prompt when role === 'client'. Turns a
 * generic Spanish assistant into one that knows which company is
 * asking, what's in-flight for them right now, and what they've had
 * to follow up on recently.
 *
 * Separate file from /api/cruz-ai/ask so unit tests can stub Supabase
 * and assert the shape without pulling the whole route handler.
 */

import type { SupabaseClient } from '@supabase/supabase-js'

// Keep the client generic so both server and service clients work.
type AnyClient = SupabaseClient<any, any, any> // eslint-disable-line @typescript-eslint/no-explicit-any

export interface ClientAIContext {
  company_name: string
  rfc: string | null
  active_shipments_count: number
  next_crossing_eta: string | null
  recent_pedimentos: Array<{ ref: string; pedimento: string | null; fecha: string | null }>
  incomplete_expedientes: number
  locale: 'es-MX'
}

/**
 * Tolerant context build: every Supabase query is guarded so a missing
 * column / absent table doesn't break the AI round-trip — the caller
 * can always form a reasonable answer from whatever fields come back.
 */
export async function buildClientAIContext(
  supabase: AnyClient,
  companyId: string,
): Promise<ClientAIContext> {
  // Wrap each query in Promise.resolve().catch so a thrown builder
  // error doesn't collapse the whole Promise.all and abort the AI
  // request. Supabase 400s return inline in `.data`, but network /
  // typeerror / etc can still throw.
  const [company, activeShipments, recentPedimentos, expedientesStatus] =
    await Promise.all([
      // portal_company_name is an optional override that isn't in any
      // applied migration yet — request only the guaranteed columns so
      // the whole row doesn't null out on a missing-column error.
      Promise.resolve(
        supabase.from('companies').select('name, rfc').eq('company_id', companyId).maybeSingle()
      ).then((r: { data: unknown } | null) => r?.data ?? null).catch(() => null),
      Promise.resolve(
        supabase.from('traficos').select('trafico, fecha_llegada, estatus').eq('company_id', companyId)
          .not('estatus', 'in', '("Cruzado","E1","Entregado","Cancelado")')
          .order('fecha_llegada', { ascending: true }).limit(10)
      ).then((r: { data: unknown[] | null } | null) => r?.data ?? []).catch(() => []),
      Promise.resolve(
        supabase.from('traficos').select('trafico, pedimento, fecha_pago').eq('company_id', companyId)
          .not('pedimento', 'is', null)
          .order('fecha_pago', { ascending: false }).limit(5)
      ).then((r: { data: unknown[] | null } | null) => r?.data ?? []).catch(() => []),
      Promise.resolve(
        // expediente_documentos uses pedimento_id (trafico slug) — `trafico_id` is a phantom.
        supabase.from('expediente_documentos').select('pedimento_id, doc_type').eq('company_id', companyId)
          .is('file_url', null).limit(50)
      ).then((r: { data: unknown[] | null } | null) => r?.data ?? []).catch(() => []),
    ])

  const companyRow = company as { name?: string | null; rfc?: string | null; portal_company_name?: string | null } | null
  const active = activeShipments as Array<{ trafico: string; fecha_llegada: string | null; estatus: string | null }>
  const pedimentos = recentPedimentos as Array<{ trafico: string; pedimento: string | null; fecha_pago: string | null }>
  const expedientes = expedientesStatus as Array<{ pedimento_id: string | null }>

  return {
    company_name: companyRow?.portal_company_name || companyRow?.name || 'cliente',
    rfc: companyRow?.rfc ?? null,
    active_shipments_count: active.length,
    next_crossing_eta: active[0]?.fecha_llegada ?? null,
    recent_pedimentos: pedimentos.map((r) => ({
      ref: r.trafico,
      pedimento: r.pedimento ?? null,
      fecha: r.fecha_pago ?? null,
    })),
    incomplete_expedientes: expedientes.length,
    locale: 'es-MX',
  }
}

/**
 * Formats the context as a deterministic string suitable for
 * prepending to the CRUZ AI system prompt. Keep short — the AI has
 * already been primed with role rules elsewhere.
 */
export function formatClientAIContextPreamble(ctx: ClientAIContext): string {
  const lines = [
    `Contexto del cliente en esta sesión:`,
    `- Empresa: ${ctx.company_name}${ctx.rfc ? ` (RFC ${ctx.rfc})` : ''}`,
    `- Embarques activos ahora: ${ctx.active_shipments_count}`,
  ]
  if (ctx.next_crossing_eta) {
    lines.push(`- Próxima llegada prevista: ${ctx.next_crossing_eta}`)
  }
  if (ctx.recent_pedimentos.length > 0) {
    const refs = ctx.recent_pedimentos.slice(0, 3).map((p) => p.pedimento || p.ref).join(', ')
    lines.push(`- Pedimentos recientes: ${refs}`)
  }
  if (ctx.incomplete_expedientes > 0) {
    lines.push(`- Expedientes con documentos faltantes: ${ctx.incomplete_expedientes}`)
  }
  lines.push(`- Fecha de hoy: ${new Date().toLocaleDateString('es-MX', { timeZone: 'America/Chicago' })}`)
  lines.push(``)
  lines.push(`Reglas adicionales para este cliente:`)
  lines.push(`- Nunca muestres datos de otros clientes.`)
  lines.push(`- Nunca muestres códigos crudos de estatus (por ejemplo "E1") — usa español plano como "Entregado".`)
  lines.push(`- No menciones cifras financieras internas a menos que el cliente pregunte específicamente por un monto (como ahorros T-MEC).`)
  lines.push(`- Si la pregunta requiere acción operativa (aprobar, rechazar, vincular, clasificar), di al cliente que contacte a su agente aduanal; no ofrezcas hacerla tú.`)
  lines.push(`- Sé cálido pero profesional. Tercera persona cuando sea posible.`)
  return lines.join('\n')
}
