/**
 * Agent action executor — downstream side-effects for committed actions.
 *
 * Why this exists:
 *   `proposeAction` / `commitAction` / `cancelAction` in `./actions.ts`
 *   deliberately stop at `committed`. `committed` is the USER's
 *   authorization token; the actual downstream side-effect is a
 *   separate concern so the HARD approval gate (CRUZ proposes, humans
 *   authorize) stays intact. This module IS that separate concern.
 *
 * Lifecycle:
 *   committed → executed          (downstream success)
 *   committed → execute_failed    (transient failure; operator may retry)
 *   execute_failed → executed     (retry succeeded)
 *
 * Dispatch map (kind → downstream artifact):
 *   flag_shipment              → escalated mensajeria thread on the trafico
 *                                (internal_only=true, subject "⚠ Flag — <trafico>")
 *   draft_mensajeria_to_anabel → internal mensajeria thread to Anabel
 *                                (author_role='system', authorName='CRUZ')
 *   open_oca_request           → internal mensajeria thread for broker review
 *                                (subject "OCA solicitada — <product>")
 *
 * Why not write directly to `traficos` / `oca_database`:
 *   - `traficos` has no flag column (2026-04-22). Adding one is a
 *     separate tenant-migration conversation.
 *   - `oca_database` requires `fraccion` (core-invariant #8) — an OCA
 *     REQUEST by definition has no fraccion yet; that's what the
 *     request is asking the broker to decide.
 *   Routing every kind through mensajeria keeps execution safe, visible,
 *   and inside a surface operators already monitor. When dedicated
 *   downstream paths exist, swap them in — this module is the single
 *   integration seam.
 *
 * Invariants:
 *   - Executor functions NEVER throw to the caller. Failures are
 *     captured as `{ ok: false, errorEs }` and the route marks the
 *     row `execute_failed` with the Spanish reason.
 *   - Idempotency is the caller's job (see executeAction in
 *     action-executor-router.ts for the status check).
 *   - Every successful execution logs via `logOperatorAction` with
 *     actor = the operator/admin/broker who clicked Execute.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { createThread, findOrCreateThreadByTrafico } from '@/lib/mensajeria/threads'
import type { AgentActionKind, AgentActionRow } from './actions'

export interface ExecutorContext {
  supabase: SupabaseClient
  executorId: string | null
  executorRole: 'operator' | 'admin' | 'broker'
}

export type ExecuteOutcome =
  | { ok: true; result: Record<string, unknown> }
  | { ok: false; errorEs: string }

const MENSAJERIA_SYSTEM_ROLE = 'system' as const
const SYSTEM_AUTHOR = 'CRUZ'

function payload<T>(action: AgentActionRow): T {
  return action.payload as unknown as T
}

async function executeFlagShipment(
  action: AgentActionRow,
  ctx: ExecutorContext,
): Promise<ExecuteOutcome> {
  const p = payload<{
    trafico_id: string
    reason_es: string
    severity: 'info' | 'warn' | 'critical'
  }>(action)

  if (!p.trafico_id || !p.reason_es) {
    return { ok: false, errorEs: 'Tráfico o razón faltante en el payload.' }
  }

  const severityLabel =
    p.severity === 'critical' ? '🔴 Crítico' : p.severity === 'warn' ? '🟡 Aviso' : '🔵 Info'

  const subject = `⚠ Flag ${p.trafico_id} · ${severityLabel}`
  const firstMessage = `${severityLabel} — ${p.reason_es}\n\nGenerado por CRUZ a partir de acción ${action.id}.`

  const res = await findOrCreateThreadByTrafico({
    companyId: action.company_id,
    traficoId: p.trafico_id,
    subject,
    role: MENSAJERIA_SYSTEM_ROLE,
    authorName: SYSTEM_AUTHOR,
    firstMessageBody: firstMessage,
    internalOnly: true,
  })

  if (res.error || !res.data) {
    return { ok: false, errorEs: res.error?.message ?? 'No se pudo crear el hilo de seguimiento.' }
  }

  return {
    ok: true,
    result: {
      thread_id: res.data.id,
      trafico_id: p.trafico_id,
      severity: p.severity,
      downstream: 'mensajeria.thread',
      executor_role: ctx.executorRole,
    },
  }
}

async function executeDraftMensajeriaToAnabel(
  action: AgentActionRow,
  ctx: ExecutorContext,
): Promise<ExecuteOutcome> {
  const p = payload<{
    subject_es: string
    body_es: string
    related_trafico_id?: string
    related_pedimento?: string
  }>(action)

  if (!p.subject_es || !p.body_es) {
    return { ok: false, errorEs: 'Asunto o cuerpo faltante en el payload.' }
  }

  const refs: string[] = []
  if (p.related_trafico_id) refs.push(`Tráfico: ${p.related_trafico_id}`)
  if (p.related_pedimento) refs.push(`Pedimento: ${p.related_pedimento}`)
  const refLine = refs.length > 0 ? `\n\n${refs.join(' · ')}` : ''
  const fullBody = `Para Anabel:\n\n${p.body_es}${refLine}\n\nGenerado por CRUZ · acción ${action.id}.`

  const res = await createThread({
    companyId: action.company_id,
    subject: p.subject_es,
    role: MENSAJERIA_SYSTEM_ROLE,
    authorName: SYSTEM_AUTHOR,
    firstMessageBody: fullBody,
    traficoId: p.related_trafico_id ?? null,
    internalOnly: true,
  })

  if (res.error || !res.data) {
    return { ok: false, errorEs: res.error?.message ?? 'No se pudo redactar el mensaje.' }
  }

  return {
    ok: true,
    result: {
      thread_id: res.data.id,
      recipient: 'anabel',
      downstream: 'mensajeria.thread',
      executor_role: ctx.executorRole,
    },
  }
}

async function executeOpenOcaRequest(
  action: AgentActionRow,
  ctx: ExecutorContext,
): Promise<ExecuteOutcome> {
  const p = payload<{
    product_description_es: string
    reason_es: string
    fraccion?: string
    cve_producto?: string
    trafico_id?: string
  }>(action)

  if (!p.product_description_es || !p.reason_es) {
    return { ok: false, errorEs: 'Descripción o motivo faltante en el payload.' }
  }

  const subject = `OCA solicitada — ${p.product_description_es.slice(0, 60)}`
  const fraccionLine = p.fraccion ? `Fracción sugerida: ${p.fraccion}` : 'Fracción: por determinar'
  const cveLine = p.cve_producto ? `cve_producto: ${p.cve_producto}` : null
  const traficoLine = p.trafico_id ? `Tráfico: ${p.trafico_id}` : null

  const bodyLines = [
    `Solicitud de OCA automática generada por CRUZ.`,
    '',
    `Producto: ${p.product_description_es}`,
    fraccionLine,
    cveLine,
    traficoLine,
    '',
    `Motivo: ${p.reason_es}`,
    '',
    `Acción de origen: ${action.id}`,
  ].filter(Boolean) as string[]

  const res = await createThread({
    companyId: action.company_id,
    subject,
    role: MENSAJERIA_SYSTEM_ROLE,
    authorName: SYSTEM_AUTHOR,
    firstMessageBody: bodyLines.join('\n'),
    traficoId: p.trafico_id ?? null,
    internalOnly: true,
  })

  if (res.error || !res.data) {
    return { ok: false, errorEs: res.error?.message ?? 'No se pudo abrir la solicitud de OCA.' }
  }

  return {
    ok: true,
    result: {
      thread_id: res.data.id,
      product_description: p.product_description_es.slice(0, 140),
      downstream: 'mensajeria.thread',
      oca_stage: 'requested',
      executor_role: ctx.executorRole,
    },
  }
}

const EXECUTORS: Record<
  AgentActionKind,
  (action: AgentActionRow, ctx: ExecutorContext) => Promise<ExecuteOutcome>
> = {
  flag_shipment: executeFlagShipment,
  draft_mensajeria_to_anabel: executeDraftMensajeriaToAnabel,
  open_oca_request: executeOpenOcaRequest,
}

/**
 * Dispatch a committed action to its downstream executor.
 *
 * Never throws — all executor-level errors are captured as
 * `{ ok: false, errorEs }` with Spanish copy safe for the operator UI.
 */
export async function runExecutor(
  action: AgentActionRow,
  ctx: ExecutorContext,
): Promise<ExecuteOutcome> {
  const exec = EXECUTORS[action.kind]
  if (!exec) {
    return { ok: false, errorEs: `Tipo de acción no soportado: ${action.kind}` }
  }
  try {
    return await exec(action, ctx)
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error desconocido en el ejecutor.'
    return { ok: false, errorEs: msg.slice(0, 500) }
  }
}

export const __TEST_ONLY = { EXECUTORS }
