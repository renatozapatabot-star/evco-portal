/**
 * Lead activities — helpers for writing to the timeline.
 *
 * The auto-logger diffs an old LeadRow against a new one and emits one
 * activity row per meaningful change. Field edits that only change
 * whitespace or null↔empty-string are suppressed.
 *
 * All writes here are best-effort. A failed insert must NEVER break
 * the edit flow — the timeline is an audit trail, not a hard contract.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { LEAD_STAGE_LABELS, type LeadActivityKind, type LeadRow } from './types'

interface ActivityInsert {
  lead_id: string
  kind: LeadActivityKind
  summary: string
  metadata?: Record<string, unknown> | null
  actor_user_id?: string | null
  actor_name?: string | null
  occurred_at?: string
}

export async function writeActivity(
  supabase: SupabaseClient,
  row: ActivityInsert,
): Promise<void> {
  try {
    await supabase.from('lead_activities').insert({
      lead_id: row.lead_id,
      kind: row.kind,
      summary: row.summary,
      metadata: row.metadata ?? null,
      actor_user_id: row.actor_user_id ?? null,
      actor_name: row.actor_name ?? null,
      occurred_at: row.occurred_at ?? new Date().toISOString(),
    })
  } catch {
    // Best-effort. Timeline failures never interrupt business logic.
  }
}

export async function writeActivities(
  supabase: SupabaseClient,
  rows: ActivityInsert[],
): Promise<void> {
  if (rows.length === 0) return
  try {
    await supabase.from('lead_activities').insert(
      rows.map((row) => ({
        lead_id: row.lead_id,
        kind: row.kind,
        summary: row.summary,
        metadata: row.metadata ?? null,
        actor_user_id: row.actor_user_id ?? null,
        actor_name: row.actor_name ?? null,
        occurred_at: row.occurred_at ?? new Date().toISOString(),
      })),
    )
  } catch {
    // Best-effort.
  }
}

// ── Field labels for humanized summaries ────────────────────────────

const FIELD_LABELS: Record<string, string> = {
  contact_name: 'Nombre del contacto',
  contact_email: 'Email',
  contact_phone: 'Teléfono',
  contact_title: 'Puesto',
  rfc: 'RFC',
  priority: 'Prioridad',
  value_monthly_mxn: 'Valor mensual estimado',
  next_action_at: 'Próxima acción',
  next_action_note: 'Nota de próxima acción',
  last_contact_at: 'Último contacto',
  industry: 'Industria',
  aduana: 'Aduana',
  volume_note: 'Volumen',
  notes: 'Notas',
}

const PRIORITY_LABELS: Record<string, string> = {
  high: 'Alta',
  normal: 'Normal',
  low: 'Baja',
}

const FORMAT_MXN = new Intl.NumberFormat('es-MX', {
  style: 'currency',
  currency: 'MXN',
  maximumFractionDigits: 0,
})

function formatFieldValue(field: string, value: unknown): string {
  if (value === null || value === undefined || value === '') return '—'
  if (field === 'value_monthly_mxn' && typeof value === 'number') {
    return FORMAT_MXN.format(value)
  }
  if (field === 'priority' && typeof value === 'string') {
    return PRIORITY_LABELS[value] ?? value
  }
  if (field === 'next_action_at' || field === 'last_contact_at') {
    if (typeof value !== 'string') return String(value)
    const d = new Date(value)
    if (Number.isNaN(d.getTime())) return value
    return d.toLocaleString('es-MX', {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: 'America/Chicago',
    })
  }
  if (typeof value === 'string') {
    const trimmed = value.trim()
    return trimmed.length > 60 ? `${trimmed.slice(0, 57)}…` : trimmed
  }
  return String(value)
}

/** Return true when old/new are meaningfully different (whitespace-tolerant). */
function materiallyChanged(a: unknown, b: unknown): boolean {
  const na = a === '' || a === undefined ? null : a
  const nb = b === '' || b === undefined ? null : b
  if (typeof na === 'string' && typeof nb === 'string') {
    return na.trim() !== nb.trim()
  }
  return na !== nb
}

/**
 * Compute activity rows from the diff between old and new LeadRow.
 * Returns one `stage_change` row if stage changed, plus one
 * `field_update` row per other whitelisted change.
 */
export function diffToActivities(
  leadId: string,
  before: LeadRow,
  after: LeadRow,
  actor: { userId: string | null; name: string | null },
): ActivityInsert[] {
  const out: ActivityInsert[] = []

  if (materiallyChanged(before.stage, after.stage)) {
    out.push({
      lead_id: leadId,
      kind: 'stage_change',
      summary: `Etapa: ${LEAD_STAGE_LABELS[before.stage] ?? before.stage} → ${LEAD_STAGE_LABELS[after.stage] ?? after.stage}`,
      metadata: { from: before.stage, to: after.stage },
      actor_user_id: actor.userId,
      actor_name: actor.name,
    })
  }

  for (const [field, label] of Object.entries(FIELD_LABELS)) {
    const a = (before as unknown as Record<string, unknown>)[field]
    const b = (after as unknown as Record<string, unknown>)[field]
    if (!materiallyChanged(a, b)) continue
    out.push({
      lead_id: leadId,
      kind: 'field_update',
      summary: `${label}: ${formatFieldValue(field, a)} → ${formatFieldValue(field, b)}`,
      metadata: { field, from: a, to: b },
      actor_user_id: actor.userId,
      actor_name: actor.name,
    })
  }

  return out
}
