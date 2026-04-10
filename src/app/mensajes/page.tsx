'use client'

import { useEffect, useState, useMemo, useRef, useCallback } from 'react'
import { createClient } from '@supabase/supabase-js'
import { getCookieValue, getCompanyIdCookie, getClientNameCookie } from '@/lib/client-config'
import { useIsMobile } from '@/hooks/use-mobile'
import { fmtDateTime, fmtDateCompact } from '@/lib/format-utils'
import { EmptyState } from '@/components/ui/EmptyState'
import { Send, ArrowLeft, Phone, Paperclip, FileText, User, MessageSquare } from 'lucide-react'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

// ── Types ──
interface WaMessage {
  id: string
  trafico_id: string | null
  company_id: string | null
  supplier_phone: string
  direction: 'inbound' | 'outbound'
  message_body: string | null
  status: string | null
  media_urls: string[] | null
  created_at: string
}

interface Contact {
  phone: string
  displayName: string
  lastMessage: string
  lastTime: string
  traficoId: string | null
  companyId: string | null
  unreadCount: number
  totalMessages: number
}

// ── Helpers ──
function cleanPhone(phone: string): string {
  return phone.replace('whatsapp:', '').replace(/^\+/, '')
}

function formatPhone(phone: string): string {
  const clean = cleanPhone(phone)
  if (clean.length === 12 && clean.startsWith('52')) {
    return `+52 ${clean.slice(2, 5)} ${clean.slice(5, 8)} ${clean.slice(8)}`
  }
  if (clean.length === 11 && clean.startsWith('1')) {
    return `+1 (${clean.slice(1, 4)}) ${clean.slice(4, 7)}-${clean.slice(7)}`
  }
  return phone
}

function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max) + '…' : s
}

// ── Suggested replies based on last inbound message ──
function getSuggestedReplies(lastInbound: string | null, traficoId: string | null): string[] {
  if (!lastInbound) return []
  const lower = (lastInbound || '').toLowerCase()
  const suggestions: string[] = []

  if (lower.includes('archivo') || lower.includes('documento') || lower.includes('adjunt')) {
    suggestions.push('Recibido, gracias. Estamos revisando el documento.')
  }
  if (lower.includes('status') || lower.includes('estatus') || lower.includes('cómo va')) {
    suggestions.push(traficoId
      ? `El tráfico ${traficoId} está en proceso. Le avisamos cuando haya actualización.`
      : 'Estamos revisando. Le avisamos en breve.')
  }
  if (lower.includes('hola') || lower.includes('buenos') || lower.includes('buenas')) {
    suggestions.push('Hola, ¿en qué podemos ayudarle?')
  }
  if (lower.includes('gracias') || lower.includes('ok') || lower.includes('listo')) {
    suggestions.push('¡Gracias! Quedamos al pendiente.')
  }

  // Always offer generic follow-ups
  if (suggestions.length === 0) {
    suggestions.push('Recibido. Gracias por la información.')
    suggestions.push('¿Puede enviarnos el documento actualizado?')
  }

  return suggestions.slice(0, 3)
}

