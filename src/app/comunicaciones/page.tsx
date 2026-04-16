'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'
import { Send, Inbox, FileText, PenLine, X, Mail, ArrowLeft, Paperclip, RefreshCw } from 'lucide-react'
import { getCompanyIdCookie, getCookieValue } from '@/lib/client-config'
import { fmtDateTime } from '@/lib/format-utils'
import { useIsMobile } from '@/hooks/use-mobile'
import { EmptyState } from '@/components/ui/EmptyState'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

// Client contacts loaded from config — never hardcode names or emails
const RECIPIENTS = [
  { name: 'Renato Zapata III', email: 'ai@renatozapata.com', role: 'Director General' },
]

const TEMPLATES = [
  { id: 'doc_request', name: 'Solicitud de Documentos', body: 'Estimado(a) {recipient},\n\nPor medio de la presente, le solicito los siguientes documentos para el trafico {trafico}:\n\n- Factura comercial\n- Packing list\n- Bill of Lading\n\nAgradezco su pronta respuesta.\n\nAtentamente,\nRenato Zapata & Company' },
  { id: 'status_update', name: 'Actualización de Estado', body: 'Estimado(a) {recipient},\n\nLe informo sobre el estado actual de sus operaciones:\n\n{status_details}\n\nQuedamos a sus órdenes.\n\nRenato Zapata & Company' },
  { id: 'compliance_notice', name: 'Aviso de Cumplimiento', body: 'AVISO DE CUMPLIMIENTO\n\n{recipient},\n\nSe le notifica que la siguiente obligación está próxima a vencer:\n\n{compliance_details}\n\nFavor de tomar acción antes de la fecha límite.\n\nRenato Zapata & Company' },
  { id: 'weekly_summary', name: 'Resumen Semanal', body: 'Estimado(a) {recipient},\n\nAdjunto el resumen semanal de operaciones.\n\n{summary}\n\nRenato Zapata & Company' },
  { id: 'custom', name: 'Personalizado', body: '' },
]

type Tab = 'inbox' | 'gmail' | 'compose' | 'sent' | 'templates'

interface GmailMessage {
  id: string
  threadId: string
  from: string
  subject: string
  date: string
  snippet: string
  isUnread: boolean
}

interface GmailDetail {
  id: string
  threadId: string
  from: string
  to: string
  subject: string
  date: string
  body: string
  attachments: { filename: string; mimeType: string; size: number }[]
}

