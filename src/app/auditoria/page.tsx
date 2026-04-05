'use client'

import { useEffect, useState, useMemo } from 'react'
import { createClient } from '@supabase/supabase-js'
import { getCookieValue } from '@/lib/client-config'
import { fmtDateTime } from '@/lib/format-utils'
import { EmptyState } from '@/components/ui/EmptyState'
import { Search, Download, Shield } from 'lucide-react'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

interface AuditRow {
  id: number
  action: string
  resource: string | null
  resource_id: string | null
  user_id: string | null
  diff: Record<string, unknown> | null
  ip: string | null
  created_at: string
  // Alternative fields from scripts
  actor?: string | null
  details?: Record<string, unknown> | null
  timestamp?: string | null
}

const ACTION_LABELS: Record<string, string> = {
  draft_approved: 'Borrador aprobado',
  draft_approved_telegram: 'Aprobado via Telegram',
  draft_rejected_telegram: 'Rechazado via Telegram',
  draft_corrected_telegram: 'Corregido via Telegram',
  draft_approval_cancelled_telegram: 'Aprobación cancelada',
  draft_filed: 'Borrador transmitido',
  email_intake_draft_created: 'Borrador creado (email)',
  oca_generated: 'OCA generada',
  client_onboarded: 'Cliente registrado',
  anomaly_resolved: 'Anomalía resuelta',
  test_probe: 'Prueba del sistema',
}

const ACTION_COLORS: Record<string, string> = {
  draft_approved: '#16A34A',
  draft_approved_telegram: '#16A34A',
  draft_filed: '#0D9488',
  draft_rejected_telegram: '#DC2626',
  draft_corrected_telegram: '#D97706',
  oca_generated: '#7E22CE',
  client_onboarded: '#C4963C',
  anomaly_resolved: '#2563EB',
}

