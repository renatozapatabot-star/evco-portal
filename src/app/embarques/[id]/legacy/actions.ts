'use server'

/**
 * V1 Polish Pack · Block 1 — embarque detail server actions.
 *
 * Two actions:
 *   - updateTraficoStatus  → updates traficos.estatus + brain log
 *   - addTraficoNote       → inserts trafico_notes + notifies mentions
 *
 * Identity: session cookie `portal_session` verified via HMAC.
 * Tenant scoping: every DB write filters by the session's companyId
 * for non-internal roles (broker/admin bypass client scoping).
 */

import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { createServerClient } from '@/lib/supabase-server'
import { verifySession } from '@/lib/session'
import { logDecision } from '@/lib/decision-logger'
import { createNotification } from '@/lib/notifications'

export type ActionResult = { ok: true; error: null } | { ok: false; error: string }

// {companyId}:{role} — permissive on the pieces because role strings
// and slug-based company ids are varied in this project.
const MENTION_RE = /^[a-z0-9_-]+:[a-z0-9_-]+$/i

async function getSession() {
  const store = await cookies()
  const token = store.get('portal_session')?.value ?? ''
  return verifySession(token)
}

function normalizeStatus(s: string): string {
  return s.trim()
}

export async function updateTraficoStatus(traficoId: string, newStatus: string): Promise<ActionResult> {
  if (!traficoId) return { ok: false, error: 'traficoId requerido' }
  const status = normalizeStatus(newStatus || '')
  if (!status) return { ok: false, error: 'Estatus requerido' }
  if (status.length > 60) return { ok: false, error: 'Estatus demasiado largo' }

  const session = await getSession()
  if (!session) return { ok: false, error: 'Sesión no válida' }

  const supabase = createServerClient()
  const isInternal = session.role === 'broker' || session.role === 'admin'

  // Read current status first for reasoning log and scope verification.
  let readQ = supabase.from('traficos').select('trafico, estatus, company_id').eq('trafico', traficoId)
  if (!isInternal) readQ = readQ.eq('company_id', session.companyId)
  const { data: existing, error: readErr } = await readQ.maybeSingle()
  if (readErr) return { ok: false, error: readErr.message }
  if (!existing) return { ok: false, error: 'Embarque no encontrado' }

  const previous = (existing.estatus as string | null) ?? ''
  if (previous === status) {
    return { ok: true, error: null }
  }

  let updateQ = supabase.from('traficos').update({ estatus: status }).eq('trafico', traficoId)
  if (!isInternal) updateQ = updateQ.eq('company_id', session.companyId)
  const { error: updErr } = await updateQ
  if (updErr) return { ok: false, error: updErr.message }

  await logDecision({
    trafico: traficoId,
    company_id: (existing.company_id as string | null) ?? session.companyId,
    decision_type: 'status_update',
    decision: `estatus: ${previous || '—'} → ${status}`,
    reasoning: `Actualización manual desde el portal por ${session.companyId}:${session.role}`,
    dataPoints: { previous, next: status, actor: `${session.companyId}:${session.role}` },
  })

  revalidatePath(`/embarques/${traficoId}`)
  return { ok: true, error: null }
}

function sanitizeMentions(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  const out: string[] = []
  let skippedShape = 0
  for (const m of raw) {
    if (typeof m !== 'string') { skippedShape++; continue }
    if (!MENTION_RE.test(m)) { skippedShape++; continue }
    if (out.includes(m)) continue
    out.push(m)
    if (out.length >= 20) break
  }
  if (skippedShape > 0 && process.env.NODE_ENV !== 'production') {
    console.warn(`[addTraficoNote] skipped ${skippedShape} malformed mention(s); expected {companyId}:{role} composite`)
  }
  return out
}

export async function addTraficoNote(
  traficoId: string,
  content: string,
  mentions: string[],
): Promise<ActionResult> {
  if (!traficoId) return { ok: false, error: 'traficoId requerido' }
  const body = (content ?? '').trim()
  if (!body) return { ok: false, error: 'La nota no puede estar vacía' }
  if (body.length > 4000) return { ok: false, error: 'La nota excede 4000 caracteres' }

  const session = await getSession()
  if (!session) return { ok: false, error: 'Sesión no válida' }

  const supabase = createServerClient()
  const isInternal = session.role === 'broker' || session.role === 'admin'

  // Verify caller can see this embarque before we log anything.
  let scopeQ = supabase.from('traficos').select('trafico, company_id').eq('trafico', traficoId)
  if (!isInternal) scopeQ = scopeQ.eq('company_id', session.companyId)
  const { data: scopeRow, error: scopeErr } = await scopeQ.maybeSingle()
  if (scopeErr) return { ok: false, error: scopeErr.message }
  if (!scopeRow) return { ok: false, error: 'Embarque no encontrado' }

  const cleanMentions = sanitizeMentions(mentions)
  const authorId = `${session.companyId}:${session.role}`

  const { error: insErr } = await supabase.from('trafico_notes').insert({
    trafico_id: traficoId,
    author_id: authorId,
    content: body,
    mentions: cleanMentions,
  })
  if (insErr) return { ok: false, error: insErr.message }

  await logDecision({
    trafico: traficoId,
    company_id: (scopeRow.company_id as string | null) ?? session.companyId,
    decision_type: 'trafico_note_added',
    decision: `nota agregada (${body.length} car., ${cleanMentions.length} menciones)`,
    reasoning: `Autor ${authorId}`,
    dataPoints: { author: authorId, length: body.length, mention_count: cleanMentions.length },
  })

  // Fan-out notifications. Each mention carries {companyId}:{role}; we
  // derive the notification's tenant scope from the mention's companyId
  // so cross-tenant mentions still reach the right inbox.
  for (const m of cleanMentions) {
    const [mentionCompanyId] = m.split(':')
    if (!mentionCompanyId) continue
    await createNotification({
      companyId: mentionCompanyId,
      recipientKey: m,
      title: 'Fuiste mencionado en una nota',
      description: body.length > 160 ? `${body.slice(0, 157)}…` : body,
      severity: 'info',
      actionUrl: `/embarques/${encodeURIComponent(traficoId)}`,
      traficoId,
      entityType: 'trafico_note',
      entityId: traficoId,
    })
  }

  revalidatePath(`/embarques/${traficoId}`)
  return { ok: true, error: null }
}
