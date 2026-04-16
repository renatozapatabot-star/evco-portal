import { createServerClient } from '@/lib/supabase-server'
import { logOperatorAction } from '@/lib/operator-actions'
import { isInternalRole, UNDO_WINDOW_MS } from './constants'
import type {
  AuthorRole,
  MensajeriaMessage,
  MensajeriaThread,
  Result,
  ThreadStatus,
  ThreadWithMeta,
} from './types'

export interface ListThreadsOptions {
  role: AuthorRole
  companyId: string
  readerKey: string
  status?: ThreadStatus | 'all'
  limit?: number
}

/**
 * List threads visible to the caller. Owners and operators see everything
 * across tenants (defense-in-depth: RLS also enforces this). Clients see
 * only their company's threads (Phase 1: client surface disabled).
 */
export async function listThreads(opts: ListThreadsOptions): Promise<Result<ThreadWithMeta[]>> {
  const supabase = createServerClient()
  const internal = isInternalRole(opts.role)
  const limit = Math.min(Math.max(opts.limit ?? 50, 1), 200)

  let query = supabase
    .from('mensajeria_threads')
    .select('*')
    .order('last_message_at', { ascending: false })
    .limit(limit)

  if (!internal) {
    query = query.eq('company_id', opts.companyId)
  }
  if (opts.status && opts.status !== 'all') {
    query = query.eq('status', opts.status)
  }

  const { data: threadsRaw, error } = await query
  if (error) return { data: null, error: { code: 'DB_ERROR', message: error.message } }
  const threads = (threadsRaw ?? []) as MensajeriaThread[]
  if (threads.length === 0) return { data: [], error: null }

  const threadIds = threads.map(t => t.id)

  // Batch fetch last-read markers + latest message preview
  const [readsRes, lastMsgsRes] = await Promise.all([
    supabase
      .from('mensajeria_reads')
      .select('thread_id, last_read_at')
      .eq('reader_key', opts.readerKey)
      .in('thread_id', threadIds),
    supabase
      .from('mensajeria_messages')
      .select('thread_id, body, author_role, created_at, internal_only, undone')
      .in('thread_id', threadIds)
      .eq('undone', false)
      .order('created_at', { ascending: false })
      .limit(threadIds.length * 20),
  ])

  const readsByThread = new Map<string, string>()
  for (const r of (readsRes.data ?? []) as { thread_id: string; last_read_at: string }[]) {
    readsByThread.set(r.thread_id, r.last_read_at)
  }

  const latestByThread = new Map<
    string,
    { body: string; author_role: AuthorRole; created_at: string; internal_only: boolean }
  >()
  for (const m of (lastMsgsRes.data ?? []) as {
    thread_id: string
    body: string
    author_role: AuthorRole
    created_at: string
    internal_only: boolean
  }[]) {
    if (!latestByThread.has(m.thread_id)) {
      if (!internal && m.internal_only) continue
      latestByThread.set(m.thread_id, m)
    }
  }

  // Unread count per thread: messages after reader's last_read_at
  const unreadCountsRes = await supabase
    .from('mensajeria_messages')
    .select('thread_id, created_at, internal_only, undone')
    .in('thread_id', threadIds)
    .eq('undone', false)
  const unreadByThread = new Map<string, number>()
  for (const m of (unreadCountsRes.data ?? []) as {
    thread_id: string
    created_at: string
    internal_only: boolean
    undone: boolean
  }[]) {
    if (!internal && m.internal_only) continue
    const lastRead = readsByThread.get(m.thread_id)
    if (!lastRead || m.created_at > lastRead) {
      unreadByThread.set(m.thread_id, (unreadByThread.get(m.thread_id) ?? 0) + 1)
    }
  }

  const enriched: ThreadWithMeta[] = threads.map(t => {
    const last = latestByThread.get(t.id) ?? null
    return {
      ...t,
      unread_count: unreadByThread.get(t.id) ?? 0,
      last_message_preview: last ? last.body.slice(0, 140) : null,
      last_author_role: last ? last.author_role : null,
    }
  })

  return { data: enriched, error: null }
}

export interface CreateThreadInput {
  companyId: string
  subject: string
  role: AuthorRole
  authorName: string
  firstMessageBody: string
  traficoId?: string | null
  internalOnly?: boolean
}

