'use client'

/**
 * Mensajería · client cockpit.
 *
 * Operators/owners see all threads. Owners see escalated threads pinned at top
 * (server sorts). Realtime subscription bumps the unread badge and refreshes the
 * open thread. 30-second undo window visible after every send.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createClient } from '@supabase/supabase-js'
import { PageShell, GlassCard, SectionHeader } from '@/components/aguila'
import {
  ACCENT_SILVER,
  ACCENT_SILVER_BRIGHT,
  AMBER,
  BORDER,
  GREEN,
  RED,
  TEXT_MUTED,
  TEXT_PRIMARY,
  TEXT_SECONDARY,
} from '@/lib/design-system'
import { SENDER_PUBLIC_NAME, UNDO_WINDOW_MS } from '@/lib/mensajeria/constants'
import type {
  AuthorRole,
  MensajeriaMessage,
  MensajeriaThread,
  ThreadWithMeta,
} from '@/lib/mensajeria/types'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
)

interface Props {
  role: AuthorRole
  companyId: string
  companyName: string
  operatorName: string
}

const OWNER_ROLES: AuthorRole[] = ['admin', 'broker']

function fmtTime(iso: string): string {
  try {
    const d = new Date(iso)
    return d.toLocaleTimeString('es-MX', {
      hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'America/Chicago',
    })
  } catch {
    return iso
  }
}

function fmtDate(iso: string): string {
  try {
    const d = new Date(iso)
    return d.toLocaleDateString('es-MX', {
      day: 'numeric', month: 'short', timeZone: 'America/Chicago',
    })
  } catch {
    return iso
  }
}

export function MensajeriaClient({ role, companyId, companyName, operatorName }: Props) {
  const isOwner = OWNER_ROLES.includes(role)
  const isInternal = isOwner || role === 'operator'

  const [threads, setThreads] = useState<ThreadWithMeta[]>([])
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null)
  const [currentThread, setCurrentThread] = useState<MensajeriaThread | null>(null)
  const [messages, setMessages] = useState<MensajeriaMessage[]>([])
  const [loadingThreads, setLoadingThreads] = useState(true)
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [composeOpen, setComposeOpen] = useState(false)
  const [newSubject, setNewSubject] = useState('')
  const [newBody, setNewBody] = useState('')
  const [newInternalOnly, setNewInternalOnly] = useState(true) // Phase 1 default
  const [newTargetCompany, setNewTargetCompany] = useState('')
  const [replyBody, setReplyBody] = useState('')
  const [replyInternalOnly, setReplyInternalOnly] = useState(false)
  const [sending, setSending] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const threadEndRef = useRef<HTMLDivElement | null>(null)

  const loadThreads = useCallback(async () => {
    setLoadingThreads(true)
    try {
      const res = await fetch('/api/mensajeria/threads', { cache: 'no-store' })
      const json = await res.json()
      if (json.error) setErrorMsg(json.error.message)
      else setThreads(json.data ?? [])
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : 'Error cargando hilos')
    } finally {
      setLoadingThreads(false)
    }
  }, [])

  const loadMessages = useCallback(async (threadId: string) => {
    setLoadingMessages(true)
    try {
      const res = await fetch(`/api/mensajeria/threads/${threadId}/messages`, { cache: 'no-store' })
      const json = await res.json()
      if (json.error) {
        setErrorMsg(json.error.message)
      } else {
        setCurrentThread(json.data.thread as MensajeriaThread)
        setMessages((json.data.messages ?? []) as MensajeriaMessage[])
      }
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : 'Error cargando mensajes')
    } finally {
      setLoadingMessages(false)
    }
  }, [])

  useEffect(() => { loadThreads() }, [loadThreads])
  useEffect(() => {
    if (selectedThreadId) loadMessages(selectedThreadId)
    else { setMessages([]); setCurrentThread(null) }
  }, [selectedThreadId, loadMessages])

  // Realtime: listen for any new message → refresh thread list badge counts
  // and, if the active thread matches, append the message live.
  useEffect(() => {
    const channel = supabase
      .channel('mensajeria-phase1')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'mensajeria_messages' },
        payload => {
          const row = payload.new as MensajeriaMessage
          if (!isInternal && row.internal_only) return
          if (!isInternal && row.company_id !== companyId) return
          if (selectedThreadId && row.thread_id === selectedThreadId) {
            setMessages(prev => (prev.some(m => m.id === row.id) ? prev : [...prev, row]))
          }
          loadThreads()
        },
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [selectedThreadId, isInternal, companyId, loadThreads])

  // Auto-scroll when new messages land
  useEffect(() => {
    threadEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length, selectedThreadId])

  const escalatedCount = useMemo(
    () => threads.filter(t => t.status === 'escalated').length,
    [threads],
  )
  const totalUnread = useMemo(
    () => threads.reduce((sum, t) => sum + t.unread_count, 0),
    [threads],
  )

  async function handleCreateThread() {
    setErrorMsg(null)
    if (!newSubject.trim() || !newBody.trim()) {
      setErrorMsg('Asunto y mensaje son requeridos')
      return
    }
    setSending(true)
    try {
      const targetCompany = newTargetCompany.trim() || companyId
      const res = await fetch('/api/mensajeria/threads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject: newSubject.trim(),
          body: newBody.trim(),
          company_id: targetCompany,
          internal_only: newInternalOnly,
        }),
      })
      const json = await res.json()
      if (json.error) throw new Error(json.error.message)
      setNewSubject('')
      setNewBody('')
      setComposeOpen(false)
      await loadThreads()
      setSelectedThreadId(json.data.id)
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : 'Error al crear hilo')
    } finally {
      setSending(false)
    }
  }

  async function handleSendReply() {
    if (!selectedThreadId || !replyBody.trim()) return
    setErrorMsg(null)
    setSending(true)
    try {
      const res = await fetch(`/api/mensajeria/threads/${selectedThreadId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: replyBody.trim(), internal_only: replyInternalOnly }),
      })
      const json = await res.json()
      if (json.error) throw new Error(json.error.message)
      setReplyBody('')
      setMessages(prev => [...prev, json.data as MensajeriaMessage])
      loadThreads()
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : 'Error al enviar')
    } finally {
      setSending(false)
    }
  }

  async function handleEscalate() {
    if (!selectedThreadId) return
    setSending(true)
    try {
      const summary = window.prompt('Resumen para Dirección (opcional):') ?? ''
      const res = await fetch(`/api/mensajeria/threads/${selectedThreadId}/escalate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ summary }),
      })
      const json = await res.json()
      if (json.error) throw new Error(json.error.message)
      await loadThreads()
      await loadMessages(selectedThreadId)
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : 'Error al escalar')
    } finally {
      setSending(false)
    }
  }

  return (
    <PageShell
      title="Chat"
      subtitle={
        isOwner
          ? `${escalatedCount} escalado${escalatedCount === 1 ? '' : 's'} · ${threads.length} hilo${threads.length === 1 ? '' : 's'}`
          : `${totalUnread} sin leer · ${threads.length} hilo${threads.length === 1 ? '' : 's'}`
      }
      systemStatus={escalatedCount > 0 ? 'warning' : 'healthy'}
      liveTimestamp
      badges={
        <button
          onClick={() => setComposeOpen(v => !v)}
          style={{
            minHeight: 44, minWidth: 44,
            padding: '10px 16px', borderRadius: 12,
            background: ACCENT_SILVER_BRIGHT, color: '#0A0A0C',
            border: 'none', cursor: 'pointer',
            fontSize: 'var(--aguila-fs-body)', fontWeight: 700, letterSpacing: '0.02em',
          }}
        >
          {composeOpen ? 'Cancelar' : '+ Nuevo hilo'}
        </button>
      }
    >
      {errorMsg ? (
        <div style={{
          padding: '10px 14px', marginBottom: 16, borderRadius: 12,
          background: 'rgba(239,68,68,0.1)', border: `1px solid ${RED}`,
          color: RED, fontSize: 'var(--aguila-fs-body)',
        }}>
          {errorMsg}
        </div>
      ) : null}

      {composeOpen ? (
        <GlassCard>
          <SectionHeader title="Nuevo hilo" />
          <div style={{ display: 'grid', gap: 12, marginTop: 12 }}>
            {isInternal ? (
              <input
                type="text"
                placeholder="Clave de cliente (company_id)"
                value={newTargetCompany}
                onChange={e => setNewTargetCompany(e.target.value)}
                style={fieldStyle()}
              />
            ) : null}
            <input
              type="text"
              placeholder="Asunto"
              value={newSubject}
              onChange={e => setNewSubject(e.target.value)}
              style={fieldStyle()}
              maxLength={200}
            />
            <textarea
              placeholder="Mensaje"
              value={newBody}
              onChange={e => setNewBody(e.target.value)}
              rows={4}
              style={{ ...fieldStyle(), resize: 'vertical', minHeight: 96 }}
              maxLength={10_000}
            />
            {isInternal ? (
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: TEXT_SECONDARY }}>
                <input
                  type="checkbox"
                  checked={newInternalOnly}
                  onChange={e => setNewInternalOnly(e.target.checked)}
                  style={{ width: 18, height: 18 }}
                />
                Interno (nunca visible al cliente)
              </label>
            ) : null}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button
                onClick={handleCreateThread}
                disabled={sending}
                style={{
                  minHeight: 44, padding: '10px 20px', borderRadius: 12,
                  background: ACCENT_SILVER_BRIGHT, color: '#0A0A0C',
                  border: 'none', cursor: sending ? 'wait' : 'pointer',
                  fontSize: 'var(--aguila-fs-body)', fontWeight: 700,
                }}
              >
                {sending ? 'Enviando…' : 'Crear hilo'}
              </button>
            </div>
          </div>
        </GlassCard>
      ) : null}

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(280px, 340px) 1fr',
        gap: 16,
        marginTop: 16,
        minHeight: 520,
      }}>
        {/* Thread list */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {loadingThreads ? (
            <GlassCard>
              <div style={{ color: TEXT_MUTED, fontSize: 'var(--aguila-fs-body)' }}>Cargando…</div>
            </GlassCard>
          ) : threads.length === 0 ? (
            <GlassCard>
              <div style={{ textAlign: 'center', padding: 24 }}>
                <div style={{ fontSize: 'var(--aguila-fs-kpi-compact)', marginBottom: 8 }}>📨</div>
                <div style={{ color: TEXT_PRIMARY, fontSize: 'var(--aguila-fs-section)', marginBottom: 4 }}>Sin hilos todavía</div>
                <div style={{ color: TEXT_MUTED, fontSize: 12 }}>
                  Crea un hilo nuevo para empezar.
                </div>
              </div>
            </GlassCard>
          ) : (
            threads.map(t => {
              const active = t.id === selectedThreadId
              const escalated = t.status === 'escalated'
              return (
                <button
                  key={t.id}
                  onClick={() => setSelectedThreadId(t.id)}
                  style={{
                    textAlign: 'left',
                    minHeight: 60,
                    padding: 14,
                    borderRadius: 14,
                    border: `1px solid ${active ? AMBER : BORDER}`,
                    background: active ? 'rgba(251,191,36,0.05)' : 'rgba(255,255,255,0.04)',
                    backdropFilter: 'blur(20px)',
                    color: TEXT_PRIMARY,
                    cursor: 'pointer',
                    display: 'flex', flexDirection: 'column', gap: 4,
                    position: 'relative',
                  }}
                >
                  {escalated ? (
                    <span style={{
                      position: 'absolute', left: 0, top: 0, bottom: 0, width: 3,
                      background: AMBER, borderRadius: '3px 0 0 3px',
                    }} />
                  ) : null}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
                    <span style={{
                      fontSize: 'var(--aguila-fs-body)', fontWeight: 700, color: TEXT_PRIMARY,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1,
                    }}>
                      {t.subject}
                    </span>
                    <span style={{
                      fontSize: 'var(--aguila-fs-label)', color: TEXT_MUTED,
                      fontFamily: 'var(--font-jetbrains-mono, monospace)',
                    }}>
                      {fmtDate(t.last_message_at)}
                    </span>
                  </div>
                  <div style={{
                    fontSize: 'var(--aguila-fs-meta)', color: TEXT_SECONDARY,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {t.last_message_preview ?? '—'}
                  </div>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    {isInternal ? (
                      <span style={{
                        fontSize: 'var(--aguila-fs-label)', color: TEXT_MUTED,
                        fontFamily: 'var(--font-jetbrains-mono, monospace)',
                      }}>
                        {t.company_id}
                      </span>
                    ) : null}
                    {escalated ? (
                      <span style={{
                        fontSize: 'var(--aguila-fs-label)', fontWeight: 700, color: AMBER,
                        padding: '1px 6px', borderRadius: 4,
                        background: 'rgba(251,191,36,0.1)', border: `1px solid ${AMBER}`,
                      }}>
                        ESCALADO
                      </span>
                    ) : null}
                    {t.unread_count > 0 ? (
                      <span style={{
                        marginLeft: 'auto',
                        fontSize: 'var(--aguila-fs-label)', fontWeight: 700, color: '#0A0A0C',
                        background: GREEN, padding: '1px 7px', borderRadius: 10,
                        minWidth: 18, textAlign: 'center',
                      }}>
                        {t.unread_count}
                      </span>
                    ) : null}
                  </div>
                </button>
              )
            })
          )}
        </div>

        {/* Thread detail */}
        <GlassCard padding={0}>
          {selectedThreadId && currentThread ? (
            <div style={{ display: 'flex', flexDirection: 'column', minHeight: 520 }}>
              {/* Header */}
              <div style={{
                padding: '16px 20px',
                borderBottom: `1px solid ${BORDER}`,
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: TEXT_PRIMARY }}>
                    {currentThread.subject}
                  </div>
                  <div style={{
                    fontSize: 'var(--aguila-fs-meta)', color: TEXT_MUTED, marginTop: 2,
                    fontFamily: 'var(--font-jetbrains-mono, monospace)',
                  }}>
                    {currentThread.company_id}
                    {currentThread.trafico_id ? ` · ${currentThread.trafico_id}` : ''}
                    {currentThread.status === 'escalated' ? ' · ESCALADO' : ''}
                  </div>
                </div>
                {isInternal && currentThread.status !== 'escalated' ? (
                  <button
                    onClick={handleEscalate}
                    disabled={sending}
                    style={{
                      minHeight: 44, padding: '8px 14px', borderRadius: 10,
                      border: `1px solid ${AMBER}`, background: 'rgba(251,191,36,0.08)',
                      color: AMBER, fontSize: 12, fontWeight: 700, cursor: 'pointer',
                    }}
                  >
                    Escalar a Dirección
                  </button>
                ) : null}
              </div>

              {/* Messages */}
              <div style={{
                flex: 1, overflowY: 'auto', padding: '16px 20px',
                display: 'flex', flexDirection: 'column', gap: 10,
                maxHeight: '60vh',
              }}>
                {loadingMessages ? (
                  <div style={{ color: TEXT_MUTED, fontSize: 'var(--aguila-fs-body)' }}>Cargando mensajes…</div>
                ) : messages.length === 0 ? (
                  <div style={{ color: TEXT_MUTED, fontSize: 'var(--aguila-fs-body)' }}>Sin mensajes.</div>
                ) : (
                  messages.map(m => (
                    <MessageBubble
                      key={m.id}
                      message={m}
                      isInternalViewer={isInternal}
                      selfName={operatorName}
                    />
                  ))
                )}
                <div ref={threadEndRef} />
              </div>

              {/* Reply box */}
              <div style={{
                borderTop: `1px solid ${BORDER}`, padding: '12px 16px',
                display: 'flex', flexDirection: 'column', gap: 8,
              }}>
                {isInternal ? (
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 'var(--aguila-fs-meta)', color: TEXT_SECONDARY }}>
                    <input
                      type="checkbox"
                      checked={replyInternalOnly}
                      onChange={e => setReplyInternalOnly(e.target.checked)}
                      style={{ width: 16, height: 16 }}
                    />
                    Nota interna (no visible al cliente)
                  </label>
                ) : null}
                <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
                  <textarea
                    value={replyBody}
                    onChange={e => setReplyBody(e.target.value)}
                    placeholder={isInternal ? 'Responde al cliente…' : 'Escribe un mensaje…'}
                    rows={2}
                    style={{
                      ...fieldStyle(),
                      flex: 1,
                      resize: 'none',
                      minHeight: 44,
                    }}
                    maxLength={10_000}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                        e.preventDefault()
                        handleSendReply()
                      }
                    }}
                  />
                  <button
                    onClick={handleSendReply}
                    disabled={sending || !replyBody.trim()}
                    style={{
                      minHeight: 44, minWidth: 80,
                      padding: '10px 18px', borderRadius: 12,
                      background: replyBody.trim() ? ACCENT_SILVER_BRIGHT : 'rgba(255,255,255,0.1)',
                      color: replyBody.trim() ? '#0A0A0C' : TEXT_MUTED,
                      border: 'none', cursor: replyBody.trim() && !sending ? 'pointer' : 'default',
                      fontSize: 'var(--aguila-fs-body)', fontWeight: 700,
                    }}
                  >
                    {sending ? '…' : 'Enviar'}
                  </button>
                </div>
                <div style={{ fontSize: 'var(--aguila-fs-label)', color: TEXT_MUTED, textAlign: 'right' }}>
                  30 s para retirar tras enviar · Cmd+Enter para enviar
                </div>
              </div>
            </div>
          ) : (
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              minHeight: 520, color: TEXT_MUTED, flexDirection: 'column', gap: 8,
            }}>
              <div style={{ fontSize: 'var(--aguila-fs-kpi-compact)' }}>💬</div>
              <div style={{ fontSize: 'var(--aguila-fs-body)' }}>Selecciona un hilo para verlo</div>
              <div style={{ fontSize: 'var(--aguila-fs-meta)', color: TEXT_MUTED }}>
                {companyName || 'Chat interno'} · Phase 1
              </div>
            </div>
          )}
        </GlassCard>
      </div>
    </PageShell>
  )
}

