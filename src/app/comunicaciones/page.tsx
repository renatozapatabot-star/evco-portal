'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'
import { Send, Inbox, FileText, PenLine, X } from 'lucide-react'
import { COMPANY_ID } from '@/lib/client-config'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

const RECIPIENTS = [
  { name: 'Ursula Banda', email: 'ursula@evco.com', role: 'Operaciones EVCO' },
  { name: 'EVCO General', email: 'info@evcoplastics.com', role: 'Cliente' },
  { name: 'Renato Zapata III', email: 'ai@renatozapata.com', role: 'Director General' },
]

const TEMPLATES = [
  { id: 'doc_request', name: 'Solicitud de Documentos', body: 'Estimado(a) {recipient},\n\nPor medio de la presente, le solicito los siguientes documentos para el trafico {trafico}:\n\n- Factura comercial\n- Packing list\n- Bill of Lading\n\nAgradezco su pronta respuesta.\n\nAtentamente,\nRenato Zapata & Company' },
  { id: 'status_update', name: 'Actualizacion de Estado', body: 'Estimado(a) {recipient},\n\nLe informo sobre el estado actual de sus operaciones:\n\n{status_details}\n\nQuedamos a sus ordenes.\n\nRenato Zapata & Company' },
  { id: 'compliance_notice', name: 'Aviso de Cumplimiento', body: 'AVISO DE CUMPLIMIENTO\n\n{recipient},\n\nSe le notifica que la siguiente obligacion esta proxima a vencer:\n\n{compliance_details}\n\nFavor de tomar accion antes de la fecha limite.\n\nRenato Zapata & Company' },
  { id: 'weekly_summary', name: 'Resumen Semanal', body: 'Estimado(a) {recipient},\n\nAdjunto el resumen semanal de operaciones.\n\n{summary}\n\nRenato Zapata & Company' },
  { id: 'custom', name: 'Personalizado', body: '' },
]

type Tab = 'inbox' | 'compose' | 'sent' | 'templates'