export async function createThread(input: CreateThreadInput): Promise<Result<MensajeriaThread>> {
  const supabase = createServerClient()

  const subject = input.subject.trim()
  const body = input.firstMessageBody.trim()
  if (subject.length === 0 || subject.length > 200) {
    return { data: null, error: { code: 'VALIDATION', message: 'Asunto inválido (1–200 caracteres)' } }
  }
  if (body.length === 0 || body.length > 10_000) {
    return { data: null, error: { code: 'VALIDATION', message: 'Mensaje inválido (1–10,000 caracteres)' } }
  }

  const { data: threadRow, error: threadErr } = await supabase
    .from('mensajeria_threads')
    .insert({
      company_id: input.companyId,
      subject,
      status: 'open' as ThreadStatus,
      trafico_id: input.traficoId ?? null,
      created_by_role: input.role,
      created_by_name: input.authorName,
    })
    .select('*')
    .single()
  if (threadErr || !threadRow) {
    return { data: null, error: { code: 'DB_ERROR', message: threadErr?.message ?? 'insert failed' } }
  }
  const thread = threadRow as MensajeriaThread

  const undoUntil = new Date(Date.now() + UNDO_WINDOW_MS).toISOString()
  const { error: msgErr } = await supabase
    .from('mensajeria_messages')
    .insert({
      thread_id: thread.id,
      company_id: input.companyId,
      author_role: input.role,
      author_name: input.authorName,
      body,
      internal_only: Boolean(input.internalOnly),
      undo_until: undoUntil,
    })
  if (msgErr) {
    return { data: null, error: { code: 'DB_ERROR', message: msgErr.message } }
  }

  await logOperatorAction({
    operatorName: input.authorName,
    actionType: 'mensajeria_thread_created',
    targetTable: 'mensajeria_threads',
    targetId: thread.id,
    companyId: input.companyId,
    payload: { subject, trafico_id: input.traficoId ?? null },
  })

  return { data: thread, error: null }
}

export interface FindOrCreateByTraficoInput {
  companyId: string
  traficoId: string
  subject: string
  role: AuthorRole
  authorName: string
  firstMessageBody: string
  internalOnly?: boolean
}

/**
 * Deterministic thread resolver for workflow-triggered notifications.
 * One open thread per (company_id, trafico_id). If none exists, creates one.
 * Matches 'open' or 'escalated' — only 'resolved' threads spawn a new one.
 */
export async function findOrCreateThreadByTrafico(
  input: FindOrCreateByTraficoInput,
): Promise<Result<MensajeriaThread>> {
  const supabase = createServerClient()

  const { data: existing } = await supabase
    .from('mensajeria_threads')
    .select('*')
    .eq('company_id', input.companyId)
    .eq('trafico_id', input.traficoId)
    .in('status', ['open', 'escalated'])
    .order('last_message_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (existing) {
    return { data: existing as MensajeriaThread, error: null }
  }

  return createThread({
    companyId: input.companyId,
    subject: input.subject,
    role: input.role,
    authorName: input.authorName,
    firstMessageBody: input.firstMessageBody,
    traficoId: input.traficoId,
    internalOnly: input.internalOnly,
  })
}

export interface EscalateThreadInput {
  threadId: string
  role: AuthorRole
  authorName: string
  summary?: string
}

export async function escalateThread(input: EscalateThreadInput): Promise<Result<MensajeriaThread>> {
  const supabase = createServerClient()

  const { data: existing, error: fetchErr } = await supabase
    .from('mensajeria_threads')
    .select('*')
    .eq('id', input.threadId)
    .single()
  if (fetchErr || !existing) {
    return { data: null, error: { code: 'NOT_FOUND', message: 'Hilo no encontrado' } }
  }
  if ((existing as MensajeriaThread).status === 'escalated') {
    return { data: existing as MensajeriaThread, error: null }
  }

  const summary = (input.summary ?? '').trim().slice(0, 600) || null

  const { data: updated, error } = await supabase
    .from('mensajeria_threads')
    .update({
      status: 'escalated' as ThreadStatus,
      escalated_at: new Date().toISOString(),
      escalated_by: input.authorName,
      escalation_summary: summary,
    })
    .eq('id', input.threadId)
    .select('*')
    .single()
  if (error || !updated) {
    return { data: null, error: { code: 'DB_ERROR', message: error?.message ?? 'update failed' } }
  }

  // System message marking escalation (internal-only — never shown to client)
  await supabase.from('mensajeria_messages').insert({
    thread_id: input.threadId,
    company_id: (existing as MensajeriaThread).company_id,
    author_role: 'system',
    author_name: 'CRUZ',
    body: `Escalado a Dirección por ${input.authorName}${summary ? `\n\nResumen: ${summary}` : ''}`,
    internal_only: true,
  })

  await logOperatorAction({
    operatorName: input.authorName,
    actionType: 'mensajeria_thread_escalated',
    targetTable: 'mensajeria_threads',
    targetId: input.threadId,
    companyId: (existing as MensajeriaThread).company_id,
    payload: { summary },
  })

  return { data: updated as MensajeriaThread, error: null }
}

export async function getThread(
  threadId: string,
  role: AuthorRole,
  companyId: string,
): Promise<Result<MensajeriaThread>> {
  const supabase = createServerClient()
  let query = supabase.from('mensajeria_threads').select('*').eq('id', threadId).limit(1)
  if (!isInternalRole(role)) query = query.eq('company_id', companyId)
  const { data, error } = await query.maybeSingle()
  if (error) return { data: null, error: { code: 'DB_ERROR', message: error.message } }
  if (!data) return { data: null, error: { code: 'NOT_FOUND', message: 'Hilo no encontrado' } }
  return { data: data as MensajeriaThread, error: null }
}