// ═══════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════
export default function MensajesPage() {
  const isMobile = useIsMobile()
  const [messages, setMessages] = useState<WaMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedPhone, setSelectedPhone] = useState<string | null>(null)
  const [replyText, setReplyText] = useState('')
  const [sending, setSending] = useState(false)
  const [sendStatus, setSendStatus] = useState<'idle' | 'sent' | 'error'>('idle')
  const threadEndRef = useRef<HTMLDivElement>(null)

  const companyId = getCompanyIdCookie()
  const role = getCookieValue('portal_role') || 'client'
  const isInternal = role === 'broker' || role === 'admin'

  // ── Load all conversations ──
  const loadMessages = useCallback(async () => {
    let query = supabase
      .from('whatsapp_conversations')
      .select('id, trafico_id, company_id, supplier_phone, direction, message_body, status, media_urls, created_at')
      .order('created_at', { ascending: false })
      .limit(500)

    // Clients see only their conversations
    if (!isInternal && companyId) {
      query = query.eq('company_id', companyId)
    }

    const { data, error } = await query
    if (error) {
      console.error('[Mensajes] Load error:', error.message)
    }
    setMessages(data || [])
    setLoading(false)
  }, [companyId, isInternal])

  useEffect(() => { loadMessages() }, [loadMessages])

  // Realtime subscription for new messages
  useEffect(() => {
    const channel = supabase
      .channel('whatsapp-realtime')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'whatsapp_conversations',
      }, (payload) => {
        const newMsg = payload.new as WaMessage
        // Only add if it matches our view (client isolation)
        if (!isInternal && companyId && newMsg.company_id !== companyId) return
        setMessages(prev => [newMsg, ...prev])
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [companyId, isInternal])

  // Auto-scroll thread when messages change or selection changes
  useEffect(() => {
    threadEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [selectedPhone, messages])

  // ── Build contact list ──
  const contacts = useMemo((): Contact[] => {
    const map = new Map<string, Contact>()

    for (const msg of messages) {
      const phone = msg.supplier_phone
      if (!map.has(phone)) {
        map.set(phone, {
          phone,
          displayName: formatPhone(phone),
          lastMessage: msg.message_body || '[archivo]',
          lastTime: msg.created_at,
          traficoId: msg.trafico_id,
          companyId: msg.company_id,
          unreadCount: 0,
          totalMessages: 0,
        })
      }
      const c = map.get(phone)!
      c.totalMessages++
      if (msg.direction === 'inbound' && msg.status === 'received') {
        c.unreadCount++
      }
    }

    return Array.from(map.values())
      .sort((a, b) => b.lastTime.localeCompare(a.lastTime))
  }, [messages])

  // ── Messages for selected contact ──
  const thread = useMemo((): WaMessage[] => {
    if (!selectedPhone) return []
    return messages
      .filter(m => m.supplier_phone === selectedPhone)
      .sort((a, b) => a.created_at.localeCompare(b.created_at))
  }, [messages, selectedPhone])

  const selectedContact = contacts.find(c => c.phone === selectedPhone)

  // Last inbound for suggested replies
  const lastInbound = useMemo(() => {
    const inbound = thread.filter(m => m.direction === 'inbound')
    return inbound.length > 0 ? inbound[inbound.length - 1] : null
  }, [thread])

  const suggestions = useMemo(
    () => getSuggestedReplies(lastInbound?.message_body || null, selectedContact?.traficoId || null),
    [lastInbound, selectedContact]
  )

  // ── Send reply ──
  async function handleSend() {
    if (!replyText.trim() || !selectedPhone) return
    setSending(true)
    setSendStatus('idle')

    try {
      const res = await fetch('/api/whatsapp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          trafico_id: selectedContact?.traficoId || 'general',
          supplier_phone: selectedPhone,
          message: replyText.trim(),
        }),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Error al enviar')
      }

      setSendStatus('sent')
      setReplyText('')
      // Reload to pick up the new message
      await loadMessages()
      setTimeout(() => setSendStatus('idle'), 3000)
    } catch (err) {
      console.error('[Mensajes] Send error:', err)
      setSendStatus('error')
      setTimeout(() => setSendStatus('idle'), 5000)
    } finally {
      setSending(false)
    }
  }

  // ═══════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════

  if (loading) {
    return (
      <div style={{ padding: 24, maxWidth: 960, margin: '0 auto' }}>
        <div className="skeleton-shimmer" style={{ height: 32, width: 160, borderRadius: 8, marginBottom: 16 }} />
        <div style={{ display: 'flex', gap: 16 }}>
          <div style={{ flex: '0 0 300px' }}>
            {[0, 1, 2, 3].map(i => <div key={i} className="skeleton-shimmer" style={{ height: 72, borderRadius: 8, marginBottom: 8 }} />)}
          </div>
          <div style={{ flex: 1 }}>
            <div className="skeleton-shimmer" style={{ height: 400, borderRadius: 8 }} />
          </div>
        </div>
      </div>
    )
  }

  // Mobile: show either contact list or thread
  const showThread = isMobile && selectedPhone

  return (
    <div style={{ padding: isMobile ? '16px 12px' : '24px 16px', maxWidth: 1080, margin: '0 auto', height: 'calc(100vh - 80px)' }}>
      {/* Header */}
      {(!showThread) && (
        <div style={{ marginBottom: 16 }}>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 4px' }}>
            <MessageSquare size={20} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 8 }} />
            WhatsApp
          </h1>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0 }}>
            {contacts.length} conversación{contacts.length !== 1 ? 'es' : ''} · {isInternal ? 'Todos los clientes' : 'Proveedores'}
          </p>
        </div>
      )}

      {contacts.length === 0 && !selectedPhone ? (
        <EmptyState
          icon="💬"
          title="Sin conversaciones"
          description="Las conversaciones de WhatsApp con proveedores aparecerán aquí cuando se soliciten documentos."
          cta={{ label: 'Ver tráficos', href: '/traficos' }}
        />
      ) : (
        <div style={{ display: 'flex', gap: 16, height: 'calc(100% - 60px)', minHeight: 400 }}>
          {/* ── LEFT: Contact list ── */}
          {(!showThread) && (
            <div style={{
              flex: isMobile ? '1' : '0 0 320px',
              overflowY: 'auto',
              borderRight: isMobile ? 'none' : '1px solid var(--border)',
              paddingRight: isMobile ? 0 : 16,
            }}>
              {contacts.map(contact => {
                const isActive = contact.phone === selectedPhone
                return (
                  <button
                    key={contact.phone}
                    onClick={() => setSelectedPhone(contact.phone)}
                    style={{
                      display: 'flex', alignItems: 'flex-start', gap: 12,
                      width: '100%', padding: '12px 12px', borderRadius: 8,
                      border: 'none', cursor: 'pointer', textAlign: 'left',
                      background: isActive ? 'rgba(196,150,60,0.08)' : 'transparent',
                      transition: 'background 150ms',
                      minHeight: 60,
                    }}
                  >
                    {/* Avatar */}
                    <div style={{
                      width: 40, height: 40, borderRadius: '50%',
                      background: 'var(--slate-100)', display: 'flex',
                      alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                    }}>
                      <User size={18} style={{ color: 'var(--slate-400)' }} />
                    </div>

                    {/* Content */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                          {contact.displayName}
                        </span>
                        <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap' }}>
                          {fmtDateCompact(contact.lastTime)}
                        </span>
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {truncate(contact.lastMessage, 50)}
                      </div>
                      {contact.traficoId && contact.traficoId !== 'unknown' && (
                        <span style={{
                          fontSize: 10, fontFamily: 'var(--font-mono)',
                          color: 'var(--gold-dark)', marginTop: 2, display: 'inline-block',
                        }}>
                          {contact.traficoId}
                        </span>
                      )}
                    </div>

                    {/* Unread badge */}
                    {contact.unreadCount > 0 && (
                      <span style={{
                        background: 'var(--success)', color: 'rgba(9,9,11,0.75)',
                        fontSize: 10, fontWeight: 700, borderRadius: 10,
                        padding: '2px 7px', alignSelf: 'center',
                      }}>
                        {contact.unreadCount}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          )}

          {/* ── RIGHT: Message thread ── */}
          {(selectedPhone || !isMobile) && (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
              {selectedPhone ? (
                <>
                  {/* Thread header */}
                  <div style={{
                    padding: '12px 16px', borderBottom: '1px solid var(--border)',
                    display: 'flex', alignItems: 'center', gap: 12,
                  }}>
                    {isMobile && (
                      <button
                        onClick={() => setSelectedPhone(null)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, minWidth: 44, minHeight: 44, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                      >
                        <ArrowLeft size={20} style={{ color: 'var(--text-primary)' }} />
                      </button>
                    )}
                    <div style={{
                      width: 36, height: 36, borderRadius: '50%',
                      background: 'var(--slate-100)', display: 'flex',
                      alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                    }}>
                      <Phone size={16} style={{ color: 'var(--slate-400)' }} />
                    </div>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
                        {selectedContact?.displayName}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                        {selectedContact?.totalMessages} mensaje{(selectedContact?.totalMessages || 0) !== 1 ? 's' : ''}
                        {selectedContact?.traficoId && selectedContact.traficoId !== 'unknown'
                          ? ` · ${selectedContact.traficoId}`
                          : ''}
                      </div>
                    </div>
                  </div>

                  {/* Messages */}
                  <div style={{ flex: 1, overflowY: 'auto', padding: '16px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {thread.map(msg => {
                      const isOut = msg.direction === 'outbound'
                      return (
                        <div
                          key={msg.id}
                          style={{
                            maxWidth: '80%',
                            alignSelf: isOut ? 'flex-end' : 'flex-start',
                            padding: '10px 14px',
                            borderRadius: isOut ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
                            background: isOut ? 'rgba(196,150,60,0.08)' : 'var(--bg-card)',
                            border: `1px solid ${isOut ? 'rgba(196,150,60,0.2)' : 'var(--border)'}`,
                          }}
                        >
                          <div style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
                            {msg.message_body || '[sin contenido]'}
                          </div>

                          {/* Media attachments */}
                          {msg.media_urls && msg.media_urls.length > 0 && (
                            <div style={{ marginTop: 8, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                              {msg.media_urls.map((url, i) => (
                                <a
                                  key={i}
                                  href={url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  style={{
                                    display: 'flex', alignItems: 'center', gap: 4,
                                    padding: '4px 8px', borderRadius: 6,
                                    background: 'var(--slate-100)', fontSize: 11,
                                    color: 'var(--text-secondary)', textDecoration: 'none',
                                  }}
                                >
                                  <Paperclip size={10} /> Archivo {i + 1}
                                </a>
                              ))}
                            </div>
                          )}

                          <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4, fontFamily: 'var(--font-mono)', textAlign: isOut ? 'right' : 'left' }}>
                            {fmtDateTime(msg.created_at)}
                            {isOut && msg.status && (
                              <span style={{ marginLeft: 6 }}>
                                {msg.status === 'sent' ? '✓' : msg.status === 'delivered' ? '✓✓' : msg.status === 'read' ? '✓✓' : ''}
                              </span>
                            )}
                          </div>
                        </div>
                      )
                    })}
                    <div ref={threadEndRef} />
                  </div>

                  {/* Suggested replies */}
                  {suggestions.length > 0 && (
                    <div style={{ padding: '8px 12px', display: 'flex', gap: 6, flexWrap: 'wrap', borderTop: '1px solid var(--border)' }}>
                      {suggestions.map((s, i) => (
                        <button
                          key={i}
                          onClick={() => setReplyText(s)}
                          style={{
                            padding: '6px 12px', borderRadius: 16,
                            border: '1px solid var(--border)', background: 'var(--bg-card)',
                            fontSize: 12, color: 'var(--text-secondary)', cursor: 'pointer',
                            transition: 'border-color 150ms',
                            minHeight: 32,
                          }}
                        >
                          {truncate(s, 40)}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Reply input */}
                  <div style={{
                    padding: '12px 12px', borderTop: '1px solid var(--border)',
                    display: 'flex', gap: 8, alignItems: 'flex-end',
                  }}>
                    <textarea
                      value={replyText}
                      onChange={e => setReplyText(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault()
                          handleSend()
                        }
                      }}
                      placeholder="Escribe un mensaje..."
                      rows={2}
                      style={{
                        flex: 1, border: '1px solid var(--border)', borderRadius: 8,
                        padding: '10px 12px', fontSize: 13, color: 'var(--text-primary)',
                        fontFamily: 'inherit', resize: 'none', outline: 'none',
                        background: 'var(--bg-main)', boxSizing: 'border-box',
                        minHeight: 44,
                      }}
                    />
                    <button
                      onClick={handleSend}
                      disabled={!replyText.trim() || sending}
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        width: 44, height: 44, borderRadius: 8,
                        background: replyText.trim() ? 'var(--gold)' : 'var(--border)',
                        border: 'none',
                        color: replyText.trim() ? 'var(--bg-card)' : 'var(--text-muted)',
                        cursor: replyText.trim() ? 'pointer' : 'default',
                        flexShrink: 0,
                      }}
                    >
                      <Send size={16} />
                    </button>
                  </div>

                  {/* Send status */}
                  {sendStatus !== 'idle' && (
                    <div style={{
                      padding: '4px 12px', fontSize: 11,
                      color: sendStatus === 'sent' ? 'var(--success)' : 'var(--danger-500)',
                      textAlign: 'center',
                    }}>
                      {sendStatus === 'sent' ? '✅ Mensaje enviado' : '❌ Error al enviar — intenta de nuevo'}
                    </div>
                  )}
                </>
              ) : (
                /* No thread selected */
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <EmptyState
                    icon="💬"
                    title="Selecciona una conversación"
                    description="Elige un contacto para ver la conversación completa"
                  />
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