export default function AuditoriaPage() {
  const [rows, setRows] = useState<AuditRow[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [actionFilter, setActionFilter] = useState('')
  const [actorFilter, setActorFilter] = useState('')

  const role = getCookieValue('user_role')
  const isBroker = role === 'broker' || role === 'admin'

  useEffect(() => {
    supabase
      .from('audit_log')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(500)
      .then(({ data }) => {
        setRows((data || []) as AuditRow[])
        setLoading(false)
      })
  }, [])

  // Unique actions and actors for filters
  const actions = useMemo(() => {
    const set = new Set<string>()
    rows.forEach(r => set.add(r.action))
    return Array.from(set).sort()
  }, [rows])

  const actors = useMemo(() => {
    const set = new Set<string>()
    rows.forEach(r => { const a = r.actor || r.user_id || 'system'; set.add(a) })
    return Array.from(set).sort()
  }, [rows])

  const filtered = useMemo(() => {
    let f = rows
    if (actionFilter) f = f.filter(r => r.action === actionFilter)
    if (actorFilter) f = f.filter(r => (r.actor || r.user_id || 'system') === actorFilter)
    if (search.trim()) {
      const q = search.toLowerCase()
      f = f.filter(r =>
        r.action.toLowerCase().includes(q) ||
        (r.resource_id || '').toLowerCase().includes(q) ||
        JSON.stringify(r.diff || r.details || '').toLowerCase().includes(q)
      )
    }
    return f
  }, [rows, actionFilter, actorFilter, search])

  function exportCSV() {
    const header = 'ID,Fecha,Acción,Actor,Recurso,ID Recurso,Detalles'
    const lines = filtered.map(r => {
      const actor = r.actor || r.user_id || 'system'
      const details = JSON.stringify(r.diff || r.details || {}).replace(/"/g, '""')
      return `${r.id},"${r.created_at}","${r.action}","${actor}","${r.resource || ''}","${r.resource_id || ''}","${details}"`
    })
    const csv = [header, ...lines].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = `audit_log_${new Date().toISOString().split('T')[0]}.csv`; a.click()
    URL.revokeObjectURL(url)
  }

  if (!isBroker) return <EmptyState icon="🔒" title="Acceso restringido" description="Solo para uso interno — Patente 3596" />

  return (
    <div style={{ padding: '24px 16px', maxWidth: 1100, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: '#1A1A1A', margin: 0 }}>Auditoría</h1>
          <p style={{ fontSize: 13, color: '#6B6B6B', margin: '4px 0 0' }}>
            {filtered.length} registros · Registro inmutable
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px',
            background: 'rgba(13,148,136,0.08)', border: '1px solid rgba(13,148,136,0.2)',
            borderRadius: 8, fontSize: 11, fontWeight: 700, color: '#0D9488',
          }}>
            <Shield size={12} /> SAT Compliant · Patente 3596 · Aduana 240
          </div>
          <button onClick={exportCSV} style={{
            display: 'flex', alignItems: 'center', gap: 4, padding: '8px 16px',
            borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer',
            background: '#C4963C', border: 'none', color: '#FFFFFF', minHeight: 36,
          }}>
            <Download size={14} /> Exportar CSV
          </button>
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6, padding: '0 12px', height: 40,
          background: '#FFFFFF', border: '1px solid #E8E5E0', borderRadius: 8, flex: 1, maxWidth: 300,
        }}>
          <Search size={14} style={{ color: '#9B9B9B' }} />
          <input
            placeholder="Buscar en auditoría..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', fontSize: 13, color: '#1A1A1A' }}
          />
        </div>
        <select
          value={actionFilter}
          onChange={e => setActionFilter(e.target.value)}
          style={{ height: 40, padding: '0 12px', borderRadius: 8, border: '1px solid #E8E5E0', fontSize: 12, color: '#1A1A1A', cursor: 'pointer', background: '#FFFFFF' }}
        >
          <option value="">Todas las acciones</option>
          {actions.map(a => <option key={a} value={a}>{ACTION_LABELS[a] || a}</option>)}
        </select>
        <select
          value={actorFilter}
          onChange={e => setActorFilter(e.target.value)}
          style={{ height: 40, padding: '0 12px', borderRadius: 8, border: '1px solid #E8E5E0', fontSize: 12, color: '#1A1A1A', cursor: 'pointer', background: '#FFFFFF' }}
        >
          <option value="">Todos los actores</option>
          {actors.map(a => <option key={a} value={a}>{a}</option>)}
        </select>
      </div>

      {/* Table */}
      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {[0, 1, 2, 3, 4].map(i => <div key={i} className="skeleton-shimmer" style={{ height: 56, borderRadius: 4 }} />)}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState icon="📋" title="Sin registros" description="No hay entradas en el log de auditoría para los filtros seleccionados" />
      ) : (
        <div style={{ background: '#FFFFFF', border: '1px solid #E8E5E0', borderRadius: 8, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #E8E5E0' }}>
                  <th style={{ padding: '10px 16px', textAlign: 'left', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#9B9B9B' }}>Fecha</th>
                  <th style={{ padding: '10px 12px', textAlign: 'left', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#9B9B9B' }}>Acción</th>
                  <th style={{ padding: '10px 12px', textAlign: 'left', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#9B9B9B' }}>Actor</th>
                  <th style={{ padding: '10px 12px', textAlign: 'left', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#9B9B9B' }}>Recurso</th>
                  <th style={{ padding: '10px 12px', textAlign: 'left', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#9B9B9B' }}>Detalles</th>
                </tr>
              </thead>
              <tbody>
                {filtered.slice(0, 100).map(r => {
                  const actor = r.actor || r.user_id || 'system'
                  const color = ACTION_COLORS[r.action] || '#475569'
                  const details = r.diff || r.details
                  const detailStr = details ? Object.entries(details).filter(([, v]) => v != null).map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : v}`).slice(0, 3).join(' · ') : ''
                  return (
                    <tr key={r.id} style={{ borderBottom: '1px solid #E8E5E0' }}>
                      <td style={{ padding: '10px 16px', fontFamily: 'var(--font-mono)', fontSize: 11, color: '#6B6B6B', whiteSpace: 'nowrap' }}>
                        {fmtDateTime(r.timestamp || r.created_at)}
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        <span style={{
                          fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 4,
                          background: `${color}15`, color,
                        }}>
                          {ACTION_LABELS[r.action] || r.action}
                        </span>
                      </td>
                      <td style={{ padding: '10px 12px', fontSize: 12, color: '#1A1A1A', fontWeight: 500 }}>
                        {actor}
                      </td>
                      <td style={{ padding: '10px 12px', fontSize: 12, fontFamily: 'var(--font-mono)', color: '#6B6B6B' }}>
                        {r.resource_id ? `${r.resource || ''} ${String(r.resource_id).substring(0, 12)}` : '—'}
                      </td>
                      <td style={{ padding: '10px 12px', fontSize: 11, color: '#9B9B9B', maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {detailStr || '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          {filtered.length > 100 && (
            <div style={{ padding: '12px 16px', borderTop: '1px solid #E8E5E0', fontSize: 12, color: '#9B9B9B', textAlign: 'center' }}>
              Mostrando 100 de {filtered.length} · Exporta CSV para ver todos
            </div>
          )}
        </div>
      )}

      {/* Footer */}
      <div style={{ marginTop: 24, textAlign: 'center', fontSize: 11, color: '#9B9B9B' }}>
        Registro inmutable · Append-only · Sin edición ni eliminación
        <br />Patente 3596 · Aduana 240 · Renato Zapata &amp; Company
      </div>
    </div>
  )
}