export async function markThreadRead(
  threadId: string,
  readerKey: string,
): Promise<void> {
  const supabase = createServerClient()
  await supabase.from('mensajeria_reads').upsert(
    { thread_id: threadId, reader_key: readerKey, last_read_at: new Date().toISOString() },
    { onConflict: 'thread_id,reader_key' },
  )
}

export async function getUnreadCount(
  role: AuthorRole,
  companyId: string,
  readerKey: string,
): Promise<number> {
  const res = await listThreads({ role, companyId, readerKey, limit: 200 })
  if (!res.data) return 0
  return res.data.reduce((sum, t) => sum + t.unread_count, 0)
}

export interface ListMessagesOptions {
  threadId: string
  role: AuthorRole
  companyId: string
  limit?: number
}

export async function listMessages(opts: ListMessagesOptions): Promise<Result<MensajeriaMessage[]>> {
  const supabase = createServerClient()
  const limit = Math.min(Math.max(opts.limit ?? 100, 1), 500)
  const internal = isInternalRole(opts.role)

  let query = supabase
    .from('mensajeria_messages')
    .select('*')
    .eq('thread_id', opts.threadId)
    .eq('undone', false)
    .order('created_at', { ascending: true })
    .limit(limit)

  if (!internal) {
    query = query.eq('internal_only', false).eq('company_id', opts.companyId)
  }

  const { data, error } = await query
  if (error) return { data: null, error: { code: 'DB_ERROR', message: error.message } }
  return { data: (data ?? []) as MensajeriaMessage[], error: null }
}

export interface CreateMessageInput {
  threadId: string
  role: AuthorRole
  authorName: string
  body: string
  internalOnly?: boolean
}

export async function createMessage(input: CreateMessageInput): Promise<Result<MensajeriaMessage>> {
  const supabase = createServerClient()

  const body = input.body.trim()
  if (body.length === 0 || body.length > 10_000) {
    return { data: null, error: { code: 'VALIDATION', message: 'Mensaje inválido (1–10,000 caracteres)' } }
  }

  const { data: thread, error: fetchErr } = await supabase
    .from('mensajeria_threads')
    .select('company_id, status')
    .eq('id', input.threadId)
    .single()
  if (fetchErr || !thread) {
    return { data: null, error: { code: 'NOT_FOUND', message: 'Hilo no encontrado' } }
  }

  const undoUntil = new Date(Date.now() + UNDO_WINDOW_MS).toISOString()
  const { data, error } = await supabase
    .from('mensajeria_messages')
    .insert({
      thread_id: input.threadId,
      company_id: (thread as { company_id: string }).company_id,
      author_role: input.role,
      author_name: input.authorName,
      body,
      internal_only: Boolean(input.internalOnly),
      undo_until: undoUntil,
    })
    .select('*')
    .single()
  if (error || !data) {
    return { data: null, error: { code: 'DB_ERROR', message: error?.message ?? 'insert failed' } }
  }

  await logOperatorAction({
    operatorName: input.authorName,
    actionType: 'mensajeria_message_sent',
    targetTable: 'mensajeria_messages',
    targetId: (data as MensajeriaMessage).id,
    companyId: (thread as { company_id: string }).company_id,
    payload: { thread_id: input.threadId, internal_only: Boolean(input.internalOnly) },
  })

  return { data: data as MensajeriaMessage, error: null }
}

export async function undoMessage(
  messageId: string,
  authorName: string,
): Promise<Result<true>> {
  const supabase = createServerClient()

  const { data: msg, error: fetchErr } = await supabase
    .from('mensajeria_messages')
    .select('id, author_name, undo_until, undone, company_id')
    .eq('id', messageId)
    .single()
  if (fetchErr || !msg) return { data: null, error: { code: 'NOT_FOUND', message: 'Mensaje no encontrado' } }

  const m = msg as { author_name: string; undo_until: string | null; undone: boolean; company_id: string }
  if (m.undone) return { data: true, error: null }
  if (m.author_name !== authorName) {
    return { data: null, error: { code: 'FORBIDDEN', message: 'Solo el autor puede retirar el mensaje' } }
  }
  if (!m.undo_until || new Date(m.undo_until).getTime() < Date.now()) {
    return { data: null, error: { code: 'EXPIRED', message: 'Ventana de retiro expirada' } }
  }

  const { error } = await supabase
    .from('mensajeria_messages')
    .update({ undone: true })
    .eq('id', messageId)
  if (error) return { data: null, error: { code: 'DB_ERROR', message: error.message } }

  await logOperatorAction({
    operatorName: authorName,
    actionType: 'mensajeria_message_undone',
    targetTable: 'mensajeria_messages',
    targetId: messageId,
    companyId: m.company_id,
  })

  return { data: true, error: null }
}