function MessageBubble({
  message, isInternalViewer, selfName,
}: {
  message: MensajeriaMessage
  isInternalViewer: boolean
  selfName: string
}) {
  const isSystem = message.author_role === 'system'
  const isSelf = message.author_name === selfName
  const isClient = message.author_role === 'client'
  const align = isSelf ? 'flex-end' : 'flex-start'
  const bg = isSystem
    ? 'rgba(251,191,36,0.06)'
    : isSelf
      ? 'rgba(192,197,206,0.1)'
      : 'rgba(255,255,255,0.04)'
  const border = isSystem ? `1px solid ${AMBER}` : `1px solid ${BORDER}`
  const displayName = roleLabelPrefix(message.author_role, message.author_name, isInternalViewer)
  const [undoRemaining, setUndoRemaining] = useState(0)

  useEffect(() => {
    if (!message.undo_until || !isSelf) return
    const compute = () => {
      const until = new Date(message.undo_until!).getTime()
      setUndoRemaining(Math.max(0, until - Date.now()))
    }
    compute()
    const id = window.setInterval(compute, 1000)
    return () => window.clearInterval(id)
  }, [message.undo_until, isSelf])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: align, maxWidth: '80%', alignSelf: align }}>
      <div style={{
        padding: '10px 14px', borderRadius: 12,
        background: bg, border, color: TEXT_PRIMARY,
        fontSize: 'var(--aguila-fs-body)', lineHeight: 1.5, whiteSpace: 'pre-wrap',
      }}>
        {message.body}
      </div>
      <div style={{
        fontSize: 'var(--aguila-fs-label)', color: TEXT_MUTED, marginTop: 3,
        fontFamily: 'var(--font-jetbrains-mono, monospace)',
        display: 'flex', gap: 6, alignItems: 'center',
      }}>
        <span>{displayName}</span>
        <span>·</span>
        <span>{fmtTime(message.created_at)}</span>
        {message.internal_only ? (
          <>
            <span>·</span>
            <span style={{ color: AMBER }}>interno</span>
          </>
        ) : null}
        {isSelf && undoRemaining > 0 && undoRemaining < UNDO_WINDOW_MS ? (
          <>
            <span>·</span>
            <span style={{ color: ACCENT_SILVER }}>
              {Math.ceil(undoRemaining / 1000)}s para retirar
            </span>
          </>
        ) : null}
        {!isInternalViewer && !isClient && !isSystem ? (
          <>
            <span>·</span>
            <span>{SENDER_PUBLIC_NAME}</span>
          </>
        ) : null}
      </div>
    </div>
  )
}

function roleLabelPrefix(role: AuthorRole, authorName: string, isInternalViewer: boolean): string {
  if (role === 'system') return 'Sistema'
  if (role === 'client') return authorName || 'Cliente'
  if (!isInternalViewer) return SENDER_PUBLIC_NAME
  return authorName || (role === 'operator' ? 'Operador' : 'Dirección')
}

function fieldStyle(): React.CSSProperties {
  return {
    padding: '10px 14px',
    borderRadius: 10,
    border: `1px solid ${BORDER}`,
    background: 'rgba(255,255,255,0.03)',
    color: TEXT_PRIMARY,
    fontFamily: 'inherit',
    fontSize: 'var(--aguila-fs-body)',
    outline: 'none',
    minHeight: 44,
  }
}