export default function ComunicacionesPage() {
  const [events, setEvents] = useState<any[]>([])
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

  async function draftWithCRUZ() {
    setDrafting(true)
    try {
      const res = await fetch('/api/chat', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{ role: 'user', content: `Redacta un email profesional bilingue (espanol primario) para ${recipient || 'el cliente'} sobre: ${subject || 'operaciones aduanales'}. ${body ? 'Contexto adicional: ' + body : ''}. Firma como Renato Zapata & Company.` }]
        })
      })
      const data = await res.json()
      setBody(data.content || data.message || body)
    } catch {}
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

  function fmtDate(d: string) {
    if (!d) return ''
    try { return new Date(d).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) }
    catch { return d }
  }

  const tabs: { key: Tab; label: string; icon: any }[] = [
    { key: 'inbox', label: `Bandeja (${events.length})`, icon: Inbox },
    { key: 'compose', label: 'Redactar', icon: PenLine },
    { key: 'sent', label: 'Enviados', icon: Send },
    { key: 'templates', label: 'Plantillas', icon: FileText },
  ]

  return (
    <div style={{ padding: 32 }}>
      <div style={{ marginBottom: 24 }}>
        <h1 className="pg-title">Centro de Comunicaciones</h1>
        <p className="pg-meta">{events.length} eventos · {urgentCount} urgentes · Email Intelligence</p>
      </div>

      {/* Tab bar */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20 }}>
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
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="text-[10.5px] font-semibold uppercase tracking-[0.07em] mb-1 block" style={{ color: 'var(--text-muted)' }}>Destinatario</label>
              <select value={recipient} onChange={e => setRecipient(e.target.value)}
                className="w-full rounded-[6px] px-3 py-2 text-[13px] outline-none"
                style={{ border: '1px solid var(--border)', color: 'var(--text-primary)', background: 'var(--bg-input)' }}>
                <option value="">Seleccionar...</option>
                {RECIPIENTS.map(r => <option key={r.email} value={r.email}>{r.name} — {r.role}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[10.5px] font-semibold uppercase tracking-[0.07em] mb-1 block" style={{ color: 'var(--text-muted)' }}>Plantilla</label>
              <select value={template} onChange={e => selectTemplate(e.target.value)}
                className="w-full rounded-[6px] px-3 py-2 text-[13px] outline-none"
                style={{ border: '1px solid var(--border)', color: 'var(--text-primary)', background: 'var(--bg-input)' }}>
                <option value="">Sin plantilla</option>
                {TEMPLATES.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
          </div>

          <div className="mb-4">
            <label className="text-[10.5px] font-semibold uppercase tracking-[0.07em] mb-1 block" style={{ color: 'var(--text-muted)' }}>Asunto</label>
            <input value={subject} onChange={e => setSubject(e.target.value)} placeholder="Asunto del mensaje"
              className="w-full rounded-[6px] px-3 py-2 text-[13px] outline-none"
              style={{ border: '1px solid var(--border)', color: 'var(--text-primary)', background: 'var(--bg-input)' }} />
          </div>

          <div className="mb-4">
            <div className="flex justify-between items-center mb-1">
              <label className="text-[10.5px] font-semibold uppercase tracking-[0.07em]" style={{ color: 'var(--text-muted)' }}>Mensaje</label>
              <button onClick={draftWithCRUZ} disabled={drafting}
                className="flex items-center gap-1.5 px-3 py-1 rounded-[4px] text-[11px] font-semibold"
                style={{ background: 'var(--amber-100)', color: 'var(--amber-600)', border: '1px solid var(--amber-200)', cursor: 'pointer' }}>
                {drafting ? 'Redactando...' : '🦀 Redactar con CRUZ'}
              </button>
            </div>
            <textarea value={body} onChange={e => setBody(e.target.value)} rows={12}
              className="w-full rounded-[6px] px-3 py-2 text-[13px] outline-none leading-relaxed"
              style={{ border: '1px solid var(--border)', color: 'var(--text-primary)', background: 'var(--bg-input)', fontFamily: 'inherit', resize: 'vertical' }} />
          </div>

          <div className="flex items-center gap-3">
            <button onClick={handleSend}
              className="flex items-center gap-2 px-4 py-2.5 rounded-[6px] text-[13px] font-semibold"
              style={{ background: 'var(--amber-600)', color: '#fff', border: 'none', cursor: 'pointer' }}>
              <Send size={14} /> Aprobar y Enviar
            </button>
            <button className="px-4 py-2.5 rounded-[6px] text-[13px] font-medium"
              style={{ background: 'var(--bg-elevated)', color: 'var(--text-secondary)', border: '1px solid var(--border)', cursor: 'pointer' }}>
              Guardar Borrador
            </button>
            {sendStatus && <span className="text-[12px] font-medium" style={{ color: 'var(--green)' }}>{sendStatus}</span>}
          </div>
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
              <pre className="text-[12px] leading-relaxed" style={{ color: 'var(--text-muted)', whiteSpace: 'pre-wrap', fontFamily: 'inherit' }}>
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
                className="rounded-[6px] px-3 py-2 text-[13px] outline-none w-full max-w-[400px]"
                style={{ border: '1px solid var(--border)', color: 'var(--text-primary)', background: 'var(--bg-input)' }} />
            </div>
          )}
          <div className="card" style={{ overflow: 'hidden' }}>
            {loading ? (
              <div style={{ padding: 48, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>Cargando...</div>
            ) : filtered.length === 0 ? (
              <div style={{ padding: 48, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>Sin comunicaciones en esta vista.</div>
            ) : (
              <table className="data-table">
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
                  {filtered.map((e: any, i: number) => (
                    <tr key={e.id || i}>
                      <td>
                        <span style={{ width: 8, height: 8, borderRadius: '50%', display: 'inline-block',
                          background: e.is_urgent ? 'var(--status-red, #ef4444)' : (e.from_address || '').includes(COMPANY_ID) ? '#3b82f6' : 'var(--green)' }} />
                      </td>
                      <td style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        <span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{(e.from_address || '').substring(0, 35)}</span>
                      </td>
                      <td style={{ maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.subject || ''}</td>
                      <td style={{ color: 'var(--text-muted)', fontSize: 12, whiteSpace: 'nowrap' }}>{fmtDate(e.scanned_at || e.date)}</td>
                      <td>
                        {(e.urgent_keywords || []).map((k: string, j: number) => (
                          <span key={j} style={{ background: 'var(--amber-100)', color: 'var(--amber-800)', borderRadius: 4, padding: '1px 6px', fontSize: 10, fontWeight: 600, marginRight: 4 }}>{k}</span>
                        ))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}

      <div style={{ marginTop: 16, padding: '12px 16px', background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', borderRadius: 8 }}>
        <p style={{ color: 'var(--text-muted)', fontSize: 12, margin: 0 }}>
          Gmail scanner: cada 30 min en dias habiles · Envios requieren aprobacion via Telegram
        </p>
      </div>
    </div>
  )
}
