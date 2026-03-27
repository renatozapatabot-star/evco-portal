'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

export default function ComunicacionesPage() {
  const [events, setEvents] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'all' | 'urgent' | 'sent'>('all')

  useEffect(() => {
    supabase.from('communication_events').select('*').order('scanned_at', { ascending: false }).limit(100)
      .then(({ data }) => { setEvents(data || []); setLoading(false) })
      .then(undefined, () => setLoading(false))
  }, [])

  const filtered = tab === 'all' ? events : tab === 'urgent' ? events.filter(e => e.is_urgent) : events.filter(e => (e.from_address || '').includes('renatozapata'))
  const urgentCount = events.filter(e => e.is_urgent).length

  function fmtDate(d: string) {
    if (!d) return '—'
    try { return new Date(d).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) } catch { return d }
  }

  return (
    <div style={{ padding: 32 }}>
      <div style={{ marginBottom: 24 }}>
        <h1 className="pg-title">Comunicaciones</h1>
        <p className="pg-meta">{events.length} eventos · {urgentCount} urgentes · Email Intelligence</p>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20 }}>
        {([['all', 'Todos'], ['urgent', 'Urgentes'], ['sent', 'Enviados']] as const).map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)}
            className="tab-btn" style={tab === key ? { background: 'var(--amber-100)', color: 'var(--amber-800)', border: '1px solid var(--amber-200)' } : {}}>
            {label} {key === 'urgent' && urgentCount > 0 ? `(${urgentCount})` : ''}
          </button>
        ))}
      </div>

      <div className="card" style={{ overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: 48, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>Cargando comunicaciones...</div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 48, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
            {tab === 'all' ? 'Sin comunicaciones registradas. El scanner de Gmail poblará esta vista automáticamente.' : 'Sin elementos en esta categoría.'}
          </div>
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
              {filtered.map((e, i) => (
                <tr key={e.id || i}>
                  <td>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', display: 'inline-block',
                      background: e.is_urgent ? 'var(--status-red)' : (e.from_address || '').includes('evco') ? 'var(--status-blue)' : 'var(--status-green)' }} />
                  </td>
                  <td style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    <span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{(e.from_address || '—').substring(0, 35)}</span>
                  </td>
                  <td style={{ maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {e.subject || '—'}
                  </td>
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

      <div style={{ marginTop: 16, padding: '12px 16px', background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', borderRadius: 8 }}>
        <p style={{ color: 'var(--text-muted)', fontSize: 12, margin: 0 }}>
          📧 Gmail scanner runs every 30 min on business days · All outbound emails require approval via Telegram before sending
        </p>
      </div>
    </div>
  )
}
