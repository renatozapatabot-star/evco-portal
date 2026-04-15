/**
 * Mensajería · notify() — single entry point for workflow-triggered messages.
 *
 * MENSAJERÍA LAW: every alert, notification, and client-facing comm stays
 * inside AGUILA. Workflow handlers (invoice upload, semáforo rojo, permit
 * expiry, anomaly) call notifyMensajeria() — never sendTelegram.
 *
 * Thread strategy:
 *   · traficoId given → findOrCreateThreadByTrafico (one open thread per
 *     company+tráfico, reused until resolved)
 *   · no traficoId    → dedupe by (companyId, subject_slug, UTC date) within
 *     24h; otherwise new thread
 *
 * Non-fatal push: push failure logs to operator_actions and continues.
 * Email fallback is cron-driven (separate worker) — notify() does not trigger
 * it synchronously.
 */

import { createServerClient } from '@/lib/supabase-server'
import { logOperatorAction } from '@/lib/operator-actions'
import { UNDO_WINDOW_MS } from './constants'
import {
  createMessage,
  createThread,
  findOrCreateThreadByTrafico,
} from './threads'
import { sendPush } from './push'
import type { AuthorRole, MensajeriaMessage, MensajeriaThread, Result } from './types'

export interface NotifyInput {
  companyId: string
  subject: string
  body: string
  /** Links the thread to a tráfico; reuses an existing open thread when present. */
  traficoId?: string | null
  /** When true, clients never see the message even if they share the thread. */
  internalOnly?: boolean
  /** Who triggered this — shapes audit and push targeting. */
  actor: { role: AuthorRole; name: string }
  /** Role user_keys to push to. Defaults to internal operators when internalOnly. */
  pushTo?: string[]
}

export interface NotifyResult {
  threadId: string
  messageId: string
  pushSent: number
  pushSkipped?: string
  pushError?: string
}

function slugify(subject: string): string {
  return subject
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
}

async function findDedupeThread(
  companyId: string,
  subjectSlug: string,
): Promise<MensajeriaThread | null> {
  const supabase = createServerClient()
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const { data } = await supabase
    .from('mensajeria_threads')
    .select('*')
    .eq('company_id', companyId)
    .is('trafico_id', null)
    .in('status', ['open', 'escalated'])
    .gte('last_message_at', since)
    .order('last_message_at', { ascending: false })
    .limit(10)
  if (!data || data.length === 0) return null
  const match = (data as MensajeriaThread[]).find(
    (t) => slugify(t.subject) === subjectSlug,
  )
  return match ?? null
}

function appUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.VERCEL_URL ||
    'https://portal.renatozapata.com'
  ).replace(/\/$/, '')
}

function defaultPushTargets(input: NotifyInput): string[] {
  if (input.pushTo && input.pushTo.length > 0) return input.pushTo
  // Internal-only: operators + admin + broker
  if (input.internalOnly !== false) {
    return ['internal:operator', 'internal:admin', 'internal:broker']
  }
  // Tenant-facing: operators (not clients — no push for clients Phase 1)
  return ['internal:operator', 'internal:admin']
}

export async function notifyMensajeria(input: NotifyInput): Promise<Result<NotifyResult>> {
  const internalOnly = input.internalOnly !== false
  let thread: MensajeriaThread

  if (input.traficoId) {
    const res = await findOrCreateThreadByTrafico({
      companyId: input.companyId,
      traficoId: input.traficoId,
      subject: input.subject,
      role: input.actor.role,
      authorName: input.actor.name,
      firstMessageBody: input.body,
      internalOnly,
    })
    if (res.error || !res.data) {
      return { data: null, error: res.error ?? { code: 'DB_ERROR', message: 'thread resolve failed' } }
    }
    thread = res.data

    // If this reused an existing thread, the body hasn't been posted yet —
    // append it as a new message. findOrCreateThreadByTrafico only inserts
    // a first message when it creates.
    const createdJustNow =
      new Date(thread.created_at).getTime() >= Date.now() - UNDO_WINDOW_MS
    if (!createdJustNow) {
      const msg = await createMessage({
        threadId: thread.id,
        role: input.actor.role,
        authorName: input.actor.name,
        body: input.body,
        internalOnly,
      })
      if (msg.error || !msg.data) {
        return { data: null, error: msg.error ?? { code: 'DB_ERROR', message: 'message append failed' } }
      }
      return await finishNotify(thread, msg.data, input)
    }

    // Thread was created with the first message — fetch it for the id.
    const supabase = createServerClient()
    const { data: firstMsg } = await supabase
      .from('mensajeria_messages')
      .select('*')
      .eq('thread_id', thread.id)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle()
    if (!firstMsg) {
      return { data: null, error: { code: 'DB_ERROR', message: 'first message missing' } }
    }
    return await finishNotify(thread, firstMsg as MensajeriaMessage, input)
  }

  // No tráfico → dedupe by subject slug within 24h
  const subjectSlug = slugify(input.subject)
  const existing = await findDedupeThread(input.companyId, subjectSlug)

  if (existing) {
    const msg = await createMessage({
      threadId: existing.id,
      role: input.actor.role,
      authorName: input.actor.name,
      body: input.body,
      internalOnly,
    })
    if (msg.error || !msg.data) {
      return { data: null, error: msg.error ?? { code: 'DB_ERROR', message: 'message append failed' } }
    }
    return await finishNotify(existing, msg.data, input)
  }

  const created = await createThread({
    companyId: input.companyId,
    subject: input.subject,
    role: input.actor.role,
    authorName: input.actor.name,
    firstMessageBody: input.body,
    traficoId: null,
    internalOnly,
  })
  if (created.error || !created.data) {
    return { data: null, error: created.error ?? { code: 'DB_ERROR', message: 'thread create failed' } }
  }
  thread = created.data

  const supabase = createServerClient()
  const { data: firstMsg } = await supabase
    .from('mensajeria_messages')
    .select('*')
    .eq('thread_id', thread.id)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()
  if (!firstMsg) {
    return { data: null, error: { code: 'DB_ERROR', message: 'first message missing' } }
  }
  return await finishNotify(thread, firstMsg as MensajeriaMessage, input)
}

async function finishNotify(
  thread: MensajeriaThread,
  message: MensajeriaMessage,
  input: NotifyInput,
): Promise<Result<NotifyResult>> {
  const url = `${appUrl()}/mensajeria?thread=${thread.id}`
  const push = await sendPush({
    userKeys: defaultPushTargets(input),
    title: thread.subject.slice(0, 80),
    body: input.body.slice(0, 120),
    url,
  })

  await logOperatorAction({
    operatorName: input.actor.name,
    actionType: 'mensajeria_notify',
    targetTable: 'mensajeria_messages',
    targetId: message.id,
    companyId: input.companyId ?? thread.company_id,
    payload: {
      thread_id: thread.id,
      trafico_id: thread.trafico_id,
      subject: thread.subject,
      push_sent: push.sent,
      push_skipped: push.skipped ?? null,
      push_error: push.error ?? null,
    },
  })

  return {
    data: {
      threadId: thread.id,
      messageId: message.id,
      pushSent: push.sent,
      pushSkipped: push.skipped,
      pushError: push.error,
    },
    error: null,
  }
}
