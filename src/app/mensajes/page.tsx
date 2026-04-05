'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'
import { getCookieValue, getCompanyIdCookie, getClientNameCookie } from '@/lib/client-config'
import { fmtDateTime } from '@/lib/format-utils'
import { EmptyState } from '@/components/ui/EmptyState'
import { Send, FileText } from 'lucide-react'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

interface Message {
  id: string
  direction: string
  subject: string | null
  body: string | null
  channel: string | null
  created_at: string
  from_name: string | null
}

export default function MensajesPage() {
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(true)
  const [replyText, setReplyText] = useState('')
  const [replySent, setReplySent] = useState(false)

  const companyId = getCompanyIdCookie()
  const companyName = getClientNameCookie()

  useEffect(() => {
    supabase
      .from('communication_events')
      .select('id, direction, subject, body_preview, channel, created_at, from_address')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false })
      .limit(50)
      .then(({ data }) => {
        setMessages((data || []).map(d => ({
          id: d.id,
          direction: d.direction || 'inbound',
          subject: d.subject,
          body: d.body_preview,
          channel: d.channel,
          created_at: d.created_at,
          from_name: d.from_address || (d.direction === 'outbound' ? 'RZ & Company' : companyName),
        })))
        setLoading(false)
      })
  }, [companyId, companyName])

  async function sendReply() {
    if (!replyText.trim()) return

    const csrfToken = getCookieValue('csrf_token') || ''
    // Save as draft pending Tito approval
    await supabase.from('pedimento_drafts').insert({
      trafico_id: null,
      draft_data: {
        type: 'client_message',
        from: companyName,
        company_id: companyId,
        body: replyText,
        channel: 'portal',
      },
      status: 'pending_approval',
      created_by: companyId,
    })

    setReplySent(true)
    setReplyText('')
    setTimeout(() => setReplySent(false), 3000)
  }

  return (
    <div style={{ padding: '24px 16px', maxWidth: 700, margin: '0 auto' }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, color: '#1A1A1A', margin: '0 0 4px' }}>Mensajes</h1>
      <p style={{ fontSize: 13, color: '#6B6B6B', margin: '0 0 24px' }}>
        Comunicación con Renato Zapata &amp; Company
      </p>

      {/* Reply box */}
      <div className="card" style={{ padding: '16px 20px', marginBottom: 24 }}>
        <textarea
          value={replyText}
          onChange={e => setReplyText(e.target.value)}
          placeholder="Escriba un mensaje..."
          style={{
            width: '100%', minHeight: 80, border: '1px solid #E8E5E0', borderRadius: 8,
            padding: '10px 12px', fontSize: 13, color: '#1A1A1A', fontFamily: 'inherit',
            resize: 'vertical', outline: 'none', background: 'var(--bg-main)', boxSizing: 'border-box',
          }}
        />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
          <span style={{ fontSize: 11, color: '#9B9B9B' }}>
            {replySent ? '✅ Mensaje enviado — pendiente de revisión' : 'Los mensajes son revisados antes de envío'}
          </span>
          <button
            onClick={sendReply}
            disabled={!replyText.trim()}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '8px 20px', borderRadius: 8, fontSize: 13, fontWeight: 700,
              background: replyText.trim() ? 'var(--gold)' : 'var(--border)',
              border: 'none', color: replyText.trim() ? '#FFFFFF' : '#9B9B9B',
              cursor: replyText.trim() ? 'pointer' : 'default', minHeight: 40,
            }}
          >
            <Send size={14} /> Enviar
          </button>
        </div>
      </div>

      {/* Message thread */}
      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[0, 1, 2].map(i => <div key={i} className="skeleton-shimmer" style={{ height: 80, borderRadius: 8 }} />)}
        </div>
      ) : messages.length === 0 ? (
        <EmptyState icon="💬" title="Sin mensajes" description="Los mensajes con su agente aduanal aparecerán aquí" />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {messages.map(msg => {
            const isOutbound = msg.direction === 'outbound'
            return (
              <div key={msg.id} style={{
                padding: '14px 20px', borderRadius: 12,
                background: isOutbound ? 'rgba(196,150,60,0.06)' : '#FFFFFF',
                border: `1px solid ${isOutbound ? 'rgba(196,150,60,0.2)' : 'var(--border)'}`,
                marginLeft: isOutbound ? 40 : 0,
                marginRight: isOutbound ? 0 : 40,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: isOutbound ? 'var(--gold)' : '#1A1A1A' }}>
                    {isOutbound ? 'RZ & Company' : msg.from_name || companyName}
                  </span>
                  <span style={{ fontSize: 10, color: '#9B9B9B', fontFamily: 'var(--font-mono)' }}>{fmtDateTime(msg.created_at)}</span>
                </div>
                {msg.subject && <div style={{ fontSize: 13, fontWeight: 600, color: '#1A1A1A', marginBottom: 4 }}>{msg.subject}</div>}
                {msg.body && <div style={{ fontSize: 13, color: '#6B6B6B', lineHeight: 1.5 }}>{msg.body}</div>}
                {msg.channel && (
                  <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
                    <FileText size={10} style={{ color: '#9B9B9B' }} />
                    <span style={{ fontSize: 10, color: '#9B9B9B' }}>{msg.channel}</span>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