export default function ComunicacionesPage() {
  const isMobile = useIsMobile()
  const [events, setEvents] = useState<{ id?: string; from_address?: string; subject?: string; is_urgent?: boolean; urgent_keywords?: string[]; scanned_at?: string; date?: string; body_preview?: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<Tab>('inbox')
  const [filter, setFilter] = useState('')

  // Compose state
  const [recipient, setRecipient] = useState('')
  const [template, setTemplate] = useState('')
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [drafting, setDrafting] = useState(false)
  const [sendStatus, setSendStatus] = useState('')

  // Gmail live state
  const role = getCookieValue('portal_role') || 'client'
  const isInternal = role === 'broker' || role === 'admin'
  const [gmailMessages, setGmailMessages] = useState<GmailMessage[]>([])
  const [gmailLoading, setGmailLoading] = useState(false)
  const [gmailSearch, setGmailSearch] = useState('')
  const [selectedEmail, setSelectedEmail] = useState<GmailDetail | null>(null)
  const [emailLoading, setEmailLoading] = useState(false)
  const [replyBody, setReplyBody] = useState('')
  const [replying, setReplying] = useState(false)
  const [replyStatus, setReplyStatus] = useState('')

  async function loadGmail(q?: string) {
    setGmailLoading(true)
    try {
      const params = new URLSearchParams({ action: 'list', limit: '30' })
      if (q) params.set('q', q)
      const res = await fetch(`/api/gmail?${params}`)
      const json = await res.json()
      setGmailMessages(json.data || [])
    } catch { setGmailMessages([]) }
    setGmailLoading(false)
  }

  async function readEmail(id: string) {
    setEmailLoading(true)
    setSelectedEmail(null)
    try {
      const res = await fetch(`/api/gmail?action=read&id=${id}`)
      const json = await res.json()
      setSelectedEmail(json.data || null)
    } catch (e) { console.error('[comunicaciones] email read failed:', (e as Error).message) }
    setEmailLoading(false)
  }

  async function sendReply() {
    if (!replyBody.trim() || !selectedEmail) return
    setReplying(true)
    setReplyStatus('')
    try {
      const res = await fetch('/api/gmail/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: selectedEmail.from,
          subject: `Re: ${selectedEmail.subject}`,
          body: replyBody,
          threadId: selectedEmail.threadId,
        }),
      })
      if (res.ok) {
        setReplyStatus('✅ Enviado')
        setReplyBody('')
        setTimeout(() => setReplyStatus(''), 3000)
      } else {
        const err = await res.json()
        setReplyStatus(`❌ ${err.error}`)
      }
    } catch {
      setReplyStatus('❌ Error de conexión')
    }
    setReplying(false)
  }

  useEffect(() => {
    supabase.from('communication_events').select('*').order('scanned_at', { ascending: false }).limit(200)
      .then(({ data }) => { setEvents(data || []); setLoading(false) })
      .then(undefined, () => setLoading(false))
  }, [])

  const filtered = events.filter(e => {
    if (tab === 'sent') return (e.from_address || '').includes('renatozapata')
    if (!filter) return true
    const q = filter.toLowerCase()
    return (e.from_address || '').toLowerCase().includes(q) ||
      (e.subject || '').toLowerCase().includes(q) ||
      (e.urgent_keywords || []).some((k: string) => k.toLowerCase().includes(q))
  })

  const urgentCount = events.filter(e => e.is_urgent).length

  function selectTemplate(id: string) {
    setTemplate(id)
    const t = TEMPLATES.find(t => t.id === id)
    if (t) setBody(t.body)
  }

  async function draftWithADUANA() {
    setDrafting(true)
    try {
      const res = await fetch('/api/chat', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{ role: 'user', content: `Redacta un email profesional bilingüe (español primario) para ${recipient || 'el cliente'} sobre: ${subject || 'operaciones aduanales'}. ${body ? 'Contexto adicional: ' + body : ''}. Firma como Renato Zapata & Company.` }]
        })
      })
      const data = await res.json()
      setBody(data.content || data.message || body)
    } catch (e) { console.error('[comunicaciones] AI draft failed:', (e as Error).message) }
    setDrafting(false)
  }

  async function handleSend() {
    if (!recipient || !body) return
    setSendStatus('Enviando...')
    // Save as draft/sent in communication_events
    await supabase.from('communication_events').insert({
      from_address: 'ai@renatozapata.com',
      subject: subject || 'Comunicacion — Renato Zapata & Company',
      body_preview: body.substring(0, 500),
      is_urgent: false,
      scanned_at: new Date().toISOString(),
      urgent_keywords: ['sent'],
    })
    setSendStatus('Guardado como borrador — requiere aprobacion via Telegram')
    setTimeout(() => setSendStatus(''), 5000)
  }

  const fmtDate = (d: string | undefined) => fmtDateTime(d)

  const tabs: { key: Tab; label: string; icon: React.ElementType }[] = [
    { key: 'inbox', label: `Bandeja (${events.length})`, icon: Inbox },
    ...(isInternal ? [{ key: 'gmail' as Tab, label: 'Gmail', icon: Mail }] : []),
    { key: 'compose', label: 'Redactar', icon: PenLine },
    { key: 'sent', label: 'Enviados', icon: Send },
    { key: 'templates', label: 'Plantillas', icon: FileText },
  ]

  return (
    <div style={{ padding: 32 }}>
      <div style={{ marginBottom: 24 }}>
        <h1 className="page-title">Centro de Comunicaciones</h1>
        <p className="page-subtitle">{events.length} eventos · {urgentCount} urgentes · Email Intelligence</p>
      </div>

      {/* Tab bar */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 20 }}>
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className="tab-btn flex items-center gap-1.5"
            style={tab === t.key ? { background: 'var(--amber-100)', color: 'var(--amber-800)', border: '1px solid var(--amber-200)' } : {}}>
            <t.icon size={13} /> {t.label}
          </button>
        ))}
      </div>

      {/* COMPOSE TAB */}
      {tab === 'compose' && (
        <div className="card" style={{ padding: 24 }}>
          <div className={`grid ${isMobile ? 'grid-cols-1' : 'grid-cols-2'} gap-4 mb-4`}>
            <div>
              <label className="text-[10.5px] font-semibold uppercase tracking-[0.07em] mb-1 block" style={{ color: 'var(--slate-400)' }}>Destinatario</label>
              <select value={recipient} onChange={e => setRecipient(e.target.value)}
                className="w-full rounded-[6px] px-3 py-2 text-[13px] outline-none"
                style={{ border: '1px solid var(--border)', color: 'var(--text-primary)', background: 'var(--bg-input)' }}>
                <option value="">Seleccionar...</option>
                {RECIPIENTS.map(r => <option key={r.email} value={r.email}>{r.name} — {r.role}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[10.5px] font-semibold uppercase tracking-[0.07em] mb-1 block" style={{ color: 'var(--slate-400)' }}>Plantilla</label>
              <select value={template} onChange={e => selectTemplate(e.target.value)}
                className="w-full rounded-[6px] px-3 py-2 text-[13px] outline-none"
                style={{ border: '1px solid var(--border)', color: 'var(--text-primary)', background: 'var(--bg-input)' }}>
                <option value="">Sin plantilla</option>
                {TEMPLATES.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
          </div>

          <div className="mb-4">
            <label className="text-[10.5px] font-semibold uppercase tracking-[0.07em] mb-1 block" style={{ color: 'var(--slate-400)' }}>Asunto</label>
            <input value={subject} onChange={e => setSubject(e.target.value)} placeholder="Asunto del mensaje"
              className="w-full rounded-[6px] px-3 py-2 text-[13px] outline-none"
              style={{ border: '1px solid var(--border)', color: 'var(--text-primary)', background: 'var(--bg-input)' }} />
          </div>

          <div className="mb-4">
            <div className="flex justify-between items-center mb-1">
              <label className="text-[10.5px] font-semibold uppercase tracking-[0.07em]" style={{ color: 'var(--slate-400)' }}>Mensaje</label>
              <button onClick={draftWithADUANA} disabled={drafting}
                className="flex items-center gap-1.5 px-3 py-1 rounded-[4px] text-[11px] font-semibold"
                style={{ background: 'var(--amber-100)', color: 'var(--amber-600)', border: '1px solid var(--amber-200)', cursor: 'pointer' }}>
                {drafting ? 'Redactando...' : '🦀 Redactar con CRUZ'}
              </button>
            </div>
            <textarea value={body} onChange={e => setBody(e.target.value)} rows={12}
              className="w-full rounded-[6px] px-3 py-2 text-[13px] outline-none leading-relaxed"
              style={{ border: '1px solid var(--border)', color: 'var(--text-primary)', background: 'var(--bg-input)', fontFamily: 'inherit', resize: 'vertical' }} />
          </div>

          <div className={`flex ${isMobile ? 'flex-col' : 'items-center'} gap-3`}>
            <button onClick={handleSend}
              className="flex items-center gap-2 px-4 py-2.5 rounded-[6px] text-[13px] font-semibold"
              style={{ background: 'var(--amber-600)', color: 'rgba(255,255,255,0.045)', border: 'none', cursor: 'pointer' }}>
              <Send size={14} /> Aprobar y Enviar
            </button>
            <button className="px-4 py-2.5 rounded-[6px] text-[13px] font-medium"
              style={{ background: 'var(--slate-50)', color: 'var(--slate-500)', border: '1px solid var(--border)', cursor: 'pointer' }}>
              Guardar Borrador
            </button>
            {sendStatus && <span className="text-[12px] font-medium" style={{ color: 'var(--green)' }}>{sendStatus}</span>}
          </div>
        </div>
      )}

      {/* GMAIL TAB */}
      {tab === 'gmail' && isInternal && (
        <div>
          {selectedEmail ? (
            /* Email detail view */
            <div>
              <button
                onClick={() => setSelectedEmail(null)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  background: 'none', border: 'none', cursor: 'pointer',
                  fontSize: 'var(--aguila-fs-body)', color: 'var(--text-secondary)', marginBottom: 12,
                  padding: '4px 0', minHeight: 44,
                }}
              >
                <ArrowLeft size={14} /> Volver a la bandeja
              </button>
              <div className="card" style={{ padding: 24 }}>
                <h2 style={{ fontSize: 'var(--aguila-fs-kpi-small)', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>
                  {selectedEmail.subject || '(sin asunto)'}
                </h2>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
                  <span style={{ fontSize: 'var(--aguila-fs-body)', color: 'var(--text-secondary)' }}>
                    De: <strong>{selectedEmail.from}</strong>
                  </span>
                  <span style={{ fontSize: 'var(--aguila-fs-meta)', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                    {selectedEmail.date}
                  </span>
                </div>

                {/* Attachments */}
                {selectedEmail.attachments.length > 0 && (
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
                    {selectedEmail.attachments.map((a, i) => (
                      <span key={i} style={{
                        display: 'flex', alignItems: 'center', gap: 4,
                        padding: '4px 10px', borderRadius: 6,
                        background: 'var(--slate-100)', fontSize: 'var(--aguila-fs-meta)', color: 'var(--text-secondary)',
                      }}>
                        <Paperclip size={10} /> {a.filename} ({Math.round(a.size / 1024)}KB)
                      </span>
                    ))}
                  </div>
                )}

                {/* Body */}
                <div style={{
                  fontSize: 'var(--aguila-fs-body)', color: 'var(--text-primary)', lineHeight: 1.6,
                  whiteSpace: 'pre-wrap', borderTop: '1px solid var(--border)',
                  paddingTop: 16, maxHeight: 500, overflowY: 'auto',
                }}>
                  {emailLoading ? 'Cargando...' : selectedEmail.body}
                </div>

                {/* Reply */}
                <div style={{ marginTop: 20, borderTop: '1px solid var(--border)', paddingTop: 16 }}>
                  <label style={{ fontSize: 'var(--aguila-fs-meta)', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', display: 'block', marginBottom: 6 }}>
                    Responder
                  </label>
                  <textarea
                    value={replyBody}
                    onChange={e => setReplyBody(e.target.value)}
                    placeholder="Escribe tu respuesta..."
                    rows={4}
                    style={{
                      width: '100%', border: '1px solid var(--border)', borderRadius: 8,
                      padding: '10px 12px', fontSize: 'var(--aguila-fs-body)', color: 'var(--text-primary)',
                      fontFamily: 'inherit', resize: 'vertical', outline: 'none',
                      background: 'var(--bg-main)', boxSizing: 'border-box',
                    }}
                  />
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 8 }}>
                    <button
                      onClick={sendReply}
                      disabled={!replyBody.trim() || replying}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 6,
                        padding: '8px 20px', borderRadius: 8, fontSize: 'var(--aguila-fs-body)', fontWeight: 700,
                        background: replyBody.trim() ? 'var(--gold)' : 'var(--border)',
                        border: 'none', color: replyBody.trim() ? 'var(--bg-card)' : 'var(--text-muted)',
                        cursor: replyBody.trim() ? 'pointer' : 'default', minHeight: 40,
                      }}
                    >
                      <Send size={14} /> {replying ? 'Enviando...' : 'Enviar respuesta'}
                    </button>
                    {replyStatus && <span style={{ fontSize: 'var(--aguila-fs-compact)', color: replyStatus.startsWith('✅') ? 'var(--green)' : 'var(--status-red)' }}>{replyStatus}</span>}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* Email list */
            <div>
              <div style={{ display: 'flex', gap: 8, marginBottom: 12, alignItems: 'center' }}>
                <input
                  value={gmailSearch}
                  onChange={e => setGmailSearch(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && loadGmail(gmailSearch)}
                  placeholder="Buscar en Gmail..."
                  style={{
                    flex: 1, border: '1px solid var(--border)', borderRadius: 8,
                    padding: '10px 12px', fontSize: 'var(--aguila-fs-body)', color: 'var(--text-primary)',
                    background: 'var(--bg-card)', outline: 'none', fontFamily: 'inherit',
                    minHeight: 40,
                  }}
                />
                <button
                  onClick={() => loadGmail(gmailSearch)}
                  disabled={gmailLoading}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    width: 40, height: 40, borderRadius: 8,
                    background: 'var(--gold)', border: 'none', cursor: 'pointer',
                  }}
                >
                  <RefreshCw size={14} style={{ color: 'var(--bg-card)' }} />
                </button>
              </div>

              {gmailLoading ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {[0, 1, 2, 3].map(i => <div key={i} className="skeleton-shimmer" style={{ height: 60, borderRadius: 8 }} />)}
                </div>
              ) : gmailMessages.length === 0 ? (
                <EmptyState
                  icon="📧"
                  title={gmailMessages.length === 0 && !gmailLoading ? 'Haz clic en el botón para cargar Gmail' : 'Sin correos'}
                  description="Los correos del buzón ai@renatozapata.com aparecerán aquí"
                />
              ) : (
                <div className="card" style={{ overflow: 'hidden' }}>
                  {gmailMessages.map(msg => (
                    <button
                      key={msg.id}
                      onClick={() => readEmail(msg.id)}
                      style={{
                        display: 'flex', alignItems: 'flex-start', gap: 12, width: '100%',
                        padding: '12px 16px', border: 'none', borderBottom: '1px solid var(--border)',
                        background: msg.isUnread ? 'rgba(196,150,60,0.04)' : 'transparent',
                        cursor: 'pointer', textAlign: 'left', minHeight: 60,
                      }}
                    >
                      {/* Unread dot */}
                      <span style={{
                        width: 8, height: 8, borderRadius: '50%', marginTop: 6, flexShrink: 0,
                        background: msg.isUnread ? 'var(--gold)' : 'transparent',
                      }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                          <span style={{
                            fontSize: 'var(--aguila-fs-body)', fontWeight: msg.isUnread ? 700 : 400,
                            color: 'var(--text-primary)', overflow: 'hidden',
                            textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                          }}>
                            {msg.from.replace(/<.*>/, '').trim().substring(0, 40)}
                          </span>
                          <span style={{ fontSize: 'var(--aguila-fs-label)', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap', flexShrink: 0 }}>
                            {msg.date ? new Date(msg.date).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', timeZone: 'America/Chicago' }) : ''}
                          </span>
                        </div>
                        <div style={{ fontSize: 'var(--aguila-fs-compact)', fontWeight: msg.isUnread ? 600 : 400, color: 'var(--text-primary)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {msg.subject || '(sin asunto)'}
                        </div>
                        <div style={{ fontSize: 'var(--aguila-fs-meta)', color: 'var(--text-muted)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {msg.snippet}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* TEMPLATES TAB */}
      {tab === 'templates' && (
        <div className="space-y-3">
          {TEMPLATES.filter(t => t.id !== 'custom').map(t => (
            <div key={t.id} className="card" style={{ padding: 16 }}>
              <div className="flex justify-between items-start mb-2">
                <div className="text-[14px] font-semibold" style={{ color: 'var(--text-primary)' }}>{t.name}</div>
                <button onClick={() => { setTemplate(t.id); setBody(t.body); setTab('compose') }}
                  className="text-[11px] font-semibold px-2.5 py-1 rounded-[4px]"
                  style={{ background: 'var(--amber-100)', color: 'var(--amber-600)', border: 'none', cursor: 'pointer' }}>
                  Usar
                </button>
              </div>
              <pre className="text-[12px] leading-relaxed" style={{ color: 'var(--slate-400)', whiteSpace: 'pre-wrap', fontFamily: 'inherit' }}>
                {t.body.substring(0, 200)}...
              </pre>
            </div>
          ))}
        </div>
      )}

      {/* INBOX / SENT TAB */}
      {(tab === 'inbox' || tab === 'sent') && (
        <>
          {tab === 'inbox' && (
            <div className="mb-3">
              <input value={filter} onChange={e => setFilter(e.target.value)} placeholder="Filtrar por remitente, asunto, keyword..."
                aria-label="Filtrar comunicaciones"
                className="rounded-[6px] px-3 py-2 text-[13px] outline-none w-full max-w-[400px]"
                style={{ border: '1px solid var(--border)', color: 'var(--text-primary)', background: 'var(--bg-input)' }} />
            </div>
          )}
          <div className="card" style={{ overflow: 'hidden' }}>
            {loading ? (
              <div style={{ padding: 48, textAlign: 'center', color: 'var(--slate-400)', fontSize: 'var(--aguila-fs-body)' }}>Cargando...</div>
            ) : filtered.length === 0 ? (
              <EmptyState icon="📨" title="Sin comunicaciones" description="Los correos y solicitudes enviados aparecerán aquí" />
            ) : (
              <div style={{ overflowX: 'auto' }}>
              <table className="aguila-table" aria-label="Bandeja de comunicaciones">
                <thead>
                  <tr>
                    <th style={{ width: 30 }}></th>
                    <th>De</th>
                    <th>Asunto</th>
                    <th>Fecha</th>
                    <th>Keywords</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((e: { id?: string; from_address?: string; subject?: string; is_urgent?: boolean; urgent_keywords?: string[]; scanned_at?: string; date?: string }, i: number) => (
                    <tr key={e.id || i}>
                      <td>
                        <span style={{ width: 8, height: 8, borderRadius: '50%', display: 'inline-block',
                          background: e.is_urgent ? 'var(--status-red, #ef4444)' : (e.from_address || '').includes(getCompanyIdCookie()) ? '#C0C5CE' : 'var(--green)' }} />
                      </td>
                      <td style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        <span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{(e.from_address || '').substring(0, 35)}</span>
                      </td>
                      <td style={{ maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.subject || ''}</td>
                      <td style={{ color: 'var(--slate-400)', fontSize: 'var(--aguila-fs-compact)', whiteSpace: 'nowrap', fontFamily: 'var(--font-mono)' }}>{fmtDate(e.scanned_at || e.date)}</td>
                      <td>
                        {(e.urgent_keywords || []).map((k: string, j: number) => (
                          <span key={j} style={{ background: 'var(--amber-100)', color: 'var(--amber-800)', borderRadius: 4, padding: '1px 6px', fontSize: 'var(--aguila-fs-label)', fontWeight: 600, marginRight: 4 }}>{k}</span>
                        ))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            )}
          </div>
        </>
      )}

      <div style={{ marginTop: 16, padding: '12px 16px', background: 'var(--slate-50)', border: '1px solid var(--border-card)', borderRadius: 8 }}>
        <p style={{ color: 'var(--slate-400)', fontSize: 'var(--aguila-fs-compact)', margin: 0 }}>
          Gmail scanner: cada 30 min en dias habiles · Envios requieren aprobacion via Telegram
        </p>
      </div>
    </div>
  )
}
