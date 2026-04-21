'use server'

/**
 * Block 1B · Embarque detail — server actions.
 *
 * Extends the legacy actions (status update + note add) with the
 * event-firing surface the new Acciones Rápidas panel drives. Every
 * mutation does three things atomically from the caller's POV:
 *
 *   1. Perform the core write (or just validate, for pure events).
 *   2. Insert a `workflow_events` row with category-mapped workflow.
 *   3. Log to `operational_decisions` via `logDecision`.
 *
 * Return shape matches the project convention: `{ ok, error }`. Never
 * throws across the boundary. Tenant-scoped via `verifySession` —
 * non-internal roles cannot touch embarques outside their company_id.
 */

import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { createServerClient } from '@/lib/supabase-server'
import { verifySession } from '@/lib/session'
import { logDecision } from '@/lib/decision-logger'
import {
  CATEGORY_TO_WORKFLOW,
  type Category,
  type Workflow,
} from '@/lib/events-catalog'
import {
  updateTraficoStatus as legacyUpdateTraficoStatus,
  addTraficoNote as legacyAddTraficoNote,
} from './legacy/actions'

// Thin async wrappers around the legacy implementations so this
// 'use server' module exposes only async functions (Next's server-
// action compiler rejects re-exports and non-function exports).
export async function updateTraficoStatus(
  traficoId: string,
  newStatus: string,
): Promise<FireResult> {
  return legacyUpdateTraficoStatus(traficoId, newStatus)
}

export async function addTraficoNote(
  traficoId: string,
  content: string,
  mentions: string[],
): Promise<FireResult> {
  return legacyAddTraficoNote(traficoId, content, mentions)
}

// ─────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────

// Use FireResult from ./types so this file's top-level exports are
// all async functions — required by Next's server-action compiler.
import type { FireResult } from './types'

async function getSession() {
  const store = await cookies()
  const token = store.get('portal_session')?.value ?? ''
  return verifySession(token)
}

async function resolveCategory(eventType: string): Promise<Category | null> {
  const supabase = createServerClient()
  const { data } = await supabase
    .from('events_catalog')
    .select('category')
    .eq('event_type', eventType)
    .maybeSingle()
  const category = (data as { category: string } | null)?.category ?? null
  if (!category) return null
  // Narrow to our Category union — unknown categories are rejected.
  const known: Category[] = [
    'lifecycle',
    'payment',
    'inspection',
    'exception',
    'export',
    'load_order',
    'vucem',
    'document',
    'manual',
  ]
  return (known as string[]).includes(category) ? (category as Category) : null
}

async function scopeTrafico(traficoId: string) {
  const session = await getSession()
  if (!session) return { session: null, row: null, error: 'Sesión no válida' } as const

  const supabase = createServerClient()
  const isInternal = session.role === 'broker' || session.role === 'admin'
  let q = supabase.from('traficos').select('trafico, company_id').eq('trafico', traficoId)
  if (!isInternal) q = q.eq('company_id', session.companyId)
  const { data, error } = await q.maybeSingle()
  if (error) return { session, row: null, error: error.message } as const
  if (!data) return { session, row: null, error: 'Embarque no encontrado' } as const
  return { session, row: data as { trafico: string; company_id: string | null }, error: null } as const
}

// ─────────────────────────────────────────────────────────────────────
// Generic event fire — drives every Acciones Rápidas button
// ─────────────────────────────────────────────────────────────────────

export async function fireLifecycleEvent(
  traficoId: string,
  eventType: string,
  payload?: Record<string, unknown>,
): Promise<FireResult> {
  if (!traficoId) return { ok: false, error: 'traficoId requerido' }
  if (!eventType) return { ok: false, error: 'eventType requerido' }

  const { session, row, error } = await scopeTrafico(traficoId)
  if (!session) return { ok: false, error: error ?? 'Sesión no válida' }
  if (!row) return { ok: false, error: error ?? 'Embarque no encontrado' }

  const category = await resolveCategory(eventType)
  if (!category) return { ok: false, error: `Evento desconocido: ${eventType}` }
  const workflow: Workflow = CATEGORY_TO_WORKFLOW[category]

  const supabase = createServerClient()
  const actor = `${session.companyId}:${session.role}`
  const companyId = row.company_id ?? session.companyId

  const { error: insErr } = await supabase.from('workflow_events').insert({
    event_type: eventType,
    workflow,
    trigger_id: traficoId,
    company_id: companyId,
    payload: { ...(payload ?? {}), actor },
  })
  if (insErr) return { ok: false, error: insErr.message }

  // V1.5 F12 — Telegram routing. Map lifecycle events to routable kinds.
  // Fire-and-forget: delivery failures never block the lifecycle write.
  const { dispatchTelegramForEvent } = await import('@/lib/telegram/dispatch')
  const kindMap: Record<string, string> = {
    semaforo_first_green: 'semaforo_verde',
    merchandise_customs_cleared: 'trafico_completed',
  }
  const dispatchKind = kindMap[eventType]
  if (dispatchKind) {
    void dispatchTelegramForEvent(dispatchKind, {
      trafico_id: traficoId,
      company_id: companyId,
      actor,
      ...(payload ?? {}),
    })
  }

  await logDecision({
    trafico: traficoId,
    company_id: companyId,
    decision_type: 'lifecycle_event',
    decision: `evento emitido: ${eventType}`,
    reasoning: `Emitido por ${actor} desde el portal (categoría ${category}, workflow ${workflow})`,
    dataPoints: { event_type: eventType, category, workflow, actor, ...(payload ?? {}) },
  })

  revalidatePath(`/embarques/${traficoId}`)
  return { ok: true, error: null }
}

// ─────────────────────────────────────────────────────────────────────
// Named wrappers — thin sugar over fireLifecycleEvent + scoped writes
// ─────────────────────────────────────────────────────────────────────

export async function assignOperator(
  traficoId: string,
  operatorId: string,
): Promise<FireResult> {
  if (!traficoId) return { ok: false, error: 'traficoId requerido' }
  const op = (operatorId ?? '').trim()
  if (!op) return { ok: false, error: 'Operador requerido' }

  const { session, row, error } = await scopeTrafico(traficoId)
  if (!session) return { ok: false, error: error ?? 'Sesión no válida' }
  if (!row) return { ok: false, error: error ?? 'Embarque no encontrado' }
  if (session.role !== 'broker' && session.role !== 'admin') {
    return { ok: false, error: 'Solo el broker o admin puede reasignar operadores' }
  }

  const supabase = createServerClient()
  const { error: updErr } = await supabase
    .from('traficos')
    .update({ assigned_to_operator_id: op })
    .eq('trafico', traficoId)
  if (updErr) return { ok: false, error: updErr.message }

  return fireLifecycleEvent(traficoId, 'operator_assigned', { operator_id: op })
}

export async function escalateToBroker(
  traficoId: string,
  reason: string,
): Promise<FireResult> {
  const clean = (reason ?? '').trim()
  if (!clean) return { ok: false, error: 'Motivo requerido' }
  if (clean.length > 500) return { ok: false, error: 'Motivo excede 500 caracteres' }
  return fireLifecycleEvent(traficoId, 'operator_escalation', { reason: clean })
}

export async function markReceived(traficoId: string): Promise<FireResult> {
  return fireLifecycleEvent(traficoId, 'warehouse_entry_received')
}
